import { NextRequest, NextResponse } from "next/server";
import {
  DATABASE_ID,
  COLLECTIONS,
  BUCKETS,
  getServerAppwriteStorage,
} from "@/lib/appwrite";
import { getAuthenticatedDatabases } from "@/lib/auth";

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

    // Get document to find the storage file ID
    const document = await tables.getRow({
      databaseId: DATABASE_ID,
      tableId: COLLECTIONS.DOCUMENTS,
      rowId: id
    });

    // Check ownership
    if (document.user_id !== user.id) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Delete file from storage if it exists
    if (document.pdf_file) {
      try {
        const storage = getServerAppwriteStorage();
        await storage.deleteFile({
          bucketId: BUCKETS.PDFS,
          fileId: document.pdf_file,
        });
        console.log(`Deleted storage file: ${document.pdf_file}`);
      } catch (storageError) {
        console.error("Failed to delete storage file:", storageError);
        // Continue even if storage deletion fails (file might already be gone)
      }
    }

    // Delete database record
    await tables.deleteRow({
      databaseId: DATABASE_ID,
      tableId: COLLECTIONS.DOCUMENTS,
      rowId: id
    });

    return NextResponse.json({ success: true, message: "Document and associated file deleted" });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Failed to delete document";
    console.error("Delete document error:", error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
