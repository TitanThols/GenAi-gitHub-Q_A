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
import { AgentModule } from './agent/agent.module';

@Module({
  imports: [

    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.getOrThrow<string>('DATABASE_URL'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        migrations: [__dirname + '/migrations/*.js'],
        migrationsRun: false,
        synchronize: config.get<string>('NODE_ENV') !== 'production',
        logging: config.get<string>('NODE_ENV') === 'development',
      }),
      inject: [ConfigService],
    }),

    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => {
        const redisUrl = config.getOrThrow<string>('REDIS_URL');
        const isTls = redisUrl.startsWith('rediss://');
        return {
          connection: {
            url: redisUrl,
            maxRetriesPerRequest: null,
            ...(isTls ? { tls: { rejectUnauthorized: false } } : {}),
          },
        };
      },
      inject: [ConfigService],
    }),

    AuthModule,
    UsersModule,
    ReposModule,
    ChunkerModule,
    EmbeddingModule,
    VectorStoreModule,
    IngestionModule,
    QueryModule,
    AgentModule
  ],
})
export class AppModule { }
