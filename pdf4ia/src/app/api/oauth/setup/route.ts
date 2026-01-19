import { NextResponse } from 'next/server';
import { getServerAppwriteDatabases, DATABASE_ID } from '@/lib/appwrite';
import { Permission, Role, IndexType } from 'node-appwrite';

/**
 * Setup OAuth collections in Appwrite
 * Run this endpoint once to create the necessary collections
 */
export async function POST() {
    try {
        const databases = getServerAppwriteDatabases();
        const collections = [];

        // 1. OAuth Clients Collection
        try {
            const clientsCollection = await databases.createCollection(
                DATABASE_ID,
                'oauth_clients',
                'OAuth Clients',
                [
                    Permission.read(Role.any()),
                    Permission.create(Role.users()),
                    Permission.update(Role.users()),
                    Permission.delete(Role.users()),
                ]
            );

            // Create attributes
            await databases.createStringAttribute(DATABASE_ID, 'oauth_clients', 'user_id', 255, true);
            await databases.createStringAttribute(DATABASE_ID, 'oauth_clients', 'client_id', 255, true);
            await databases.createStringAttribute(DATABASE_ID, 'oauth_clients', 'client_secret', 255, true);
            await databases.createStringAttribute(DATABASE_ID, 'oauth_clients', 'name', 255, true);
            await databases.createStringAttribute(DATABASE_ID, 'oauth_clients', 'description', 1000, false);
            await databases.createStringAttribute(DATABASE_ID, 'oauth_clients', 'redirect_uris', 10000, true, undefined, true);
            await databases.createStringAttribute(DATABASE_ID, 'oauth_clients', 'scopes', 5000, true, undefined, true);
            await databases.createStringAttribute(DATABASE_ID, 'oauth_clients', 'created_at', 255, true);
            await databases.createStringAttribute(DATABASE_ID, 'oauth_clients', 'updated_at', 255, true);

            // Create indexes
            await databases.createIndex(DATABASE_ID, 'oauth_clients', 'client_id_idx', IndexType.Key, ['client_id'], ['ASC']);
            await databases.createIndex(DATABASE_ID, 'oauth_clients', 'user_id_idx', IndexType.Key, ['user_id'], ['ASC']);

            collections.push({ name: 'oauth_clients', id: clientsCollection.$id, status: 'created' });
        } catch (error: unknown) {
            const err = error as { code?: number; message?: string };
            if (err.code === 409) {
                collections.push({ name: 'oauth_clients', status: 'already exists' });
            } else {
                throw error;
            }
        }

        // 2. OAuth Tokens Collection
        try {
            const tokensCollection = await databases.createCollection(
                DATABASE_ID,
                'oauth_tokens',
                'OAuth Tokens',
                [
                    Permission.read(Role.any()),
                    Permission.create(Role.any()),
                    Permission.update(Role.any()),
                    Permission.delete(Role.any()),
                ]
            );

            await databases.createStringAttribute(DATABASE_ID, 'oauth_tokens', 'client_id', 255, true);
            await databases.createStringAttribute(DATABASE_ID, 'oauth_tokens', 'user_id', 255, true);
            await databases.createStringAttribute(DATABASE_ID, 'oauth_tokens', 'access_token', 255, true);
            await databases.createStringAttribute(DATABASE_ID, 'oauth_tokens', 'refresh_token', 255, false);
            await databases.createStringAttribute(DATABASE_ID, 'oauth_tokens', 'token_type', 50, true);
            await databases.createStringAttribute(DATABASE_ID, 'oauth_tokens', 'expires_at', 255, true);
            await databases.createStringAttribute(DATABASE_ID, 'oauth_tokens', 'scopes', 5000, true, undefined, true);
            await databases.createStringAttribute(DATABASE_ID, 'oauth_tokens', 'created_at', 255, true);

            await databases.createIndex(DATABASE_ID, 'oauth_tokens', 'access_token_idx', IndexType.Key, ['access_token'], ['ASC']);
            await databases.createIndex(DATABASE_ID, 'oauth_tokens', 'refresh_token_idx', IndexType.Key, ['refresh_token'], ['ASC']);
            await databases.createIndex(DATABASE_ID, 'oauth_tokens', 'user_client_idx', IndexType.Key, ['user_id', 'client_id'], ['ASC', 'ASC']);

            collections.push({ name: 'oauth_tokens', id: tokensCollection.$id, status: 'created' });
        } catch (error: unknown) {
            const err = error as { code?: number; message?: string };
            if (err.code === 409) {
                collections.push({ name: 'oauth_tokens', status: 'already exists' });
            } else {
                throw error;
            }
        }

        // 3. OAuth Authorization Codes Collection
        try {
            const codesCollection = await databases.createCollection(
                DATABASE_ID,
                'oauth_codes',
                'OAuth Authorization Codes',
                [
                    Permission.read(Role.any()),
                    Permission.create(Role.any()),
                    Permission.update(Role.any()),
                    Permission.delete(Role.any()),
                ]
            );

            await databases.createStringAttribute(DATABASE_ID, 'oauth_codes', 'code', 255, true);
            await databases.createStringAttribute(DATABASE_ID, 'oauth_codes', 'client_id', 255, true);
            await databases.createStringAttribute(DATABASE_ID, 'oauth_codes', 'user_id', 255, true);
            await databases.createStringAttribute(DATABASE_ID, 'oauth_codes', 'redirect_uri', 1000, true);
            await databases.createStringAttribute(DATABASE_ID, 'oauth_codes', 'scopes', 5000, true, undefined, true);
            await databases.createStringAttribute(DATABASE_ID, 'oauth_codes', 'code_challenge', 255, false);
            await databases.createStringAttribute(DATABASE_ID, 'oauth_codes', 'code_challenge_method', 50, false);
            await databases.createStringAttribute(DATABASE_ID, 'oauth_codes', 'expires_at', 255, true);
            await databases.createStringAttribute(DATABASE_ID, 'oauth_codes', 'created_at', 255, true);

            await databases.createIndex(DATABASE_ID, 'oauth_codes', 'code_idx', IndexType.Key, ['code'], ['ASC']);

            collections.push({ name: 'oauth_codes', id: codesCollection.$id, status: 'created' });
        } catch (error: unknown) {
            const err = error as { code?: number; message?: string };
            if (err.code === 409) {
                collections.push({ name: 'oauth_codes', status: 'already exists' });
            } else {
                throw error;
            }
        }

        return NextResponse.json({
            success: true,
            message: 'OAuth collections setup completed',
            collections,
        });
    } catch (error: unknown) {
        const err = error as { message?: string };
        console.error('OAuth setup error:', error);
        return NextResponse.json(
            {
                success: false,
                error: err.message || 'Failed to setup OAuth collections',
            },
            { status: 500 }
        );
    }
}
