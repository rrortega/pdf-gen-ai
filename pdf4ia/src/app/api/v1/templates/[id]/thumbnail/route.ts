import { NextRequest, NextResponse } from "next/server";
import { getServerAppwriteAvatars } from "@/lib/appwrite";

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: templateId } = await params;
        const avatars = getServerAppwriteAvatars();

        const domain = process.env.NEXT_PUBLIC_DOMAIN || "";
        const previewUrl = `${domain}/api/v1/templates/${templateId}/html`;

        // Use Appwrite Avatars to capture a screenshot of the preview URL
        // In node-appwrite, getScreenshot returns a Promise<ArrayBuffer>
        const arrayBuffer = await avatars.getScreenshot({
            url: previewUrl,
            width: 200,
            height: 300,
        });

        return new NextResponse(arrayBuffer, {
            headers: {
                "Content-Type": "image/png",
                "Cache-Control": "public, max-age=3600", // Cache for 1 hour
            },
        });
    } catch (error) {
        console.error("Thumbnail proxy error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to generate thumbnail" },
            { status: 500 }
        );
    }
}
