# Evaluation results: sindresorhus/is

- Commit: `e9c026c611c1160eaad50da00be4e676b626018f`
- Run time: `2026-10-06T20:45:27.548Z`
- Embedding model: `text-embedding-3-small`
- Answer model: `gpt-4.1-mini`
- Qdrant collection: `codebase-embeddings-openai-v1`
- Recall criterion: Per-question hit: at least one ground-truth file/symbol chunk appears in top-k.
- Percentile method: Linear interpolation over sorted end-to-end latency samples.

| Question | Ground-truth files / symbols | Recall@1 | Recall@5 | End-to-end latency (ms) | Agent hops | Correct source citation |
|---|---|---:|---:|---:|---:|---|
| IS-01 | source/index.ts (isAll) | yes | yes | 6960.01 | 2 | yes |
| IS-02 | source/index.ts (isAny) | yes | yes | 8808.53 | 2 | yes |
| IS-03 | source/index.ts (isOptional) | yes | yes | 6276.35 | 2 | yes |
| IS-04 | source/index.ts (isArray) | yes | yes | 5965.23 | 2 | yes |
| IS-05 | source/index.ts (isArrayBuffer) | yes | yes | 6640.97 | 2 | no |
| IS-06 | source/index.ts (isArrayLike) | yes | yes | 5331.35 | 2 | yes |
| IS-07 | source/index.ts (isArrayOf) | yes | yes | 6288.84 | 2 | yes |
| IS-08 | source/index.ts (isAsyncFunction) | yes | yes | 5678.42 | 2 | yes |
| IS-09 | source/index.ts (isAsyncGenerator) | yes | yes | 5673.13 | 2 | yes |
| IS-10 | source/index.ts (isAsyncIterable) | yes | yes | 2892.13 | 1 | yes |
| IS-11 | source/index.ts (isBigint) | yes | yes | 2828.76 | 1 | yes |
| IS-12 | source/index.ts (isBoolean) | no | yes | 5153.82 | 2 | yes |
| IS-13 | source/index.ts (isClass) | yes | yes | 5368.52 | 2 | yes |
| IS-14 | source/index.ts (isDate) | yes | yes | 6495.71 | 2 | yes |
| IS-15 | source/index.ts (isEmptyArray) | yes | yes | 6029.32 | 2 | yes |
| IS-16 | source/index.ts (isEmptyObject) | yes | yes | 5432.77 | 2 | yes |
| IS-17 | source/index.ts (isError) | yes | yes | 5617.26 | 2 | yes |
| IS-18 | source/index.ts (isEvenInteger) | yes | yes | 5199.23 | 2 | yes |
| IS-19 | source/index.ts (isFalsy) | yes | yes | 5916.94 | 2 | yes |
| IS-20 | source/index.ts (isFiniteNumber) | no | yes | 2449.26 | 1 | yes |

## Summary

| Questions | Recall@1 | Recall@5 | Correct source citation | p50 latency (ms) | p95 latency (ms) |
|---:|---:|---:|---:|---:|---:|
| 20 | 90.0% | 100.0% | 95.0% | 5675.77 | 7052.44 |

Latency is measured around the authenticated `/query` request. Retrieval recall is measured separately by embedding the question and querying Qdrant for the configured collection.
