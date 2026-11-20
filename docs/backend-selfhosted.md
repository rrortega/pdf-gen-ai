# Self-hosted backend

The application can run against Appwrite (legacy, default) or against
PostgreSQL + Redis + S3-compatible storage (for example MinIO). One variable
selects the whole server-side backend:

```sh
BACKEND_PROVIDER=appwrite   # default: unchanged legacy behaviour
BACKEND_PROVIDER=postgres   # self-hosted data, auth, jobs and files
```

The selector is read on the server only (`src/backend/config.ts`). No request
mixes the two backends, and the Appwrite code paths stay identical when
`postgres` is selected: every route change is an additive early return.

## Environment

Data and authentication (`postgres` only):

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string. Read lazily, so legacy deployments never need it. |

Files:

| Variable | Purpose |
|---|---|
| `S3_ENDPOINT` | S3/MinIO endpoint. This is also the host used when signing downloads, so it must be reachable from the browser. |
| `S3_BUCKET` | Bucket holding generated PDFs. |
| `S3_ACCESS_KEY` / `S3_SECRET_KEY` | Credentials. MinIO community edition only offers root credentials. |
| `S3_REGION` | Defaults to `us-east-1`. |
| `S3_PRESIGN_EXPIRES_SECONDS` | Download URL lifetime, defaults to `900`. |

Jobs:

| Variable | Default | Purpose |
|---|---|---|
| `REDIS_URL` | — | Required for the queue. `ioredis` is a declared dependency; BullMQ cannot build a client without it. |
| `PDF_QUEUE_NAME` | `pdf-generation` | Generation queue. |
| `WEBHOOK_QUEUE_NAME` | `webhook-delivery` | Webhook delivery queue. |
| `PDF_QUEUE_JOB_ATTEMPTS` | `3` | Attempts per job, exponential backoff from 5 s. |
| `PDF_WORKER_CONCURRENCY` | `2` | Concurrent generation jobs per worker. |
| `PDF_BROWSER_RECYCLE_JOBS` | — | Recycle the browser after N jobs. |

Shared with the legacy path: `JWT_SECRET`, `MCP_API_KEY`, `PDF_GENERATION_MODE`,
`NEXT_PUBLIC_DOMAIN`/`NEXT_PUBLIC_APP_URL`.

## Schema

Two idempotent scripts, safe to run on every deploy:

- `scripts/migrations/001-postgres-data-backend.sql` — templates, documents,
  webhook deliveries, including the `queued|pending|completed|failed|trashed`
  statuses, render settings, signature and retry fields.
- `scripts/migrations/002-auth.sql` — users, sessions, password-reset tokens,
  API keys, OAuth codes and tokens. Only one-way hashes are stored; there is no
  plaintext secret column.

They are applied by the setup route and at worker startup. To apply them
manually:

```sh
DATABASE_URL=... node --import tsx -e \
  'const m = await import("./src/backend/postgres/migrate.ts"); await m.runPostgresDataMigrationsWithPool()'
DATABASE_URL=... node --import tsx -e \
  'const m = await import("./src/backend/postgres/auth/migrate.ts"); await m.runPostgresAuthMigrationsWithPool()'
```

## Worker

PDF generation and webhook delivery run in a separate long-lived process:

```sh
BACKEND_PROVIDER=postgres node --import tsx src/worker/pdf-worker.ts
```

It reuses the existing `PDFGenerator`, renders one page per job, recycles the
browser periodically, retries webhooks with backoff and shuts down gracefully on
`SIGTERM`/`SIGINT`. PDFs are rendered by Puppeteer's managed Chrome for Testing;
Node 22.12 or newer is required.

## Ownership model

Every owner-scoped query filters by `user_id`. Two system-principal reads exist
and are documented in the code: the background worker (`getById`/`updateById`)
and the signature-authenticated download, both of which apply their access check
immediately after the read. The browser never talks to PostgreSQL: document and
dashboard views fall back to polling under the `postgres` provider.

## Verification status

Verified against real remote services during development: schema application,
owner isolation, document status transitions, MinIO upload and presigned
download of a real PDF, BullMQ enqueue/consume, and the full chain
queue → worker → PDF → storage → `completed`.

Not verified: SMTP delivery (only the offline adapter was exercised), OAuth
against a third-party identity provider, and behaviour under production load.
