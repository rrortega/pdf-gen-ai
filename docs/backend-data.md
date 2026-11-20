# Self-hosted data backend (PostgreSQL + MinIO + BullMQ)

`BACKEND_PROVIDER` selects the complete server-side data backend:

- `BACKEND_PROVIDER=appwrite` (default, unset counts as appwrite): legacy Appwrite behaviour, unchanged.
- `BACKEND_PROVIDER=postgres`: self-hosted PostgreSQL data, MinIO object storage and a BullMQ worker for PDF generation and webhook delivery.

Invalid values throw `BACKEND_PROVIDER must be appwrite or postgres` (see `src/backend/config.ts`).

## Environment variables

### Database (postgres provider)

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string for the shared lazy pool (`src/backend/db.ts`). |

### Object storage (MinIO, S3 API)

| Variable | Purpose |
| --- | --- |
| `S3_ENDPOINT` | MinIO endpoint, e.g. `http://minio:9000`. |
| `S3_BUCKET` | Bucket for generated PDFs. |
| `S3_ACCESS_KEY` / `S3_SECRET_KEY` | MinIO credentials. |
| `S3_REGION` | Optional, defaults to `us-east-1`. |
| `S3_PRESIGN_EXPIRES_SECONDS` | Optional presigned download lifetime, defaults to `900`. |

Presigned download URLs are computed locally (SigV4) and expire after the configured window.

### Job queue and worker (BullMQ)

| Variable | Purpose |
| --- | --- |
| `REDIS_URL` | Redis connection URL. Required only when a flow enqueues (queue/webhook generation modes). |
| `PDF_QUEUE_NAME` | Optional, defaults to `pdf-generation`. |
| `WEBHOOK_QUEUE_NAME` | Optional, defaults to `webhook-delivery`. |
| `PDF_QUEUE_JOB_ATTEMPTS` | Optional BullMQ job attempts, defaults to `3`. |
| `PDF_WORKER_CONCURRENCY` | Optional worker concurrency, defaults to `2` (bounded). |
| `PDF_BROWSER_RECYCLE_JOBS` | Optional browser recycle interval, defaults to `100` completed jobs. |
| `PDF_WEBHOOK_MAX_ATTEMPTS` | Optional webhook delivery attempts, defaults to `3`. |
| `PDF_WEBHOOK_BACKOFF_BASE_MS` | Optional exponential backoff base, defaults to `10000`, capped at `60000`. |
| `PDF_GENERATION_MODE` | `sync` (default) or `queue`. |
| `PDF_GENERATION_TIMEOUT` | Queue-wait polling timeout in seconds, defaults to `30`. |
| `JWT_SECRET` | Signs download JWTs (already used by the legacy path). |

### Browser realtime degradation

Client components read `NEXT_PUBLIC_BACKEND_PROVIDER` (inlined at build time):

- unset or `appwrite`: Appwrite realtime subscriptions, exactly as today.
- `postgres`: no browser database access; the documents list polls the documents API every 15s and the dashboard refetches via `router.refresh()` every 30s. Webhook delivery logs degrade to the delivery summary stored on the document row.

## Migration

```bash
psql "$DATABASE_URL" -f scripts/migrations/001-postgres-data-backend.sql
```

The script is idempotent (every statement uses `IF NOT EXISTS`, nothing is dropped). `POST /api/setup` runs the same script when `BACKEND_PROVIDER=postgres`, and the worker re-runs it at startup.

## Worker

```bash
node --import tsx src/worker/pdf-worker.ts
```

Requires `BACKEND_PROVIDER=postgres` plus the database/Redis/MinIO variables above. The worker:

- consumes `pdf-generation` jobs: renders with the shared `PDFGenerator` (one page per job, browser closed per render), uploads the PDF to MinIO, marks the document `completed` with a signed download JWT;
- consumes `webhook-delivery` jobs: delivers callbacks with bounded retries (`PDF_WEBHOOK_MAX_ATTEMPTS`) and capped exponential backoff, recording each outcome on `webhook_deliveries` and the document;
- recycles the browser every `PDF_BROWSER_RECYCLE_JOBS` completed generations;
- closes workers, queue, browser and the PostgreSQL pool on SIGTERM/SIGINT.

## Document statuses

`queued | pending | completed | failed | trashed` (CHECK constraint in the migration). Trash is soft-delete: status `trashed` with the stored PDF reference cleared.

## Ownership model

Every route-scoped query filters by `user_id`; one owner can never read, update, delete or download another owner's rows. Two deliberate exceptions, both system-principal, server-side only:

- `getById`/`updateById` document and template reads used by the background worker and the signed-download endpoint (access still enforced by signature or ownership immediately after the read);
- base-template copy on create (`?base=` lists `user_id IS NULL` templates, matching the legacy shared base templates).

## Auth under the postgres provider

API/Bearer JWT authentication works as today (`authenticateRequest`). Browser session authentication against Appwrite is replaced by the separate self-hosted authentication work unit; until that lands, session-cookie requests under `BACKEND_PROVIDER=postgres` return `401 Unauthorized`.

## What is verified vs unverified

Verified offline (deterministic tests, no live services): provider selection, repository owner-scoping with a scripted queryer, status transitions and trash behaviour, presenter response shapes, presigned URL shape and expiry, retry/backoff bounds, worker job processing with injected fakes, migration idempotency.

Unverified (requires live services; not available in this environment): actual PostgreSQL queries against a real database, MinIO put/delete against a real bucket, BullMQ enqueue/consume against a real Redis, and Puppeteer rendering inside the worker.
