import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { stat, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { execFile as execFileCallback } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import process from 'node:process';

const execFile = promisify(execFileCallback);
const evalDirectory = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(new URL('../backend/package.json', import.meta.url));
const OpenAI = require('openai').default ?? require('openai');
const { QdrantClient } = require('@qdrant/js-client-rest');
const { getEncoding } = require('js-tiktoken');
const questionSet = JSON.parse(
  await readFile(path.join(evalDirectory, 'questions.json'), 'utf8'),
);
const RESULTS_PATH = path.join(evalDirectory, 'ablation-results.json');
const REPORT_PATH = path.join(evalDirectory, 'ablation-results.md');
const AST_COLLECTION = 'codebase-embeddings-openai-v1';
const FIXED_COLLECTION = 'codebase-embeddings-fixed-500-50-v1';
const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 1536;
const CHUNK_TOKENS = 500;
const OVERLAP_TOKENS = 50;
const SUPPORTED_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.py']);
const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  'coverage',
  'venv',
  '.venv',
  '__pycache__',
  '.idea',
  '.vscode',
]);

require('dotenv').config({
  path: path.join(evalDirectory, '../backend/.env'),
  quiet: true,
});

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function targetMatchesPoint(target, point) {
  const payload = point.payload ?? {};
  if (payload.filePath !== target.filePath) return false;
  if (!target.symbols?.length) return true;

  const name = typeof payload.name === 'string' ? payload.name : '';
  const content = typeof payload.content === 'string' ? payload.content : '';
  return target.symbols.some(
    (symbol) =>
      name === symbol || new RegExp(`\\b${escapeRegExp(symbol)}\\b`).test(content),
  );
}

async function collectFiles(directory, root, result = []) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && IGNORED_DIRS.has(entry.name)) continue;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await collectFiles(fullPath, root, result);
      continue;
    }
    if (!entry.isFile() || !SUPPORTED_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      continue;
    }
    const fileStat = await stat(fullPath);
    if (fileStat.size <= 500 * 1024) {
      result.push({ fullPath, relativePath: path.relative(root, fullPath) });
    }
  }
  return result;
}

function countLines(text) {
  return (text.match(/\n/g) ?? []).length;
}

function fixedSizeChunks(filePath, source, encoder) {
  const tokens = encoder.encode(source);
  const chunks = [];
  for (let tokenStart = 0; tokenStart < tokens.length; tokenStart += CHUNK_TOKENS - OVERLAP_TOKENS) {
    const tokenEnd = Math.min(tokenStart + CHUNK_TOKENS, tokens.length);
    const content = encoder.decode(tokens.slice(tokenStart, tokenEnd));
    const prefix = encoder.decode(tokens.slice(0, tokenStart));
    const throughChunk = encoder.decode(tokens.slice(0, tokenEnd));
    chunks.push({
      filePath,
      content,
      tokenStart,
      tokenCount: tokenEnd - tokenStart,
      startLine: countLines(prefix) + 1,
      endLine: Math.max(countLines(prefix) + 1, countLines(throughChunk) + (throughChunk.endsWith('\n') ? 0 : 1)),
    });
    if (tokenEnd === tokens.length) break;
  }
  return chunks;
}

async function ensureCollection(qdrant) {
  const exists = await qdrant.collectionExists(FIXED_COLLECTION);
  if (!exists.exists) {
    await qdrant.createCollection(FIXED_COLLECTION, {
      vectors: { size: EMBEDDING_DIMENSIONS, distance: 'Cosine' },
    });
  } else {
    const collection = await qdrant.getCollection(FIXED_COLLECTION);
    const size = collection.config.params.vectors.size;
    if (size !== EMBEDDING_DIMENSIONS) {
      throw new Error(
        `Collection ${FIXED_COLLECTION} has vector size ${size}, expected ${EMBEDDING_DIMENSIONS}.`,
      );
    }
  }
}

