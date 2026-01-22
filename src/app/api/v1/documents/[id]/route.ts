import { NextRequest, NextResponse, connection } from "next/server";
import { revalidatePath } from "next/cache";
import {
  DATABASE_ID,
  COLLECTIONS,
} from "@/lib/appwrite";
import { getAuthenticatedDatabases } from "@/lib/auth";
import { SignJWT } from "jose";

const JWT_SECRET = process.env.JWT_SECRET || "default-secret-change-me";
const encoder = new TextEncoder();

/**
 * Get document info
 * GET /api/v1/documents/[id]
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await connection();
  try {
    const { id } = await params;
    const auth = await getAuthenticatedDatabases(request);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { tables, user } = auth;

    // Get document
    const document = await tables.getRow({
      databaseId: DATABASE_ID,
      tableId: COLLECTIONS.DOCUMENTS,
      rowId: id
    });

    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    // Check ownership
    if (document.user_id !== user.id) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Generate JWT signature if not already present or for security freshness
    const secret = encoder.encode(JWT_SECRET);
    const signature = await new SignJWT({
      userId: user.id,
      download_id: document.$id
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .sign(secret);

    const downloadUrl = `${process.env.NEXT_PUBLIC_DOMAIN || process.env.NEXT_PUBLIC_APP_URL}/api/v1/documents/${document.$id}/download?signature=${signature}`;

    return NextResponse.json({
      success: true,
      document: {
        id: document.$id,
        name: document.name,
        template_id: document.template_id,
        status: document.status,
        size: document.size || 0,
        downloads: document.downloads || 0,
        created_at: document.$createdAt,
        error_message: document.error_message,
        signature: signature
      },
      download_url: document.status === "completed" ? downloadUrl : null
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Failed to fetch document";
    console.error("Get document error:", error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

/**
 * Delete document
 * DELETE /api/v1/documents/[id]
 */
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
    const { BUCKETS, getServerAppwriteStorage } = await import("@/lib/appwrite");

    const document = await tables.getRow({
      databaseId: DATABASE_ID,
      tableId: COLLECTIONS.DOCUMENTS,
      rowId: id
    });

    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    if (document.user_id !== user.id) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    if (document.pdf_file) {
      try {
        const storage = getServerAppwriteStorage();
        await storage.deleteFile({
          bucketId: BUCKETS.PDFS,
          fileId: document.pdf_file,
        });
      } catch (storageError) {
        console.error("Failed to delete storage file:", storageError);
      }
    }

    await tables.updateRow({
      databaseId: DATABASE_ID,
      tableId: COLLECTIONS.DOCUMENTS,
      rowId: id,
      data: {
        status: "trashed",
        pdf_file: null
      }
    });

    // Invalidate document list cache and trigger UI refresh
    revalidatePath("/documents", "page");

    return NextResponse.json({ success: true, message: "Document trashed and file removed" });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Failed to delete document";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
