import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AgentService, AgentResult } from '../agent/agent.service';
import { ReposService } from '../repos/repos.service';
import { performance } from 'node:perf_hooks';

@Injectable()
export class QueryService {
    private readonly logger = new Logger(QueryService.name);

    constructor(
        private readonly agentService: AgentService,
        private readonly reposService: ReposService,
    ) { }

    async ask(repoId: string, question: string): Promise<AgentResult> {
        const startedAt = performance.now();
        let succeeded = false;
        try {
            const repo = await this.reposService.findOne(repoId);
            if (!repo) {
                throw new NotFoundException(`Repo with ID "${repoId}" not found`);
            }

            this.logger.log(`Agent query on repo ${repo.name}: "${question}"`);

            const result = await this.agentService.run(repoId, question);
            succeeded = true;
            return result;
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
