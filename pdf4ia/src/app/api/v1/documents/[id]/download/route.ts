import { NextRequest, NextResponse } from "next/server";
import { DATABASE_ID, COLLECTIONS, getServerAppwriteTables } from "@/lib/appwrite";
import { getAuthenticatedDatabases } from "@/lib/auth";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const { id } = await params;
        const signature = await request.nextUrl.searchParams.get('signature');
        const auth = await getAuthenticatedDatabases(request);

        const tables = await getServerAppwriteTables();

        if (!auth && !signature) {
            return NextResponse.json({ error: "Unauthorized: signature is required" }, { status: 401 });
        }

        // Get document to find the file ID
        let document;
        try {
            document = await tables.getRow({
                databaseId: DATABASE_ID,
                tableId: COLLECTIONS.DOCUMENTS,
                rowId: id,
            });
        } catch {
            return NextResponse.json({ error: "Document not found" }, { status: 404 });
        }

        if (!document) {
            return NextResponse.json({ error: "Document not found" }, { status: 404 });
        }

        // Check access: either valid signature OR authenticated owner
        const isValidSignature = signature && document.signature === signature;
        const isOwner = auth && document.user_id === auth.user.id;

        if (!isValidSignature && !isOwner) {
            return NextResponse.json({ error: "Access denied or invalid signature" }, { status: 403 });
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
            },
        });

        // Construct S3 URL
        const s3Endpoint = process.env.NEXT_PUBLIC_S3_ENDPOINT;
        if (!s3Endpoint) {
            return NextResponse.json({ error: "S3 endpoint not configured" }, { status: 500 });
        }

        const s3Url = `${s3Endpoint}/${document.pdf_file}.pdf`;

        // Redirect to S3 URL
        return NextResponse.redirect(s3Url, 302);
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Failed to download document";
        console.error("Download error:", error);
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}
