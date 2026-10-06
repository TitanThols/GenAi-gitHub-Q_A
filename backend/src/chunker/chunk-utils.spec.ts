import { getEncoding } from 'js-tiktoken';
import { CodeChunk } from './chunker.service';
import { splitOversizedChunkForEmbedding } from './chunk-utils';

describe('splitOversizedChunkForEmbedding', () => {
    const encoder = getEncoding('cl100k_base');
    const chunk: CodeChunk = {
        fileName: 'large.ts',
        type: 'function',
        name: 'largeFunction',
        content: 'const value = 1;\n'.repeat(1700),
        startLine: 10,
        endLine: 1710,
    };

    it('preserves chunks within the embedding input limit', () => {
        const smallChunk = { ...chunk, content: 'function small() {}' };

        expect(splitOversizedChunkForEmbedding(smallChunk)).toEqual([smallChunk]);
    });

    it('splits oversized chunks and preserves source metadata and content', () => {
        const fragments = splitOversizedChunkForEmbedding(chunk);

        expect(fragments.length).toBeGreaterThan(1);
        expect(fragments.map((fragment) => fragment.content).join('')).toBe(chunk.content);
        expect(
            fragments.every(
                (fragment) => encoder.encode(fragment.content).length <= 8000,
            ),
        ).toBe(true);
        expect(fragments.every((fragment) => fragment.name === chunk.name)).toBe(true);
        expect(fragments.every((fragment) => fragment.fileName === chunk.fileName)).toBe(true);
        expect(fragments[0].startLine).toBe(chunk.startLine);
        expect(fragments.at(-1)?.endLine).toBe(chunk.endLine);
    });
});
