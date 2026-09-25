import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';

import { EmbeddingService } from '../embedding/embedding.service';
import { VectorStoreService } from '../vector-store/vector-store.service';
import { ReposService } from '../repos/repos.service';

export interface QueryResult {
    answer: string,
    sources: {
        filePath: string;
        startLine: number;
        endLine: number;
        type: string;
        name?: string;
        score: number;
        content: string;
    }[];
}

@Injectable()
export class QueryService {
    private readonly logger = new Logger(QueryService.name);
    private readonly ai: GoogleGenAI;
    private readonly llmModel = 'gemini-3.5-flash-lite';

    constructor(
        private readonly configService: ConfigService,
        private readonly embeddingService: EmbeddingService,
        private readonly vectorStoreService: VectorStoreService,
        private readonly reposService: ReposService,
    ) {
        const apiKey = this.configService.get<string>('GEMINI_API_KEY');
        this.ai = new GoogleGenAI({ apiKey: apiKey || '' });
    }

    async ask(repoId: string, question: string): Promise<QueryResult> {
        const repo = await this.reposService.findOne(repoId);
        if (!repo) {
            throw new NotFoundException(`Repo with ID "${repoId}" not found`);
        }

        this.logger.log(`Querying repo ${repo.name} with question "${question}`);

        const queryVector = await this.embeddingService.embedQuery(question);

        const searchResults = await this.vectorStoreService.search(repoId, queryVector, 8);

        if (!searchResults || searchResults.length === 0) {
            return {
                answer: 'No relevant code found in this repository for your question.',
                sources: [],
            };
        }

        const sources = searchResults.map((point: any) => ({
            filePath: point.payload?.filePath,
            startLine: point.payload?.startLine,
            endLine: point.payload?.endLine,
            type: point.payload?.type,
            name: point.payload?.name,
            score: point.score,
            content: point.payload?.content
        }));

        const contextBlocks = sources
            .map(
                (s, idx) =>
                    `[Source ${idx + 1}] File: ${s.filePath} (Lines ${s.startLine}-${s.endLine}) Type: ${s.type} ${s.name || ''}\n\`\`\`\n${s.content}\n\`\`\``,
            )
            .join('\n\n');
        const systemPrompt = `You are an expert software engineer answering questions about a codebase.
Use the provided code snippets to answer the user's question accurately and concisely.
Rules:
1. Ground your answer ONLY in the provided code snippets.
2. Always cite the file path and line numbers when referencing code (e.g. \`[src/auth/auth.service.ts:15-30]\`).
3. If the answer cannot be determined from the provided snippets, state clearly what information is missing. Do not guess or hallucinate imports, classes, or logic.
4. Include brief code snippets where helpful.
Context Code Snippets:
${contextBlocks}
User Question:
${question}
`;
        const response = await this.ai.models.generateContent({
            model: this.llmModel,
            contents: systemPrompt,
        });

        const answer = response.text || 'Unable to generate answer';

        return {
            answer,
            sources,
        };
    }

}