import { NotFoundException } from '@nestjs/common';
import type { Repository } from 'typeorm';
import type { Queue } from 'bullmq';
import { Repo } from './repo.entity';
import { ReposService } from './repos.service';
import { VectorStoreService } from '../vector-store/vector-store.service';

describe('ReposService ownership', () => {
    let service: ReposService;
    let repoRepository: jest.Mocked<Pick<Repository<Repo>, 'findOneBy'>>;

    beforeEach(() => {
        repoRepository = {
            findOneBy: jest.fn(),
        };
        service = new ReposService(
            repoRepository as unknown as Repository<Repo>,
            {} as Queue,
            {} as VectorStoreService,
        );
    });

    it('looks up a repository using both its ID and its owner', async () => {
        const repo = { id: 'repo-id', userId: 'owner-id' } as Repo;
        repoRepository.findOneBy.mockResolvedValue(repo);

        await expect(service.findOne('repo-id', 'owner-id')).resolves.toBe(repo);
        expect(repoRepository.findOneBy).toHaveBeenCalledWith({
            id: 'repo-id',
            userId: 'owner-id',
        });
    });

    it('does not return a repository owned by another account', async () => {
        repoRepository.findOneBy.mockResolvedValue(null);

        await expect(service.findOne('repo-id', 'other-user')).rejects.toThrow(
            NotFoundException,
        );
    });
});
