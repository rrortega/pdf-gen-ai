import { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { getAppwriteAccount, getServerAppwriteClient, getAppwriteClient, getSessionSecret } from "./appwrite";
import { Client, TablesDB, Storage } from "node-appwrite";
import { OAuthClientsService, OAuthTokensService } from "./oauth-service";
import { isPostgresBackend } from "@/backend/config";

const JWT_SECRET = process.env.JWT_SECRET || "default-secret-change-me";
const encoder = new TextEncoder();

export interface AuthUser {
    id: string;
    email: string;
    name?: string;
    isApiKey?: boolean;
}

/**
 * Authenticates a request by checking for a session cookie or a Bearer token.
 * Returns the user information if authenticated, otherwise null.
 */
export async function authenticateRequest(request: NextRequest): Promise<AuthUser | null> {
    const start = Date.now();
    // 1. Check for Authorization header (Bearer token)
    const authHeader = request.headers.get("Authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
        const token = authHeader.substring(7);

        // Try local JWT first
        try {
            const secret = encoder.encode(JWT_SECRET);
            const { payload } = await jwtVerify(token, secret);

            if (payload && payload.userId) {
                console.log(`[AUTH] Authenticated via JWT in ${Date.now() - start}ms`);
                return {
                    id: payload.userId as string,
                    email: payload.email as string,
                    isApiKey: true
                };
            }
        } catch {
            // Not a local JWT or expired, try OAuth Service
            try {
                const oauthToken = await OAuthTokensService.verifyToken(token);
                if (oauthToken) {
                    console.log(`[AUTH] Authenticated via OAuth in ${Date.now() - start}ms`);
                    return {
                        id: oauthToken.user_id,
                        email: "", // We might not have email in OAuthToken record
                        isApiKey: false // It's an OAuth user session
                    };
                }
            } catch (oauthError) {
                console.error("[AUTH] OAuth token verification failed:", oauthError);
            }
        }

        // Postgres backend: opaque API keys live in auth_api_keys. The lazy
        // import keeps Appwrite deployments independent of the auth schema.
        if (isPostgresBackend()) {
            const { getPostgresAuthProvider } = await import("@/backend/postgres/auth/provider");
            const principal = await getPostgresAuthProvider().verifyApiKeySecret(token);
            if (principal) {
                console.log(`[AUTH] Authenticated via API key in ${Date.now() - start}ms`);
                return principal;
            }
        }

        console.warn(`[AUTH] Bearer token provided but invalid. Time: ${Date.now() - start}ms`);
        return null;
    }

    // 2. Check for Session Cookie (Browser)
    if (isPostgresBackend()) {
        // The self-hosted backend verifies the opaque session cookie without
        // initialising the Appwrite SDK.
        const { getPostgresAuthProvider } = await import("@/backend/postgres/auth/provider");
        const principal = await getPostgresAuthProvider().current();
        if (principal) {
            console.log(`[AUTH] Authenticated via Session Cookie in ${Date.now() - start}ms`);
        }
        return principal;
    }

    try {
        const account = await getAppwriteAccount();
        const user = await account.get();
        console.log(`[AUTH] Authenticated via Session Cookie in ${Date.now() - start}ms`);
        return {
            id: user.$id,
            email: user.email,
            name: user.name,
            isApiKey: false
        };
    } catch (err: unknown) {
        // Only log if not just "missing cookie"
        const error = err as { code?: number };
        if (error.code !== 401) {
            console.error("[AUTH] Session check failed:", error);
        }
        return null;
    }
}

/**
 * Gets an Appwrite Client authenticated for the current request.
 */
export async function getAuthenticatedAppwriteClient(request: NextRequest) {
    const user = await authenticateRequest(request);
    if (!user) return null;

    if (user.isApiKey) {
        return {
            client: getServerAppwriteClient(),
            user,
            isAdmin: true
        };
    } else {
        const secret = await getSessionSecret();
        return {
            client: getAppwriteClient(secret),
            user,
            isAdmin: false
        };
    }
}

/**
 * Gets Appwrite Databases instance authenticated for the current request.
 * Uses node-appwrite for both Session and API Key auth to have a consistent API.
 */
export async function getAuthenticatedDatabases(request: NextRequest) {
    const auth = await authenticateRequest(request);
    if (!auth) return null;

    const client = new Client()
        .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || "https://cloud.appwrite.io/v1")
        .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!);

    if (auth.isApiKey) {
        client.setKey(process.env.APPWRITE_API_KEY!);
    } else {
        const secret = await getSessionSecret();
        if (secret) {
            client.setSession(secret);
        }
    }

    return {
        tables: new TablesDB(client),
        user: auth,
        isAdmin: !!auth.isApiKey
    };
}

