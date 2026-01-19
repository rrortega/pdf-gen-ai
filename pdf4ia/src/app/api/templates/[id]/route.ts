import { NextRequest, NextResponse } from "next/server";
import {
  DATABASE_ID,
  COLLECTIONS,
} from "@/lib/appwrite";
import { getAuthenticatedDatabases } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const auth = await getAuthenticatedDatabases(request);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { tables, user } = auth;

    const template = await tables.getRow({
      databaseId: DATABASE_ID,
      tableId: COLLECTIONS.TEMPLATES,
      rowId: id
    });

    // Check if template belongs to current user
    if (template.user_id !== user.id) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Decode test_data from base64
    if (template.test_data) {
      try {
        const decoded = Buffer.from(template.test_data, 'base64').toString('utf8');
        template.test_data = JSON.parse(decoded);
      } catch (e) {
        console.warn("Could not decode test_data for template:", id, e);
      }
    }

    return NextResponse.json({
      success: true,
      template,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Failed to get template";
    console.error("Get template error:", error);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 },
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const auth = await getAuthenticatedDatabases(request);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { tables, user } = auth;

    const {
      title,
      tags,
      html,
      css,
      test_data,
      orientation,
      paper_size,
      margin_top,
      margin_right,
      margin_bottom,
      margin_left } = await request.json();

    if (!title || !html) {
      return NextResponse.json(
        { error: "Title and html are required" },
        { status: 400 },
      );
    }

    // First get the template to check ownership
    const template = await tables.getRow({
      databaseId: DATABASE_ID,
      tableId: COLLECTIONS.TEMPLATES,
      rowId: id,
    });

    if (template.user_id !== user.id) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Encode test_data to base64
    const encodedTestData = Buffer.from(JSON.stringify(test_data || {})).toString('base64');

    const updatedTemplate = await tables.updateRow({
      databaseId: DATABASE_ID,
      tableId: COLLECTIONS.TEMPLATES,
      rowId: id,
      data: {
        title,
        html,
        css: css || "",
        test_data: encodedTestData,
        orientation,
        tags,
        paper_size,
        margin_top,
        margin_right,
        margin_bottom,
        margin_left
      },
    });

    // Decode for response
    const responseTemplate = { ...updatedTemplate };
    try {
      const decoded = Buffer.from(updatedTemplate.test_data, 'base64').toString('utf8');
      responseTemplate.test_data = JSON.parse(decoded);
    } catch (e) {
      console.warn("Could not decode test_data for response:", e);
    }

    return NextResponse.json({
      success: true,
      template: responseTemplate,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Failed to update template";
    console.error("Update template error:", error);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const auth = await getAuthenticatedDatabases(request);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { tables, user } = auth;

    const template = await tables.getRow({
      databaseId: DATABASE_ID,
      tableId: COLLECTIONS.TEMPLATES,
      rowId: id
    });

    // Check if template belongs to current user
    if (template.user_id !== user.id) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    await tables.deleteRow({
      databaseId: DATABASE_ID,
      tableId: COLLECTIONS.TEMPLATES,
      rowId: id
    });

    return NextResponse.json({
      success: true,
      message: "Template deleted successfully",
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Failed to delete template";
    console.error("Delete template error:", error);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 },
    );
  }
}
