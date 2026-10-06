# RepoQuery

RepoQuery indexes source code with Tree-sitter AST chunks and OpenAI embeddings, stores vectors in Qdrant, and answers repository questions with a multi-hop LLM agent.

## Measured results

These are outputs from the committed scripts and data files linked below, not estimates. The evaluation and ablation use the pinned `sindresorhus/is` revision `e9c026c611c1160eaad50da00be4e676b626018f` and the same approved set of 20 questions.

### Question answering evaluation

| Questions | Recall@1 | Recall@5 | Correct source citation | p50 latency (ms) | p95 latency (ms) |
|---:|---:|---:|---:|---:|---:|
| 20 | 90.0% | 100.0% | 95.0% | 5675.77 | 7052.44 |

Recall is a per-question hit: at least one ground-truth file/symbol chunk appears in the top-k results. Latency is measured around the authenticated `/query` request. Full per-question data and run metadata are in [eval/results.md](./eval/results.md) and [eval/results.json](./eval/results.json).

### Chunking ablation

| Chunking method | Recall@5 |
|---|---:|
| Tree-sitter AST | 100.0% |
| Fixed-size (500 tokens, 50-token overlap) | 80.0% |

This is a retrieval-only comparison: both methods use the same question set, source revision, embedding model, and top-five Qdrant search. See [eval/ablation-results.md](./eval/ablation-results.md) and [eval/ablation-results.json](./eval/ablation-results.json) for the per-question results and run details.

### Indexing benchmark

| Size class | Repository | Eligible source files | AST chunks | Total index time (ms) | Rate-limit retries | Backoff time (ms) |
|---|---|---:|---:|---:|---:|---:|
| Small | `sindresorhus/is` | 5 | 340 | 16105.24 | 0 | 0 |
| Medium | `sindresorhus/ky` | 87 | 417 | 19391.63 | 0 | 0 |
| Large | `sindresorhus/type-fest` | 457 | 1512 | 63559.17 | 0 | 0 |

The benchmark uses pinned source revisions, supports `.ts`, `.tsx`, `.js`, `.jsx`, and `.py`, and excludes individual files larger than 500 KB. Total time runs from clone start through the final Qdrant upsert. No retry or backoff was observed in this run. See [eval/index-benchmark-results.md](./eval/index-benchmark-results.md) and [eval/index-benchmark-results.json](./eval/index-benchmark-results.json).

## Reproducing the measurements

Use Node.js and npm versions supported by the backend project. Start the backend and make sure Qdrant is reachable. Configure the required credentials and settings in `backend/.env` using [backend/.env.example](./backend/.env.example); do not commit that file.

Validate the committed question set without making API calls:

```bash
cd backend
npm ci
npm run eval:validate
```

Run the end-to-end evaluation against the already-indexed approved repository revision. Set `REPO_ID`, `INDEXED_COMMIT`, `EVAL_EMAIL`, and `EVAL_PASSWORD` in `backend/.env`; configure `API_BASE_URL`, `QDRANT_URL`, `QDRANT_API_KEY`, and `OPENAI_API_KEY` as needed for your environment.

```bash
cd backend
npm run eval
```

Run the AST-versus-fixed-size retrieval ablation. Set `REPO_ID` and `INDEXED_COMMIT` to the indexed evaluation repository and commit in `backend/.env`.

```bash
cd backend
npm run eval:ablation
```

Run the three-repository indexing benchmark. It clones the pinned commits in [eval/index-benchmarks.json](./eval/index-benchmarks.json), embeds the chunks, and writes the measured results to `eval/index-benchmark-results.json` and `eval/index-benchmark-results.md` after all repositories complete.

```bash
cd backend
npm ci
npm run build
npm run benchmark:index
```

The evaluation, ablation, and indexing benchmark make OpenAI API calls and may incur charges. Each runner overwrites its corresponding result files when it completes; retain the committed baseline outputs if comparing a new run.

## Limitations

- The question-answering evaluation and ablation use only 20 questions from one repository and one pinned revision; results do not establish general performance across languages, repository sizes, or question types.
- The 20-question sample is small, and measured latency is specific to this run and its local/network/provider conditions.
- Citation correctness is checked by a script against the ground-truth paths and source-line ranges; it is not a human quality assessment of explanation correctness.
- The ablation measures retrieval Recall@5 only. It does not compare answer quality, latency, or indexing cost between chunking methods.
- The indexing benchmark covers three pinned TypeScript-oriented repositories under the runner's supported-extension and file-size rules. It is a single run; the observed absence of retries does not predict rate limiting on other runs.
- These committed outputs are reproducible records of specific runs, not guarantees that future runs will return identical latency or retrieval results.