/**
 * Gets Appwrite Account instance authenticated for the current request.
 * Only works for session-based auth.
 */
export async function getAuthenticatedAccount(request: NextRequest) {
    const auth = await getAuthenticatedAppwriteClient(request);
    if (!auth || auth.isAdmin) return null;

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Account } = require("appwrite");
    return new Account(auth.client);
}

/**
 * Gets Appwrite Storage instance authenticated for the current request.
 * Uses node-appwrite for both Session and API Key auth to have a consistent API.
 */
export async function getAuthenticatedStorage(request: NextRequest) {
    const auth = await authenticateRequest(request);
    if (!auth) return null;

    const client = new Client()
        .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || "https://cloud.appwrite.io/v1")
        .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!);

    if (auth.isApiKey) {
        client.setKey(process.env.APPWRITE_API_KEY!);
    } else {
        const secret = await getSessionSecret();
        if (secret) {
            client.setSession(secret);
        }
    }

    return {
        storage: new Storage(client),
        user: auth,
        isAdmin: !!auth.isApiKey
    };
}

/**
 * Validates hybrid tokens for MCP server
 * Supports both local API keys and OAuth access tokens
 */
export async function validateHybridToken(authHeader: string | null): Promise<boolean> {
    const start = Date.now();
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return false;
    }

    const token = authHeader.substring(7);

    // 1. Check if it's a local API key (Fastest)
    const localApiKey = process.env.MCP_API_KEY;
    if (localApiKey && token === localApiKey) {
        console.log(`[HYBRID_AUTH] Validated via local API key in ${Date.now() - start}ms`);
        return true;
    }

    // 2. Try to verify as JWT (Fast - Local)
    try {
        const secret = encoder.encode(JWT_SECRET);
        const { payload } = await jwtVerify(token, secret);
        if (payload && payload.userId) {
            console.log(`[HYBRID_AUTH] Validated via JWT API key in ${Date.now() - start}ms`);
            return true;
        }
    } catch {
        // Not a JWT, continue
    }

    // 3. Try to verify as OAuth token or Direct API Key (Slower - DB/User API)
    try {
        const dbStart = Date.now();
        // First try standard OAuth token lookup
        const oauthToken = await OAuthTokensService.verifyToken(token);
        if (oauthToken) {
            console.log(`[HYBRID_AUTH] Validated via OAuth token in ${Date.now() - start}ms (DB: ${Date.now() - dbStart}ms)`);
            return true;
        }

        // Then try direct API key lookup (User Preferences)
        const userId = await OAuthClientsService.getUserIdFromApiKey(token);
        if (userId) {
            console.log(`[HYBRID_AUTH] Validated via Direct API key (User Prefs) in ${Date.now() - start}ms (UserAPI: ${Date.now() - dbStart}ms)`);
            return true;
        }
    } catch (_error) {
        console.error('[HYBRID_AUTH] Token/Key verification failed:', _error);
    }

    console.warn(`[HYBRID_AUTH] Token validation failed after ${Date.now() - start}ms`);
    return false;
}
