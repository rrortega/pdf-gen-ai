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

      const executablePath = await this.findChromium();
      console.log(`[PDFGenerator] launching browser with executablePath: ${executablePath || "default"}`);

      this.browser = await puppeteer.launch({
        headless: true,
        executablePath: executablePath || undefined,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-accelerated-2d-canvas",
          "--no-first-run",
          "--no-zygote",
          "--single-process", // <- Essential for Appwrite / Containers
          "--disable-gpu",
          "--font-render-hinting=none",
          "--disable-extensions",
          "--disable-web-security",
        ],
      });
    }
    return this.browser;
  }

  /**
   * Tries several common locations to find the chrome executable in production
   */
  private static async findChromium(): Promise<string | null> {
    const { existsSync, lstatSync, readdirSync } = await import("fs");
    const { join } = await import("path");

    const envPath = process.env.PUPPETEER_EXECUTABLE_PATH;
    if (envPath && existsSync(envPath)) return envPath;

    // Search in the local project cache first (where postinstall puts it)
    const localCachePath = join(process.cwd(), ".cache", "puppeteer");
    const searchPaths = [
      localCachePath,
      "/usr/local/build/.cache/puppeteer", // Path seen in the logs
      join(process.cwd(), "node_modules", "puppeteer", ".local-chromium"),
      "/usr/bin/google-chrome",
      "/usr/bin/google-chrome-stable",
      "/usr/bin/chromium",
      "/usr/bin/chromium-browser",
    ];

    console.log(`[PDFGenerator] Searching for Chromium in ${searchPaths.length} locations. cwd: ${process.cwd()}`);

    for (const basePath of searchPaths) {
      if (!existsSync(basePath)) continue;

      try {
        if (lstatSync(basePath).isFile()) return basePath;

        // Recursively find the actual binary inside directories (Puppeteer cache structure)
        const findBinary = (dir: string): string | null => {
          try {
            const files = readdirSync(dir);
            for (const file of files) {
              const fullPath = join(dir, file);
              const stat = lstatSync(fullPath);
              if (file === "chrome" || file === "chromium") {
                if (stat.isFile()) return fullPath;
              }
              if (stat.isDirectory()) {
                const found = findBinary(fullPath);
                if (found) return found;
              }
            }
          } catch { /* ignore */ }
          return null;
        };

        const found = findBinary(basePath);
        if (found) {
          console.log(`[PDFGenerator] Found binary at: ${found}`);
          return found;
        }
      } catch (e) {
        console.warn(`[PDFGenerator] Error searching in ${basePath}:`, e);
      }
    }

    return null;
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

      // Emulate print media to apply @media print styles
      await page.emulateMediaType("print");

      // Use networkidle2 to allow external assets (JS/Fonts/CSS) to load
      await page.setContent(fullHtml, {
        waitUntil: ["load", "domcontentloaded", "networkidle2"],
        timeout: 45000
      });

      // Wait for fonts to be specifically ready
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

      // If connection closed or frame detached, and we haven't retried yet, try one more time
      const errorMessage = error instanceof Error ? error.message : String(error);
      const shouldRetry = (
        errorMessage.includes("Connection closed") ||
        errorMessage.includes("Navigating frame was detached") ||
        errorMessage.includes("Target closed")
      ) && retryCount < 2;

      if (shouldRetry) {
        console.warn(`Puppeteer error: ${errorMessage}. Retrying PDF generation (${retryCount + 1})...`);
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
