import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Parser, Node, Language } from 'web-tree-sitter';
import * as path from 'path';

export interface CodeChunk {
    fileName: string;
    type: 'class' | 'function' | 'method';
    name: string;
    content: string;
    startLine: number;
    endLine: number;
    parentClass?: string;
}

@Injectable()
export class AstChunkerService implements OnModuleInit {
    private readonly logger = new Logger(AstChunkerService.name);
    private parser: Parser;

    async onModuleInit(): Promise<void> {
        await Parser.init();
        this.parser = new Parser();

        const langpath = path.join(
            process.cwd(),
            'node_modules',
            'tree-sitter-python',
            'tree-sitter-python.wasm',
        );

        const pythonLang = await Language.load(langpath);
        this.parser.setLanguage(pythonLang);

        this.logger.log('AST Chunker Initialized with Python Grammar');
    }

    chunkPythonCode(fileName: string, sourceCode: string): CodeChunk[] {
        const tree = this.parser.parse(sourceCode);
        if (!tree) return []; 
        const chunks: CodeChunk[] = [];

        const traverse = (node: Node, currentClass?: string): void => {
            if (node.type === 'class_definition') {
                const className = node.childForFieldName('name')?.text ?? 'UnknownClass';

                chunks.push({
                    fileName,
                    type: 'class',
                    name: className,
                    content: node.text,
                    startLine: node.startPosition.row + 1,
                    endLine: node.endPosition.row + 1,
                    parentClass: currentClass,
                });

                for (const child of node.namedChildren) {
                    traverse(child, className);
                }
                return;
            }

            if (['function_definition', 'async_function_definition'].includes(node.type)) {
                const funcName = node.childForFieldName('name')?.text ?? 'UnknownFunction';

                chunks.push({
                    fileName,
                    type: currentClass ? 'method' : 'function',
                    name: funcName,
                    content: node.text,
                    startLine: node.startPosition.row + 1,
                    endLine: node.endPosition.row + 1,
                    parentClass: currentClass,
                });
                return;
            }

            for (const child of node.namedChildren) {
                traverse(child, currentClass);
            }
        };

        traverse(tree.rootNode);
        this.logger.debug(`Parsed ${chunks.length} chunks from ${fileName}`);
        return chunks;
    }
}