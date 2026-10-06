import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);
  private readonly genAI: GoogleGenAI;
  private readonly model = 'gemini-embedding-001';

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      this.logger.warn('GEMINI_API_KEY is not set, EmbeddingService will not work');
    }
    this.genAI = new GoogleGenAI({ apiKey: apiKey || '' });
  }

  async embedQuery(text: string): Promise<number[]> {
    const embeddings = await this.embedBatch([text]);
    return embeddings[0] || [];
  }

  private async embedSliceWithRetry(slice: string[], maxRetries = 5): Promise<number[][]> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await this.genAI.models.embedContent({
          model: this.model,
          contents: slice,
          config: { outputDimensionality: 768 },
        });
        return response.embeddings?.map((e) => e.values ?? []) ?? [];
      } catch (error: any) {
        const isRateLimit =
          error?.status === 429 ||
          error?.code === 429 ||
          error?.message?.includes('429') ||
          error?.message?.includes('RESOURCE_EXHAUSTED');

        if (isRateLimit && attempt < maxRetries) {
          let waitTimeMs = 50_000;

          const match = error?.message?.match(/retry in ([0-9.]+)s/i);
          if (match && match[1]) {
            const parsedSeconds = parseFloat(match[1]);
            if (!isNaN(parsedSeconds) && parsedSeconds > 0) {
              waitTimeMs = Math.ceil(parsedSeconds * 1000) + 2000;
            }
          } else if (Array.isArray(error?.details)) {
            const retryInfo = error.details.find((d: any) => d?.retryDelay);
            if (retryInfo?.retryDelay) {
              const seconds = parseFloat(retryInfo.retryDelay.replace('s', ''));
              if (!isNaN(seconds) && seconds > 0) {
                waitTimeMs = Math.ceil(seconds * 1000) + 2000;
              }
            }
          }

          this.logger.warn(
            `Rate limit hit (attempt ${attempt}/${maxRetries}). Retrying in ${(waitTimeMs / 1000).toFixed(1)}s...`,
          );
          await sleep(waitTimeMs);
          continue;
        }

        this.logger.error(
          `Failed to embed ${slice.length} texts after ${attempt} attempt(s): ${error?.message || error}`,
        );
        throw error;
      }
    }
    throw new Error(`Failed to embed ${slice.length} texts: Max retries exceeded`);
  }

  async embedBatch(texts: string[], batchSize = 10): Promise<number[][]> {
    if (!texts.length) return [];

    const results: number[][] = [];

    for (let i = 0; i < texts.length; i += batchSize) {
      const slice = texts.slice(i, i + batchSize);

      const embeddings = await this.embedSliceWithRetry(slice);
      results.push(...embeddings);

      if (i + batchSize < texts.length) {
        await sleep(7_000);
      }
    }

    return results;
  }
}
