import { NextRequest, NextResponse } from "next/server";
import { DATABASE_ID, COLLECTIONS } from "@/lib/appwrite";
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

        const { tables } = auth;

        // Get document to find the file ID
        const document = await tables.getRow({
            databaseId: DATABASE_ID,
            tableId: COLLECTIONS.DOCUMENTS,
            rowId: id,
        });

        if (!document) {
            return NextResponse.json({ error: "Document not found" }, { status: 404 });
        }

        if (!document.pdf_file) {
            return NextResponse.json({ error: "PDF file not generated yet" }, { status: 400 });
        }

        // Increment download count
        await tables.updateRow({
            databaseId: DATABASE_ID,
            tableId: COLLECTIONS.DOCUMENTS,
            rowId: id,
            data: {
                downloads: (document.downloads || 0) + 1,
            }
        });

        // Construct S3 URL
        const s3Endpoint = process.env.NEXT_PUBLIC_S3_ENDPOINT;
        if (!s3Endpoint) {
            return NextResponse.json({ error: "S3 endpoint not configured" }, { status: 500 });
        }

        const s3Url = `${s3Endpoint}${document.pdf_file}.pdf`;

        // Redirect to S3 URL
        return NextResponse.redirect(s3Url, 302);
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Failed to download document";
        console.error("Download error:", error);
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}
