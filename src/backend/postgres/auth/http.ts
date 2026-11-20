import { NextRequest, NextResponse } from "next/server";
import { SignJWT, jwtVerify } from "jose";
import type {
  PostgresAuthProvider,
  Principal,
} from "../../auth-contracts";
import { SESSION_COOKIE_NAME, SESSION_TTL_SECONDS, getPostgresAuthProvider } from "./provider";
/**
 * PostgreSQL branches for the /api/v1/auth routes and request authentication.
 * Response shapes, status codes and the legacy `session` cookie behaviour
 * mirror the Appwrite handlers exactly; the Appwrite SDK is never initialised
 * on this path.
 */

const encoder = new TextEncoder();

type Env = Record<string, string | undefined>;

function jwtSecret(env: Env): Uint8Array {
  return encoder.encode(env.JWT_SECRET || "default-secret-change-me");
}

export interface PostgresAuthHttpDeps {
  provider: PostgresAuthProvider;
  env: Env;
  authenticate(request: NextRequest): Promise<Principal | null>;
}

export interface PostgresAuthHttp {
  registerPostgres(request: NextRequest): Promise<NextResponse>;
  loginPostgres(request: NextRequest): Promise<NextResponse>;
  logoutPostgres(request: NextRequest): Promise<NextResponse>;
  mePostgres(request: NextRequest): Promise<NextResponse>;
  requestRecoveryPostgres(request: NextRequest): Promise<NextResponse>;
  confirmRecoveryPostgres(request: NextRequest): Promise<NextResponse>;
  apiKeyGetPostgres(request: NextRequest): Promise<NextResponse>;
  apiKeyPostgres(request: NextRequest): Promise<NextResponse>;
  apiKeyDeletePostgres(request: NextRequest): Promise<NextResponse>;
}

/**
 * Self-hosted request authentication. Bearer order mirrors the legacy path:
 * local JWT, then OAuth access token, then API key. The `session` cookie
 * verifies against the opaque session store. A bearer token that is present
 * but invalid authenticates to null, exactly like the legacy handler.
 */
export async function authenticateRequestPostgres(
  request: NextRequest,
  deps: { provider?: PostgresAuthProvider; env?: Env } = {},
): Promise<Principal | null> {
  const provider = deps.provider ?? getPostgresAuthProvider();
  const env = deps.env ?? process.env;

  const authHeader = request.headers.get("Authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7);

    // 1. Local JWT (jose), same secret as the legacy path.
    try {
      const { payload } = await jwtVerify(token, jwtSecret(env));
      if (payload && payload.userId) {
        return {
          id: payload.userId as string,
          email: (payload.email as string) ?? "",
          isApiKey: true,
        };
      }
      return null;
    } catch {
      // 2. OAuth access token, 3. API key.
      const oauth = await provider.verifyOAuthAccessToken(token);
      if (oauth) {
        return oauth;
      }
      const apiKey = await provider.verifyApiKeySecret(token);
      if (apiKey) {
        return apiKey;
      }
      return null;
    }
  }

  // 4. Session cookie (browser).
  const sessionSecret = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (sessionSecret) {
    return provider.verifySessionSecret(sessionSecret);
  }

  return null;
}

/** MCP hybrid token validation for the postgres provider. */
export async function validateHybridTokenPostgres(
  authHeader: string | null,
  deps: { provider?: PostgresAuthProvider; env?: Env } = {},
): Promise<boolean> {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return false;
  }
  const token = authHeader.substring(7);
  const env = deps.env ?? process.env;
  const provider = deps.provider ?? getPostgresAuthProvider();

  // 1. Local MCP API key (fastest, env comparison).
  const localApiKey = env.MCP_API_KEY;
  if (localApiKey && token === localApiKey) {
    return true;
  }

  // 2. Local JWT.
  try {
    const { payload } = await jwtVerify(token, jwtSecret(env));
    if (payload && payload.userId) {
      return true;
    }
  } catch {
    // Not a JWT, continue.
  }

  // 3. OAuth token, 4. API key.
  if (await provider.verifyOAuthAccessToken(token)) {
    return true;
  }
  if (await provider.verifyApiKeySecret(token)) {
    return true;
  }

  return false;
}

function setSessionCookie(response: NextResponse, secret: string, env: Env): void {
  response.cookies.set(SESSION_COOKIE_NAME, secret, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_TTL_SECONDS,
    path: "/",
  });
}

