import { NextRequest, NextResponse } from "next/server";
import { SignJWT } from "jose";
import { authenticateRequest } from "@/lib/auth";
import { validateWebhookUrl } from "@/lib/security";
import { PDFGenerator } from "@/lib/pdf-generator";
import { createMinioObjectStore } from "../../storage/minio";
import { createDataJobQueue } from "../../queue/bullmq";
import { getDataRepositories } from "../repositories";
import { invalidateDocumentCaches } from "./documents";

/**
 * PostgreSQL branch for POST /api/v1/generate. The three legacy flows (queue
 * mode, webhook mode, sync mode) return identical status codes and payloads;
 * generation runs through PDFGenerator and the BullMQ worker, storage goes to
 * MinIO through the shared ObjectStore contract.
 */

const JWT_SECRET = process.env.JWT_SECRET || "default-secret-change-me";
const encoder = new TextEncoder();

async function signDownloadToken(userId: string, downloadId: string): Promise<string> {
  const secret = encoder.encode(JWT_SECRET);
  return new SignJWT({ userId, download_id: downloadId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .sign(secret);
}

function templateRenderOptions(template: {
  orientation?: string;
  paper_size?: string;
  margin_top?: string;
  margin_right?: string;
  margin_bottom?: string;
  margin_left?: string;
}) {
  return {
    orientation: template.orientation === "landscape" ? ("landscape" as const) : ("portrait" as const),
    paperSize: template.paper_size || "A4",
    margins: {
      top: template.margin_top || "10mm",
      right: template.margin_right || "10mm",
      bottom: template.margin_bottom || "10mm",
      left: template.margin_left || "10mm",
    },
  };
}

export async function generatePostgres(request: NextRequest): Promise<NextResponse> {
  try {
    const user = await authenticateRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const repos = getDataRepositories();
    const { template_id, name, data: inputData, webhook_callback } = await request.json();

    if (webhook_callback && !validateWebhookUrl(webhook_callback)) {
      return NextResponse.json({ error: "Invalid webhook_callback URL" }, { status: 400 });
    }

    if (!template_id || !name) {
      return NextResponse.json(
        { error: "template_id and name are required" },
        { status: 400 },
      );
    }

    const template = await repos.templates.get(user.id, template_id);
    if (!template) {
      if (await repos.templates.exists(template_id)) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    const encodedData = Buffer.from(JSON.stringify(inputData || {})).toString("base64");
    const generationMode = process.env.PDF_GENERATION_MODE || "sync";

    const createQueuedDocument = () =>
      repos.documents.create(user.id, {
        template_id,
        name,
        pdf_file: "",
        data: encodedData,
        status: "queued",
        size: 0,
        downloads: 0,
        webhook_callback: webhook_callback || null,
        webhook_response: null,
        webhook_retry: 0,
      });

    if (generationMode === "queue") {
      const document = await createQueuedDocument();

      await createDataJobQueue().enqueueGeneration({ documentId: document.$id });

      invalidateDocumentCaches(user.id);

      if (webhook_callback) {
        return NextResponse.json({
          success: true,
          status: "queued",
          download_id: document.$id,
          message: "Document generation enqueued. You will be notified via webhook.",
        });
      }

      // Sync wait: poll the document until the worker completes or the
      // configured timeout elapses, mirroring the legacy queue-wait loop.
      console.log(`[Queue-Wait] Polling status for document ${document.$id}...`);
      const startTime = Date.now();
      const timeoutSeconds = Number.parseInt(process.env.PDF_GENERATION_TIMEOUT || "30", 10);
      const timeoutMs = timeoutSeconds * 1000;

      while (Date.now() - startTime < timeoutMs) {
        await new Promise((resolve) => setTimeout(resolve, 2000));

        const doc = await repos.documents.get(user.id, document.$id);
        if (!doc) continue;

        if (doc.status === "completed") {
          return NextResponse.json({
            success: true,
            document: {
              id: doc.$id,
              name: doc.name,
              template_id: doc.template_id,
              size: doc.size,
              status: doc.status,
              signature: doc.signature,
            },
            download_url: `${process.env.NEXT_PUBLIC_DOMAIN || process.env.NEXT_PUBLIC_APP_URL}/api/v1/documents/${doc.$id}/download?signature=${doc.signature}`,
          });
        }

        if (doc.status === "failed") {
          return NextResponse.json(
            { error: doc.error_message || "Document generation failed in queue" },
            { status: 500 },
          );
        }
      }

      console.error(`[Queue-Wait] Timeout waiting for document ${document.$id}`);
      try {
        await repos.documents.update(user.id, document.$id, {
          status: "failed",
          error_message: "Document generation timed out in queue",
        });
      } catch (dbErr) {
        console.error(dbErr);
      }

      return NextResponse.json(
        { error: "Document generation timed out", download_id: document.$id, status: "failed" },
        { status: 504 },
      );
    }

    if (webhook_callback) {
      // Webhook flow: queue the work and respond immediately. The worker
      // delivers the callback with bounded retries and backoff.
      const document = await createQueuedDocument();

      await createDataJobQueue().enqueueGeneration({ documentId: document.$id });

      invalidateDocumentCaches(user.id);

      return NextResponse.json({
        success: true,
        status: "queued",
        download_id: document.$id,
        message: "Document generation enqueued. You will be notified via webhook.",
      });
    }

    // SYNC flow (classic): render inline, upload to MinIO, create the
    // completed document and answer with the signed download URL.
    try {
      const pdfBuffer = await PDFGenerator.generatePDF(
        template.html || "",
        template.css || "",
        inputData || {},
        templateRenderOptions(template),
      );

      const storage = createMinioObjectStore();
      const document = await repos.documents.create(user.id, {
        template_id,
        name,
        status: "pending",
        data: encodedData,
        downloads: 0,
      });
      const { key } = await storage.putPdf({
        key: `${document.$id}.pdf`,
        body: new Uint8Array(pdfBuffer),
        contentType: "application/pdf",
      });

      const signature = await signDownloadToken(user.id, document.$id);
      const size = Math.round(pdfBuffer.length / 1024);

      await repos.documents.update(user.id, document.$id, {
        pdf_file: key,
        status: "completed",
        size,
        signature,
      });

      invalidateDocumentCaches(user.id);

      return NextResponse.json({
        success: true,
        document: {
          id: document.$id,
          name,
          template_id,
          size,
          status: "completed",
          signature,
        },
        download_url: `${process.env.NEXT_PUBLIC_DOMAIN || process.env.NEXT_PUBLIC_APP_URL}/api/v1/documents/${document.$id}/download?signature=${signature}`,
      });
    } catch (pdfError: unknown) {
      const errorMessage = pdfError instanceof Error ? pdfError.message : "Failed to generate PDF";
      return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
