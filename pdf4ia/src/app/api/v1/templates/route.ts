import { NextRequest, NextResponse } from 'next/server';
import { requireOAuth } from '@/lib/oauth-middleware';
import { getServerAppwriteTables, DATABASE_ID } from '@/lib/appwrite';
import { Query } from 'node-appwrite';

/**
 * List templates
 * GET /api/v1/templates
 * 
 * Supports both OAuth tokens and API keys
 */
export async function GET(request: NextRequest) {
  try {
    // Try OAuth authentication first
    const oauthResult = await requireOAuth(request, ['templates:read']);

    let userId: string;

    if ('error' in oauthResult) {
      // OAuth failed, try API key authentication
      const apiKey = request.headers.get('x-api-key');

      if (!apiKey) {
        return NextResponse.json(
          { error: 'Authentication required. Provide either OAuth token or API key.' },
          { status: 401 }
        );
      }

      // Verify API key and get user ID
      const tables = getServerAppwriteTables();
      const apiKeyDocs = await tables.listDocuments(
        DATABASE_ID,
        'api_keys',
        [Query.equal('key', apiKey), Query.limit(1)]
      );

      if (apiKeyDocs.documents.length === 0) {
        return NextResponse.json(
          { error: 'Invalid API key' },
          { status: 401 }
        );
      }

      userId = apiKeyDocs.documents[0].user_id;
    } else {
      // OAuth authentication successful
      userId = oauthResult.context.userId;
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search');
    const tags = searchParams.get('tags')?.split(',');

    // Build queries
    const queries = [Query.equal('user_id', userId)];

    if (search) {
      queries.push(Query.search('title', search));
    }

    if (tags && tags.length > 0) {
      queries.push(Query.contains('tags', tags));
    }

    // Get templates
    const tables = getServerAppwriteTables();
    const response = await tables.listDocuments(
      DATABASE_ID,
      'templates',
      queries
    );

    return NextResponse.json({
      success: true,
      total: response.total,
      templates: response.documents.map(doc => ({
        $id: doc.$id,
        title: doc.title,
        description: doc.description,
        tags: doc.tags,
        $createdAt: doc.$createdAt,
        $updatedAt: doc.$updatedAt,
      })),
    });

  } catch (error: any) {
    console.error('Templates list error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to list templates' },
      { status: 500 }
    );
  }
}
