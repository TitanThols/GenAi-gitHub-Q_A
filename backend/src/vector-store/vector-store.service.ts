import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QdrantClient } from '@qdrant/js-client-rest';
import { CodeChunk } from '../chunker/chunker.service';
import { performance } from 'node:perf_hooks';

export interface VectorPoint {
    id: string;
    vector: number[];
    payload: {
        repoId: string;
        filePath: string;
        startLine: number;
        endLine: number;
        type: string;
        name?: string;
        parentClass?: string;
        content: string;
        [key: string]: any;
    };
}

@Injectable()
export class VectorStoreService implements OnModuleInit {
    private readonly logger = new Logger(VectorStoreService.name);
    private readonly client: QdrantClient;
    public readonly collectionName = 'codebase-embeddings-openai-v1';
    public readonly vectorDimension = 1536;

    constructor(private readonly configService: ConfigService) {
        const url = this.configService.get<string>('QDRANT_URL') || 'http://localhost:6333';
        this.client = new QdrantClient({
            url,
            checkCompatibility: false,
        });
    }

    async onModuleInit() {
        await this.ensureCollection();
    }

    async ensureCollection(): Promise<void> {
        try {
            const exists = await this.client.collectionExists(this.collectionName);
            if (!exists.exists) {
                this.logger.log(`Creating Qdrant collection '${this.collectionName}' with ${this.vectorDimension} dim...`);
                await this.client.createCollection(this.collectionName, {
                    vectors: {
                        size: this.vectorDimension,
                        distance: 'Cosine',
                    }
                });
                this.logger.log(`Collection '${this.collectionName}' created successfully.`);
            }
        } catch (error) {
            this.logger.warn(
                `Failed to verify or create collection '${this.collectionName}'. Is Qdrant running?`,
                error,
            );
        }
    }

    async upsertPoints(points: VectorPoint[]): Promise<void> {
        if (!points.length) return;

        const batchSize = 100;
        const startedAt = performance.now();
        let succeeded = false;
        try {
            for (let i = 0; i < points.length; i += batchSize) {
                const batch = points.slice(i, i + batchSize);
                await this.client.upsert(this.collectionName, {
                    wait: true,
                    points: batch.map((p) => ({
                        id: p.id,
                        vector: p.vector,
                        payload: p.payload,
                    })),
                });
            }
            succeeded = true;
        } finally {
            this.logger.log(
                JSON.stringify({
                    event: 'timing',
                    stage: 'qdrant_upsert',
                    collection: this.collectionName,
                    pointCount: points.length,
                    durationMs: Number((performance.now() - startedAt).toFixed(2)),
                    outcome: succeeded ? 'success' : 'failed',
                }),
            );
        }
    }

    async search(repoId: string, vector: number[], limit = 10) {
        const startedAt = performance.now();
        let resultCount = 0;
        let succeeded = false;
        try {
            const result = await this.client.query(this.collectionName, {
                query: vector,
                filter: {
                    must: [
                        {
                            key: 'repoId',
                            match: { value: repoId },
                        },
                    ],
                },
                limit,
                with_payload: true,
            });
            resultCount = result.points.length;
            succeeded = true;
            return result.points;
        } finally {
            this.logger.log(
                JSON.stringify({
                    event: 'timing',
                    stage: 'retrieval',
                    repoId,
                    limit,
                    resultCount,
                    durationMs: Number((performance.now() - startedAt).toFixed(2)),
                    outcome: succeeded ? 'success' : 'failed',
                }),
            );
        }
    }

    async deleteRepoPoints(repoId: string): Promise<void> {
        await this.client.delete(this.collectionName, {
            filter: {
                must: [
                    {
                        key: 'repoId',
                        match: { value: repoId }
                    },
                ],
            },
        });
    }

    async getFileChunks(repoId: string, filePath: string): Promise<CodeChunk[]> {
        const result = await this.client.scroll(this.collectionName, {
            filter: {
                must: [
                    { key: 'repoId', match: { value: repoId } },
                    { key: 'filePath', match: { value: filePath } },
                ],
            },
            limit: 500,
            with_payload: true,
            with_vector: false,
        });

        return result.points
            .map((p) => ({
                fileName: p.payload?.filePath as string,
                type: p.payload?.type as CodeChunk['type'],
                name: p.payload?.name as string,
                content: p.payload?.content as string,
                startLine: p.payload?.startLine as number,
                endLine: p.payload?.endLine as number,
                parentClass: p.payload?.parentClass as string | undefined,
            }))
            .sort((a, b) => a.startLine - b.startLine);
    }

    async listFiles(repoId: string): Promise<string[]> {
        const result = await this.client.scroll(this.collectionName, {
            filter: {
                must: [
                    { key: 'repoId', match: { value: repoId } },
                ],
            },
            limit: 10_000,
            with_payload: true,
            with_vector: false,
        });

        const seen = new Set<string>();
        for (const point of result.points) {
            const fp = point.payload?.filePath as string;
            if (fp) seen.add(fp);
        }
        return Array.from(seen).sort();
    }
}
 