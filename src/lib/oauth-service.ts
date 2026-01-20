import { getServerAppwriteDatabases, DATABASE_ID } from './appwrite';
import { ID, Query } from 'node-appwrite';
import {
    OAuthToken,
    OAuthAuthorizationCode,
    generateAuthorizationCode,
    generateAccessToken,
    generateRefreshToken,
} from './oauth';

// Collection IDs
export const OAUTH_TOKENS_COLLECTION = process.env.OAUTH_TOKENS_COLLECTION_ID || 'oauth_tokens';
export const OAUTH_CODES_COLLECTION = process.env.OAUTH_CODES_COLLECTION_ID || 'oauth_codes';
export const API_KEYS_COLLECTION = process.env.API_KEYS_COLLECTION_ID || 'api_keys';

/**
 * OAuth Clients Service
 * Uses Appwrite User ID as client_id and API Key as client_secret
 */
export class OAuthClientsService {
    /**
     * Verify client credentials using User ID and API Key
     */
    static async verifyClient(userId: string, apiKey: string): Promise<boolean> {
        try {
            const tables = getServerAppwriteDatabases();
            // Verify that the API key belongs to this user
            const response = await tables.listDocuments(
                DATABASE_ID,
                API_KEYS_COLLECTION,
                [
                    Query.equal('user_id', userId),
                    Query.equal('key', apiKey),
                    Query.limit(1)
                ]
            );

            return response.documents.length > 0;
        } catch (error) {
            console.error('Error verifying OAuth client:', error);
            return false;
        }
    }

    /**
     * Get user ID from API key
     */
    static async getUserIdFromApiKey(apiKey: string): Promise<string | null> {
        try {
            const tables = getServerAppwriteDatabases();
            const response = await tables.listDocuments(
                DATABASE_ID,
                API_KEYS_COLLECTION,
                [Query.equal('key', apiKey), Query.limit(1)]
            );

            if (response.documents.length === 0) {
                return null;
            }

            return response.documents[0].user_id;
        } catch (error) {
            console.error('Error getting user from API key:', error);
            return null;
        }
    }
}

/**
 * OAuth Authorization Codes Service
 */
export class OAuthCodesService {
    /**
     * Create authorization code
     */
    static async createCode(
        clientId: string,
        userId: string,
        redirectUri: string,
        scopes: string[],
        codeChallenge?: string,
        codeChallengeMethod?: 'S256' | 'plain'
    ): Promise<{ code: string; expiresAt: string }> {
        const code = generateAuthorizationCode();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes

        const tables = getServerAppwriteDatabases();
        await tables.createDocument(
            DATABASE_ID,
            OAUTH_CODES_COLLECTION,
            ID.unique(),
            {
                code,
                client_id: clientId,
                user_id: userId,
                redirect_uri: redirectUri,
                scopes,
                code_challenge: codeChallenge || '',
                code_challenge_method: codeChallengeMethod || '',
                expires_at: expiresAt,
                created_at: new Date().toISOString(),
            }
        );

        return { code, expiresAt };
    }

    /**
     * Get and consume authorization code
     */
    static async consumeCode(code: string): Promise<OAuthAuthorizationCode | null> {
        try {
            const tables = getServerAppwriteDatabases();
            const response = await tables.listDocuments(
                DATABASE_ID,
                OAUTH_CODES_COLLECTION,
                [Query.equal('code', code), Query.limit(1)]
            );

            if (response.documents.length === 0) {
                return null;
            }

            const authCode = response.documents[0] as unknown as OAuthAuthorizationCode;

            // Check if expired
            if (new Date(authCode.expires_at) < new Date()) {
                await tables.deleteDocument(DATABASE_ID, OAUTH_CODES_COLLECTION, authCode.$id);
                return null;
            }

            // Delete code (one-time use)
            await tables.deleteDocument(DATABASE_ID, OAUTH_CODES_COLLECTION, authCode.$id);

            return authCode;
        } catch (error) {
            console.error('Error consuming authorization code:', error);
            return null;
        }
    }
}

/**
 * OAuth Tokens Service
 */
