import type { NextRequest } from "next/server";
import {
  createPostgresAuthHttp,
  type PostgresAuthHttp,
} from "@/backend/postgres/auth/http";

let cached: PostgresAuthHttp | undefined;

/**
 * Memoised accessor for the self-hosted auth HTTP adapter.
 *
 * Routes call this only inside their `isPostgresBackend()` branch, so the
 * Appwrite path keeps its own handlers. Building the adapter does not connect
 * to PostgreSQL: the pool is created lazily on first query.
 */
export function getPostgresAuthHttp(): PostgresAuthHttp {
  cached ??= createPostgresAuthHttp();
  return cached;
}
