import { NextRequest, NextResponse } from "next/server";
import { createPostgresOAuthCodeRepository } from "./repositories";
import { createPostgresOAuthTokenRepository } from "./repositories";

/**
 * PostgreSQL branches for the MCP OAuth endpoints (/api/llm/mcp/auth and
 * /api/llm/mcp/token). Response shapes and status codes mirror the legacy
 * Appwrite handlers exactly; the Appwrite SDK is never initialised here.
 */

function searchParamsOf(request: NextRequest): URLSearchParams {
  return request.nextUrl.searchParams;
}

/** GET /api/llm/mcp/auth — issue an authorization code for the signed-in user. */
export async function authGetPostgres(request: NextRequest): Promise<NextResponse> {
  try {
    const params = searchParamsOf(request);
    const clientId = params.get("client_id");
    const redirectUri = params.get("redirect_uri");
    const state = params.get("state");
    const codeChallenge = params.get("code_challenge");
    const codeChallengeMethod = params.get("code_challenge_method") as "S256" | "plain" | null;
    const scope = params.get("scope") || "read write";

    console.log("[OAuth Auth] Request received:", {
      clientId,
      redirectUri,
      state,
      scope,
      hasCodeChallenge: !!codeChallenge,
    });

    if (!clientId || !redirectUri) {
      return new NextResponse("Missing required parameters: client_id and redirect_uri", { status: 400 });
    }

    // Resolve the signed-in user from the opaque session cookie.
    const { getPostgresAuthProvider } = await import("./provider");
    const principal = await getPostgresAuthProvider().current();
    if (!principal) {
      const baseUrl = process.env.NEXT_PUBLIC_DOMAIN || process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
      const consentUrl = new URL("/oauth/consent", baseUrl);
      params.forEach((value, key) => {
        consentUrl.searchParams.set(key, value);
      });
      console.log("[OAuth Auth] User not authenticated, redirecting to consent page");
      return NextResponse.redirect(consentUrl);
    }

    console.log("[OAuth Auth] User authenticated:", principal.id);
    const scopes = scope.split(" ");
    const { secret: code } = await createPostgresOAuthCodeRepository().issue({
      clientId,
      userId: principal.id,
      redirectUri,
      scopes,
      codeChallenge: codeChallenge || undefined,
      codeChallengeMethod: codeChallengeMethod || undefined,
    });

    console.log("[OAuth Auth] Code generated, redirecting to:", redirectUri);
    const callbackUrl = new URL(redirectUri);
    callbackUrl.searchParams.set("code", code);
    if (state) {
      callbackUrl.searchParams.set("state", state);
    }
    return NextResponse.redirect(callbackUrl.toString());
  } catch (error) {
    console.error("[OAuth Auth] Error:", error);
    return new NextResponse("Internal server error", { status: 500 });
  }
}

function formDataToObject(formData: FormData): Record<string, string> {
  const body: Record<string, string> = {};
  formData.forEach((value, key) => {
    body[key] = value.toString();
  });
  return body;
}

async function readTokenRequestBody(request: NextRequest): Promise<Record<string, string>> {
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("application/x-www-form-urlencoded")) {
    return formDataToObject(await request.formData());
  }

  try {
    const body = await request.json();
    return typeof body === "object" && body !== null ? (body as Record<string, string>) : {};
  } catch {
    console.warn("[OAuth Token] Failed to parse as JSON, trying form data fallback");
    return formDataToObject(await request.formData());
  }
}

function errorBody(error: string, error_description: string, status: number): NextResponse {
  return NextResponse.json({ error, error_description }, { status });
}

/** POST /api/llm/mcp/token — exchange a code or refresh token for access tokens. */
export async function tokenPostPostgres(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await readTokenRequestBody(request);
    const { grant_type, code, redirect_uri, client_id, client_secret, code_verifier, refresh_token } = body;

    if (!grant_type || !["authorization_code", "refresh_token"].includes(grant_type)) {
      return errorBody(
        "unsupported_grant_type",
        'grant_type must be "authorization_code" or "refresh_token"',
        400,
      );
    }

    if (grant_type === "authorization_code") {
      return handleAuthorizationCodeGrantPostgres({ code, redirect_uri, client_id, code_verifier });
    }

    return handleRefreshTokenGrantPostgres({ refresh_token, client_id, client_secret });
  } catch (error) {
    console.error("[OAuth Token] Error:", error);
    console.error("[OAuth Token] Stack:", (error as Error).stack);
    return NextResponse.json(
      { error: "server_error", error_description: (error as Error).message },
      { status: 500 },
    );
  }
}

