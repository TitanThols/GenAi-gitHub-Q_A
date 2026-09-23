import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { simpleGit } from 'simple-git';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { randomUUID } from 'crypto';

import { Repo, RepoStatus } from '../repos/repo.entity';
import { ChunkerService, CodeChunk } from '../chunker/chunker.service';
import { EmbeddingService } from '../embedding/embedding.service';
import { VectorStoreService, VectorPoint } from '../vector-store/vector-store.service';

const SUPPORTED_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.py']);
const IGNORED_DIRS = new Set([
    'node_modules',
    '.git',
    'dist',
    'build',
    '.next',
    'coverage',
    'venv',
    '.venv',
    '__pycache__',
    '.idea',
    '.vscode',
]);

const MAX_FILE_SIZE = 500 * 1024;

@Processor('ingestion')
export class IngestionProcessor extends WorkerHost {
    private readonly logger = new Logger(IngestionProcessor.name);

    constructor(
        @InjectRepository(Repo)
        private readonly repoRepository: Repository<Repo>,
        private readonly chunkerService: ChunkerService,
        private readonly embeddingService: EmbeddingService,
        private readonly vectorStoreService: VectorStoreService,
    ) {
        super();
    }

    async process(job: Job<{ repoId: string; url: string }>): Promise<void> {
        const { repoId, url } = job.data;
        const tempDir = path.join(os.tmpdir(), 'repos', repoId);

        this.logger.log(`Starting ingestion for repo ${repoId} (${url})`);

        const repo = await this.repoRepository.findOneBy({ id: repoId });
        if (!repo) {
            throw new Error(`Repo with ID ${repoId} not found in database.`);
        }

        try {
            await this.updateStatus(repo, RepoStatus.CLONING);
            await fs.promises.rm(tempDir, { recursive: true, force: true });
            await fs.promises.mkdir(tempDir, { recursive: true });

            const git = simpleGit();
            await git.clone(url, tempDir, ['--depth=1', '--single-branch']);

            await this.updateStatus(repo, RepoStatus.CHUNKING);
            const filePaths: string[] = [];
            this.collectFiles(tempDir, filePaths);

            if (filePaths.length === 0) {
                throw new Error('No supported TypeScript, JavaScript, or Python files found in repository.');
            }

            const allChunks: { chunk: CodeChunk; relativePath: string }[] = [];

            for (const filePath of filePaths) {
                const relativePath = path.relative(tempDir, filePath);
                const content = fs.readFileSync(filePath, 'utf-8');
                const chunks = this.chunkerService.chunkFile(relativePath, content);

                for (const chunk of chunks) {
                    allChunks.push({ chunk, relativePath });
                }
            }

            this.logger.log(
                `Repo ${repoId}: Discovered ${filePaths.length} files, generated ${allChunks.length} chunks.`,
            );

            await this.updateStatus(repo, RepoStatus.EMBEDDING, {
                totalFiles: filePaths.length,
                totalChunks: allChunks.length,
            });

            const batchSize = 50;
            for (let i = 0; i < allChunks.length; i += batchSize) {
                const batch = allChunks.slice(i, i + batchSize);

                const textsToEmbed = batch.map(
                    ({ chunk, relativePath }) =>
                        `// File: ${relativePath}\n// Type: ${chunk.type} ${chunk.name}${chunk.parentClass ? ` (in ${chunk.parentClass})` : ''
                        }\n${chunk.content}`,
                );

                const vectors = await this.embeddingService.embedBatch(textsToEmbed);

                const points: VectorPoint[] = batch.map(({ chunk, relativePath }, index) => ({
                    id: randomUUID(),
                    vector: vectors[index],
                    payload: {
                        repoId,
                        filePath: relativePath,
                        startLine: chunk.startLine,
                        endLine: chunk.endLine,
                        type: chunk.type,
                        name: chunk.name,
                        parentClass: chunk.parentClass,
                        content: chunk.content,
                    },
                }));

                await this.vectorStoreService.upsertPoints(points);
                this.logger.log(
                    `Repo ${repoId}: Upserted chunks ${i + 1} to ${Math.min(i + batchSize, allChunks.length)} of ${allChunks.length}`,
                );
            }

            await this.updateStatus(repo, RepoStatus.INDEXED);
            this.logger.log(`Repo ${repoId} successfully indexed!`);
        } catch (error: any) {
            this.logger.error(`Ingestion failed for repo ${repoId}`, error);
            await this.updateStatus(repo, RepoStatus.FAILED, {
                errorMessage: error?.message || 'Unknown ingestion error occurred',
            });
            throw error;
        } finally {
            await fs.promises.rm(tempDir, { recursive: true, force: true }).catch((err) => {
                this.logger.warn(`Failed to clean up temp dir ${tempDir}`, err);
            });
        }
    }

    private collectFiles(dir: string, fileList: string[]): void {
        const entries = fs.readdirSync(dir, { withFileTypes: true });

        for (const entry of entries) {
            if (IGNORED_DIRS.has(entry.name)) {
                continue;
            }

            const fullPath = path.join(dir, entry.name);

            if (entry.isDirectory()) {
                this.collectFiles(fullPath, fileList);
            } else if (entry.isFile()) {
                const ext = path.extname(entry.name).toLowerCase();
                if (SUPPORTED_EXTENSIONS.has(ext)) {
                    const stats = fs.statSync(fullPath);
                    if (stats.size <= MAX_FILE_SIZE) {
                        fileList.push(fullPath);
                    }
                }
            }
        }
    }

    private async updateStatus(
        repo: Repo,
        status: RepoStatus,
        extraFields?: Partial<Repo>,
    ): Promise<void> {
        repo.status = status;
        if (extraFields) {
            Object.assign(repo, extraFields);
        }
        await this.repoRepository.save(repo);
    }
}
