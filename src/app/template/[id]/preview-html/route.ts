import { getServerAppwriteTables, DATABASE_ID, COLLECTIONS } from "@/lib/appwrite";
import { renderHbsHtml, TemplateHtmlError } from "@/lib/hbs";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const resolvedParams = await params;
    const id = resolvedParams?.id;

    if (!id) {
        return new NextResponse("Not Found", { status: 404 });
    }

    const tables = getServerAppwriteTables();

    // Fetch template
    const template = await tables.getRow({
        databaseId: DATABASE_ID,
        tableId: COLLECTIONS.TEMPLATES,
        rowId: id,
    }).catch((err: unknown) => {
        console.error("Error fetching template row for preview:", err);
        return null;
    });

    if (!template) {
        return new NextResponse("Template Not Found", { status: 404 });
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

    let compiledHtml: string;
    try {
        compiledHtml = renderHbsHtml(html, testData);
    } catch (error) {
        console.error("Error compiling Handlebars template:", error);
        if (error instanceof TemplateHtmlError) {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }
        return NextResponse.json({ error: "Failed to render template" }, { status: 500 });
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
