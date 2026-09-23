import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';

import { Repo } from './repo.entity';
import { ReposService } from './repos.service';
import { VectorStoreModule } from '../vector-store/vector-store.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Repo]),
    BullModule.registerQueue({
      name: 'ingestion',
    }),
    VectorStoreModule,
  ],
  controllers: [],
  providers: [ReposService],
  exports: [ReposService],
})
export class ReposModule {}