function clearSessionCookie(response: NextResponse, env: Env): void {
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

async function readJson(request: NextRequest): Promise<Record<string, string>> {
  try {
    const body = await request.json();
    return typeof body === "object" && body !== null ? (body as Record<string, string>) : {};
  } catch {
    return {};
  }
}

export function createPostgresAuthHttp(overrides: Partial<PostgresAuthHttpDeps> = {}): PostgresAuthHttp {
  const env = overrides.env ?? process.env;
  const provider = overrides.provider ?? getPostgresAuthProvider();
  const authenticate =
    overrides.authenticate ??
    ((request: NextRequest) => authenticateRequestPostgres(request, { provider, env }));

  return {
    async registerPostgres(request) {
      const body = await readJson(request);

      if (!body.email || !body.password || !body.name) {
        return NextResponse.json(
          { error: "Email, password and name are required" },
          { status: 400 },
        );
      }

      try {
        const issued = await provider.register({
          email: body.email,
          password: body.password,
          name: body.name,
        });

        const response = NextResponse.json({
          success: true,
          session: {
            id: issued.sessionId,
            userId: issued.principal.id,
            provider: issued.sessionProvider,
          },
          user: {
            id: issued.principal.id,
            email: issued.principal.email,
            name: issued.principal.name,
            emailVerification: false,
          },
        });
        setSessionCookie(response, issued.sessionSecret, env);
        return response;
      } catch (error) {
        console.error("Registration error:", error);
        return NextResponse.json(
          { error: errorMessage(error, "Registration failed") },
          { status: 400 },
        );
      }
    },

    async loginPostgres(request) {
      const body = await readJson(request);

      if (!body.email || !body.password) {
        return NextResponse.json(
          { error: "Email and password are required" },
          { status: 400 },
        );
      }

      try {
        const issued = await provider.login({ email: body.email, password: body.password });

        const response = NextResponse.json({
          success: true,
          session: {
            id: issued.sessionId,
            userId: issued.principal.id,
            provider: issued.sessionProvider,
          },
          user: {
            id: issued.principal.id,
            email: issued.principal.email,
            name: issued.principal.name,
            emailVerification: false,
          },
        });
        setSessionCookie(response, issued.sessionSecret, env);
        return response;
      } catch (error) {
        console.error("Login error:", error);
        return NextResponse.json(
          { error: errorMessage(error, "Login failed") },
          { status: 401 },
        );
      }
    },

    async logoutPostgres(request) {
      try {
        const sessionSecret = request.cookies.get(SESSION_COOKIE_NAME)?.value;
        if (sessionSecret) {
          await provider.logoutSession(sessionSecret);
        }

        const response = NextResponse.json({
          success: true,
          message: "Logged out successfully",
        });
        clearSessionCookie(response, env);
        return response;
      } catch (error) {
        console.error("Logout error:", error);
        const response = NextResponse.json(
          { error: errorMessage(error, "Logout failed") },
          { status: 500 },
        );
        clearSessionCookie(response, env);
        return response;
      }
    },

    async mePostgres(request) {
      try {
        const principal = await authenticate(request);
        if (!principal) {
          return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
        }

        const jwt = await new SignJWT({
          userId: principal.id,
          email: principal.email,
        })
          .setProtectedHeader({ alg: "HS256" })
          .setIssuedAt()
          .setExpirationTime("1h")
          .sign(jwtSecret(env));

        return NextResponse.json({
          success: true,
          user: {
            id: principal.id,
            email: principal.email,
            ...(principal.name ? { name: principal.name } : {}),
            emailVerification: false,
          },
          jwt,
        });
      } catch (error) {
        console.error("Auth check error:", error);
        return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
      }
    },

    async requestRecoveryPostgres(request) {
      try {
        const body = await readJson(request);

        if (!body.email) {
          return NextResponse.json(
            { success: false, error: "Email is required" },
            { status: 400 },
          );
        }

        const recoveryUrl = `${env.NEXT_PUBLIC_APP_URL || "http://localhost:3030"}/reset-password`;
        await provider.requestRecovery({ email: body.email, redirectUrl: recoveryUrl });

        return NextResponse.json({
          success: true,
          message: "Recovery email sent. Please check your inbox.",
        });
      } catch (error) {
        console.error("Password recovery error:", error);
        return NextResponse.json(
          { success: false, error: errorMessage(error, "Failed to send recovery email") },
          { status: 500 },
        );
      }
    },

    async confirmRecoveryPostgres(request) {
      try {
        const body = await readJson(request);
        const { userId, secret, password, passwordConfirm } = body;

        if (!userId || !secret || !password || !passwordConfirm) {
          return NextResponse.json(
            { success: false, error: "All fields are required" },
            { status: 400 },
          );
        }

        if (password !== passwordConfirm) {
          return NextResponse.json(
            { success: false, error: "Passwords do not match" },
            { status: 400 },
          );
        }

        if (password.length < 8) {
          return NextResponse.json(
            { success: false, error: "Password must be at least 8 characters" },
            { status: 400 },
          );
        }

        await provider.confirmRecovery({ userId, secret, password });

        return NextResponse.json({
          success: true,
          message: "Password reset successful. You can now login with your new password.",
        });
      } catch (error) {
        console.error("Password reset error:", error);
        return NextResponse.json(
          { success: false, error: errorMessage(error, "Failed to reset password") },
          { status: 500 },
        );
      }
    },

    async apiKeyGetPostgres(request) {
      try {
        const principal = await requireSession(request);
        if (!principal) {
          return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const page = await provider.listApiKeysFor(principal.id);
        return NextResponse.json({
          success: true,
          // Hashed keys cannot be re-displayed; the plaintext is shown once at
          // creation. `keys` lists the owner's key metadata.
          apiKey: null,
          keys: page.items.map((key) => ({
            id: key.id,
            name: key.name ?? null,
            createdAt: key.createdAt,
          })),
        });
      } catch (error) {
        console.error("Error fetching API keys:", error);
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    },

    async apiKeyPostgres(request) {
      try {
        const principal = await requireSession(request);
        if (!principal) {
          return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await readJson(request);
        const created = await provider.createApiKeyFor(principal.id, body.name);

        return NextResponse.json({
          success: true,
          apiKey: created.secret,
        });
      } catch (error) {
        console.error("Error generating API Key:", error);
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    },

    async apiKeyDeletePostgres(request) {
      try {
        const principal = await requireSession(request);
        if (!principal) {
          return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await readJson(request);
        if (!body.id) {
          return NextResponse.json({ error: "Key id is required" }, { status: 400 });
        }

        const revoked = await provider.revokeApiKeyFor(principal.id, body.id);
        if (!revoked) {
          return NextResponse.json({ error: "API key not found" }, { status: 404 });
        }

        return NextResponse.json({ success: true });
      } catch (error) {
        console.error("Error revoking API key:", error);
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    },
  };

  async function requireSession(request: NextRequest): Promise<Principal | null> {
    const sessionSecret = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    if (!sessionSecret) {
      return null;
    }
    return provider.verifySessionSecret(sessionSecret);
  }
}
