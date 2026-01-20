import { NextRequest, NextResponse } from "next/server";
import { PDFGenerator } from "@/lib/pdf-generator";

export async function POST(request: NextRequest) {
    try {
        const { css, html, test_data, orientation, paperSize, margins } = await request.json();

        // Parse test data
        let data;
        try {
            data = typeof test_data === 'string' ? JSON.parse(test_data) : test_data;
        } catch (error: unknown) {
            console.error("JSON parse error:", error);
            return NextResponse.json(
                { error: "Invalid JSON in test data" },
                { status: 400 }
            );
        }

        // Generate PDF using centralized generator for 100% parity
        const pdfBuffer = await PDFGenerator.generatePDF(
            html,
            css,
            data,
            {
                orientation: orientation as "portrait" | "landscape",
                paperSize: paperSize,
                margins: margins,
            }
        );

        // Return PDF as response
        return new NextResponse(pdfBuffer as any, {
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": "inline; filename=preview.pdf",
                "Cache-Control": "no-store, max-age=0",
            },
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        console.error("PDF preview error:", errorMessage);
        return NextResponse.json(
            {
                error: "Failed to generate PDF preview",
                details: errorMessage,
            },
            { status: 500 }
        );
    }
}
