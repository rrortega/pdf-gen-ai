import { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { getAppwriteAccount, getServerAppwriteClient, getAppwriteClient, getSessionSecret } from "./appwrite";
import { Client, TablesDB, Storage } from "node-appwrite";

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
    // 1. Check for Authorization header (Bearer token)
    const authHeader = request.headers.get("Authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
        const token = authHeader.substring(7);
        try {
            const secret = encoder.encode(JWT_SECRET);
            const { payload } = await jwtVerify(token, secret);

            if (payload && payload.userId) {
                return {
                    id: payload.userId as string,
                    email: payload.email as string,
                    isApiKey: true
                };
            }
        } catch (error) {
            console.error("JWT verification failed:", error);
            return null;
        }
    }

    // 2. Check for Session Cookie (Browser)
    try {
        const account = await getAppwriteAccount();
        const user = await account.get();
        return {
            id: user.$id,
            email: user.email,
            name: user.name,
            isApiKey: false
        };
    } catch (error) {
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
        .setEndpoint("https://aw.chamba.pro/v1")
        .setProject("6967f2f7001ae2212a9b");

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
        .setEndpoint("https://aw.chamba.pro/v1")
        .setProject("6967f2f7001ae2212a9b");

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
