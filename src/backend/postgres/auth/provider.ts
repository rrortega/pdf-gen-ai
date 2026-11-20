import type {
  ApiKey,
  AuthSessionIssue,
  CreatedApiKey,
  Page,
  PostgresAuthProvider,
  Principal,
  Queryer,
  RecoveryConfirmationInput,
  RecoveryRequestInput,
  RegistrationInput,
  LoginInput,
} from "../../auth-contracts";
import { hashPassword, verifyPassword } from "../../auth/password";
import { hashTokenSecret } from "../../auth/tokens";
import { resolveMailer } from "../../auth/mailer";
import {
  createPostgresApiKeyRepository,
  createPostgresAuthSessionRepository,
  createPostgresAuthUserRepository,
  createPostgresOAuthTokenRepository,
  createPostgresPasswordResetTokenRepository,
  toApiKey,
} from "./repositories";
import type { PasswordResetMailer } from "../../auth-contracts";

export const SESSION_COOKIE_NAME = "session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days, matching the legacy cookie
export const RESET_TTL_SECONDS = 60 * 60; // 1 hour

/**
 * Provider-level authentication error. HTTP handlers map these to the exact
 * legacy status codes.
 */
export class AuthError extends Error {}

export interface PostgresAuthProviderDeps {
  mailer?: PasswordResetMailer;
  env?: Record<string, string | undefined>;
}

/**
 * Creates the self-hosted authentication provider. The optional executor is
 * for deterministic tests; production wiring resolves the shared lazy pool.
 */
