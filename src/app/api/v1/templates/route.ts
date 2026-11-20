import { NextRequest, NextResponse, connection } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';
import { requireOAuth } from '@/lib/oauth-middleware';
import { DATABASE_ID, COLLECTIONS } from '@/lib/appwrite';
import { getAuthenticatedDatabases } from '@/lib/auth';
import { Query, ID } from 'node-appwrite';
import { isPostgresBackend } from '@/backend/config';
import { listTemplatesPostgres, createTemplatePostgres } from '@/backend/data/http/templates';

/**
 * List templates
 * GET /api/v1/templates
 * 
 * Supports both OAuth tokens and API keys
 */
export async function GET(request: NextRequest) {
  if (isPostgresBackend()) {
    return listTemplatesPostgres(request);
  }

  await connection();
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
    const ids = searchParams.get('ids')?.split(',');
    const includeTestData = searchParams.get('includeTestData') === 'true';

    // Build queries
    const queries = [searchParams.get('base') ? Query.isNull('user_id') : Query.equal('user_id', userId)];

    if (search) {
      queries.push(Query.search('title', search));
    }

    if (tags && tags.length > 0) {
      queries.push(Query.contains('tags', tags));
    }

    if (ids && ids.length > 0) {
      queries.push(Query.equal('$id', ids));
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
      templates: response.rows.map(row => {
        const template: any = {
          $id: row.$id,
          title: row.title,
          description: row.description,
          tags: row.tags,
          $createdAt: row.$createdAt,
          $updatedAt: row.$updatedAt,
        };

        if (includeTestData && row.test_data) {
          try {
            template.request_payload = JSON.parse(Buffer.from(row.test_data, 'base64').toString('utf8'));
          } catch (e) {
            console.warn(`Could not decode test_data for template ${row.$id}:`, e);
          }
        }

        return template;
      }),
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

/**
 * Create template
 * POST /api/v1/templates
 */
export async function POST(request: NextRequest) {
  if (isPostgresBackend()) {
    return createTemplatePostgres(request);
  }

  try {
    const auth = await getAuthenticatedDatabases(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { tables, user } = auth;
    const body = await request.json();
    const { title, tags, baseTemplateId } = body;

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    let initialData: {
      user_id: string;
      title: string;
      tags: string[];
      html: string;
      css: string;
      test_data: string;
      orientation: string;
      paper_size: string;
      margin_top: string;
      margin_right: string;
      margin_bottom: string;
      margin_left: string;
    } = {
      user_id: user.id,
      title,
      tags: tags || [],
      html: `<!-- Handlebars Template -->
<div class="document">
  <h1>{{title}}</h1>
</div>`,
      css: `/* PDF Styles */
body {
  font-family: Arial, sans-serif;
  padding: 20px;
}`,
      test_data: Buffer.from(JSON.stringify({ title: "Sample" })).toString('base64'),
      orientation: 'portrait',
      paper_size: 'A4',
      margin_top: '20mm',
      margin_right: '20mm',
      margin_bottom: '20mm',
      margin_left: '20mm',
    };

    if (baseTemplateId) {
      // Fetch base template content
      try {
        const baseTemplate = await tables.getRow({
          databaseId: DATABASE_ID,
          tableId: COLLECTIONS.TEMPLATES,
          rowId: baseTemplateId,
        });

        if (baseTemplate) {
          initialData = {
            ...initialData,
            html: baseTemplate.html || initialData.html,
            css: baseTemplate.css || initialData.css,
            test_data: baseTemplate.test_data || initialData.test_data,
            orientation: baseTemplate.orientation || initialData.orientation,
            paper_size: baseTemplate.paper_size || initialData.paper_size,
            margin_top: baseTemplate.margin_top || initialData.margin_top,
            margin_right: baseTemplate.margin_right || initialData.margin_right,
            margin_bottom: baseTemplate.margin_bottom || initialData.margin_bottom,
            margin_left: baseTemplate.margin_left || initialData.margin_left,
          };
        }
      } catch (e) {
        console.warn('Could not fetch base template, using defaults:', e);
      }
    }

    const template = await tables.createRow({
      databaseId: DATABASE_ID,
      tableId: COLLECTIONS.TEMPLATES,
      rowId: ID.unique(),
      data: initialData,
    });

    // Invalidate template list and dashboard caches
    revalidatePath("/templates", "page");
    revalidatePath("/dashboard", "page");
    revalidateTag("templates", "max");
    revalidateTag(`user-templates-${user.id}`, "max");
    revalidateTag("dashboard", "max");
    revalidateTag(`user-dashboard-${user.id}`, "max");

    return NextResponse.json({
      success: true,
      template: {
        $id: template.$id,
        $createdAt: template.$createdAt,
        title: template.title,
      },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to create template';
    console.error('Template create error:', error);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
