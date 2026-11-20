import { NextRequest, NextResponse, connection } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import {
  DATABASE_ID,
  COLLECTIONS,
} from "@/lib/appwrite";
import { getAuthenticatedDatabases } from "@/lib/auth";
import { isPostgresBackend } from "@/backend/config";
import {
  getTemplatePostgres,
  updateTemplatePostgres,
  deleteTemplatePostgres,
} from "@/backend/data/http/templates";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (isPostgresBackend()) {
    return getTemplatePostgres(request, id);
  }

  await connection();
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
    let decodedTestData = template.test_data || "{}";
    if (template.test_data) {
      try {
        decodedTestData = JSON.parse(Buffer.from(template.test_data, 'base64').toString('utf8'));
      } catch (e) {
        console.warn("Could not decode test_data for template:", id, e);
      }
    }

    // Transform to frontend structure
    const transformedTemplate = {
      $id: template.$id,
      $createdAt: template.$createdAt,
      $updatedAt: template.$updatedAt,
      title: template.title || "",
      tags: template.tags || [],
      css: template.css || "",
      html: template.html || "",
      test_data: decodedTestData,
      orientation: template.orientation || "portrait",
      paperSize: template.paper_size || "A4",
      margins: {
        top: template.margin_top || "10mm",
        right: template.margin_right || "10mm",
        bottom: template.margin_bottom || "10mm",
        left: template.margin_left || "10mm",
      },
    };

    return NextResponse.json({
      success: true,
      template: transformedTemplate,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Failed to get template";
    console.error("Get template error:", error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (isPostgresBackend()) {
    return updateTemplatePostgres(request, id);
  }

  try {
    const { id } = await params;
    const auth = await getAuthenticatedDatabases(request);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { tables, user } = auth;

    // Get existing template to verify ownership
    const existingTemplate = await tables.getRow({
      databaseId: DATABASE_ID,
      tableId: COLLECTIONS.TEMPLATES,
      rowId: id
    });

    if (existingTemplate.user_id !== user.id) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const { title, tags, css, html, test_data, orientation, paperSize, margin_left, margin_top, margin_right, margin_bottom } = await request.json();

    if (!title) {
      return NextResponse.json(
        { error: "Title is required" },
        { status: 400 },
      );
    }

    // Provide defaults if not provided
    const finalHtml = html || existingTemplate.html || "";
    const finalCss = css || existingTemplate.css || "";

    // Handle test_data - could be object or string or null
    let encodedSampleData = existingTemplate.test_data || "";
    if (test_data !== undefined) {
      const testDataObject = typeof test_data === 'string' ? JSON.parse(test_data) : test_data;
      encodedSampleData = Buffer.from(JSON.stringify(testDataObject || {})).toString('base64');
    }

    // Update with dedicated fields
    const updateData = {
      title: title,
      tags: tags || [],
      css: finalCss,
      html: finalHtml,
      test_data: encodedSampleData,
      orientation: orientation || "portrait",
      paper_size: paperSize || "A4",
      margin_top: margin_top || "10mm",
      margin_right: margin_right || "10mm",
      margin_bottom: margin_bottom || "10mm",
      margin_left: margin_left || "10mm",
    };

    const updatedTemplate = await tables.updateRow({
      databaseId: DATABASE_ID,
      tableId: COLLECTIONS.TEMPLATES,
      rowId: id,
      data: updateData
    });

    // Invalidate template list and dashboard caches
    revalidatePath("/templates", "page");
    revalidatePath("/dashboard", "page");
    revalidateTag("templates", "max");
    revalidateTag(`user-templates-${user.id}`, "max");
    revalidateTag("dashboard", "max");
    revalidateTag(`user-dashboard-${user.id}`, "max");

    // Decode for response
    let responseTestData = updatedTemplate.test_data;
    if (updatedTemplate.test_data) {
      try {
        responseTestData = JSON.parse(Buffer.from(updatedTemplate.test_data, 'base64').toString('utf8'));
      } catch (e) {
        console.warn("Could not decode test_data for response:", e);
      }
    }

    return NextResponse.json({
      success: true,
      template: {
        $id: updatedTemplate.$id,
        $createdAt: updatedTemplate.$createdAt,
        $updatedAt: updatedTemplate.$updatedAt,
        title: updatedTemplate.title,
        tags: updatedTemplate.tags || [],
        css: updatedTemplate.css,
        html: updatedTemplate.html,
        test_data: responseTestData,
        orientation: updatedTemplate.orientation,
        paperSize: updatedTemplate.paper_size,
        margins: {
          top: updatedTemplate.margin_top,
          right: updatedTemplate.margin_right,
          bottom: updatedTemplate.margin_bottom,
          left: updatedTemplate.margin_left,
        },
      },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Failed to update template";
    console.error("Update template error:", error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (isPostgresBackend()) {
    return deleteTemplatePostgres(request, id);
  }

  try {
    const { id } = await params;
    const auth = await getAuthenticatedDatabases(request);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { tables, user } = auth;

    // Get template to verify ownership
    const template = await tables.getRow({
      databaseId: DATABASE_ID,
      tableId: COLLECTIONS.TEMPLATES,
      rowId: id
    });

    if (template.user_id !== user.id) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    await tables.deleteRow({
      databaseId: DATABASE_ID,
      tableId: COLLECTIONS.TEMPLATES,
      rowId: id
    });

    // Invalidate template list and dashboard caches
    revalidatePath("/templates", "page");
    revalidatePath("/dashboard", "page");
    revalidateTag("templates", "max");
    revalidateTag(`user-templates-${user.id}`, "max");
    revalidateTag("dashboard", "max");
    revalidateTag(`user-dashboard-${user.id}`, "max");

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Failed to delete template";
    console.error("Delete template error:", error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
