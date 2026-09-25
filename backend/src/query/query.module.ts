import { Module } from '@nestjs/common';
import { EmbeddingModule } from 'src/embedding/embedding.module';
import { ReposModule } from 'src/repos/repos.module';
import { VectorStoreModule } from 'src/vector-store/vector-store.module';
import { QueryController } from './query.controller';
import { QueryService } from './query.service';

@Module({
    imports: [EmbeddingModule, VectorStoreModule, ReposModule],
    controllers: [QueryController],
    providers: [QueryService],
    exports: [QueryService],
})
export class QueryModule { }