export function createPostgresAuthProvider(
  queryer?: Queryer,
  deps: PostgresAuthProviderDeps = {},
): PostgresAuthProvider {
  const users = createPostgresAuthUserRepository(queryer);
  const sessions = createPostgresAuthSessionRepository(queryer);
  const apiKeys = createPostgresApiKeyRepository(queryer);
  const resetTokens = createPostgresPasswordResetTokenRepository(queryer);
  const oauthTokens = createPostgresOAuthTokenRepository(queryer);
  const mailer = deps.mailer ?? resolveMailer(deps.env);

  function toPrincipal(user: {
    id: string;
    email: string;
    name: string | null;
  }): Principal {
    return {
      id: user.id,
      email: user.email,
      ...(user.name ? { name: user.name } : {}),
      isApiKey: false,
    };
  }

  async function issueSession(userId: string): Promise<{ id: string; secret: string }> {
    const issued = await sessions.issue(userId, SESSION_TTL_SECONDS);
    return { id: issued.id, secret: issued.secret };
  }

  function resetUrlFor(redirectUrl: string, userId: string, secret: string): string {
    const url = new URL(redirectUrl);
    url.searchParams.set("userId", userId);
    url.searchParams.set("secret", secret);
    return url.toString();
  }

  async function readSessionSecretFromCookies(): Promise<string | null> {
    try {
      const { cookies } = await import("next/headers");
      const cookieStore = await cookies();
      return cookieStore.get(SESSION_COOKIE_NAME)?.value ?? null;
    } catch {
      return null;
    }
  }

  const provider: PostgresAuthProvider = {
    async register(input: RegistrationInput): Promise<AuthSessionIssue> {
      const existing = await users.findByEmail(input.email);
      if (existing) {
        throw new AuthError("User already exists");
      }

      const passwordHash = await hashPassword(input.password);
      const user = await users.create({
        email: input.email,
        name: input.name ?? null,
        passwordHash,
      });

      const session = await issueSession(user.id);
      return {
        principal: toPrincipal(user),
        sessionId: session.id,
        sessionSecret: session.secret,
        sessionProvider: "email",
      };
    },

    async login(input: LoginInput): Promise<AuthSessionIssue> {
      const user = await users.findByEmail(input.email);
      const valid = user ? await verifyPassword(input.password, user.password_hash) : false;
      if (!user || !valid) {
        throw new AuthError("Invalid email or password");
      }

      const session = await issueSession(user.id);
      return {
        principal: toPrincipal(user),
        sessionId: session.id,
        sessionSecret: session.secret,
        sessionProvider: "email",
      };
    },

    async verifySessionSecret(secret: string): Promise<Principal | null> {
      const owner = await sessions.findValidOwner(hashTokenSecret(secret));
      if (!owner) {
        return null;
      }
      const user = await users.findById(owner.userId);
      return user ? toPrincipal(user) : null;
    },

    async verifyApiKeySecret(key: string): Promise<Principal | null> {
      const owner = await apiKeys.findValidOwnerByKeyHash(hashTokenSecret(key));
      if (!owner) {
        return null;
      }
      return {
        id: owner.userId,
        email: owner.email,
        ...(owner.name ? { name: owner.name } : {}),
        isApiKey: true,
      };
    },

    async verifyOAuthAccessToken(accessToken: string): Promise<Principal | null> {
      const row = await oauthTokens.findValidByAccessToken(accessToken);
      if (!row) {
        return null;
      }
      const user = await users.findById(row.user_id);
      if (!user) {
        return null;
      }
      return {
        id: user.id,
        email: user.email,
        isApiKey: false,
      };
    },

    async logoutSession(sessionSecret: string): Promise<void> {
      await sessions.deleteBySecretHash(hashTokenSecret(sessionSecret));
    },

    async current(): Promise<Principal | null> {
      const secret = await readSessionSecretFromCookies();
      return secret ? provider.verifySessionSecret(secret) : null;
    },

    async logout(): Promise<void> {
      const secret = await readSessionSecretFromCookies();
      if (secret) {
        await provider.logoutSession(secret);
      }
    },

    async createApiKeyFor(ownerId: string, name?: string): Promise<CreatedApiKey> {
      const issued = await apiKeys.issue(ownerId, name);
      return {
        id: issued.id,
        secret: issued.secret,
        createdAt: issued.createdAt,
      };
    },

    async listApiKeysFor(ownerId: string): Promise<Page<ApiKey>> {
      const rows = await apiKeys.listByOwner(ownerId);
      return { total: rows.length, items: rows.map(toApiKey) };
    },

    async revokeApiKeyFor(ownerId: string, id: string): Promise<boolean> {
      return apiKeys.revoke(ownerId, id);
    },

    async requestRecovery(input: RecoveryRequestInput): Promise<void> {
      const user = await users.findByEmail(input.email);
      if (!user) {
        // Stay silent to avoid account enumeration; the response shape is the
        // same as for existing users.
        return;
      }
      const issued = await resetTokens.issue(user.id, RESET_TTL_SECONDS);
      await mailer.sendPasswordResetEmail(user.email, resetUrlFor(input.redirectUrl, user.id, issued.secret));
    },

    async confirmRecovery(input: RecoveryConfirmationInput): Promise<void> {
      const consumed = await resetTokens.consume(hashTokenSecret(input.secret));
      if (!consumed || consumed.userId !== input.userId) {
        throw new AuthError("Invalid or expired reset token");
      }
      const passwordHash = await hashPassword(input.password);
      await users.updatePasswordHash(consumed.userId, passwordHash);
    },

    async createApiKey(input?: { name?: string }): Promise<CreatedApiKey> {
      const principal = await provider.current();
      if (!principal) {
        throw new AuthError("Not authenticated");
      }
      return provider.createApiKeyFor(principal.id, input?.name);
    },

    async listApiKeys(): Promise<Page<ApiKey>> {
      const principal = await provider.current();
      if (!principal) {
        throw new AuthError("Not authenticated");
      }
      return provider.listApiKeysFor(principal.id);
    },

    async revokeApiKey(id: string): Promise<void> {
      const principal = await provider.current();
      if (!principal) {
        throw new AuthError("Not authenticated");
      }
      await provider.revokeApiKeyFor(principal.id, id);
    },
  };

  return provider;
}

let providerSingleton: PostgresAuthProvider | undefined;

/**
 * Lazily wires the provider singleton. Callers must only invoke this when
 * BACKEND_PROVIDER=postgres; construction itself never opens a connection.
 */
export function getPostgresAuthProvider(): PostgresAuthProvider {
  if (!providerSingleton) {
    providerSingleton = createPostgresAuthProvider();
  }
  return providerSingleton;
}
