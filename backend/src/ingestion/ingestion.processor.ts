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
import { performance } from 'node:perf_hooks';

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
        const ingestionStartedAt = performance.now();
        let indexedFileCount = 0;
        let indexedChunkCount = 0;
        let sourceCommit = '';
        let finalStatus: 'indexed' | 'failed' = 'failed';

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
            const cloneStartedAt = performance.now();
            await git.clone(url, tempDir, ['--depth=1', '--single-branch']);
            sourceCommit = await git.cwd(tempDir).revparse(['HEAD']);
            this.logger.log(
                JSON.stringify({
                    event: 'timing',
                    stage: 'repo_clone',
                    repoId,
                    sourceCommit,
                    durationMs: Number((performance.now() - cloneStartedAt).toFixed(2)),
                }),
            );

            await this.updateStatus(repo, RepoStatus.CHUNKING);
            const filePaths: string[] = [];
            const fileDiscoveryStartedAt = performance.now();
            this.collectFiles(tempDir, filePaths);
            indexedFileCount = filePaths.length;
            this.logger.log(
                JSON.stringify({
                    event: 'timing',
                    stage: 'file_discovery',
                    repoId,
                    durationMs: Number(
                        (performance.now() - fileDiscoveryStartedAt).toFixed(2),
                    ),
                    fileCount: indexedFileCount,
                }),
            );

            if (filePaths.length === 0) {
                throw new Error('No supported TypeScript, JavaScript, or Python files found in repository.');
            }

            const allChunks: { chunk: CodeChunk; relativePath: string }[] = [];

            const chunkingStartedAt = performance.now();
            for (const filePath of filePaths) {
                const relativePath = path.relative(tempDir, filePath);
                const content = fs.readFileSync(filePath, 'utf-8');
                const chunks = this.chunkerService.chunkFile(relativePath, content);

                for (const chunk of chunks) {
                    allChunks.push({ chunk, relativePath });
                }
            }
            indexedChunkCount = allChunks.length;
            this.logger.log(
                JSON.stringify({
                    event: 'timing',
                    stage: 'chunking',
                    repoId,
                    durationMs: Number((performance.now() - chunkingStartedAt).toFixed(2)),
                    fileCount: indexedFileCount,
                    chunkCount: indexedChunkCount,
                }),
            );

            this.logger.log(
                `Repo ${repoId}: Discovered ${indexedFileCount} files, generated ${indexedChunkCount} chunks.`,
            );

            await this.updateStatus(repo, RepoStatus.EMBEDDING, {
                totalFiles: indexedFileCount,
                totalChunks: indexedChunkCount,
            });

            const batchSize = 10;
            for (let i = 0; i < allChunks.length; i += batchSize) {
                const batch = allChunks.slice(i, i + batchSize);

                const textsToEmbed = batch.map(
                    ({ chunk, relativePath }) =>
                        `// File: ${relativePath}\n// Type: ${chunk.type} ${chunk.name}${chunk.parentClass ? ` (in ${chunk.parentClass})` : ''
                        }\n${chunk.content}`,
                );

                const embeddingStartedAt = performance.now();
                const vectors = await this.embeddingService.embedBatch(textsToEmbed);
                this.logger.log(
                    JSON.stringify({
                        event: 'timing',
                        stage: 'ingestion_embedding_batch',
                        repoId,
                        inputCount: textsToEmbed.length,
                        chunkOffset: i,
                        durationMs: Number(
                            (performance.now() - embeddingStartedAt).toFixed(2),
                        ),
                    }),
                );

                const points: VectorPoint[] = batch.map(({ chunk, relativePath }, index) => ({
                    id: randomUUID(),
                    vector: vectors[index],
                    payload: {
                        repoId,
                        sourceCommit,
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
            finalStatus = 'indexed';
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
            this.logger.log(
                JSON.stringify({
                    event: 'timing',
                    stage: 'total_indexing',
                    repoId,
                    status: finalStatus,
                    durationMs: Number((performance.now() - ingestionStartedAt).toFixed(2)),
                    fileCount: indexedFileCount,
                    chunkCount: indexedChunkCount,
                }),
            );
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
