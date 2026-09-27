import { Module } from '@nestjs/common';
import { AgentService } from './agent.service';
import { EmbeddingModule } from '../embedding/embedding.module';
import { VectorStoreModule } from '../vector-store/vector-store.module';

@Module({
    providers: [AgentService],
    imports: [EmbeddingModule, VectorStoreModule],
    exports: [AgentService],
})
export class AgentModule { }