async function handleAuthorizationCodeGrantPostgres(input: {
  code?: string;
  redirect_uri?: string;
  client_id?: string;
  code_verifier?: string;
}): Promise<NextResponse> {
  console.log("[OAuth Token] Authorization code grant request:", {
    code: input.code?.substring(0, 10) + "...",
    redirect_uri: input.redirect_uri,
    client_id: input.client_id,
    has_code_verifier: !!input.code_verifier,
  });

  if (!input.code || !input.redirect_uri || !input.client_id) {
    return errorBody("invalid_request", "Missing required parameters", 400);
  }

  console.log("[OAuth Token] Consuming authorization code...");
  const authCode = await createPostgresOAuthCodeRepository().consume(input.code);
  if (!authCode) {
    console.log("[OAuth Token] Invalid or expired code");
    return errorBody("invalid_grant", "Invalid or expired authorization code", 400);
  }

  console.log("[OAuth Token] Code consumed successfully:", {
    code_client_id: authCode.client_id,
    request_client_id: input.client_id,
    user_id: authCode.user_id,
  });

  if (authCode.client_id !== input.client_id) {
    return errorBody("invalid_grant", "Client mismatch", 400);
  }

  if (authCode.redirect_uri !== input.redirect_uri) {
    console.log("[OAuth Token] Redirect URI mismatch:", {
      expected: authCode.redirect_uri,
      received: input.redirect_uri,
    });
    return errorBody("invalid_grant", "Redirect URI mismatch", 400);
  }

  console.log("[OAuth Token] Checking PKCE...");
  if (authCode.code_challenge) {
    if (!input.code_verifier) {
      console.log("[OAuth Token] PKCE: code_verifier required but not provided");
      return errorBody("invalid_request", "code_verifier required", 400);
    }

    const { verifyPKCE } = await import("@/lib/oauth");
    const isValidPKCE = verifyPKCE(
      input.code_verifier,
      authCode.code_challenge,
      (authCode.code_challenge_method as "S256" | "plain") || "S256",
    );
    if (!isValidPKCE) {
      console.log("[OAuth Token] PKCE verification failed");
      return errorBody("invalid_grant", "Invalid code_verifier", 400);
    }
    console.log("[OAuth Token] PKCE verified successfully");
  } else {
    console.log("[OAuth Token] No PKCE challenge, skipping verification");
  }

  console.log("[OAuth Token] Creating access token...", {
    client_id: authCode.client_id,
    user_id: authCode.user_id,
    scopes: authCode.scopes,
  });

  try {
    const tokenResponse = await createPostgresOAuthTokenRepository().issue({
      clientId: authCode.client_id,
      userId: authCode.user_id,
      scopes: authCode.scopes,
      includeRefreshToken: true,
    });
    console.log("[OAuth Token] Token created successfully");
    return NextResponse.json(tokenResponse);
  } catch (tokenError) {
    console.error("[OAuth Token] Failed to create token:", tokenError);
    console.error("[OAuth Token] Token error stack:", (tokenError as Error).stack);
    return NextResponse.json(
      {
        error: "server_error",
        error_description: "Failed to create access token: " + (tokenError as Error).message,
      },
      { status: 500 },
    );
  }
}

async function handleRefreshTokenGrantPostgres(input: {
  refresh_token?: string;
  client_id?: string;
  client_secret?: string;
}): Promise<NextResponse> {
  if (!input.refresh_token || !input.client_id || !input.client_secret) {
    return errorBody("invalid_request", "Missing required parameters", 400);
  }

  const { createPostgresApiKeyRepository } = await import("./repositories");
  const { hashTokenSecret } = await import("../../auth/tokens");
  const owner = await createPostgresApiKeyRepository().findValidOwnerByKeyHash(
    hashTokenSecret(input.client_secret),
  );
  if (!owner || owner.userId !== input.client_id) {
    return errorBody("invalid_client", "Invalid client credentials", 401);
  }

  const tokenResponse = await createPostgresOAuthTokenRepository().rotateByRefreshToken(
    input.refresh_token,
  );
  if (!tokenResponse) {
    return errorBody("invalid_grant", "Invalid refresh token", 400);
  }

  return NextResponse.json(tokenResponse);
}
