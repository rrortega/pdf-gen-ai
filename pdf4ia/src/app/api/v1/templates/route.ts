import { NextRequest, NextResponse } from "next/server";
import {
  DATABASE_ID,
  COLLECTIONS,
} from "@/lib/appwrite";
import { Query, ID } from "node-appwrite";
import { getAuthenticatedDatabases } from "@/lib/auth";

/**
 * @swagger
 * /api/v1/templates:
 *   get:
 *     summary: List user templates
 *     tags: [Templates]
 *     security:
 *       - apiKeyAuth: []
 *     responses:
 *       200:
 *         description: List of templates
 *       500:
 *         description: Server error
 */

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedDatabases(request);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { tables, user, isAdmin } = auth;

    // Get templates for current user
    const response = await tables.listRows({
      databaseId: DATABASE_ID,
      tableId: COLLECTIONS.TEMPLATES,
      queries: [
        Query.equal("user_id", user.id),
        Query.orderDesc("$createdAt"),
      ]
    });

    const templates = response.rows || [];

    // Transform templates and decode test_data
    const transformedTemplates = templates.map((template) => {
      let decodedTestData = template.test_data || "{}";
      if (template.test_data) {
        try {
          decodedTestData = JSON.parse(Buffer.from(template.test_data, 'base64').toString('utf8'));
        } catch (e) {
          console.warn("Could not decode test_data for template:", template.$id, e);
        }
      }

      const baseTemplate = {
        $id: template.$id,
        $createdAt: template.$createdAt,
        $updatedAt: template.$updatedAt,
        title: template.title || "",
        tags: template.tags || [],
      };

      // Filter sensitive fields for JWT API Key requests
      if (isAdmin) {
        return baseTemplate;
      }

      return {
        ...baseTemplate,
        css: template.css || "",
        html: template.html || "",
        test_data: decodedTestData,
      };
    });

    return NextResponse.json({
      success: true,
      templates: transformedTemplates,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Failed to list templates";
    console.error("List templates error:", error);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedDatabases(request);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { tables, user } = auth;

    const { title, tags, css, html, test_data } = await request.json();

    if (!title) {
      return NextResponse.json(
        { error: "Title is required" },
        { status: 400 },
      );
    }

    // Provide defaults if not provided
    const finalHtml = html || `<!-- Handlebars Template -->
<div class="document">
  <h1>{{title}}</h1>
  
  {{#if subtitle}}
  <h2>{{subtitle}}</h2>
  {{/if}}
  
  {{#if items}}
  <ul>
    {{#each items}}
    <li>{{this.name}} - {{this.value}}</li>
    {{/each}}
  </ul>
  {{/if}}
</div>`;
    const finalCss = css || `/* PDF Styles */
body {
  font-family: Arial, sans-serif;
  padding: 20px;
  color: #333;
}

.document {
  max-width: 800px;
  margin: 0 auto;
}

h1 {
  color: #2c3e50;
  border-bottom: 2px solid #3498db;
  padding-bottom: 10px;
}

h2 {
  color: #7f8c8d;
  margin-top: 20px;
}

ul {
  list-style-type: none;
  padding: 0;
}

li {
  padding: 8px;
  margin: 5px 0;
  background: #ecf0f1;
  border-left: 3px solid #3498db;
}`;
    const finalTestData = test_data || {
      "title": "Sample Document",
      "subtitle": "Handlebars Template Example",
      "items": [
        { "name": "Item 1", "value": "Value A" },
        { "name": "Item 2", "value": "Value B" },
        { "name": "Item 3", "value": "Value C" }
      ]
    };

    // Ensure testData is an object for encoding
    const testDataObject = typeof finalTestData === 'string' ? JSON.parse(finalTestData) : finalTestData;
    const encodedSampleData = Buffer.from(JSON.stringify(testDataObject)).toString('base64');

    // Store in dedicated fields
    const createdTemplate = await tables.createRow({
      databaseId: DATABASE_ID,
      tableId: COLLECTIONS.TEMPLATES,
      rowId: ID.unique(),
      data: {
        title: title,
        tags: tags || [],
        css: finalCss,
        html: finalHtml,
        test_data: encodedSampleData,
        user_id: user.id,
      }
    });

    // Decode for response
    let responseTestData = createdTemplate.test_data;
    try {
      responseTestData = JSON.parse(Buffer.from(createdTemplate.test_data, 'base64').toString('utf8'));
    } catch (e) {
      console.warn("Could not decode test_data for response:", e);
    }

    return NextResponse.json({
      success: true,
      template: {
        $id: createdTemplate.$id,
        $createdAt: createdTemplate.$createdAt,
        $updatedAt: createdTemplate.$updatedAt,
        title: createdTemplate.title,
        tags: createdTemplate.tags || [],
        css: createdTemplate.css,
        html: createdTemplate.html,
        test_data: responseTestData,
      },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Failed to create template";
    console.error("Create template error:", error);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 },
    );
  }
}
