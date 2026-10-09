import {
    Injectable,
    Logger,
    BadRequestException,
    InternalServerErrorException,
} from '@nestjs/common';
import { AgentService, AgentResult } from '../agent/agent.service';
import { ReposService } from '../repos/repos.service';
import { RepoStatus } from '../repos/repo.entity';
import { performance } from 'node:perf_hooks';

@Injectable()
export class QueryService {
    private readonly logger = new Logger(QueryService.name);

    constructor(
        private readonly agentService: AgentService,
        private readonly reposService: ReposService,
    ) { }

    async ask(
        repoId: string,
        question: string,
        userId: string,
    ): Promise<AgentResult> {
        const startedAt = performance.now();
        let succeeded = false;
        try {
            const repo = await this.reposService.findOne(repoId, userId);

            if (repo.status !== RepoStatus.INDEXED) {
                if (repo.status === RepoStatus.FAILED) {
                    throw new BadRequestException(
                        `Cannot query this repository because indexing failed: ${repo.errorMessage || 'Unknown error'}. Please delete and re-add the repository.`,
                    );
                }
                throw new BadRequestException(
                    `Repository is still ${repo.status}. Please wait until indexing is complete before asking questions.`,
                );
            }

            this.logger.log(`Agent query on repo ${repo.name}: "${question}"`);

            const result = await this.agentService.run(repoId, question);
            succeeded = true;
            return result;
        } catch (error: any) {
            this.logger.error(`Query failed on repo ${repoId}: ${error?.message}`, error?.stack);
            if (error?.status && typeof error.getStatus === 'function') {
                throw error;
            }
            throw new InternalServerErrorException(
                `Query failed: ${error?.message || 'An error occurred while analyzing the codebase.'}`,
            );
        } finally {
            this.logger.log(
                JSON.stringify({
                    event: 'timing',
                    stage: 'total_query',
                    repoId,
                    durationMs: Number((performance.now() - startedAt).toFixed(2)),
                    outcome: succeeded ? 'success' : 'failed',
                }),
            );
        }
    }
}
