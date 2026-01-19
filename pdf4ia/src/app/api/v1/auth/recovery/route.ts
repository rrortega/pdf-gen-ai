import { NextResponse } from "next/server";
import { getAppwriteAccount } from "@/lib/appwrite";

/**
 * @swagger
 * /api/v1/auth/recovery:
 *   post:
 *     summary: Initiate password recovery
 *     description: Sends a password recovery email to the user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: Recovery email sent successfully
 *       400:
 *         description: Invalid email
 *       500:
 *         description: Server error
 */
export async function POST(request: Request) {
    try {
        const { email } = await request.json();

        if (!email) {
            return NextResponse.json(
                { success: false, error: "Email is required" },
                { status: 400 }
            );
        }

        const account = await getAppwriteAccount();

        // Create recovery URL - user will be redirected here with userId and secret
        const recoveryUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3030"}/reset-password`;

        await account.createRecovery(email, recoveryUrl);

        return NextResponse.json({
            success: true,
            message: "Recovery email sent. Please check your inbox.",
        });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Failed to send recovery email";
        console.error("Password recovery error:", error);
        return NextResponse.json(
            { success: false, error: errorMessage },
            { status: 500 }
        );
    }
}
