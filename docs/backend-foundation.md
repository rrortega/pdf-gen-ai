# Backend foundation

`BACKEND_PROVIDER` selects the complete server-side provider:

- `appwrite` is the default when the variable is absent.
- `postgres` opts into the self-hosted provider.
- Any other value fails with `BACKEND_PROVIDER must be appwrite or postgres`.

Use `backendProvider()` from `src/backend/config.ts` to make that choice. It is
pure configuration and does not load provider clients.

## PostgreSQL

`getPool()` in `src/backend/db.ts` creates one `pg.Pool` only on its first call.
It requires `DATABASE_URL` then; importing the module and legacy Appwrite mode
do not require that variable or open a connection. `transaction(work)` provides
a `PoolClient`, commits successful work, and rolls back and releases the client
on failure. Process shutdown or tests can call `closePool()`.

## Provider ports

`src/backend/contracts.ts` defines the shared contracts for future adapters:

- `AuthProvider` covers registration, login, current user lookup, logout,
  password recovery, and API-key lifecycle.
- `ObjectStore` stores, deletes, and creates download URLs for PDFs.
- `JobQueue` enqueues PDF generation and webhook delivery.
- `Principal` and `Page<T>` are shared domain values.

These are contracts only. No PostgreSQL repositories, authentication adapter,
object-store client, queue client, worker, or route integration is implemented
by this foundation.
