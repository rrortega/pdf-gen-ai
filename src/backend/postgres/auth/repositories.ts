import type {
  ApiKey,
  AuthApiKeyRepository,
  AuthApiKeyRow,
  AuthSessionRepository,
  AuthUserRepository,
  IssuedApiKey,
  IssuedSecret,
  OAuthCodeRepository,
  OAuthTokenRepository,
  PasswordResetTokenRepository,
  Queryer,
} from "../../auth-contracts";
import { generateOpaqueToken, hashTokenSecret } from "../../auth/tokens";
import { ensurePostgresAuthSchema } from "./migrate";

/**
 * PostgreSQL repositories for the self-hosted authentication backend. Every
 * factory accepts an optional executor for deterministic tests; without one
 * the shared lazy pool is used and the idempotent auth schema is ensured once
 * per process. Opaque secrets are stored only as sha-256 hashes.
 */

export const DEFAULT_SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days (legacy cookie lifetime)
export const DEFAULT_RESET_TTL_SECONDS = 60 * 60; // 1 hour
export const DEFAULT_OAUTH_CODE_TTL_SECONDS = 10 * 60; // 10 minutes (legacy)
export const DEFAULT_OAUTH_TOKEN_TTL_SECONDS = 3600; // 1 hour (legacy)

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function futureIso(ttlSeconds: number): string {
  return new Date(Date.now() + ttlSeconds * 1000).toISOString();
}

/** Shared lazy executor: injected queryer wins, otherwise pool + schema ensure. */
function createLazyDb(queryer?: Queryer): () => Promise<Queryer> {
  let db: Queryer | undefined = queryer;
  return async () => {
    if (!db) {
      // Lazy so importing this module never requires DATABASE_URL.
      const { getPool } = await import("../../db");
      db = getPool();
      await ensurePostgresAuthSchema(db);
    }
    return db;
  };
}

export function createPostgresAuthUserRepository(queryer?: Queryer): AuthUserRepository {
  const getDb = createLazyDb(queryer);

  return {
    async create({ email, name, passwordHash }) {
      const db = await getDb();
      const result = await db.query(
        `INSERT INTO auth_users (email, name, password_hash)
         VALUES ($1, $2, $3)
         RETURNING id, email, name, password_hash, email_verification, created_at, updated_at`,
        [email, name, passwordHash],
      );
      const row = result.rows[0];
      return {
        id: row.id as string,
        email: row.email as string,
        name: (row.name as string | null) ?? null,
        password_hash: row.password_hash as string,
        email_verification: row.email_verification as boolean,
        created_at: toIso(row.created_at as string),
        updated_at: toIso(row.updated_at as string),
      };
    },

    async findByEmail(email) {
      const db = await getDb();
      const result = await db.query(
        `SELECT id, email, name, password_hash, email_verification, created_at, updated_at
         FROM auth_users WHERE lower(email) = $1 LIMIT 1`,
        [email.toLowerCase()],
      );
      const row = result.rows[0];
      return row
        ? {
            id: row.id as string,
            email: row.email as string,
            name: (row.name as string | null) ?? null,
            password_hash: row.password_hash as string,
            email_verification: row.email_verification as boolean,
            created_at: toIso(row.created_at as string),
            updated_at: toIso(row.updated_at as string),
          }
        : null;
    },

    async findById(id) {
      const db = await getDb();
      const result = await db.query(
        `SELECT id, email, name, password_hash, email_verification, created_at, updated_at
         FROM auth_users WHERE id = $1 LIMIT 1`,
        [id],
      );
      const row = result.rows[0];
      return row
        ? {
            id: row.id as string,
            email: row.email as string,
            name: (row.name as string | null) ?? null,
            password_hash: row.password_hash as string,
            email_verification: row.email_verification as boolean,
            created_at: toIso(row.created_at as string),
            updated_at: toIso(row.updated_at as string),
          }
        : null;
    },

    async updatePasswordHash(userId, passwordHash) {
      const db = await getDb();
      await db.query(
        `UPDATE auth_users SET password_hash = $2, updated_at = now() WHERE id = $1`,
        [userId, passwordHash],
      );
    },
  };
}

export function createPostgresAuthSessionRepository(queryer?: Queryer): AuthSessionRepository {
  const getDb = createLazyDb(queryer);

  return {
    async issue(userId, ttlSeconds = DEFAULT_SESSION_TTL_SECONDS) {
      const db = await getDb();
      const secret = generateOpaqueToken();
      const result = await db.query(
        `INSERT INTO auth_sessions (user_id, secret_hash, expires_at)
         VALUES ($1, $2, $3)
         RETURNING id, expires_at`,
        [userId, hashTokenSecret(secret), futureIso(ttlSeconds)],
      );
      const row = result.rows[0];
      return {
        id: row.id as string,
        secret,
        expiresAt: toIso(row.expires_at as string),
      };
    },

    async findValidOwner(secretHash) {
      const db = await getDb();
      const result = await db.query(
        `SELECT id, user_id FROM auth_sessions
         WHERE secret_hash = $1 AND expires_at > now() LIMIT 1`,
        [secretHash],
      );
      const row = result.rows[0];
      return row
        ? { sessionId: row.id as string, userId: row.user_id as string }
        : null;
    },

    async deleteBySecretHash(secretHash) {
      const db = await getDb();
      const result = await db.query(
        `DELETE FROM auth_sessions WHERE secret_hash = $1 RETURNING id`,
        [secretHash],
      );
      return result.rows.length > 0;
    },
  };
}

