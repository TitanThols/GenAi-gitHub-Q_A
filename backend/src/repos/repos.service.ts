import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';

import { Repo, RepoStatus } from './repo.entity';
import { VectorStoreService } from '../vector-store/vector-store.service';

function extractRepoName(url: string): string {
    try {
        const cleaned = url.replace(/\.git$/, '').trim();
        const parsed = new URL(cleaned);
        const parts = parsed.pathname.split('/').filter(Boolean);
        if (parts.length >= 2) {
            return `${parts[parts.length - 2]}/${parts[parts.length - 1]}`;
        }
        return parts[0] || 'unknown-repo';
    } catch {
        const parts = url.split('/').filter(Boolean);
        return parts.pop() || 'unknown-repo';
    }
}

@Injectable()
export class ReposService {
    private readonly logger = new Logger(ReposService.name);

    constructor(
        @InjectRepository(Repo)
        private readonly repoRepository: Repository<Repo>,
        @InjectQueue('ingestion')
        private readonly ingestionQueue: Queue,
        private readonly vectorStoreService: VectorStoreService,
    ) { }

    async create(url: string, userId?: string): Promise<Repo> {
        if (!url || !url.startsWith('https://github.com')) {
            throw new BadRequestException('Invalid GitHub repository URL. Must start with https://github.com');
        }

        const repoName = extractRepoName(url);

        const existingRepo = await this.repoRepository.findOne({
            where: { name: repoName },
        });
        if (existingRepo) {
            throw new BadRequestException(`Repository ${repoName} already exists.`);
        }

        const repo = this.repoRepository.create({
            name: repoName,
            url,
            status: RepoStatus.PENDING,
            userId: userId || null,
        });

        const savedRepo = await this.repoRepository.save(repo);

        await this.ingestionQueue.add(
            'index-repo',
            {
                repoId: savedRepo.id,
                url: savedRepo.url,
            },
            {
                attempts: 2,
                backoff: {
                    type: 'exponential',
                    delay: 5000,
                },
            },
        );

        this.logger.log(`Enqueued ingestion job for repo ${savedRepo.id} (${savedRepo.name})`);
        return savedRepo;
    }

    async findAll(userId?: string): Promise<Repo[]> {
        if (userId) {
            return this.repoRepository.find({
                where: { userId },
                order: { createdAt: 'DESC' },
            });
        }
        return this.repoRepository.find({
            order: { createdAt: 'DESC' },
        });
    }

    async findOne(id: string): Promise<Repo> {
        const repo = await this.repoRepository.findOneBy({ id });
        if (!repo) {
            throw new NotFoundException(`Repository with ID '${id}' not found.`);
        }
        return repo;
    }

    async remove(id: string): Promise<{ success: boolean }> {
        const repo = await this.findOne(id);

        await this.vectorStoreService.deleteRepoPoints(id).catch((err) => {
            this.logger.warn(`Failed to delete Qdrant points for repo ${id}`, err);
        });
        await this.repoRepository.remove(repo);
        this.logger.log(`Deleted repo ${id} and purged vector points.`);

        return { success: true };
    }
}

export { ReposService as RepoService };