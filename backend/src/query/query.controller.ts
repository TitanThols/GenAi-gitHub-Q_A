import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { QueryService, QueryResult } from './query.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

export interface QueryRequest {
    repoId: string;
    question: string;
}

@Controller('api/query')
@UseGuards(JwtAuthGuard)
export class QueryController {
    constructor(private readonly queryService: QueryService) { }

    @Post()
    async query(@Body() body: QueryRequest): Promise<QueryResult> {
        return this.queryService.ask(body.repoId, body.question);
    }
}