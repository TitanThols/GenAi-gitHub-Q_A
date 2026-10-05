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
    let delay = 35_000;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await this.genAI.models.embedContent({
          model: this.model,
          contents: slice,
          config: { outputDimensionality: 768 },
        });
        return response.embeddings?.map((e) => e.values ?? []) ?? [];
      } catch (error: any) {
        const isRateLimit = error?.status === 429 || error?.message?.includes('429') || error?.message?.includes('RESOURCE_EXHAUSTED');

        if (isRateLimit && attempt < maxRetries) {
          this.logger.warn(
            `Rate limit hit (attempt ${attempt}/${maxRetries}). Retrying in ${delay / 1000}s...`,
          );
          await sleep(delay);
          delay = Math.min(delay * 2, 120_000);
          this.logger.error(`Failed to embed ${slice.length} texts after ${attempt} attempt(s)`);
          throw error;
        }
      }
    }
    return [];
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
