/**
 * Client-side backend mode decision. The browser never talks to PostgreSQL or
 * Redis directly: when the self-hosted backend is selected the realtime
 * components degrade to polling the HTTP API instead of Appwrite realtime.
 *
 * Deployments using the postgres provider set NEXT_PUBLIC_BACKEND_PROVIDER=postgres
 * so the value is inlined into client bundles at build time.
 */
export type RealtimeEnvironment = Record<string, string | undefined>;

export function usesSelfHostedBackend(env: RealtimeEnvironment = process.env): boolean {
  return env.NEXT_PUBLIC_BACKEND_PROVIDER === "postgres";
}
