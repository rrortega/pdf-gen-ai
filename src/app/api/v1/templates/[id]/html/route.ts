import { NextRequest, NextResponse } from "next/server";
import { getServerAppwriteClient, COLLECTIONS, DATABASE_ID } from "@/lib/appwrite";
import * as sdk from "node-appwrite";
import { renderHbsHtml, TemplateHtmlError } from "@/lib/hbs";

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: templateId } = await params;

        if (!templateId) {
            console.error("HTML preview: missing id parameter");
            return NextResponse.json({ error: "Missing template ID" }, { status: 400 });
        }

        console.log("HTML preview for template:", templateId);

        const client = getServerAppwriteClient();
        const databases = new sdk.Databases(client);

        const template = await databases.getDocument(
            DATABASE_ID,
            COLLECTIONS.TEMPLATES,
            templateId
        );

        if (!template) {
            return NextResponse.json({ error: "Template not found" }, { status: 404 });
        }

        // Decode test_data if it's base64 (consistent with other API routes)
        let parsedData = template.test_data || {};
        if (typeof template.test_data === 'string') {
            try {
                // Try to see if it's base64
                parsedData = JSON.parse(Buffer.from(template.test_data, 'base64').toString('utf8'));
            } catch {
                try {
                    // If not base64, try normal JSON
                    parsedData = JSON.parse(template.test_data);
                } catch {
                    parsedData = {};
                }
            }
        }

        const renderedHtml = renderHbsHtml(template.html ?? "", parsedData);

        // Wrap in full HTML structure for proper rendering/capture
        const fullHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${template.title || "Template Preview"}</title>
    <style>
        body { margin: 0; padding: 0; }
        ${template.css || ""}
    </style>
</head>
<body>
    ${renderedHtml}
</body>
</html>`;

        return new NextResponse(fullHtml, {
            headers: {
                "Content-Type": "text/html",
                "Cache-Control": "public, max-age=3600", // Cache for 1 hour
            },
        });
    } catch (error) {
        console.error("Public preview render error:", error);
        if (error instanceof TemplateHtmlError) {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to render template" },
            { status: 500 }
        );
    }
}
