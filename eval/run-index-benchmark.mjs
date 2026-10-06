import { mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { execFile as execFileCallback } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const execFile = promisify(execFileCallback);
const evalDirectory = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(new URL('../backend/package.json', import.meta.url));
const { ChunkerService } = require('../backend/dist/chunker/chunker.service.js');
const { splitOversizedChunkForEmbedding } = require('../backend/dist/chunker/chunk-utils.js');
const { EmbeddingService } = require('../backend/dist/embedding/embedding.service.js');
const { QdrantClient } = require('@qdrant/js-client-rest');
const benchmarkSet = JSON.parse(
  await readFile(path.join(evalDirectory, 'index-benchmarks.json'), 'utf8'),
);
const RESULTS_PATH = path.join(evalDirectory, 'index-benchmark-results.json');
const REPORT_PATH = path.join(evalDirectory, 'index-benchmark-results.md');
const COLLECTION = 'codebase-embeddings-index-benchmark-v1';
const VECTOR_DIMENSIONS = 1536;
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.py']);
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
const MAX_FILE_SIZE_BYTES = 500 * 1024;
const EMBED_BATCH_SIZE = 10;

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

require('dotenv').config({
  path: path.join(evalDirectory, '../backend/.env'),
  quiet: true,
});

if (
  benchmarkSet.repositories.length !== 3 ||
  new Set(benchmarkSet.repositories.map((repo) => repo.sizeClass)).size !== 3
) {
  throw new Error('The benchmark set must contain three repos with distinct size classes.');
}

async function collectFiles(directory, root, files = []) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && IGNORED_DIRS.has(entry.name)) continue;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await collectFiles(fullPath, root, files);
      continue;
    }
    if (!entry.isFile() || !SOURCE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      continue;
    }
    const fileStats = await stat(fullPath);
    if (fileStats.size <= MAX_FILE_SIZE_BYTES) {
      files.push({ fullPath, relativePath: path.relative(root, fullPath) });
    }
  }
  return files;
}

async function ensureCollection(qdrant) {
  const exists = await qdrant.collectionExists(COLLECTION);
  if (!exists.exists) {
    await qdrant.createCollection(COLLECTION, {
      vectors: { size: VECTOR_DIMENSIONS, distance: 'Cosine' },
    });
    return;
  }
  const current = await qdrant.getCollection(COLLECTION);
  if (current.config.params.vectors.size !== VECTOR_DIMENSIONS) {
    throw new Error(`Collection ${COLLECTION} has an incompatible vector size.`);
  }
}

async function clonePinnedRepository(repo, directory) {
  await execFile('git', ['clone', '--depth=1', repo.url, directory]);
  let { stdout } = await execFile('git', ['-C', directory, 'rev-parse', 'HEAD']);
  let actualCommit = stdout.trim();
  if (actualCommit !== repo.commit) {
    await execFile('git', ['-C', directory, 'fetch', '--depth=1', 'origin', repo.commit]);
    await execFile('git', ['-C', directory, 'checkout', '--detach', repo.commit]);
    ({ stdout } = await execFile('git', ['-C', directory, 'rev-parse', 'HEAD']));
    actualCommit = stdout.trim();
  }
  if (actualCommit !== repo.commit) {
    throw new Error(`Checked out ${actualCommit} for ${repo.name}, expected ${repo.commit}.`);
  }
}

async function indexRepository({
  repo,
  sourceDirectory,
  chunker,
  embedding,
  qdrant,
}) {
  const repoId = repo.name;
  const totalStartedAt = performance.now();
  let cloneMs = 0;
  let chunkingMs = 0;
  let embeddingMs = 0;
  let qdrantUpsertMs = 0;
  let embeddingRetryCount = 0;
  let embeddingBackoffMs = 0;
  const cloneStartedAt = performance.now();
  await clonePinnedRepository(repo, sourceDirectory);
  cloneMs = performance.now() - cloneStartedAt;

  const filesStartedAt = performance.now();
  const files = await collectFiles(sourceDirectory, sourceDirectory);
  const chunks = [];
  for (const file of files) {
    const source = await readFile(file.fullPath, 'utf8');
    chunks.push(
      ...chunker
        .chunkFile(file.relativePath, source)
        .flatMap(splitOversizedChunkForEmbedding)
        .map((chunk) => ({ chunk, relativePath: file.relativePath })),
    );
  }
  chunkingMs = performance.now() - filesStartedAt;
  if (files.length === 0) {
    throw new Error(`No supported source files found in ${repo.name}.`);
  }
  if (chunks.length === 0) {
    throw new Error(`Tree-sitter produced no chunks for ${repo.name}.`);
  }

  await qdrant.delete(COLLECTION, {
    wait: true,
    filter: { must: [{ key: 'repoId', match: { value: repoId } }] },
  });

  const batches = Math.ceil(chunks.length / EMBED_BATCH_SIZE);
  for (let offset = 0; offset < chunks.length; offset += EMBED_BATCH_SIZE) {
    const batch = chunks.slice(offset, offset + EMBED_BATCH_SIZE);
    const texts = batch.map(
      ({ chunk, relativePath }) =>
        `// File: ${relativePath}\n// Type: ${chunk.type} ${chunk.name}${chunk.parentClass ? ` (in ${chunk.parentClass})` : ''}\n${chunk.content}`,
    );
    const embeddingStartedAt = performance.now();
    const vectors = await embedding.embedBatch(
      texts,
      EMBED_BATCH_SIZE,
      (delayMs) => {
        embeddingRetryCount++;
        embeddingBackoffMs += delayMs;
        console.warn(
          `Rate-limit/server retry for ${repo.name}; waiting ${delayMs}ms.`,
        );
      },
    );
    embeddingMs += performance.now() - embeddingStartedAt;
    if (vectors.length !== batch.length) {
      throw new Error(`Embedding count mismatch in ${repo.name} at chunk offset ${offset}.`);
    }

    const points = batch.map(({ chunk, relativePath }, index) => ({
      id: randomUUID(),
      vector: vectors[index],
      payload: {
        repoId,
        sourceCommit: repo.commit,
        repository: repo.name,
        filePath: relativePath,
        startLine: chunk.startLine,
        endLine: chunk.endLine,
        type: chunk.type,
        name: chunk.name,
        parentClass: chunk.parentClass,
        content: chunk.content,
      },
    }));
    const upsertStartedAt = performance.now();
    await qdrant.upsert(COLLECTION, { wait: true, points });
    qdrantUpsertMs += performance.now() - upsertStartedAt;
    console.log(
      `${repo.name}: embedded/upserted chunk batch ${Math.floor(offset / EMBED_BATCH_SIZE) + 1} of ${batches}.`,
    );
  }

  return {
    name: repo.name,
    url: repo.url,
    sizeClass: repo.sizeClass,
    sourceCommit: repo.commit,
    repoId,
    fileCount: files.length,
    chunkCount: chunks.length,
    totalIndexTimeMs: Number((performance.now() - totalStartedAt).toFixed(2)),
    stageTimesMs: {
      clone: Number(cloneMs.toFixed(2)),
      fileDiscoveryAndChunking: Number(chunkingMs.toFixed(2)),
      embedding: Number(embeddingMs.toFixed(2)),
      qdrantUpsert: Number(qdrantUpsertMs.toFixed(2)),
    },
    embeddingBatches: batches,
    rateLimitRetryCount: embeddingRetryCount,
    rateLimitBackoffMs: embeddingBackoffMs,
    status: 'indexed',
  };
}

