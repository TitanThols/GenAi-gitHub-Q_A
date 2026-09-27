import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { QueryService } from './query.service';
import { AgentResult } from '../agent/agent.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class QueryRequest {
    @IsNotEmpty()
    @IsUUID()
    repoId: string;

    @IsNotEmpty()
    @IsString()
    question: string;
}

@Controller('query')
@UseGuards(JwtAuthGuard)
export class QueryController {
    constructor(private readonly queryService: QueryService) { }

    @Post()
    async query(@Body() body: QueryRequest): Promise<AgentResult> {
        return this.queryService.ask(body.repoId, body.question);
    }
}