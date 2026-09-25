import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai' 

@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);
  private readonly genAI: GoogleGenAI;
  private readonly model = 'text-embedding-004';

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if(!apiKey){
      this.logger.warn("Gemini_APi key is not set, EmbeddingService will not work")
    }
    this.genAI = new GoogleGenAI({apiKey: apiKey || ''});
  }

  async embedQuery(text: string): Promise<number []> {
    const embeddings = await this.embedBatch([text]);
    return embeddings[0] || [];
  }

  async embedBatch(texts: string[], batchSize = 50): Promise<number[][]> {
    if(!texts.length) return [];

    const results: number[][] = [];

    for(let i = 0; i < texts.length; i += batchSize){
      const slice = texts.slice(i, i + batchSize);
      try{
        const response = await this.genAI.models.embedContent({
          model: this.model,
          contents: slice,
        });

        const embeddings = response.embeddings?.map((e) => e.values ?? []) ?? [];
        results.push(...embeddings);
      } catch(error) {
        this.logger.error("Failed to embed content " + slice.length + " texts");
        throw error;
      }
    }
    return results;
  }

}
    