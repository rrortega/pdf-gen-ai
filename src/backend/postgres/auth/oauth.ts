import type { OAuthAuthorizationCode, OAuthToken } from "@/lib/oauth";
import { hashTokenSecret } from "../../auth/tokens";
import {
  createPostgresApiKeyRepository,
  createPostgresOAuthCodeRepository,
  createPostgresOAuthTokenRepository,
} from "./repositories";

/**
 * PostgreSQL implementations behind the OAuth service branches. Row shapes
 * mirror the legacy Appwrite documents (src/lib/oauth.ts) so the MCP token
 * routes keep their exact response shapes.
 */

interface PostgresOAuthStores {
  apiKeys: ReturnType<typeof createPostgresApiKeyRepository>;
  codes: ReturnType<typeof createPostgresOAuthCodeRepository>;
  tokens: ReturnType<typeof createPostgresOAuthTokenRepository>;
}

let stores: PostgresOAuthStores | undefined;

/** Lazily wires the OAuth stores. Construction never opens a connection. */
export function getPostgresOAuthStores(): PostgresOAuthStores {
  if (!stores) {
    stores = {
      apiKeys: createPostgresApiKeyRepository(),
      codes: createPostgresOAuthCodeRepository(),
      tokens: createPostgresOAuthTokenRepository(),
    };
  }
  return stores;
}

/**
 * Legacy client verification used the user's apikey preference; the
 * self-hosted backend verifies that the client secret is one of the client's
 * API keys (client_id === user id).
 */
export async function verifyClientPostgres(
  clientId: string,
  clientSecret: string,
): Promise<boolean> {
  const { apiKeys } = getPostgresOAuthStores();
  const owner = await apiKeys.findValidOwnerByKeyHash(hashTokenSecret(clientSecret));
  return owner !== null && owner.userId === clientId;
}

export async function getUserIdFromApiKeyPostgres(apiKey: string): Promise<string | null> {
  const { apiKeys } = getPostgresOAuthStores();
  const owner = await apiKeys.findValidOwnerByKeyHash(hashTokenSecret(apiKey));
  return owner?.userId ?? null;
}

export async function createCodePostgres(input: {
  clientId: string;
  userId: string;
  redirectUri: string;
  scopes: string[];
  codeChallenge?: string;
  codeChallengeMethod?: "S256" | "plain";
}): Promise<{ code: string; expiresAt: string }> {
  const { codes } = getPostgresOAuthStores();
  const issued = await codes.issue({
    clientId: input.clientId,
    userId: input.userId,
    redirectUri: input.redirectUri,
    scopes: input.scopes,
    codeChallenge: input.codeChallenge,
    codeChallengeMethod: input.codeChallengeMethod,
  });
  return { code: issued.secret, expiresAt: issued.expiresAt };
}

export async function consumeCodePostgres(code: string): Promise<OAuthAuthorizationCode | null> {
  const { codes } = getPostgresOAuthStores();
  const row = await codes.consume(code);
  if (!row) {
    return null;
  }
  return {
    $id: row.id,
    code,
    client_id: row.client_id,
    user_id: row.user_id,
    redirect_uri: row.redirect_uri,
    scopes: row.scopes,
    code_challenge: row.code_challenge,
    code_challenge_method: (row.code_challenge_method as "S256" | "plain") || undefined,
    expires_at: row.expires_at,
    created_at: row.created_at,
  };
}

export async function createTokenPostgres(input: {
  clientId: string;
  userId: string;
  scopes: string[];
  includeRefreshToken?: boolean;
}): Promise<{
  access_token: string;
  refresh_token?: string;
  token_type: "Bearer";
  expires_in: number;
  scope: string;
}> {
  const { tokens } = getPostgresOAuthStores();
  return tokens.issue({
    clientId: input.clientId,
    userId: input.userId,
    scopes: input.scopes,
    includeRefreshToken: input.includeRefreshToken,
  });
}

export async function verifyTokenPostgres(accessToken: string): Promise<OAuthToken | null> {
  const { tokens } = getPostgresOAuthStores();
  const row = await tokens.findValidByAccessToken(accessToken);
  if (!row) {
    return null;
  }
  return {
    $id: row.id,
    client_id: row.client_id,
    user_id: row.user_id,
    access_token: accessToken,
    refresh_token: "",
    token_type: "Bearer",
    expires_at: row.expires_at,
    scopes: row.scopes,
    created_at: row.created_at,
  };
}

export async function refreshTokenPostgres(refreshToken: string): Promise<{
  access_token: string;
  refresh_token?: string;
  token_type: "Bearer";
  expires_in: number;
  scope: string;
} | null> {
  const { tokens } = getPostgresOAuthStores();
  return tokens.rotateByRefreshToken(refreshToken);
}

export async function revokeTokenPostgres(token: string): Promise<boolean> {
  const { tokens } = getPostgresOAuthStores();
  return tokens.revokeAny(token);
}