async function indexFixedChunks({
  openai,
  qdrant,
  repoId,
  sourceCommit,
  sourceDirectory,
}) {
  const encoder = getEncoding('cl100k_base');
  try {
    const files = await collectFiles(sourceDirectory, sourceDirectory);
    if (files.length === 0) throw new Error('No supported source files found for baseline indexing.');

    const chunks = [];
    for (const file of files) {
      const source = await readFile(file.fullPath, 'utf8');
      chunks.push(...fixedSizeChunks(file.relativePath, source, encoder));
    }
    if (chunks.length === 0) throw new Error('The selected source files produced no fixed-size chunks.');

    await ensureCollection(qdrant);
    await qdrant.delete(FIXED_COLLECTION, {
      wait: true,
      filter: { must: [{ key: 'repoId', match: { value: repoId } }] },
    });

    for (let offset = 0; offset < chunks.length; offset += 32) {
      const batch = chunks.slice(offset, offset + 32);
      const response = await openai.embeddings.create({
        model: EMBEDDING_MODEL,
        input: batch.map(
          (chunk) =>
            `// File: ${chunk.filePath}\n// Fixed token window\n${chunk.content}`,
        ),
        dimensions: EMBEDDING_DIMENSIONS,
      });
      const sorted = response.data.sort((a, b) => a.index - b.index);
      if (sorted.length !== batch.length) {
        throw new Error(
          `OpenAI returned ${sorted.length} vectors for ${batch.length} baseline chunks.`,
        );
      }

      await qdrant.upsert(FIXED_COLLECTION, {
        wait: true,
        points: batch.map((chunk, index) => ({
          id: randomUUID(),
          vector: sorted[index].embedding,
          payload: {
            repoId,
            sourceCommit,
            filePath: chunk.filePath,
            startLine: chunk.startLine,
            endLine: chunk.endLine,
            type: 'fixed-window',
            name: '',
            content: chunk.content,
            tokenStart: chunk.tokenStart,
            tokenCount: chunk.tokenCount,
          },
        })),
      });
      console.log(`Indexed fixed-window chunks ${offset + 1}-${offset + batch.length} of ${chunks.length}.`);
    }

    return { files: files.length, chunks: chunks.length };
  } finally {
    encoder.free?.();
  }
}

function renderMarkdown(result) {
  const rows = result.questions.map(
    (question) =>
      `| ${question.id} | ${question.astRecallAt5 ? 'yes' : 'no'} | ${question.fixedRecallAt5 ? 'yes' : 'no'} |`,
  );
  return [
    `# AST vs fixed-size chunking ablation: ${result.repository.name}`,
    '',
    `- Source commit: \`${result.sourceCommit}\``,
    `- Run time: \`${result.runAt}\``,
    `- Embedding model: \`${result.embeddingModel}\``,
    `- AST collection: \`${result.astCollection}\``,
    `- Baseline collection: \`${result.fixedCollection}\``,
    `- Baseline: ${result.baseline.chunkTokens} \`cl100k_base\` tokens per chunk, ${result.baseline.overlapTokens} token overlap.`,
    `- Recall criterion: ${result.methodology.recallCriterion}`,
    '',
    '| Question | AST Recall@5 | Fixed-size Recall@5 |',
    '|---|---:|---:|',
    ...rows,
    '',
    '## Summary',
    '',
    '| Questions | AST Recall@5 | Fixed-size Recall@5 |',
    '|---:|---:|---:|',
    `| ${result.summary.questionCount} | ${(result.summary.astRecallAt5 * 100).toFixed(1)}% | ${(result.summary.fixedRecallAt5 * 100).toFixed(1)}% |`,
    '',
    'Both methods use the same approved questions, embedding model, source revision, and top-5 Qdrant search. AST point data comes from the standard evaluation index; baseline point data is re-chunked and embedded by this script.',
    '',
  ].join('\n');
}

require('dotenv').config({
  path: path.join(evalDirectory, '../backend/.env'),
  quiet: true,
});

const repoId = requiredEnv('REPO_ID');
const sourceCommit = questionSet.repository.commit;
const indexedCommit = requiredEnv('INDEXED_COMMIT');
if (indexedCommit !== sourceCommit) {
  throw new Error(`INDEXED_COMMIT does not match approved source commit ${sourceCommit}.`);
}
const openai = new OpenAI({ apiKey: requiredEnv('OPENAI_API_KEY') });
const qdrant = new QdrantClient({
  url: process.env.QDRANT_URL ?? 'http://localhost:6333',
  ...(process.env.QDRANT_API_KEY ? { apiKey: process.env.QDRANT_API_KEY } : {}),
});
const workingDirectory = await mkdtemp(path.join(tmpdir(), 'repoquery-ablation-'));

