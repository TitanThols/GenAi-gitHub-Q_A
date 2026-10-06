import { getEncoding } from 'js-tiktoken';
import { CodeChunk } from './chunker.service';

const MAX_EMBEDDING_TOKENS_PER_CHUNK = 8000;
const encoder = getEncoding('cl100k_base');

function countNewlines(value: string): number {
    return (value.match(/\n/g) ?? []).length;
}

export function splitOversizedChunkForEmbedding(chunk: CodeChunk): CodeChunk[] {
    const tokens = encoder.encode(chunk.content);
    if (tokens.length <= MAX_EMBEDDING_TOKENS_PER_CHUNK) return [chunk];

    const fragments: CodeChunk[] = [];
    for (
        let tokenStart = 0;
        tokenStart < tokens.length;
        tokenStart += MAX_EMBEDDING_TOKENS_PER_CHUNK
    ) {
        const tokenEnd = Math.min(
            tokenStart + MAX_EMBEDDING_TOKENS_PER_CHUNK,
            tokens.length,
        );
        const prefix = encoder.decode(tokens.slice(0, tokenStart));
        const content = encoder.decode(tokens.slice(tokenStart, tokenEnd));
        const startLine = Math.min(
            chunk.endLine,
            chunk.startLine + countNewlines(prefix),
        );

        fragments.push({
            ...chunk,
            content,
            startLine,
            endLine: Math.min(
                chunk.endLine,
                startLine + countNewlines(content),
            ),
        });
    }

    return fragments;
}
