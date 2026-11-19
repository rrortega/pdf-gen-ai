/**
 * The complete server-side provider selected for this deployment.
 *
 * Appwrite remains the default so deployments that have not opted in keep their
 * existing authentication and data behavior.
 */
export type BackendProviderName = "appwrite" | "postgres";

export type BackendEnvironment = Record<string, string | undefined>;

/**
 * Resolves the provider without loading either provider's clients.
 */
export function backendProvider(
  env: BackendEnvironment = process.env,
): BackendProviderName {
  const provider = env.BACKEND_PROVIDER;

  if (provider === undefined) {
    return "appwrite";
  }

  if (provider === "appwrite" || provider === "postgres") {
    return provider;
  }

  throw new Error("BACKEND_PROVIDER must be appwrite or postgres");
}

/**
 * Convenience guard for code that needs the self-hosted provider.
 */
export function isPostgresBackend(
  env: BackendEnvironment = process.env,
): boolean {
  return backendProvider(env) === "postgres";
}
