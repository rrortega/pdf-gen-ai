import { getServerAppwriteTables, DATABASE_ID, COLLECTIONS } from "@/lib/appwrite";
import Handlebars from "handlebars";
import { notFound } from "next/navigation";
import { registerHbsHelpers } from "@/lib/hbs";

interface PageProps {
    params: Promise<{
        id: string;
    }>;
}

export default async function PreviewHtmlPage({ params }: PageProps) {
    const resolvedParams = await params;
    const id = resolvedParams?.id;

    if (!id) {
        notFound();
    }

    const tables = getServerAppwriteTables();

    // Fetch template
    const template = await tables.getRow({
        databaseId: DATABASE_ID,
        tableId: COLLECTIONS.TEMPLATES,
        rowId: id,
    }).catch((err) => {
        console.error("Error fetching template row for preview:", err);
        return null;
    });

    if (!template) {
        notFound();
    }

    // Get HTML, CSS, and test data
    const html = template.html || "";
    const css = template.css || "";

    // Decode test_data from base64
    let testData: Record<string, unknown> = {};
    if (template.test_data) {
        try {
            const decoded = Buffer.from(template.test_data, 'base64').toString('utf8');
            testData = JSON.parse(decoded);
        } catch (e) {
            console.warn("Could not decode test_data:", e);
            testData = {};
        }
    }

    // Initialize helpers (same as PDFGenerator)
    registerHbsHelpers();

    // Compile Handlebars template
    let compiledHtml = html;
    try {
        const handlebarsTemplate = Handlebars.compile(html);
        compiledHtml = handlebarsTemplate(testData);
    } catch (e) {
        console.error("Error compiling Handlebars template:", e);
        // If compilation fails, use raw HTML
    }

    // Exact same structure as PDFGenerator.generatePDF
    const fullHtml = `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${template.title || "Template Preview"}</title>
    <style>
        ${css}
    </style>
</head>
<body>
    ${compiledHtml}
</body>
</html>
    `.trim();

    return new Response(fullHtml, {
        headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "no-cache, no-store, must-revalidate",
        },
    });
}
