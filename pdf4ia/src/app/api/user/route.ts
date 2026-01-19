import { NextResponse } from 'next/server';
import { getAppwriteAccount } from '@/lib/appwrite';

/**
 * Get current user information
 * GET /api/user
 */
export async function GET() {
    try {
        const account = await getAppwriteAccount();
        const user = await account.get();

        return NextResponse.json({
            success: true,
            user: {
                $id: user.$id,
                name: user.name,
                email: user.email,
            },
        });
    } catch (error: any) {
        console.error('Error fetching user:', error);
        return NextResponse.json(
            {
                success: false,
                error: error.message || 'Failed to fetch user',
            },
            { status: 401 }
        );
    }
}
