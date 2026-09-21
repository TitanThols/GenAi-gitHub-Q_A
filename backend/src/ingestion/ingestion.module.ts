import { Module } from '@nestjs/common'
import { AstChunkerService } from './ast-chunker.service';

@Module({
    providers: [AstChunkerService],
    exports: [AstChunkerService],
})

export class IngestionModule { }

