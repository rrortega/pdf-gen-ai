import { NextRequest, NextResponse } from "next/server";
import Handlebars from "handlebars";
import { registerHbsHelpers, registerHbsPartials } from "@/lib/hbs";

export async function POST(request: NextRequest) {
    try {
        const { html, css, test_data, orientation, paper_size, margins } = await request.json();

        // Register Handlebars helpers and partials
        registerHbsHelpers();
        registerHbsPartials();

        // Parse test data
        let data = {};
        try {
            data = typeof test_data === 'string' ? JSON.parse(test_data) : (test_data || {});
        } catch (error) {
            console.error("JSON parse error in preview-html:", error);
        }

        // Compile Handlebars template
        let renderedHtml = html || "";
        try {
            const template = Handlebars.compile(html || "");
            renderedHtml = template(data);
        } catch (e) {
            console.error("Handlebars compilation error in preview-html:", e);
        }

        // Paper dimensions mapping (approximate for preview)
        const paperDimensions: Record<string, string> = {
            "A4": orientation === "landscape" ? "297mm 210mm" : "210mm 297mm",
            "Letter": orientation === "landscape" ? "11in 8.5in" : "8.5in 11in",
            "Legal": orientation === "landscape" ? "14in 8.5in" : "8.5in 14in",
        };

        const size = paperDimensions[paper_size] || paperDimensions["A4"];

        // Create full HTML document matching PDFGenerator logic but with visual margins
        const fullHtml = `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        @page {
            size: ${paper_size || "A4"} ${orientation || "portrait"};
            margin: ${margins?.top || "20mm"} ${margins?.right || "20mm"} ${margins?.bottom || "20mm"} ${margins?.left || "20mm"};
        }

        /* Preview styles to simulate PDF */
        html, body {
            margin: 0;
            padding: 0;
            background-color: #f0f0f0;
            display: flex;
            justify-content: center;
            min-height: 100vh;
        }

        .pdf-page {
            background-color: white;
            width: ${size.split(' ')[0]};
            min-height: ${size.split(' ')[1]};
            margin: 20px auto;
            box-shadow: 0 0 10px rgba(0,0,0,0.1);
            padding: ${margins?.top || "20mm"} ${margins?.right || "20mm"} ${margins?.bottom || "20mm"} ${margins?.left || "20mm"};
            box-sizing: border-box;
            position: relative;
        }

        ${css || ""}
    </style>
</head>
<body>
    <div class="pdf-page">
        ${renderedHtml}
    </div>
</body>
</html>
        `.trim();

        return new Response(fullHtml, {
            headers: {
                "Content-Type": "text/html; charset=utf-8",
                "Cache-Control": "no-cache, no-store, must-revalidate",
            },
        });
    } catch (error) {
        console.error("Preview HTML error:", error);
        return NextResponse.json({ error: "Failed to generate preview" }, { status: 500 });
    }
}
