import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { GoogleGenAI } from "@google/genai";
import { EmbeddingService } from "../embedding/embedding.service";
import { VectorStoreService } from "../vector-store/vector-store.service";
import { AGENT_TOOLS } from "./agent-tool";

export interface AgentStep {
    hop: number;
    toolName: string;
    toolArgs: Record<string, any>;
    toolResult: string;
}

export interface AgentResult {
    answer: string;
    totalHops: number;
    steps: AgentStep[];
    sources: {
        filePath: string;
        startLine: number;
        endLine: number;
        name: string;
        score?: number;
    }[];
}

const MAX_HOPS = 4;
const MODEL = 'gemini-3.5-flash-lite';

@Injectable()
export class AgentService {
    private readonly logger = new Logger(AgentService.name);
    private readonly ai: GoogleGenAI;

    constructor(
        private readonly configService: ConfigService,
        private readonly embeddingService: EmbeddingService,
        private readonly vectorStoreService: VectorStoreService,
    ) {
        const apiKey = this.configService.get<string>('GEMINI_API_KEY');
        this.ai = new GoogleGenAI({ apiKey: apiKey || '' });
    }

    async run(repoId: string, question: string): Promise<AgentResult> {
        const steps: AgentStep[] = [];
        const allSources: AgentResult['sources'] = [];

        const contents: any[] = [
            { role: 'user', parts: [{ text: question }] },
        ];

        let answer = 'No answer could be generated.';

        for (let hop = 1; hop <= MAX_HOPS; hop++) {
            this.logger.log(`Agent hop ${hop} for repoId=${repoId}`);

            const response = await this.ai.models.generateContent({
                model: MODEL,
                contents,
                config: {
                    tools: [{ functionDeclarations: AGENT_TOOLS }],
                    systemInstruction:
                        'You are an expert code analyst. Use the provided tools to ' +
                        'investigate the codebase step by step before answering. ' +
                        'Always cite exact file paths and line numbers in your final answer.',
                },
            });

            const calls = response.functionCalls;

            if (!calls || calls.length === 0) {
                answer = response.text || answer;
                break;
            }

            contents.push(response.candidates![0].content);

            const functionResponseParts: any[] = [];

            for (const call of calls) {
                const toolResult = await this.executeTool(call.name!, call.args as Record<string, any>, repoId, allSources);

                steps.push({
                    hop,
                    toolName: call.name!,
                    toolArgs: call.args as Record<string, any>,
                    toolResult,
                });

                functionResponseParts.push({
                    functionResponse: {
                        id: call.id,
                        name: call.name,
                        response: { result: toolResult },
                    },
                });
            }

            contents.push({ role: 'user', parts: functionResponseParts });
        }

        return {
            answer,
            totalHops: steps.length,
            steps,
            sources: allSources,
        };
    }

    private async executeTool(
        toolName: string,
        args: Record<string, any>,
        repoId: string,
        sources: AgentResult['sources'],
    ): Promise<string> {
        switch (toolName) {
            case 'searchCode': {
                const vector = await this.embeddingService.embedQuery(args.query);
                const points = await this.vectorStoreService.search(repoId, vector, 5);

                for (const p of points) {
                    sources.push({
                        filePath: p.payload?.filePath as string,
                        startLine: p.payload?.startLine as number,
                        endLine: p.payload?.endLine as number,
                        name: p.payload?.name as string,
                        score: p.score,
                    });
                }

                return points.map((p, i) =>
                    `[Result ${i + 1}] ${p.payload?.filePath} lines ${p.payload?.startLine}-${p.payload?.endLine} (${p.payload?.name})\n` +
                    `\`\`\`\n${p.payload?.content}\n\`\`\``
                ).join('\n\n') || 'No results found.';
            }

            case 'readFile': {
                const chunks = await this.vectorStoreService.getFileChunks(repoId, args.filePath);
                if (!chunks.length) return `No indexed chunks found for file: ${args.filePath}`;

                return chunks.map((c) =>
                    `[Lines ${c.startLine}-${c.endLine}] ${c.type} ${c.name}\n` +
                    `\`\`\`\n${c.content}\n\`\`\``
                ).join('\n\n');
            }

            case 'listFiles': {
                const files = await this.vectorStoreService.listFiles(repoId);
                return files.length
                    ? `Indexed files:\n${files.join('\n')}`
                    : 'No files indexed for this repository.';
            }

            default:
                return `Unknown tool: ${toolName}`;
        }
    }
}