function renderMarkdown(result) {
  const rows = result.repositories.map(
    (repo) =>
      `| ${repo.sizeClass} | ${repo.name} | ${repo.sourceCommit} | ${repo.fileCount} | ${repo.chunkCount} | ${repo.totalIndexTimeMs.toFixed(2)} | ${repo.rateLimitRetryCount} | ${repo.rateLimitBackoffMs} |`,
  );
  return [
    '# Repository indexing benchmark',
    '',
    `- Run time: \`${result.runAt}\``,
    `- Embedding model: \`${result.embeddingModel}\``,
    `- Collection: \`${result.collection}\``,
    `- Supported extensions: \`${result.methodology.extensions.join(', ')}\``,
    `- Fixed pause between embedding batches: \`${result.methodology.interBatchPauseMs} ms\``,
    '',
    '| Size class | Repository | Commit | Files | AST chunks | Total index time (ms) | Rate-limit retries | Backoff time (ms) |',
    '|---|---|---|---:|---:|---:|---:|---:|',
    ...rows,
    '',
    'Total index time is measured by this runner from the start of cloning through completion of the final Qdrant upsert. Backoff time includes provider-requested or exponential retry waits reported by the embedding service. Zero retries means no retry was observed during that run.',
    '',
  ].join('\n');
}

const qdrant = new QdrantClient({
  url: process.env.QDRANT_URL ?? 'http://localhost:6333',
  ...(process.env.QDRANT_API_KEY ? { apiKey: process.env.QDRANT_API_KEY } : {}),
});
const apiKey = requiredEnv('OPENAI_API_KEY');
const configService = {
  getOrThrow(name) {
    if (name === 'OPENAI_API_KEY') return apiKey;
    throw new Error(`Unexpected required setting requested: ${name}`);
  },
};
const chunker = new ChunkerService();
const embedding = new EmbeddingService(configService);
const workingDirectory = await mkdtemp(path.join(tmpdir(), 'repoquery-index-benchmark-'));

try {
  await ensureCollection(qdrant);
  await chunker.onModuleInit();
  const repositories = [];
  for (const repo of benchmarkSet.repositories) {
    const safeName = repo.name.replaceAll('/', '__');
    const sourceDirectory = path.join(workingDirectory, safeName);
    repositories.push(
      await indexRepository({
        repo,
        sourceDirectory,
        chunker,
        embedding,
        qdrant,
      }),
    );
  }

  const result = {
    runAt: new Date().toISOString(),
    embeddingModel: embedding.model,
    embeddingDimensions: embedding.dimensions,
    collection: COLLECTION,
    methodology: {
      extensions: ['.ts', '.tsx', '.js', '.jsx', '.py'],
      maxFileSizeBytes: MAX_FILE_SIZE_BYTES,
      embeddingBatchSize: EMBED_BATCH_SIZE,
      interBatchPauseMs: 0,
      indexingPipeline: 'Tree-sitter AST chunking -> OpenAI embeddings -> Qdrant upsert',
      totalIndexTimeDefinition:
        'Wall-clock time from start of clone through completion of the final Qdrant upsert.',
      rateLimitBackoff:
        'Sum of actual retry delays invoked by EmbeddingService during this indexing run.',
    },
    repositories,
  };
  await writeFile(RESULTS_PATH, `${JSON.stringify(result, null, 2)}\n`);
  await writeFile(REPORT_PATH, renderMarkdown(result));
  console.log(`Wrote ${path.relative(process.cwd(), RESULTS_PATH)} and ${path.relative(process.cwd(), REPORT_PATH)}.`);
} finally {
  await rm(workingDirectory, { recursive: true, force: true });
}
