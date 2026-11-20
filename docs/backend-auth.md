# Self-hosted authentication backend

`BACKEND_PROVIDER` also selects the authentication backend:

- `BACKEND_PROVIDER=appwrite` (default, unset counts as appwrite): legacy Appwrite behaviour, unchanged — same `session` cookie, same response shapes, same OAuth and API-key semantics.
- `BACKEND_PROVIDER=postgres`: self-hosted authentication stored in PostgreSQL behind the same routes and response shapes. The Appwrite SDK is never initialised on this path.

Invalid values throw `BACKEND_PROVIDER must be appwrite or postgres` (see `src/backend/config.ts`).

## Schema

`scripts/migrations/002-auth.sql` (idempotent, run by `POST /api/setup`, every statement `IF NOT EXISTS`):

- `auth_users` — email (unique, case-insensitive), `password_hash` (scrypt, one-way).
- `auth_sessions` — opaque session secrets, sha-256 hashed, owner + expiry bound.
- `auth_password_reset_tokens` — single-use, expiring reset tokens (hash + `used_at`).
- `auth_api_keys` — hashed keys with display prefix, revocation and optional expiry.
- `auth_oauth_codes` / `auth_oauth_tokens` — hashed authorization codes and access/refresh tokens, expiring, owner-bound.

No recoverable plaintext secret (password, session secret, API key, reset token, OAuth code) is ever stored or logged.

## Routes (identical paths and shapes for both providers)

| Route | Notes on the postgres path |
| --- | --- |
| `POST /api/v1/auth/register` | scrypt hash stored; session cookie `session` (HttpOnly, 7 days) |
| `POST /api/v1/auth/login` | constant-time scrypt verification; 400 missing fields, 401 bad credentials |
| `POST /api/v1/auth/logout` | deletes the session row and clears the cookie |
| `GET /api/v1/auth/me` | issues a local JWT (`JWT_SECRET`) for the Browser SDK |
| `POST /api/v1/auth/recovery` | issues a single-use 1-hour token; email via the mailer adapter |
| `POST /api/v1/auth/recovery/confirm` | consumes the token atomically; second/expired use fails with 500 (legacy shape) |
| `GET/POST/DELETE /api/v1/auth/api-key` | list (metadata only), create (plaintext shown once), revoke; the DELETE route is additive |

Request authentication (`authenticateRequest`) keeps the legacy order: local JWT, OAuth access token, API key, then the `session` cookie — all resolved from the self-hosted stores when the postgres provider is selected.

## Environment variables

| Variable | Purpose |
| --- | --- |
| `BACKEND_PROVIDER` | `appwrite` (default) or `postgres`. |
| `DATABASE_URL` | PostgreSQL connection string (shared lazy pool, `src/backend/db.ts`). |
| `JWT_SECRET` | Signs the `me` JWT and accepts local JWT bearers (legacy default kept). |
| `SMTP_HOST` | Enables the SMTP reset-mail adapter; unset uses the offline logging adapter. |
| `SMTP_PORT` | Optional, defaults to `587`. |
| `SMTP_SECURE` | Optional, `true` for TLS-on-connect. |
| `SMTP_USER` / `SMTP_PASS` | Optional SMTP credentials. |
| `MAIL_FROM` | Optional sender address for reset emails. |

With no SMTP configuration the password-reset adapter logs that a reset was requested and never sends anything (and never logs the reset link), so tests and local development stay offline.

## Implementation layout

- `src/backend/auth-contracts.ts` — auth-layer contracts (module-scoped, like `data-contracts.ts`).
- `src/backend/auth/` — provider-agnostic helpers: scrypt password hashing, opaque token generation and hashing, the mailer interface.
- `src/backend/postgres/auth/` — repositories, provider, HTTP adapters, MCP OAuth adapters, migration runner.
- `src/app/api/v1/auth/**`, `src/app/api/llm/mcp/{auth,token}/route.ts` — additive `isPostgresBackend()` branches ahead of the untouched legacy handlers.
