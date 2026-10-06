import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import type {
    ChatCompletionMessageParam,
    ChatCompletionMessageToolCall,
} from 'openai/resources/chat/completions';
import { performance } from 'node:perf_hooks';
import { EmbeddingService } from '../embedding/embedding.service';
import { VectorStoreService } from '../vector-store/vector-store.service';
import { AGENT_TOOLS } from './agent-tool';

export interface AgentStep {
    hop: number;
    toolName: string;
    toolArgs: Record<string, unknown>;
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
const MODEL = 'gpt-4.1-mini';
const SYSTEM_INSTRUCTION =
    'You are an expert code analyst. Use the provided tools to investigate the codebase step by step before answering. ' +
    'Always cite exact file paths and line numbers in your final answer.';

@Injectable()
export class AgentService {
    private readonly logger = new Logger(AgentService.name);
    private readonly openai: OpenAI;

    constructor(
        private readonly configService: ConfigService,
        private readonly embeddingService: EmbeddingService,
        private readonly vectorStoreService: VectorStoreService,
    ) {
        this.openai = new OpenAI({
            apiKey: this.configService.getOrThrow<string>('OPENAI_API_KEY'),
        });
    }

    async run(repoId: string, question: string): Promise<AgentResult> {
        const steps: AgentStep[] = [];
        const allSources: AgentResult['sources'] = [];
        const messages: ChatCompletionMessageParam[] = [
            { role: 'system', content: SYSTEM_INSTRUCTION },
            { role: 'user', content: question },
        ];
        let answer = 'No answer could be generated.';
        let completed = false;
        let totalHops = 0;

        for (let hop = 1; hop <= MAX_HOPS; hop++) {
            this.logger.log(`Agent hop ${hop} for repoId=${repoId}`);
            const response = await this.requestCompletion(repoId, hop, messages, true);
            const message = response.choices[0]?.message;
            if (!message) {
                throw new Error('OpenAI returned an empty chat completion.');
            }

            const calls = message.tool_calls ?? [];
            if (calls.length === 0) {
                answer = message.content || answer;
                completed = true;
                break;
            }

            totalHops = hop;
            messages.push(message);
            for (const call of calls) {
                const { name, args } = this.readToolCall(call);
                const toolResult = await this.executeTool(name, args, repoId, allSources);
                steps.push({ hop, toolName: name, toolArgs: args, toolResult });
                messages.push({
                    role: 'tool',
                    tool_call_id: call.id,
                    content: toolResult,
                });
            }
        }

        if (!completed) {
            const response = await this.requestCompletion(
                repoId,
                MAX_HOPS + 1,
                messages,
                false,
            );
            const message = response.choices[0]?.message;
            if (!message) {
                throw new Error('OpenAI returned an empty final chat completion.');
            }
            answer = message.content || answer;
        }

        return {
            answer,
            totalHops,
            steps,
            sources: allSources,
        };
    }

    private async requestCompletion(
        repoId: string,
        hop: number,
        messages: ChatCompletionMessageParam[],
        useTools: boolean,
    ) {
        const startedAt = performance.now();
        let succeeded = false;
        try {
            const response = await this.openai.chat.completions.create({
                model: MODEL,
                messages,
                ...(useTools ? { tools: AGENT_TOOLS } : {}),
            });
            succeeded = true;
            return response;
        } finally {
            this.logger.log(
                JSON.stringify({
                    event: 'timing',
                    stage: 'llm_call',
                    provider: 'openai',
                    model: MODEL,
                    repoId,
                    hop,
                    toolsEnabled: useTools,
                    durationMs: Number((performance.now() - startedAt).toFixed(2)),
                    outcome: succeeded ? 'success' : 'failed',
                }),
            );
        }
    }

    private readToolCall(
        call: ChatCompletionMessageToolCall,
    ): { name: string; args: Record<string, unknown> } {
        if (call.type !== 'function') {
            throw new Error(`Unsupported OpenAI tool call type: ${call.type}`);
        }

        let parsed: unknown;
        try {
            parsed = JSON.parse(call.function.arguments);
        } catch (error) {
            throw new Error(`Invalid arguments for tool ${call.function.name}.`, {
                cause: error,
            });
        }
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
            throw new Error(`Tool ${call.function.name} arguments must be a JSON object.`);
        }

        return {
            name: call.function.name,
            args: parsed as Record<string, unknown>,
        };
    }

    private requiredStringArg(args: Record<string, unknown>, key: string): string {
        const value = args[key];
        if (typeof value !== 'string' || !value.trim()) {
            throw new Error(`Tool argument "${key}" must be a non-empty string.`);
        }
        return value;
    }

    private async executeTool(
        toolName: string,
        args: Record<string, unknown>,
        repoId: string,
        sources: AgentResult['sources'],
    ): Promise<string> {
        switch (toolName) {
            case 'searchCode': {
                const query = this.requiredStringArg(args, 'query');
                const vector = await this.embeddingService.embedQuery(query);
                const points = await this.vectorStoreService.search(repoId, vector, 5);

                for (const point of points) {
                    const filePath = point.payload?.filePath;
                    const startLine = point.payload?.startLine;
                    const endLine = point.payload?.endLine;
                    if (
                        typeof filePath === 'string' &&
                        typeof startLine === 'number' &&
                        typeof endLine === 'number'
                    ) {
                        sources.push({
                            filePath,
                            startLine,
                            endLine,
                            name: String(point.payload?.name ?? ''),
                            score: point.score,
                        });
                    }
                }

                return points
                    .map(
                        (point, index) =>
                            `[Result ${index + 1}] ${point.payload?.filePath} lines ${point.payload?.startLine}-${point.payload?.endLine} (${point.payload?.name})\n` +
                            `\`\`\`\n${point.payload?.content}\n\`\`\``,
                    )
                    .join('\n\n') || 'No results found.';
            }

            case 'readFile': {
                const filePath = this.requiredStringArg(args, 'filePath');
                const chunks = await this.vectorStoreService.getFileChunks(repoId, filePath);
                if (!chunks.length) return `No indexed chunks found for file: ${filePath}`;

                return chunks
                    .map(
                        (chunk) =>
                            `[Lines ${chunk.startLine}-${chunk.endLine}] ${chunk.type} ${chunk.name}\n` +
                            `\`\`\`\n${chunk.content}\n\`\`\``,
                    )
                    .join('\n\n');
            }

            case 'listFiles': {
                const files = await this.vectorStoreService.listFiles(repoId);
                return files.length
                    ? `Indexed files:\n${files.join('\n')}`
                    : 'No files indexed for this repository.';
            }

            default:
                throw new Error(`Unknown agent tool: ${toolName}`);
        }
    }
}
