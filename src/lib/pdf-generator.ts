import chromium from "@sparticuz/chromium";
import puppeteer, { Browser, PaperFormat } from "puppeteer-core";
import Handlebars from "handlebars";
import { getServerAppwriteStorage, BUCKETS, ID } from "./appwrite";
import { InputFile } from "node-appwrite/file";
import { registerHbsHelpers, registerHbsPartials } from "./hbs";
import fs from "fs";

export class PDFGenerator {
  private static browser: Browser | null = null;

  private static async getBrowser(): Promise<Browser> {
    if (this.browser && !this.browser.isConnected()) {
      console.warn("[PDFGenerator] Browser disconnected, closing old instance...");
      try { await this.browser.close(); } catch { /* ignore */ }
      this.browser = null;
    }

    if (!this.browser) {
      const isProd = process.env.NODE_ENV === "production";
      let executablePath: string | null = null;

      // 1. Priority: Environment Variable
      if (process.env.PUPPETEER_EXECUTABLE_PATH) {
        console.log(`[PDFGenerator] Using browser from environment variable: ${process.env.PUPPETEER_EXECUTABLE_PATH}`);
        executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
      }
      // 2. Production: Use @sparticuz/chromium
      else if (isProd) {
        console.log("[PDFGenerator] launching browser with @sparticuz/chromium (production)");
        executablePath = await chromium.executablePath();
      }
      // 3. Development: Search for local installations
      else {
        console.log("[PDFGenerator] launching browser in development mode");
        const localPaths = [
          "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
          "/Applications/Chromium.app/Contents/MacOS/Chromium",
          "/usr/bin/google-chrome",
          "/usr/bin/google-chrome-stable",
          "/usr/bin/chromium",
          "/usr/bin/chromium-browser"
        ];

        for (const path of localPaths) {
          if (fs.existsSync(path)) {
            executablePath = path;
            break;
          }
        }
      }

      if (!executablePath && !isProd) {
        console.warn("[PDFGenerator] No Chrome/Chromium executable found in common local paths. Puppeteer may fail.");
      }

      this.browser = (await puppeteer.launch({
        args: isProd ? [
          ...chromium.args,
          "--disable-gpu",
          "--disable-dev-shm-usage",
          "--disable-setuid-sandbox",
          "--no-sandbox",
        ] : [
          "--no-sandbox",
          "--disable-setuid-sandbox"
        ],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        defaultViewport: isProd ? (chromium as any).defaultViewport : { width: 1280, height: 720 },
        executablePath: executablePath || undefined,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        headless: isProd ? (chromium as any).headless : true,
      })) as unknown as Browser;

      console.log("[PDFGenerator] New browser instance launched.");
    } else {
      // console.log("[PDFGenerator] Reusing existing browser instance.");
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

      registerHbsHelpers();
      registerHbsPartials();

      const template = Handlebars.compile(templateHtml);
      const html = template(data);

      const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${css}</style></head><body>${html}</body></html>`;

      await page.emulateMediaType("print");
      await page.setRequestInterception(true);

      // SECURITY: Enable Request Interception to block SSRF (Private IPs, etc.)
      page.on('request', request => {
        const url = request.url();

        // Allow data URIs (images fonts etc embedded)
        if (url.startsWith('data:')) {
          request.continue();
          return;
        }

        // Block file:// protocol (local file access)
        if (url.startsWith('file:')) {
          request.abort('accessdenied');
          return;
        }

        // Allow main document content (it's set via setContent, so url is usually about:blank or data:)
        if (url === 'about:blank') {
          request.continue();
          return;
        }

        try {
          const parsed = new URL(url);
          const hostname = parsed.hostname;

          // Block Localhost / Private IPs
          if (
            hostname === 'localhost' ||
            hostname === '::1' ||
            hostname === '0.0.0.0' ||
            hostname.startsWith('127.') ||
            hostname.startsWith('10.') ||
            hostname.startsWith('192.168.') ||
            hostname.startsWith('169.254.')
          ) {
            console.warn(`[PDFGenerator] Blocked SSRF attempt to: ${url}`);
            request.abort('accessdenied');
            return;
          }

          // Optional: Block 172.16.x.x - 172.31.x.x (Class B Private)
          if (hostname.startsWith('172.')) {
            const parts = hostname.split('.');
            if (parts.length === 4) {
              const second = parseInt(parts[1], 10);
              if (second >= 16 && second <= 31) {
                console.warn(`[PDFGenerator] Blocked SSRF attempt to: ${url}`);
                request.abort('accessdenied');
                return;
              }
            }
          }

          request.continue();
        } catch {
          // Invalid URL, abort
          request.abort();
        }
      });

      await page.setContent(fullHtml, {
        waitUntil: ["load", "domcontentloaded", "networkidle2"],
        timeout: 45000
      });

      try {
        await page.evaluateHandle("document.fonts.ready");
      } catch {
        console.warn("[PDFGenerator] Timeout waiting for fonts, proceeding anyway.");
      }

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

      const errorMessage = error instanceof Error ? error.message : String(error);
      const shouldRetry = (
        errorMessage.includes("Connection closed") ||
        errorMessage.includes("Navigating frame was detached") ||
        errorMessage.includes("Target closed")
      ) && retryCount < 2;

      if (shouldRetry) {
        console.warn(`Puppeteer error: ${errorMessage}. Retrying PDF generation (${retryCount + 1})...`);

        // Force close the browser instance to free up resources/memory immediately
        if (this.browser) {
          try { await this.browser.close(); } catch { /* ignore */ }
          this.browser = null;
        }

        // Wait a bit before retrying to let the system stabilize
        await new Promise(r => setTimeout(r, 500));

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

    const file = await storage.createFile({
      bucketId: BUCKETS.PDFS,
      fileId: ID.unique(),
      file: InputFile.fromBuffer(pdfBuffer, fileName),
      permissions: [],
    });

    const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || "https://cloud.appwrite.io/v1";
    const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!;
    const fileUrl = `${endpoint}/storage/buckets/${BUCKETS.PDFS}/files/${file.$id}/view?project=${projectId}`;

    return {
      fileId: file.$id,
      fileUrl: fileUrl,
      size: Math.round(pdfBuffer.length / 1024),
    };
  }

  static async cleanup(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}
