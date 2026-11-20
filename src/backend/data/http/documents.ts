import { NextRequest, NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { SignJWT } from "jose";
import { authenticateRequest } from "@/lib/auth";
import { createMinioObjectStore } from "../../storage/minio";
import { getDataRepositories } from "../repositories";
import { toDocumentListRow } from "../presenter";

/**
 * PostgreSQL branches for the /api/v1/documents routes and the signed download
 * endpoint. Response shapes and status codes mirror the legacy handlers.
 */

const JWT_SECRET = process.env.JWT_SECRET || "default-secret-change-me";
const encoder = new TextEncoder();

export function invalidateDocumentCaches(userId: string): void {
  revalidatePath("/documents", "page");
  revalidatePath("/dashboard", "page");
  revalidateTag("documents", "max");
  revalidateTag(`user-documents-${userId}`, "max");
  revalidateTag("dashboard", "max");
  revalidateTag(`user-dashboard-${userId}`, "max");
}

export async function listDocumentsPostgres(request: NextRequest): Promise<NextResponse> {
  const user = await authenticateRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const page = Number.parseInt(searchParams.get("page") || "1") || 1;
  const limit = Number.parseInt(searchParams.get("limit") || "10") || 10;

  const { total, rows } = await getDataRepositories().documents.list(user.id, {
    page,
    limit,
  });

  return NextResponse.json({
    success: true,
    documents: rows.map((row) => toDocumentListRow(row)),
    total,
    page,
    limit,
  });
}

export async function getDocumentPostgres(
  request: NextRequest,
  id: string,
): Promise<NextResponse> {
  const user = await authenticateRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const repos = getDataRepositories();
  const document = await repos.documents.get(user.id, id);
  if (!document) {
    return ownershipResponseForDocument(await repos.documents.exists(id));
  }

  const secret = encoder.encode(JWT_SECRET);
  const signature = await new SignJWT({
    userId: user.id,
    download_id: document.$id,
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
      signature: signature,
    },
    download_url: document.status === "completed" ? downloadUrl : null,
  });
}

function ownershipResponseForDocument(exists: boolean): NextResponse {
  if (exists) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }
  return NextResponse.json({ error: "Document not found" }, { status: 404 });
}

export async function deleteDocumentPostgres(
  request: NextRequest,
  id: string,
): Promise<NextResponse> {
  const user = await authenticateRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const repos = getDataRepositories();
  const document = await repos.documents.get(user.id, id);
  if (!document) {
    return ownershipResponseForDocument(await repos.documents.exists(id));
  }

  if (document.pdf_file) {
    try {
      await createMinioObjectStore().delete(document.pdf_file);
    } catch (storageError) {
      console.error("Failed to delete storage file:", storageError);
    }
  }

  await repos.documents.trash(user.id, id);

  invalidateDocumentCaches(user.id);

  return NextResponse.json({
    success: true,
    message: "Document trashed and file removed",
  });
}

/**
 * Signed download handler. Access is granted either to the owner or to a valid
 * signature; the row is fetched through the system-principal read and access is
 * enforced immediately after, mirroring the legacy behavior.
 */
export async function downloadDocumentPostgres(
  request: NextRequest,
  id: string,
): Promise<NextResponse> {
  const signature = request.nextUrl.searchParams.get("signature");
  const auth = await authenticateRequest(request);

  if (!auth && !signature) {
    return NextResponse.json(
      { error: "Unauthorized: signature is required" },
      { status: 401 },
    );
  }

  const document = await getDataRepositories().documents.getById(id);
  if (!document) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  const isValidSignature = signature && document.signature === signature;
  const isOwner = auth && document.user_id === auth.id;

  if (!isValidSignature && !isOwner) {
    return NextResponse.json(
      { error: "Access denied or invalid signature" },
      { status: 403 },
    );
  }

  if (!document.pdf_file) {
    return NextResponse.json({ error: "PDF file not generated yet" }, { status: 400 });
  }

  await getDataRepositories().documents.incrementDownloadsById(id);

  invalidateDocumentCaches(document.user_id);

  const presignedUrl = await createMinioObjectStore().presignDownload({
    key: document.pdf_file,
  });

  return NextResponse.redirect(presignedUrl, 302);
}
