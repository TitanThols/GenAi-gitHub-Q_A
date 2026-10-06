# Repository indexing benchmark

- Run time: `2026-10-06T20:59:01.119Z`
- Embedding model: `text-embedding-3-small`
- Collection: `codebase-embeddings-index-benchmark-v1`
- Supported extensions: `.ts, .tsx, .js, .jsx, .py`
- Fixed pause between embedding batches: `0 ms`

| Size class | Repository | Commit | Files | AST chunks | Total index time (ms) | Rate-limit retries | Backoff time (ms) |
|---|---|---|---:|---:|---:|---:|---:|
| small | sindresorhus/is | e9c026c611c1160eaad50da00be4e676b626018f | 5 | 340 | 16105.24 | 0 | 0 |
| medium | sindresorhus/ky | 0d59458a0a58e1c3d7c6db0ab17ed5c7cd671e47 | 87 | 417 | 19391.63 | 0 | 0 |
| large | sindresorhus/type-fest | e9f614f191aa039e4aefa2d41d62c2a3fd070cfd | 457 | 1512 | 63559.17 | 0 | 0 |

Total index time is measured by this runner from the start of cloning through completion of the final Qdrant upsert. Backoff time includes provider-requested or exponential retry waits reported by the embedding service. Zero retries means no retry was observed during that run.
