import puppeteer, { Browser, PaperFormat } from "puppeteer";
import Handlebars from "handlebars";
import { getServerAppwriteStorage, BUCKETS, ID } from "./appwrite";
import { InputFile } from "node-appwrite/file";
import { registerHbsHelpers, registerHbsPartials } from "./hbs";

export class PDFGenerator {
  private static browser: Browser | null = null;

  private static async getBrowser(): Promise<Browser> {
    if (!this.browser || !this.browser.connected) {
      if (this.browser) {
        try { await this.browser.close(); } catch { /* ignore */ }
        this.browser = null;
      }
      this.browser = await puppeteer.launch({
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-accelerated-2d-canvas",
          "--no-first-run",
          "--no-zygote",
          "--single-process",
          "--disable-gpu",
        ],
      });
    }
    return this.browser;
  }

  static async generatePDF(
    templateHtml: string,
    css: string,
    data: Record<string, unknown>,
    options?: {
      orientation?: "portrait" | "landscape";
      paperSize?: string;
      margins?: {
        top: string;
        right: string;
        bottom: string;
        left: string;
      };
    },
    retryCount = 0
  ): Promise<Buffer> {
    let page;
    try {
      const browser = await this.getBrowser();
      page = await browser.newPage();

      // Ensure helpers and partials are registered
      registerHbsHelpers();
      registerHbsPartials();

      // Compile template with Handlebars
      const template = Handlebars.compile(templateHtml);
      const html = template(data);

      // Create full HTML with CSS (compact to avoid whitespace issues)
      const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${css}</style></head><body>${html}</body></html>`;

      await page.setContent(fullHtml, { waitUntil: "networkidle0" });

      const pdfBuffer = await page.pdf({
        format: (options?.paperSize || "A4") as PaperFormat,
        landscape: options?.orientation === "landscape",
        printBackground: true,
        margin: options?.margins || {
          top: "10mm",
          right: "10mm",
          bottom: "10mm",
          left: "10mm",
        },
      });

      await page.close();

      return Buffer.from(pdfBuffer);
    } catch (error) {
      if (page) {
        try { await page.close(); } catch { /* ignore */ }
      }

      // If connection closed and we haven't retried yet, try one more time
      if ((error instanceof Error && error.message.includes("Connection closed")) && retryCount < 1) {
        console.warn("Puppeteer connection closed, retrying PDF generation...");
        this.browser = null; // Force relaunch
        return this.generatePDF(templateHtml, css, data, options, retryCount + 1);
      }

      console.error("PDF generation error:", error);
      throw new Error(`Failed to generate PDF: ${error}`);
    }
  }

  static async generateAndUploadPDF(
    templateHtml: string,
    css: string,
    data: Record<string, unknown>,
    fileName: string,
    options?: {
      orientation?: "portrait" | "landscape";
      paperSize?: string;
      margins?: {
        top: string;
        right: string;
        bottom: string;
        left: string;
      };
    },
  ): Promise<{ fileId: string; fileUrl: string; size: number }> {
    const pdfBuffer = await this.generatePDF(templateHtml, css, data, options);

    const storage = getServerAppwriteStorage();

    // Upload PDF to storage
    const file = await storage.createFile({
      bucketId: BUCKETS.PDFS,
      fileId: ID.unique(),
      file: InputFile.fromBuffer(pdfBuffer, fileName),
      permissions: [],
    });

    // Get file view URL
    const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || "https://cloud.appwrite.io/v1";
    const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!;
    const fileUrl = `${endpoint}/storage/buckets/${BUCKETS.PDFS}/files/${file.$id}/view?project=${projectId}`;

    return {
      fileId: file.$id,
      fileUrl: fileUrl.toString(),
      size: Math.round(pdfBuffer.length / 1024), // Size in KB
    };
  }

  static async cleanup(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}
