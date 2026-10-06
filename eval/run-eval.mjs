import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import process from 'node:process';

const evalDirectory = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(new URL('../backend/package.json', import.meta.url));
const OpenAI = require('openai').default ?? require('openai');
const { QdrantClient } = require('@qdrant/js-client-rest');
const questionPath = path.join(evalDirectory, 'questions.json');
const resultsPath = path.join(evalDirectory, 'results.json');
const reportPath = path.join(evalDirectory, 'results.md');
const questionSet = JSON.parse(await readFile(questionPath, 'utf8'));
const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 1536;
const ANSWER_MODEL = 'gpt-4.1-mini';

function validateQuestionSet(set) {
  if (!set || typeof set !== 'object' || !Array.isArray(set.questions)) {
    throw new Error('questions.json must contain a questions array.');
  }
  if (set.questions.length !== 20) {
    throw new Error(`Expected 20 questions, found ${set.questions.length}.`);
  }

  const ids = new Set();
  for (const question of set.questions) {
    if (
      typeof question.id !== 'string' ||
      !question.id ||
      ids.has(question.id) ||
      typeof question.question !== 'string' ||
      !question.question.trim() ||
      !Array.isArray(question.groundTruth) ||
      question.groundTruth.length === 0
    ) {
      throw new Error(`Invalid evaluation question: ${question.id ?? '(missing id)'}.`);
    }
    ids.add(question.id);
    for (const target of question.groundTruth) {
      if (
        typeof target.filePath !== 'string' ||
        !target.filePath ||
        (target.symbols !== undefined &&
          (!Array.isArray(target.symbols) ||
            target.symbols.some((symbol) => typeof symbol !== 'string' || !symbol)))
      ) {
        throw new Error(`Invalid ground truth for ${question.id}.`);
      }
    }
  }
}

if (process.argv.includes('--validate')) {
  validateQuestionSet(questionSet);
  console.log(`Question set valid: ${questionSet.questions.length} questions.`);
  process.exit(0);
}

require('dotenv').config({
  path: path.join(evalDirectory, '../backend/.env'),
  quiet: true,
});

function requireEnv(name) {
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
  return target.symbols.some((symbol) => {
    if (name === symbol) return true;
    return new RegExp(`\\b${escapeRegExp(symbol)}\\b`).test(content);
  });
}

function getHits(points, targets) {
  return points.map((point) => targets.some((target) => targetMatchesPoint(target, point)));
}

function percentile(values, percentileValue) {
  const sorted = [...values].sort((a, b) => a - b);
  const position = (sorted.length - 1) * percentileValue;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}

function answerCitesCorrectSource(answer, sources, targets) {
  return targets.some((target) => {
    const pathPattern = escapeRegExp(target.filePath);
    const citationPattern = new RegExp(
      `${pathPattern}[^\\n]{0,80}?(?:\\bline(?:s)?\\s*|:|#L?)(\\d+)`,
      'gi',
    );

    for (const match of answer.matchAll(citationPattern)) {
      const citedLine = Number(match[1]);
      const matchingSource = sources.find(
        (source) =>
          source.filePath === target.filePath &&
          citedLine >= source.startLine &&
          citedLine <= source.endLine &&
          (!target.symbols?.length ||
            target.symbols.some(
              (symbol) =>
                source.name === symbol ||
                new RegExp(`\\b${escapeRegExp(symbol)}\\b`).test(answer),
            )),
      );
      if (matchingSource) return true;
    }
    return false;
  });
}

