import { NextRequest, NextResponse } from "next/server";
import {
  DATABASE_ID,
  COLLECTIONS,
} from "@/lib/appwrite";
import { getAuthenticatedDatabases } from "@/lib/auth";
import { Query, ID } from "node-appwrite";

/**
 * @swagger
 * /api/templates:
 *   get:
 *     summary: List user templates
 *     tags: [Templates]
 *     security:
 *       - sessionAuth: []
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

    const { tables, user } = auth;

    // Get templates for current user
    const response = await tables.listRows({
      databaseId: DATABASE_ID,
      tableId: COLLECTIONS.TEMPLATES,
      queries: [
        Query.equal("user_id", user.id),
        Query.orderDesc("$createdAt")
      ]
    });

    // Decode test_data from base64
    const decodedRows = (response.rows || []).map(row => {
      if (row.test_data) {
        try {
          const decoded = Buffer.from(row.test_data, 'base64').toString('utf8');
          row.test_data = JSON.parse(decoded);
        } catch (e) {
          console.warn("Could not decode test_data for row:", row.$id, e);
        }
      }
      return row;
    });

    return NextResponse.json({
      success: true,
      templates: decodedRows,
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

    const { title, description, html, css, test_data } = await request.json();

    if (!title || !html) {
      return NextResponse.json(
        { error: "Title and html are required" },
        { status: 400 },
      );
    }

    // Encode test_data to base64
    const encodedTestData = Buffer.from(JSON.stringify(test_data || {})).toString('base64');

    const createdTemplate = await tables.createRow({
      databaseId: DATABASE_ID,
      tableId: COLLECTIONS.TEMPLATES,
      rowId: ID.unique(),
      data: {
        title,
        description: description || "",
        user_id: user.id,
        css: css || "",
        html: html,
        test_data: encodedTestData,
        tags: [],
        orientation: "portrait",
        paper_size: "A4",
        margin_top: "10mm",
        margin_right: "10mm",
        margin_bottom: "10mm",
        margin_left: "10mm",
      }
    });

    // Decode test_data for response
    const responseTemplate = { ...createdTemplate };
    try {
      const decoded = Buffer.from(createdTemplate.test_data, 'base64').toString('utf8');
      responseTemplate.test_data = JSON.parse(decoded);
    } catch (e) {
      console.warn("Could not decode test_data for response:", e);
    }

    return NextResponse.json({
      success: true,
      template: responseTemplate,
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
