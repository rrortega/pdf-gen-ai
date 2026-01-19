import { NextRequest, NextResponse } from 'next/server';
import { requireOAuth } from '@/lib/oauth-middleware';
import { DATABASE_ID, COLLECTIONS } from '@/lib/appwrite';
import { getAuthenticatedDatabases } from '@/lib/auth';
import { Query } from 'node-appwrite';

/**
 * List templates
 * GET /api/v1/templates
 * 
 * Supports both OAuth tokens and API keys
 */
export async function GET(request: NextRequest) {
  try {
    const oauthResult = await requireOAuth(request, ['templates:read']);

    let tables;
    let userId: string;

    if ('error' in oauthResult) {
      // OAuth failed, try helper that supports Session and API Key
      const auth = await getAuthenticatedDatabases(request);
      if (!auth) {
        return oauthResult.error;
      }
      tables = auth.tables;
      userId = auth.user.id;
    } else {
      // OAuth successful
      const auth = await getAuthenticatedDatabases(request);
      if (!auth) {
        // Fallback or error if oauth scope check passed but getAuthenticatedDatabases failed
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      tables = auth.tables;
      userId = auth.user.id;
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search');
    const tags = searchParams.get('tags')?.split(',');

    // Build queries
    const queries = [searchParams.get('base') ? Query.isNull('user_id') : Query.equal('user_id', userId)];

    if (search) {
      queries.push(Query.search('title', search));
    }

    if (tags && tags.length > 0) {
      queries.push(Query.contains('tags', tags));
    }

    // Get templates using TablesDB
    const response = await tables.listRows({
      databaseId: DATABASE_ID,
      tableId: COLLECTIONS.TEMPLATES,
      queries: queries
    });

    return NextResponse.json({
      success: true,
      total: response.total,
      templates: response.rows.map(row => ({
        $id: row.$id,
        title: row.title,
        description: row.description,
        tags: row.tags,
        $createdAt: row.$createdAt,
        $updatedAt: row.$updatedAt,
      })),
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to list templates';
    console.error('Templates list error:', error);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