async function readResponse(response, context) {
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${context} failed (${response.status}): ${text.slice(0, 1000)}`);
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`${context} returned invalid JSON.`, { cause: error });
  }
}

function renderMarkdown(result) {
  const rows = result.questions.map((question) => {
    const targets = question.groundTruth
      .map((target) => `${target.filePath}${target.symbols?.length ? ` (${target.symbols.join(', ')})` : ''}`)
      .join('<br>');
    return `| ${question.id} | ${targets} | ${question.recallAt1 ? 'yes' : 'no'} | ${question.recallAt5 ? 'yes' : 'no'} | ${question.endToEndLatencyMs.toFixed(2)} | ${question.agentHops} | ${question.answerCitesCorrectSource ? 'yes' : 'no'} |`;
  });

  return [
    `# Evaluation results: ${result.repository.name}`,
    '',
    `- Commit: \`${result.repository.commit}\``,
    `- Run time: \`${result.runAt}\``,
    `- Embedding model: \`${result.models.embedding}\``,
    `- Answer model: \`${result.models.answer}\``,
    `- Qdrant collection: \`${result.qdrantCollection}\``,
    `- Recall criterion: ${result.methodology.recallCriterion}`,
    `- Percentile method: ${result.methodology.percentileMethod}`,
    '',
    '| Question | Ground-truth files / symbols | Recall@1 | Recall@5 | End-to-end latency (ms) | Agent hops | Correct source citation |',
    '|---|---|---:|---:|---:|---:|---|',
    ...rows,
    '',
    '## Summary',
    '',
    '| Questions | Recall@1 | Recall@5 | Correct source citation | p50 latency (ms) | p95 latency (ms) |',
    '|---:|---:|---:|---:|---:|---:|',
    `| ${result.summary.questionCount} | ${(result.summary.recallAt1 * 100).toFixed(1)}% | ${(result.summary.recallAt5 * 100).toFixed(1)}% | ${(result.summary.correctSourceCitationRate * 100).toFixed(1)}% | ${result.summary.p50LatencyMs.toFixed(2)} | ${result.summary.p95LatencyMs.toFixed(2)} |`,
    '',
    'Latency is measured around the authenticated `/query` request. Retrieval recall is measured separately by embedding the question and querying Qdrant for the configured collection.',
    '',
  ].join('\n');
}

validateQuestionSet(questionSet);
const apiBaseUrl = (process.env.API_BASE_URL ?? 'http://localhost:3000/api').replace(/\/+$/, '');
const repoId = requireEnv('REPO_ID');
const email = requireEnv('EVAL_EMAIL');
const password = requireEnv('EVAL_PASSWORD');
const indexedCommit = requireEnv('INDEXED_COMMIT');
if (indexedCommit !== questionSet.repository.commit) {
  throw new Error(
    `Indexed commit ${indexedCommit} does not match the approved question-set commit ${questionSet.repository.commit}.`,
  );
}
const openai = new OpenAI({ apiKey: requireEnv('OPENAI_API_KEY') });
const collection = process.env.QDRANT_COLLECTION ?? 'codebase-embeddings-openai-v1';
const qdrant = new QdrantClient({
  url: process.env.QDRANT_URL ?? 'http://localhost:6333',
  ...(process.env.QDRANT_API_KEY ? { apiKey: process.env.QDRANT_API_KEY } : {}),
});

const indexedPoints = await qdrant.scroll(collection, {
  filter: {
    must: [
      { key: 'repoId', match: { value: repoId } },
      { key: 'sourceCommit', match: { value: indexedCommit } },
    ],
  },
  limit: 1,
  with_payload: false,
  with_vector: false,
});
if (indexedPoints.points.length === 0) {
  throw new Error(
    `No indexed points found for repo ${repoId} at commit ${indexedCommit} in collection ${collection}.`,
  );
}

