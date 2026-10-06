import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import type { APIError } from 'openai';
import { performance } from 'node:perf_hooks';

const MAX_RETRIES = 5;
const MAX_RETRY_DELAY_MS = 60_000;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);
  private readonly openai: OpenAI;
  readonly model = 'text-embedding-3-small';
  readonly dimensions = 1536;

  constructor(private readonly configService: ConfigService) {
    this.openai = new OpenAI({
      apiKey: this.configService.getOrThrow<string>('OPENAI_API_KEY'),
      maxRetries: 0,
    });
  }

  async embedQuery(text: string): Promise<number[]> {
    const [embedding] = await this.embedBatch([text]);
    if (!embedding) {
      throw new Error('OpenAI returned no embedding for the query.');
    }
    return embedding;
  }

  private async embedSliceWithRetry(slice: string[]): Promise<number[][]> {
    const startedAt = performance.now();
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await this.openai.embeddings.create({
          model: this.model,
          input: slice,
          dimensions: this.dimensions,
        });

        const embeddings = response.data
          .sort((a, b) => a.index - b.index)
          .map((item) => item.embedding);
        if (embeddings.length !== slice.length) {
          throw new Error(
            `OpenAI returned ${embeddings.length} embeddings for ${slice.length} inputs.`,
          );
        }
        this.logger.log(
          JSON.stringify({
            event: 'timing',
            stage: 'embedding',
            provider: 'openai',
            model: this.model,
            inputCount: slice.length,
            attempts: attempt,
            durationMs: Number((performance.now() - startedAt).toFixed(2)),
          }),
        );
        return embeddings;
      } catch (error: unknown) {
        const isRetryable =
          error instanceof OpenAI.APIError &&
          (error.status === 429 || (error.status !== undefined && error.status >= 500));

        if (!isRetryable || attempt === MAX_RETRIES) {
          this.logger.error(
            `Failed to embed ${slice.length} texts after ${attempt} attempt(s): ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
          this.logger.error(
            JSON.stringify({
              event: 'timing',
              stage: 'embedding',
              provider: 'openai',
              model: this.model,
              inputCount: slice.length,
              attempts: attempt,
              durationMs: Number((performance.now() - startedAt).toFixed(2)),
              outcome: 'failed',
            }),
          );
          throw error;
        }

        const retryAfterMs = this.getRetryAfterMs(error);
        const delayMs =
          retryAfterMs ??
          Math.min(1_000 * 2 ** (attempt - 1), MAX_RETRY_DELAY_MS);

        this.logger.warn(
          `OpenAI embedding request failed (attempt ${attempt}/${MAX_RETRIES}); retrying in ${delayMs}ms.`,
        );
        await sleep(delayMs);
      }
    }

    throw new Error('OpenAI embedding retries exhausted unexpectedly.');
  }

  private getRetryAfterMs(error: APIError): number | undefined {
    const retryAfterMs = error.headers?.get('retry-after-ms');
    if (retryAfterMs) {
      const parsed = Number(retryAfterMs);
      if (Number.isFinite(parsed) && parsed >= 0) return parsed;
    }

    const retryAfter = error.headers?.get('retry-after');
    if (retryAfter) {
      const seconds = Number(retryAfter);
      if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
    }

    return undefined;
  }

  async embedBatch(texts: string[], batchSize = 10): Promise<number[][]> {
    if (!texts.length) return [];
    if (!Number.isInteger(batchSize) || batchSize < 1) {
      throw new Error(`Invalid embedding batch size: ${batchSize}`);
    }

    const results: number[][] = [];
    for (let i = 0; i < texts.length; i += batchSize) {
      const slice = texts.slice(i, i + batchSize);
      results.push(...(await this.embedSliceWithRetry(slice)));
    }

    return results;
  }
}