export function createPostgresApiKeyRepository(queryer?: Queryer): AuthApiKeyRepository {
  const getDb = createLazyDb(queryer);

  return {
    async issue(ownerId, name, ttlSeconds?) {
      const db = await getDb();
      const secret = generateOpaqueToken();
      const expiresAt = ttlSeconds ? futureIso(ttlSeconds) : null;
      const result = await db.query(
        `INSERT INTO auth_api_keys (user_id, name, key_hash, key_prefix, expires_at)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, created_at`,
        [ownerId, name ?? null, hashTokenSecret(secret), secret.slice(0, 8), expiresAt],
      );
      const row = result.rows[0];
      return {
        id: row.id as string,
        secret,
        keyPrefix: secret.slice(0, 8),
        expiresAt: expiresAt ?? "",
        createdAt: toIso(row.created_at as string),
      };
    },

    async listByOwner(ownerId) {
      const db = await getDb();
      const result = await db.query(
        `SELECT id, user_id, name, key_hash, key_prefix, created_at, revoked_at, last_used_at
         FROM auth_api_keys WHERE user_id = $1 ORDER BY created_at DESC`,
        [ownerId],
      );
      return result.rows.map((row) => ({
        id: row.id as string,
        user_id: row.user_id as string,
        name: (row.name as string | null) ?? null,
        key_hash: row.key_hash as string,
        key_prefix: row.key_prefix as string,
        created_at: toIso(row.created_at as string),
        revoked_at: row.revoked_at ? toIso(row.revoked_at as string) : null,
        last_used_at: row.last_used_at ? toIso(row.last_used_at as string) : null,
      }));
    },

    async revoke(ownerId, id) {
      const db = await getDb();
      const result = await db.query(
        `UPDATE auth_api_keys SET revoked_at = now()
         WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL
         RETURNING id`,
        [id, ownerId],
      );
      return result.rows.length > 0;
    },

    async findValidOwnerByKeyHash(keyHash) {
      const db = await getDb();
      const result = await db.query(
        `SELECT k.user_id, u.email, u.name
         FROM auth_api_keys k
         JOIN auth_users u ON u.id = k.user_id
         WHERE k.key_hash = $1 AND k.revoked_at IS NULL
           AND (k.expires_at IS NULL OR k.expires_at > now())
         LIMIT 1`,
        [keyHash],
      );
      const row = result.rows[0];
      return row
        ? {
            userId: row.user_id as string,
            email: row.email as string,
            name: (row.name as string | null) ?? null,
          }
        : null;
    },
  };
}

export function createPostgresPasswordResetTokenRepository(queryer?: Queryer): PasswordResetTokenRepository {
  const getDb = createLazyDb(queryer);

  return {
    async issue(userId, ttlSeconds = DEFAULT_RESET_TTL_SECONDS) {
      const db = await getDb();
      const secret = generateOpaqueToken();
      const result = await db.query(
        `INSERT INTO auth_password_reset_tokens (user_id, secret_hash, expires_at)
         VALUES ($1, $2, $3)
         RETURNING id, expires_at`,
        [userId, hashTokenSecret(secret), futureIso(ttlSeconds)],
      );
      const row = result.rows[0];
      return {
        id: row.id as string,
        secret,
        expiresAt: toIso(row.expires_at as string),
      };
    },

    async consume(secretHash) {
      const db = await getDb();
      // Atomic single-use: already-consumed or expired tokens update nothing.
      const result = await db.query(
        `UPDATE auth_password_reset_tokens SET used_at = now()
         WHERE secret_hash = $1 AND used_at IS NULL AND expires_at > now()
         RETURNING user_id`,
        [secretHash],
      );
      const row = result.rows[0];
      return row ? { userId: row.user_id as string } : null;
    },
  };
}

