import { NextResponse } from "next/server";
import { getAppwriteAccount } from "@/lib/appwrite";

/**
 * @swagger
 * /api/v1/auth/recovery/confirm:
 *   post:
 *     summary: Confirm password recovery
 *     description: Completes the password reset process
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - secret
 *               - password
 *               - passwordConfirm
 *             properties:
 *               userId:
 *                 type: string
 *               secret:
 *                 type: string
 *               password:
 *                 type: string
 *                 minLength: 8
 *               passwordConfirm:
 *                 type: string
 *                 minLength: 8
 *     responses:
 *       200:
 *         description: Password reset successful
 *       400:
 *         description: Invalid input or passwords don't match
 *       500:
 *         description: Server error
 */
export async function POST(request: Request) {
    try {
        const { userId, secret, password, passwordConfirm } = await request.json();

        // Validation
        if (!userId || !secret || !password || !passwordConfirm) {
            return NextResponse.json(
                { success: false, error: "All fields are required" },
                { status: 400 }
            );
        }

        if (password !== passwordConfirm) {
            return NextResponse.json(
                { success: false, error: "Passwords do not match" },
                { status: 400 }
            );
        }

        if (password.length < 8) {
            return NextResponse.json(
                { success: false, error: "Password must be at least 8 characters" },
                { status: 400 }
            );
        }

        const account = await getAppwriteAccount();

        // Complete the password recovery
        await account.updateRecovery(userId, secret, password);

        return NextResponse.json({
            success: true,
            message: "Password reset successful. You can now login with your new password.",
        });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Failed to reset password";
        console.error("Password reset error:", error);
        return NextResponse.json(
            { success: false, error: errorMessage },
            { status: 500 }
        );
    }
}
