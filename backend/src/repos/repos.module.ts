import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';

import { Repo } from './repo.entity';
import { ReposService } from './repos.service';
import { ReposController } from './repos.controller';
import { VectorStoreModule } from '../vector-store/vector-store.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Repo]),
    BullModule.registerQueue({
      name: 'ingestion',
    }),
    VectorStoreModule,
  ],
  controllers: [ReposController],
  providers: [ReposService],
  exports: [ReposService],
})
export class ReposModule { }