let auth = await readResponse(
  await fetch(`${apiBaseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  }),
  'Login',
);
if (typeof auth.accessToken !== 'string' || typeof auth.refreshToken !== 'string') {
  throw new Error('Login response did not include access and refresh tokens.');
}

async function refreshAccessToken() {
  auth = await readResponse(
    await fetch(`${apiBaseUrl}/auth/refresh`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken: auth.refreshToken }),
    }),
    'Token refresh',
  );
}

const questions = [];
for (const item of questionSet.questions) {
  const embeddingResponse = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: item.question,
    dimensions: EMBEDDING_DIMENSIONS,
  });
  const queryVector = embeddingResponse.data[0]?.embedding;
  if (!queryVector) throw new Error(`No embedding returned for ${item.id}.`);

  const retrieval = await qdrant.query(collection, {
    query: queryVector,
    filter: {
      must: [
        { key: 'repoId', match: { value: repoId } },
        { key: 'sourceCommit', match: { value: indexedCommit } },
      ],
    },
    limit: 5,
    with_payload: true,
  });
  const hitRanks = getHits(retrieval.points, item.groundTruth);
  const start = performance.now();
  let queryResponse = await fetch(`${apiBaseUrl}/query`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${auth.accessToken}`,
    },
    body: JSON.stringify({ repoId, question: item.question }),
  });
  if (queryResponse.status === 401) {
    await refreshAccessToken();
    queryResponse = await fetch(`${apiBaseUrl}/query`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${auth.accessToken}`,
      },
      body: JSON.stringify({ repoId, question: item.question }),
    });
  }
  const endToEndLatencyMs = performance.now() - start;
  const response = await readResponse(queryResponse, `Query ${item.id}`);
  const sources = Array.isArray(response.sources) ? response.sources : [];
  const steps = Array.isArray(response.steps) ? response.steps : [];
  const agentHops = steps.reduce(
    (maximum, step) => Math.max(maximum, Number(step.hop) || 0),
    0,
  );

  questions.push({
    id: item.id,
    question: item.question,
    groundTruth: item.groundTruth,
    recallAt1: hitRanks[0] ?? false,
    recallAt5: hitRanks.some(Boolean),
    retrievedMatches: retrieval.points
      .map((point, index) => ({ point, rank: index + 1 }))
      .filter(({ point }) => item.groundTruth.some((target) => targetMatchesPoint(target, point)))
      .map(({ point, rank }) => ({
        rank,
        filePath: point.payload?.filePath,
        startLine: point.payload?.startLine,
        endLine: point.payload?.endLine,
        name: point.payload?.name,
      })),
    endToEndLatencyMs: Number(endToEndLatencyMs.toFixed(2)),
    agentHops,
    answerCitesCorrectSource: answerCitesCorrectSource(
      typeof response.answer === 'string' ? response.answer : '',
      sources,
      item.groundTruth,
    ),
    answer: response.answer,
  });

  console.log(`Completed ${item.id}.`);
}

const latencies = questions.map((question) => question.endToEndLatencyMs);
const summary = {
  questionCount: questions.length,
  recallAt1: questions.filter((question) => question.recallAt1).length / questions.length,
  recallAt5: questions.filter((question) => question.recallAt5).length / questions.length,
  correctSourceCitationRate:
    questions.filter((question) => question.answerCitesCorrectSource).length /
    questions.length,
  p50LatencyMs: Number(percentile(latencies, 0.5).toFixed(2)),
  p95LatencyMs: Number(percentile(latencies, 0.95).toFixed(2)),
};
const result = {
  repository: questionSet.repository,
  indexedCommit,
  runAt: new Date().toISOString(),
  repoId,
  models: { embedding: EMBEDDING_MODEL, answer: ANSWER_MODEL },
  qdrantCollection: collection,
  methodology: {
    recallCriterion: 'Per-question hit: at least one ground-truth file/symbol chunk appears in top-k.',
    percentileMethod: 'Linear interpolation over sorted end-to-end latency samples.',
  },
  summary,
  questions,
};

await writeFile(resultsPath, `${JSON.stringify(result, null, 2)}\n`);
await writeFile(reportPath, renderMarkdown(result));
console.log(`Wrote ${path.relative(process.cwd(), resultsPath)} and ${path.relative(process.cwd(), reportPath)}.`);
