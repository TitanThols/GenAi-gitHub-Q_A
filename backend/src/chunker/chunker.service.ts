import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Parser, Node, Language } from 'web-tree-sitter';
import * as path from 'path';

export interface CodeChunk {
    fileName: string;
    type: 'class' | 'function' | 'method' | 'interface' | 'type';
    name: string;
    content: string;
    startLine: number;
    endLine: number;
    parentClass?: string;
}

@Injectable()
export class ChunkerService implements OnModuleInit {
    private readonly logger = new Logger(ChunkerService.name);
    private pythonParser: Parser;
    private tsParser: Parser;
    private tsxParser: Parser;
    private jsParser: Parser;

    async onModuleInit(): Promise<void> {
        await Parser.init();

        const pythonWasm = require.resolve('tree-sitter-python/tree-sitter-python.wasm');
        const tsWasm = require.resolve('tree-sitter-typescript/tree-sitter-typescript.wasm');
        const tsxWasm = require.resolve('tree-sitter-typescript/tree-sitter-tsx.wasm');
        const jsWasm = require.resolve('tree-sitter-javascript/tree-sitter-javascript.wasm');

        const [pythonLang, tsLang, tsxLang, jsLang] = await Promise.all([
            Language.load(pythonWasm),
            Language.load(tsWasm),
            Language.load(tsxWasm),
            Language.load(jsWasm),
        ]);

        this.pythonParser = new Parser();
        this.pythonParser.setLanguage(pythonLang);

        this.tsParser = new Parser();
        this.tsParser.setLanguage(tsLang);

        this.tsxParser = new Parser();
        this.tsxParser.setLanguage(tsxLang);

        this.jsParser = new Parser();
        this.jsParser.setLanguage(jsLang);

        this.logger.log('ChunkerService initialized with Python, TypeScript, TSX, and JavaScript grammars');
    }

    chunkFile(fileName: string, content: string): CodeChunk[] {
        const ext = path.extname(fileName).toLowerCase();

        switch (ext) {
            case '.py':
                return this.chunkPythonCode(fileName, content);
            case '.ts':
                return this.chunkTypeScriptCode(fileName, content, false);
            case '.tsx':
                return this.chunkTypeScriptCode(fileName, content, true);
            case '.js':
            case '.jsx':
            case '.mjs':
            case '.cjs':
                return this.chunkJavaScriptCode(fileName, content);
            default:
                this.logger.warn(`Unsupported file extension for AST chunking ${ext}`);
                return [];
        }
    }

    chunkPythonCode(fileName: string, sourceCode: string): CodeChunk[] {
        if (!this.pythonParser) {
            this.logger.error('Pyhton parser not initialised');
            return [];
        }

        const tree = this.pythonParser.parse(sourceCode);
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

                const body = node.childForFieldName('body');
                if (body) {
                    for (const child of body.namedChildren) {
                        traverse(child, className);
                    }
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
    chunkTypeScriptCode(fileName: string, sourceCode: string, isTsx = false): CodeChunk[] {
        const parser = isTsx ? this.tsxParser : this.tsParser;
        if (!parser) {
            this.logger.error(`${isTsx ? 'TSX' : 'TypeScript'} parser not initialized`);
            return [];
        }
        const tree = parser.parse(sourceCode);
        if (!tree) return [];
        const chunks: CodeChunk[] = [];
        const traverse = (node: Node, currentClass?: string): void => {
            if (node.type === 'interface_declaration') {
                const name = node.childForFieldName('name')?.text ?? 'UnknownInterface';
                chunks.push({
                    fileName,
                    type: 'interface',
                    name,
                    content: node.text,
                    startLine: node.startPosition.row + 1,
                    endLine: node.endPosition.row + 1,
                });
                return;
            }
            if (node.type === 'type_alias_declaration') {
                const name = node.childForFieldName('name')?.text ?? 'UnknownType';
                chunks.push({
                    fileName,
                    type: 'type',
                    name,
                    content: node.text,
                    startLine: node.startPosition.row + 1,
                    endLine: node.endPosition.row + 1,
                });
                return;
            }
            if (node.type === 'class_declaration' || node.type === 'class') {
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
                const body = node.childForFieldName('body');
                if (body) {
                    for (const child of body.namedChildren) {
                        traverse(child, className);
                    }
                }
                return;
            }
            if (node.type === 'method_definition') {
                const methodName = node.childForFieldName('name')?.text ?? 'UnknownMethod';
                chunks.push({
                    fileName,
                    type: 'method',
                    name: methodName,
                    content: node.text,
                    startLine: node.startPosition.row + 1,
                    endLine: node.endPosition.row + 1,
                    parentClass: currentClass,
                });
                return;
            }
            if (node.type === 'function_declaration') {
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
            if (node.type === 'lexical_declaration' || node.type === 'variable_declaration') {
                for (const declarator of node.namedChildren) {
                    if (declarator.type === 'variable_declarator') {
                        const nameNode = declarator.childForFieldName('name');
                        const valueNode = declarator.childForFieldName('value');
                        if (
                            nameNode &&
                            valueNode &&
                            ['arrow_function', 'function_expression', 'function'].includes(valueNode.type)
                        ) {
                            chunks.push({
                                fileName,
                                type: 'function',
                                name: nameNode.text,
                                content: node.text,
                                startLine: node.startPosition.row + 1,
                                endLine: node.endPosition.row + 1,
                            });
                        }
                    }
                }
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
    chunkJavaScriptCode(fileName: string, sourceCode: string): CodeChunk[] {
        if (!this.jsParser) {
            this.logger.error('JavaScript parser not initialized');
            return [];
        }
        const tree = this.jsParser.parse(sourceCode);
        if (!tree) return [];
        const chunks: CodeChunk[] = [];
        const traverse = (node: Node, currentClass?: string): void => {
            if (node.type === 'class_declaration' || node.type === 'class') {
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
                const body = node.childForFieldName('body');
                if (body) {
                    for (const child of body.namedChildren) {
                        traverse(child, className);
                    }
                }
                return;
            }
            if (node.type === 'method_definition') {
                const methodName = node.childForFieldName('name')?.text ?? 'UnknownMethod';
                chunks.push({
                    fileName,
                    type: 'method',
                    name: methodName,
                    content: node.text,
                    startLine: node.startPosition.row + 1,
                    endLine: node.endPosition.row + 1,
                    parentClass: currentClass,
                });
                return;
            }
            if (node.type === 'function_declaration') {
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
            if (node.type === 'lexical_declaration' || node.type === 'variable_declaration') {
                for (const declarator of node.namedChildren) {
                    if (declarator.type === 'variable_declarator') {
                        const nameNode = declarator.childForFieldName('name');
                        const valueNode = declarator.childForFieldName('value');
                        if (
                            nameNode &&
                            valueNode &&
                            ['arrow_function', 'function_expression', 'function'].includes(valueNode.type)
                        ) {
                            chunks.push({
                                fileName,
                                type: 'function',
                                name: nameNode.text,
                                content: node.text,
                                startLine: node.startPosition.row + 1,
                                endLine: node.endPosition.row + 1,
                            });
                        }
                    }
                }
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