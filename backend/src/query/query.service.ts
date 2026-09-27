import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AgentService, AgentResult } from '../agent/agent.service';
import { ReposService } from '../repos/repos.service';

@Injectable()
export class QueryService {
    private readonly logger = new Logger(QueryService.name);

    constructor(
        private readonly agentService: AgentService,
        private readonly reposService: ReposService,
    ) { }

    async ask(repoId: string, question: string): Promise<AgentResult> {
        const repo = await this.reposService.findOne(repoId);
        if (!repo) {
            throw new NotFoundException(`Repo with ID "${repoId}" not found`);
        }

        this.logger.log(`Agent query on repo ${repo.name}: "${question}"`);

        return this.agentService.run(repoId, question);
    }
}
