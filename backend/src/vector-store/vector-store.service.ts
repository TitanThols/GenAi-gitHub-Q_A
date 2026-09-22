import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QdrantClient } from '@qdrant/js-client-rest';

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
    public readonly collectionName = 'codebase-embeddings';
    public readonly vectorDimension = 768;

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
                this.logger.log(`Creating Qdrant collection '${this.collectionName}' with ${this.vectorDimension} dim...`,);
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

    async search(repoId: string, vector: number[], limit = 10) {
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

        return result.points;
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

}