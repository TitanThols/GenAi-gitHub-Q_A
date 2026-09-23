import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';

import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ReposModule } from './repos/repos.module';
import { ChunkerModule } from './chunker/chunker.module';
import { EmbeddingModule } from './embedding/embedding.module';
import { VectorStoreModule } from './vector-store/vector-store.module';
import { IngestionModule } from './ingestion/ingestion.module';
import { QueryModule } from './query/query.module';

@Module({
  imports: [
    // ─── Global Config ──────────────────────────────────────────────────────
    // isGlobal:true means every module can inject ConfigService without re-importing ConfigModule.
    // Reads from .env at the project root.
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // ─── PostgreSQL (TypeORM) ───────────────────────────────────────────────
    // Used for structured data: users, repos, query history.
    // Vector data (embeddings) lives in Qdrant, not here.
    //
    // forRootAsync lets us read the DATABASE_URL from ConfigService rather than
    // hardcoding it — required for 12-factor app compliance.
    //
    // synchronize:true auto-creates/alters tables to match entities. Safe in dev.
    // NEVER enable in production — use TypeORM migrations instead. If you run
    // synchronize:true against a production DB you can lose data.
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.getOrThrow<string>('DATABASE_URL'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: config.get<string>('NODE_ENV') !== 'production',
        logging: config.get<string>('NODE_ENV') === 'development',
      }),
      inject: [ConfigService],
    }),

    // ─── BullMQ (Redis-backed job queue) ────────────────────────────────────
    // Repo indexing is a long-running task (minutes for large repos). BullMQ
    // runs it in a worker process so HTTP requests return immediately.
    // The client polls GET /api/repos/:id/status or subscribes to SSE for progress.
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        connection: {
          url: config.getOrThrow<string>('REDIS_URL'),
        },
      }),
      inject: [ConfigService],
    }),

    // ─── Feature Modules ─────────────────────────────────────────────────────
    // Each module owns one domain. Dependencies flow:
    //   Auth      → Users
    //   Repos     → Chunker, Embedding, VectorStore (orchestration)
    //   Query     → Embedding, VectorStore (retrieval + reasoning)
    AuthModule,
    UsersModule,
    ReposModule,
    ChunkerModule,
    EmbeddingModule,
    VectorStoreModule,
    IngestionModule,
    QueryModule,
  ],
})
export class AppModule {}
