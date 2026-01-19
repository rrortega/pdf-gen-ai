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
    const isBaseQuery = request.nextUrl.searchParams.get("base") === "true";

    // Get templates
    const queries = [];
    if (isBaseQuery) {
      // Templates without user_id are consider "base/mother" templates
      queries.push(Query.isNull("user_id"));
    } else {
      queries.push(Query.equal("user_id", user.id));
    }
    queries.push(Query.orderDesc("$createdAt"));

    const response = await tables.listRows({
      databaseId: DATABASE_ID,
      tableId: COLLECTIONS.TEMPLATES,
      queries: queries
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

    const { title, tags, css, html, test_data, baseTemplateId } = await request.json();

    if (!title) {
      return NextResponse.json(
        { error: "Title is required" },
        { status: 400 },
      );
    }

    let finalHtml = html;
    let finalCss = css;
    let finalTestData = test_data;
    let finalOrientation = "portrait";
    let finalPaperSize = "A4";
    let finalMargins = {
      top: "10mm",
      right: "10mm",
      bottom: "10mm",
      left: "10mm",
    };

    // If cloning from a base template
    if (baseTemplateId) {
      try {
        const baseTemplate = await tables.getRow({
          databaseId: DATABASE_ID,
          tableId: COLLECTIONS.TEMPLATES,
          rowId: baseTemplateId,
        });

        // Only clone if it's a "base" template (user_id is null) OR it's the user's own template
        if (baseTemplate.user_id && baseTemplate.user_id !== user.id) {
          return NextResponse.json({ error: "Cannot clone this template" }, { status: 403 });
        }

        finalHtml = baseTemplate.html;
        finalCss = baseTemplate.css;
        finalTestData = baseTemplate.test_data; // This is already base64 in the DB
        finalOrientation = baseTemplate.orientation || "portrait";
        finalPaperSize = baseTemplate.paper_size || "A4";
        finalMargins = {
          top: baseTemplate.margin_top || "10mm",
          right: baseTemplate.margin_right || "10mm",
          bottom: baseTemplate.margin_bottom || "10mm",
          left: baseTemplate.margin_left || "10mm",
        };
      } catch (e) {
        console.error("Error fetching base template for cloning:", e);
      }
    }

    // Provide generic defaults if still empty (and it wasn't a clone or clone failed)
    if (!finalHtml) {
      finalHtml = `<!-- Handlebars Template -->
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
    }

    if (!finalCss) {
      finalCss = `/* PDF Styles */
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
    }

    if (!finalTestData) {
      const defaultData = {
        "title": "Sample Document",
        "subtitle": "Handlebars Template Example",
        "items": [
          { "name": "Item 1", "value": "Value A" },
          { "name": "Item 2", "value": "Value B" },
          { "name": "Item 3", "value": "Value C" }
        ]
      };
      finalTestData = Buffer.from(JSON.stringify(defaultData)).toString('base64');
    } else if (typeof finalTestData !== 'string') {
      // It came from cloning (already base64) or from request as object
      // If it's an object, encode it. If it's already a string (base64 from baseTemplate), keep it.
      // Actually, baseTemplate.test_data is already base64 string.
      // If it came from request body and it's an object, we should encode it.
      finalTestData = Buffer.from(JSON.stringify(finalTestData)).toString('base64');
    }

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
        test_data: finalTestData,
        user_id: user.id,
        orientation: finalOrientation,
        paper_size: finalPaperSize,
        margin_top: finalMargins.top,
        margin_right: finalMargins.right,
        margin_bottom: finalMargins.bottom,
        margin_left: finalMargins.left,
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