export class OAuthTokensService {
    /**
     * Create access token
     */
    static async createToken(
        clientId: string,
        userId: string,
        scopes: string[],
        includeRefreshToken: boolean = true
    ): Promise<{
        access_token: string;
        refresh_token?: string;
        token_type: 'Bearer';
        expires_in: number;
        scope: string;
    }> {
        const accessToken = generateAccessToken();
        const refreshToken = includeRefreshToken ? generateRefreshToken() : undefined;
        const expiresIn = 3600; // 1 hour
        const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

        const tables = getServerAppwriteDatabases();
        await tables.createDocument(
            DATABASE_ID,
            OAUTH_TOKENS_COLLECTION,
            ID.unique(),
            {
                client_id: clientId,
                user_id: userId,
                access_token: accessToken,
                refresh_token: refreshToken || '',
                token_type: 'Bearer',
                expires_at: expiresAt,
                scopes,
                created_at: new Date().toISOString(),
            }
        );

        return {
            access_token: accessToken,
            refresh_token: refreshToken,
            token_type: 'Bearer',
            expires_in: expiresIn,
            scope: scopes.join(' '),
        };
    }

    /**
     * Verify access token
     */
    static async verifyToken(accessToken: string): Promise<OAuthToken | null> {
        try {
            const tables = getServerAppwriteDatabases();
            const response = await tables.listDocuments(
                DATABASE_ID,
                OAUTH_TOKENS_COLLECTION,
                [Query.equal('access_token', accessToken), Query.limit(1)]
            );

            if (response.documents.length === 0) {
                return null;
            }

            const token = response.documents[0] as unknown as OAuthToken;

            // Check if expired
            if (new Date(token.expires_at) < new Date()) {
                await tables.deleteDocument(DATABASE_ID, OAUTH_TOKENS_COLLECTION, token.$id);
                return null;
            }

            return token;
        } catch (error) {
            console.error('Error verifying token:', error);
            return null;
        }
    }

    /**
     * Refresh access token
     */
    static async refreshToken(refreshToken: string): Promise<{
        access_token: string;
        refresh_token?: string;
        token_type: 'Bearer';
        expires_in: number;
        scope: string;
    } | null> {
        try {
            const tables = getServerAppwriteDatabases();
            const response = await tables.listDocuments(
                DATABASE_ID,
                OAUTH_TOKENS_COLLECTION,
                [Query.equal('refresh_token', refreshToken), Query.limit(1)]
            );

            if (response.documents.length === 0) {
                return null;
            }

            const oldToken = response.documents[0] as unknown as OAuthToken;

            // Delete old token
            await tables.deleteDocument(DATABASE_ID, OAUTH_TOKENS_COLLECTION, oldToken.$id);

            // Create new token
            return await this.createToken(
                oldToken.client_id,
                oldToken.user_id,
                oldToken.scopes,
                true
            );
        } catch (error) {
            console.error('Error refreshing token:', error);
            return null;
        }
    }

    /**
     * Revoke token
     */
    static async revokeToken(token: string): Promise<boolean> {
        try {
            const tables = getServerAppwriteDatabases();
            const response = await tables.listDocuments(
                DATABASE_ID,
                OAUTH_TOKENS_COLLECTION,
                [
                    Query.or([
                        Query.equal('access_token', token),
                        Query.equal('refresh_token', token),
                    ]),
                    Query.limit(1),
                ]
            );

            if (response.documents.length === 0) {
                return false;
            }

            await tables.deleteDocument(
                DATABASE_ID,
                OAUTH_TOKENS_COLLECTION,
                response.documents[0].$id
            );

            return true;
        } catch (error) {
            console.error('Error revoking token:', error);
            return false;
        }
    }

    /**
     * Get user tokens for a client
     */
    static async getUserClientTokens(userId: string, clientId: string): Promise<OAuthToken[]> {
        const tables = getServerAppwriteDatabases();
        const response = await tables.listDocuments(
            DATABASE_ID,
            OAUTH_TOKENS_COLLECTION,
            [
                Query.equal('user_id', userId),
                Query.equal('client_id', clientId),
                Query.orderDesc('$createdAt'),
            ]
        );

        return response.documents as unknown as OAuthToken[];
    }
}
