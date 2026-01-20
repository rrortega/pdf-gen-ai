import { NextRequest, NextResponse } from "next/server";
import { PDFGenerator } from "@/lib/pdf-generator";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { html, css, test_data, orientation, paper_size, margins } = body;

        let parsedData = {};
        try {
            parsedData = typeof test_data === "string" ? JSON.parse(test_data) : test_data;
        } catch {
            return NextResponse.json(
                { error: "Invalid test data JSON" },
                { status: 400 }
            );
        }

        // Attempt to generate PDF in memory to validate Handlebars and rendering
        await PDFGenerator.generatePDF(html, css, parsedData, {
            orientation,
            paperSize: paper_size,
            margins,
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Validation error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Validation failed" },
            { status: 400 }
        );
    }
}
