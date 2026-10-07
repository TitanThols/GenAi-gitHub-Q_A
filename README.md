# RepoQuery

RepoQuery indexes source code with Tree-sitter AST chunks and OpenAI embeddings, stores vectors in Qdrant, and answers repository questions with a multi-hop LLM agent.

## Accounts and indexed data

Repository records and ownership are stored in PostgreSQL. Source-code chunks and their embeddings are stored in the Qdrant `codebase-embeddings-openai-v1` collection, keyed by an internal repository ID. BullMQ uses Redis to queue indexing work; Redis is not the long-term store for indexed code.

Logging out removes the browser's saved authentication tokens and clears the current in-memory repository and chat state; it does not delete repository records or Qdrant points. Logging back in to the owning account makes its repositories available again. Repository listing, detail, deletion, and question requests are authenticated and scoped to the repository owner. Deleting a repository removes its Qdrant points before removing its PostgreSQL record; if vector deletion fails, the API reports the failure and retains the repository record.

The frontend stores access and refresh tokens in browser local storage. When an API request receives an expired-access-token response, it refreshes the tokens and retries that request. If the refresh token is expired or rejected, the browser clears the local session and requires a new login.

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

Use Node.js and npm versions supported by the backend project. Start the backend and make sure Qdrant is reachable. Configure the required credentials and settings in `backend/.env` using [backend/.env.example](./backend/.env.example); replace all example placeholders and do not commit the actual `.env` file.

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

## Deployment

The application needs a static frontend host, a Node.js backend host that can run the NestJS API and BullMQ worker, PostgreSQL for users/repository metadata, Redis for BullMQ, Qdrant for vectors, and an OpenAI API key. Qdrant Cloud and managed Redis/PostgreSQL providers can be used; keep all data services private or restrict their network/API-key access to the backend.

### 1. Provision the data services

- Create a PostgreSQL database and copy its TLS-enabled connection URL as `DATABASE_URL`.
- Create a Redis instance with BullMQ-compatible persistence and copy its connection URL as `REDIS_URL`. Use the provider's `rediss://` URL when TLS is required.
- Create a Qdrant Cloud cluster. Copy its HTTPS cluster URL to `QDRANT_URL` and its cluster API key to `QDRANT_API_KEY`.
- Create an OpenAI API key for embeddings and chat completions.

### 2. Deploy the backend API and worker

Deploy the `backend` directory as a Node.js service. Configure the build command as:

```bash
npm ci && npm run build
```

Configure the start command as:

```bash
npm run start:prod
```

The service binds to `PORT` (default `3000`) and serves the API below `/api`. Set the environment variables below in the backend host's secret/environment settings, not in source control:

| Variable | Required | Value |
|---|---|---|
| `NODE_ENV` | Yes | `production` |
| `PORT` | Host-dependent | Use the port provided by the host; defaults to `3000` |
| `DATABASE_URL` | Yes | Managed PostgreSQL connection URL; include provider-required TLS options |
| `REDIS_URL` | Yes | Managed Redis connection URL; use `rediss://` when required |
| `QDRANT_URL` | Yes | Qdrant Cloud HTTPS cluster URL |
| `QDRANT_API_KEY` | Yes for secured Qdrant Cloud | Qdrant cluster API key |
| `OPENAI_API_KEY` | Yes | OpenAI API key |
| `JWT_ACCESS_SECRET` | Yes | Long, random, private secret |
| `JWT_REFRESH_SECRET` | Yes | A separate long, random, private secret |
| `ALLOWED_ORIGINS` | Yes | Comma-separated exact frontend origins, without a trailing slash |

Do not set `NODE_ENV=production` until the PostgreSQL tables for the TypeORM entities have been created: production disables TypeORM schema synchronization. This repository does not yet include a migration command or checked-in initial migration, so database schema provisioning is currently a manual deployment prerequisite. Do not use TypeORM `synchronize` against production data.

The API process also runs the BullMQ consumer in the same NestJS application, so queue processing works while this single service is running. Do not deploy a separate worker unless you intentionally configure it to run this same application and share the same environment.

### 3. Deploy the frontend

Deploy the `frontend` directory as a static Vite site. Set `VITE_API_URL` at build time to the deployed backend URL ending in `/api`, for example `https://api.example.com/api`; see [frontend/.env.example](./frontend/.env.example). The Vite value is embedded into the public browser bundle, so it must contain only the API URL, never credentials.

Build command:

```bash
npm ci && npm run build
```

Publish directory: `dist`.

Configure the static host to rewrite application routes (such as `/dashboard`, `/repos/...`, and `/chat/...`) to `index.html`, while still serving existing static assets normally. Add the final HTTPS frontend origin to backend `ALLOWED_ORIGINS`, then redeploy/restart the backend after changing that setting.

### 4. Verify deployment

- Open the frontend over HTTPS, register or log in, and check that the dashboard loads.
- Add a public GitHub repository and confirm the status progresses to indexed; inspect backend logs for BullMQ, OpenAI, and Qdrant failures if it stalls.
- Open chat, ask a question, and test that a source citation loads the indexed chunk and its GitHub line link.
- Confirm a second account cannot read, query, or delete the first account's repository.
- Keep secrets in the service providers' secret stores. Never put OpenAI, Qdrant, database, Redis, or JWT secrets into `VITE_*` variables or commit a `.env` file.

The optional `EVAL_EMAIL`, `EVAL_PASSWORD`, `REPO_ID`, and `INDEXED_COMMIT` values in [backend/.env.example](./backend/.env.example) are only for local evaluation scripts; they are not needed by the deployed app.