try {
  const sourceDirectory = path.join(workingDirectory, 'source');
  await execFile('git', ['clone', '--depth=1', questionSet.repository.url, sourceDirectory]);
  const { stdout: clonedCommit } = await execFile('git', ['-C', sourceDirectory, 'rev-parse', 'HEAD']);
  let sourceRevision = clonedCommit.trim();
  if (sourceRevision !== sourceCommit) {
    await execFile('git', ['-C', sourceDirectory, 'fetch', '--depth=1', 'origin', sourceCommit]);
    await execFile('git', ['-C', sourceDirectory, 'checkout', '--detach', sourceCommit]);
    const { stdout } = await execFile('git', ['-C', sourceDirectory, 'rev-parse', 'HEAD']);
    sourceRevision = stdout.trim();
  }
  if (sourceRevision !== sourceCommit) {
    throw new Error(`Cloned source commit ${sourceRevision}, expected ${sourceCommit}.`);
  }

  const { files, chunks } = await indexFixedChunks({
    openai,
    qdrant,
    repoId,
    sourceCommit,
    sourceDirectory,
  });

  const astCount = await qdrant.count(AST_COLLECTION, {
    exact: true,
    filter: {
      must: [
        { key: 'repoId', match: { value: repoId } },
        { key: 'sourceCommit', match: { value: sourceCommit } },
      ],
    },
  });
  if (astCount.count === 0) {
    throw new Error(`No AST chunks found for repo ${repoId} at ${sourceCommit}.`);
  }

  const questions = [];
  for (const question of questionSet.questions) {
    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: question.question,
      dimensions: EMBEDDING_DIMENSIONS,
    });
    const vector = response.data[0]?.embedding;
    if (!vector) throw new Error(`No query embedding returned for ${question.id}.`);

    const filter = {
      must: [
        { key: 'repoId', match: { value: repoId } },
        { key: 'sourceCommit', match: { value: sourceCommit } },
      ],
    };
    const [astResults, fixedResults] = await Promise.all([
      qdrant.query(AST_COLLECTION, {
        query: vector,
        filter,
        limit: 5,
        with_payload: true,
      }),
      qdrant.query(FIXED_COLLECTION, {
        query: vector,
        filter,
        limit: 5,
        with_payload: true,
      }),
    ]);
    questions.push({
      id: question.id,
      question: question.question,
      astRecallAt5: astResults.points.some((point) =>
        question.groundTruth.some((target) => targetMatchesPoint(target, point)),
      ),
      fixedRecallAt5: fixedResults.points.some((point) =>
        question.groundTruth.some((target) => targetMatchesPoint(target, point)),
      ),
      astMatches: astResults.points
        .map((point, index) => ({ point, rank: index + 1 }))
        .filter(({ point }) =>
          question.groundTruth.some((target) => targetMatchesPoint(target, point)),
        )
        .map(({ point, rank }) => ({
          rank,
          filePath: point.payload?.filePath,
          startLine: point.payload?.startLine,
          endLine: point.payload?.endLine,
          name: point.payload?.name,
        })),
      fixedMatches: fixedResults.points
        .map((point, index) => ({ point, rank: index + 1 }))
        .filter(({ point }) =>
          question.groundTruth.some((target) => targetMatchesPoint(target, point)),
        )
        .map(({ point, rank }) => ({
          rank,
          filePath: point.payload?.filePath,
          startLine: point.payload?.startLine,
          endLine: point.payload?.endLine,
        })),
    });
    console.log(`Compared ${question.id}.`);
  }

  const summary = {
    questionCount: questions.length,
    astRecallAt5:
      questions.filter((question) => question.astRecallAt5).length / questions.length,
    fixedRecallAt5:
      questions.filter((question) => question.fixedRecallAt5).length / questions.length,
  };
  const result = {
    repository: questionSet.repository,
    repoId,
    sourceCommit,
    runAt: new Date().toISOString(),
    embeddingModel: EMBEDDING_MODEL,
    astCollection: AST_COLLECTION,
    fixedCollection: FIXED_COLLECTION,
    baseline: {
      chunkTokens: CHUNK_TOKENS,
      overlapTokens: OVERLAP_TOKENS,
      tokenizer: 'cl100k_base',
      files,
      chunks,
    },
    astChunks: astCount.count,
    methodology: {
      recallCriterion:
        'Per-question hit: at least one ground-truth file/symbol chunk appears in top 5.',
    },
    summary,
    questions,
  };
  await writeFile(RESULTS_PATH, `${JSON.stringify(result, null, 2)}\n`);
  await writeFile(REPORT_PATH, renderMarkdown(result));
  console.log(`Wrote ${path.relative(process.cwd(), RESULTS_PATH)} and ${path.relative(process.cwd(), REPORT_PATH)}.`);
} finally {
  await rm(workingDirectory, { recursive: true, force: true });
}
