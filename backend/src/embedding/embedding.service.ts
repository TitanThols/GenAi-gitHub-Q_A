import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';

@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);
  private readonly ai: GoogleGenAI;
  private readonly model = 'text-embedding-004';

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      this.logger.warn('GEMINI_API_KEY is not set. Embedding calls will fail.');
    }
    this.ai = new GoogleGenAI({ apiKey: apiKey || '' });
  }

  /**
   * Generates an embedding for a single text.
   */
  async embedQuery(text: string): Promise<number[]> {
    const embeddings = await this.embedBatch([text]);
    return embeddings[0] || [];
  }

  /**
   * Generates embeddings for an array of texts.
   * Batches into groups of up to 50 to stay well within Gemini API limits.
   */
  async embedBatch(texts: string[], batchSize = 50): Promise<number[][]> {
    if (!texts.length) return [];

    const results: number[][] = [];

    for (let i = 0; i < texts.length; i += batchSize) {
      const slice = texts.slice(i, i + batchSize);
      try {
        const response = await this.ai.models.embedContent({
          model: this.model,
          contents: slice,
        });

        const embeddings = response.embeddings?.map((e) => e.values ?? []) ?? [];
        results.push(...embeddings);
      } catch (error) {
        this.logger.error(`Failed to embed batch of ${slice.length} items`, error);
        throw error;
      }
    }

    return results;
  }
}
