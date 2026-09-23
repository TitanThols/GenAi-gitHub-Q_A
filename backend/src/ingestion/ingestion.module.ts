import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';

import { Repo } from '../repos/repo.entity';
import { ChunkerModule } from '../chunker/chunker.module';
import { EmbeddingModule } from '../embedding/embedding.module';
import { VectorStoreModule } from '../vector-store/vector-store.module';
import { IngestionProcessor } from './ingestion.processor';

@Module({
  imports: [
    TypeOrmModule.forFeature([Repo]),
    BullModule.registerQueue({
      name: 'ingestion',
    }),
    ChunkerModule,
    EmbeddingModule,
    VectorStoreModule,
  ],
  providers: [IngestionProcessor],
  exports: [BullModule],
})
export class IngestionModule {}
