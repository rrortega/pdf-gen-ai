/**
 * Auth-layer contracts for the self-hosted (postgres) provider.
 *
 * These are module-scoped for the authentication work unit, mirroring
 * src/backend/data-contracts.ts. The shared src/backend/contracts.ts keeps the
 * provider-wide AuthProvider port; this file adds the row shapes, repositories
 * and helpers the auth routes need. Legacy Appwrite code does not import these.
 */

import type {
  ApiKey,
  AuthProvider,
  CreatedApiKey,
  LoginInput,
  Page,
  Principal,
  RecoveryConfirmationInput,
  RecoveryRequestInput,
  RegistrationInput,
} from "./contracts";

export type {
  ApiKey,
  AuthProvider,
  CreatedApiKey,
  LoginInput,
  Page,
  Principal,
  RecoveryConfirmationInput,
  RecoveryRequestInput,
  RegistrationInput,
};

/** Minimal SQL executor shared by repositories and the migration runner. */
export interface Queryer {
  query(text: string, values?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
}

export interface AuthUserRow {
  id: string;
  email: string;
  name: string | null;
  password_hash: string;
  email_verification: boolean;
  created_at: string;
  updated_at: string;
}

export interface AuthSessionRow {
  id: string;
  user_id: string;
  secret_hash: string;
  expires_at: string;
  created_at: string;
  last_used_at: string | null;
}

export interface AuthApiKeyRow {
  id: string;
  user_id: string;
  name: string | null;
  key_hash: string;
  key_prefix: string;
  created_at: string;
  revoked_at: string | null;
  last_used_at: string | null;
}

export interface AuthOAuthCodeRow {
  id: string;
  client_id: string;
  user_id: string;
  redirect_uri: string;
  scopes: string[];
  code_challenge: string;
  code_challenge_method: string;
  expires_at: string;
  created_at: string;
}

/**
 * A secret (session secret, API key, reset token, OAuth code) is only ever
 * returned at issue time; the database stores the strong one-way hash.
 */
export interface IssuedSecret {
  id: string;
  secret: string;
  expiresAt: string;
}

export interface IssuedApiKey extends IssuedSecret {
  keyPrefix: string;
  createdAt: string;
}

export interface AuthUserRepository {
  create(input: { email: string; name: string | null; passwordHash: string }): Promise<AuthUserRow>;
  findByEmail(email: string): Promise<AuthUserRow | null>;
  findById(id: string): Promise<AuthUserRow | null>;
  updatePasswordHash(userId: string, passwordHash: string): Promise<void>;
}

export interface AuthSessionRepository {
  issue(userId: string, ttlSeconds?: number): Promise<IssuedSecret>;
  findValidOwner(secretHash: string): Promise<{ sessionId: string; userId: string } | null>;
  deleteBySecretHash(secretHash: string): Promise<boolean>;
}

export interface AuthApiKeyRepository {
  issue(ownerId: string, name?: string, ttlSeconds?: number): Promise<IssuedApiKey>;
  listByOwner(ownerId: string): Promise<AuthApiKeyRow[]>;
  revoke(ownerId: string, id: string): Promise<boolean>;
  findValidOwnerByKeyHash(keyHash: string): Promise<{ userId: string; email: string; name: string | null } | null>;
}

export interface PasswordResetTokenRepository {
  issue(userId: string, ttlSeconds?: number): Promise<IssuedSecret>;
  /**
   * Atomic single-use consumption: a token that was already used or is
   * expired yields null, and the same statement is safe under concurrency.
   */
  consume(secretHash: string): Promise<{ userId: string } | null>;
}

export interface OAuthCodeRepository {
  issue(input: {
    clientId: string;
    userId: string;
    redirectUri: string;
    scopes: string[];
    codeChallenge?: string;
    codeChallengeMethod?: string;
  }): Promise<IssuedSecret>;
  consume(code: string): Promise<AuthOAuthCodeRow | null>;
}

export interface OAuthTokenRepository {
  issue(input: {
    clientId: string;
    userId: string;
    scopes: string[];
    includeRefreshToken?: boolean;
    expiresInSeconds?: number;
  }): Promise<{
    access_token: string;
    refresh_token?: string;
    token_type: "Bearer";
    expires_in: number;
    scope: string;
  }>;
  findValidByAccessToken(accessToken: string): Promise<AuthOAuthCodeRow | null>;
  rotateByRefreshToken(refreshToken: string, expiresInSeconds?: number): Promise<{
    access_token: string;
    refresh_token?: string;
    token_type: "Bearer";
    expires_in: number;
    scope: string;
  } | null>;
  revokeAny(token: string): Promise<boolean>;
}

/** Small email port. Tests always inject a no-op/logging adapter. */
export interface PasswordResetMailer {
  sendPasswordResetEmail(to: string, resetUrl: string): Promise<void>;
}

/** Result of a successful register/login: principal plus the session secret. */
export interface AuthSessionIssue {
  principal: Principal;
  sessionId: string;
  sessionSecret: string;
  sessionProvider: string;
}

/**
 * Authentication provider for the self-hosted backend. Route handlers own
 * cookies and response formatting; the provider performs the backend work.
 * The explicit-owner variants exist so HTTP handlers never need to trust a
 * client-supplied owner id.
 *
 * register/login return the issued session secret on top of the principal,
 * so they are omitted from the shared port and widened here; every other
 * member keeps the shared AuthProvider signature.
 */
export interface PostgresAuthProvider extends Omit<AuthProvider, "register" | "login"> {
  register(input: RegistrationInput): Promise<AuthSessionIssue>;
  login(input: LoginInput): Promise<AuthSessionIssue>;
  /** Resolves the opaque session secret issued at register/login time. */
  verifySessionSecret(secret: string): Promise<Principal | null>;
  verifyApiKeySecret(key: string): Promise<Principal | null>;
  verifyOAuthAccessToken(accessToken: string): Promise<Principal | null>;
  logoutSession(sessionSecret: string): Promise<void>;
  createApiKeyFor(ownerId: string, name?: string): Promise<CreatedApiKey>;
  listApiKeysFor(ownerId: string): Promise<Page<ApiKey>>;
  revokeApiKeyFor(ownerId: string, id: string): Promise<boolean>;
  requestRecovery(input: RecoveryRequestInput): Promise<void>;
  confirmRecovery(input: RecoveryConfirmationInput): Promise<void>;
}
