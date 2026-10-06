# AST vs fixed-size chunking ablation: sindresorhus/is

- Source commit: `e9c026c611c1160eaad50da00be4e676b626018f`
- Run time: `2026-10-06T20:53:02.176Z`
- Embedding model: `text-embedding-3-small`
- AST collection: `codebase-embeddings-openai-v1`
- Baseline collection: `codebase-embeddings-fixed-500-50-v1`
- Baseline: 500 `cl100k_base` tokens per chunk, 50 token overlap.
- Recall criterion: Per-question hit: at least one ground-truth file/symbol chunk appears in top 5.

| Question | AST Recall@5 | Fixed-size Recall@5 |
|---|---:|---:|
| IS-01 | yes | yes |
| IS-02 | yes | yes |
| IS-03 | yes | yes |
| IS-04 | yes | yes |
| IS-05 | yes | no |
| IS-06 | yes | yes |
| IS-07 | yes | yes |
| IS-08 | yes | yes |
| IS-09 | yes | yes |
| IS-10 | yes | yes |
| IS-11 | yes | yes |
| IS-12 | yes | yes |
| IS-13 | yes | yes |
| IS-14 | yes | yes |
| IS-15 | yes | no |
| IS-16 | yes | yes |
| IS-17 | yes | yes |
| IS-18 | yes | no |
| IS-19 | yes | yes |
| IS-20 | yes | no |

## Summary

| Questions | AST Recall@5 | Fixed-size Recall@5 |
|---:|---:|---:|
| 20 | 100.0% | 80.0% |

Both methods use the same approved questions, embedding model, source revision, and top-5 Qdrant search. AST point data comes from the standard evaluation index; baseline point data is re-chunked and embedded by this script.