export function createPostgresOAuthCodeRepository(queryer?: Queryer): OAuthCodeRepository {
  const getDb = createLazyDb(queryer);

  return {
    async issue({ clientId, userId, redirectUri, scopes, codeChallenge, codeChallengeMethod }) {
      const db = await getDb();
      const code = generateOpaqueToken();
      const result = await db.query(
        `INSERT INTO auth_oauth_codes
           (client_id, user_id, redirect_uri, scopes, code_challenge, code_challenge_method, code_hash, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id, expires_at`,
        [
          clientId,
          userId,
          redirectUri,
          scopes,
          codeChallenge ?? "",
          codeChallengeMethod ?? "",
          hashTokenSecret(code),
          futureIso(DEFAULT_OAUTH_CODE_TTL_SECONDS),
        ],
      );
      const row = result.rows[0];
      return {
        id: row.id as string,
        secret: code,
        expiresAt: toIso(row.expires_at as string),
      };
    },

    async consume(code) {
      const db = await getDb();
      // Atomic single-use with expiry, mirroring the legacy delete-on-consume.
      const result = await db.query(
        `UPDATE auth_oauth_codes SET consumed_at = now()
         WHERE code_hash = $1 AND consumed_at IS NULL AND expires_at > now()
         RETURNING id, client_id, user_id, redirect_uri, scopes, code_challenge, code_challenge_method, expires_at, created_at`,
        [hashTokenSecret(code)],
      );
      const row = result.rows[0];
      return row
        ? {
            id: row.id as string,
            client_id: row.client_id as string,
            user_id: row.user_id as string,
            redirect_uri: row.redirect_uri as string,
            scopes: (row.scopes as string[]) ?? [],
            code_challenge: (row.code_challenge as string) ?? "",
            code_challenge_method: (row.code_challenge_method as string) ?? "",
            expires_at: toIso(row.expires_at as string),
            created_at: toIso(row.created_at as string),
          }
        : null;
    },
  };
}

export function createPostgresOAuthTokenRepository(queryer?: Queryer): OAuthTokenRepository {
  const getDb = createLazyDb(queryer);

  async function insertToken(
    clientId: string,
    userId: string,
    scopes: string[],
    includeRefreshToken: boolean,
    expiresInSeconds: number,
  ): Promise<{
    access_token: string;
    refresh_token?: string;
    token_type: "Bearer";
    expires_in: number;
    scope: string;
  }> {
    const db = await getDb();
    const accessToken = generateOpaqueToken();
    const refreshToken = includeRefreshToken ? generateOpaqueToken() : null;
    await db.query(
      `INSERT INTO auth_oauth_tokens
         (client_id, user_id, access_token_hash, refresh_token_hash, token_type, scopes, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        clientId,
        userId,
        hashTokenSecret(accessToken),
        refreshToken ? hashTokenSecret(refreshToken) : null,
        "Bearer",
        scopes,
        futureIso(expiresInSeconds),
      ],
    );
    return {
      access_token: accessToken,
      refresh_token: refreshToken ?? undefined,
      token_type: "Bearer",
      expires_in: expiresInSeconds,
      scope: scopes.join(" "),
    };
  }

  return {
    async issue({ clientId, userId, scopes, includeRefreshToken = true, expiresInSeconds = DEFAULT_OAUTH_TOKEN_TTL_SECONDS }) {
      return insertToken(clientId, userId, scopes, includeRefreshToken, expiresInSeconds);
    },

    async findValidByAccessToken(accessToken) {
      const db = await getDb();
      const result = await db.query(
        `SELECT id, client_id, user_id, scopes, expires_at, created_at FROM auth_oauth_tokens
         WHERE access_token_hash = $1 AND expires_at > now() LIMIT 1`,
        [hashTokenSecret(accessToken)],
      );
      const row = result.rows[0];
      if (!row) {
        return null;
      }
      return {
        id: row.id as string,
        client_id: row.client_id as string,
        user_id: row.user_id as string,
        redirect_uri: "",
        scopes: (row.scopes as string[]) ?? [],
        code_challenge: "",
        code_challenge_method: "",
        expires_at: toIso(row.expires_at as string),
        created_at: toIso(row.created_at as string),
      };
    },

    async rotateByRefreshToken(refreshToken, expiresInSeconds = DEFAULT_OAUTH_TOKEN_TTL_SECONDS) {
      const db = await getDb();
      const result = await db.query(
        `DELETE FROM auth_oauth_tokens WHERE refresh_token_hash = $1
         RETURNING client_id, user_id, scopes`,
        [hashTokenSecret(refreshToken)],
      );
      const row = result.rows[0];
      if (!row) {
        return null;
      }
      return insertToken(
        row.client_id as string,
        row.user_id as string,
        (row.scopes as string[]) ?? [],
        true,
        expiresInSeconds,
      );
    },

    async revokeAny(token) {
      const db = await getDb();
      const result = await db.query(
        `DELETE FROM auth_oauth_tokens
         WHERE access_token_hash = $1 OR refresh_token_hash = $1
         RETURNING id`,
        [hashTokenSecret(token)],
      );
      return result.rows.length > 0;
    },
  };
}

/** Convenience for consumers that need the shared ApiKey mapping. */
export function toApiKey(row: AuthApiKeyRow): ApiKey {
  return {
    id: row.id,
    ...(row.name ? { name: row.name } : {}),
    createdAt: row.created_at,
  };
}

export type { IssuedApiKey, IssuedSecret };
