import { NextRequest, NextResponse, connection } from "next/server";
import { DATABASE_ID, COLLECTIONS } from "@/lib/appwrite";
import { getAuthenticatedDatabases } from "@/lib/auth";
import { Query } from "node-appwrite";
import { isPostgresBackend } from "@/backend/config";
import { dashboardStatsPostgres } from "@/backend/data/http/dashboard";

export async function GET(request: NextRequest) {
    if (isPostgresBackend()) {
        return dashboardStatsPostgres(request);
    }

    await connection();
    try {
        const auth = await getAuthenticatedDatabases(request);
        if (!auth) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { tables, user } = auth;

        // Get templates count
        const templatesResponse = await tables.listRows({
            databaseId: DATABASE_ID,
            tableId: COLLECTIONS.TEMPLATES,
            queries: [Query.equal("user_id", user.id)],
        });
        const templatesCount = templatesResponse.total || templatesResponse.rows?.length || 0;

        // Get all documents for the user
        const documentsResponse = await tables.listRows({
            databaseId: DATABASE_ID,
            tableId: COLLECTIONS.DOCUMENTS,
            queries: [
                Query.equal("user_id", user.id),
                Query.orderDesc("$createdAt"),
            ],
        });

        const documents = documentsResponse.rows || [];
        const documentsCount = documentsResponse.total || documents.length;

        // Calculate total storage and total transferred data
        // totalStorage: sum of unique file sizes (KB)
        // totalTransferred: sum of (size * downloads) (KB)
        let totalStorage = 0;
        let totalTransferred = 0;

        documents.forEach(doc => {
            const size = doc.size || 0;
            const downloads = doc.downloads || 0;
            totalStorage += size;
            totalTransferred += (size * downloads);
        });

        // Get recent 10 documents with template info
        const recentDocuments = await Promise.all(
            documents.slice(0, 5).map(async (doc) => {
                try {
                    const template = await tables.getRow({
                        databaseId: DATABASE_ID,
                        tableId: COLLECTIONS.TEMPLATES,
                        rowId: doc.template_id,
                    });
                    return {
                        ...doc,
                        template_name: template.name,
                    };
                } catch {
                    return {
                        ...doc,
                        template_name: "Unknown",
                    };
                }
            })
        );

        // Calculate activity data with adaptive time period
        const now = new Date();
        const activityMap = new Map<string, { created: number; downloads: number }>();

        // Determine the time period based on oldest document
        let periodDays = 7; // default
        if (documents.length > 0) {
            const oldestDoc = documents[documents.length - 1];
            const oldestDate = new Date(oldestDoc.$createdAt);
            const daysDiff = Math.ceil((now.getTime() - oldestDate.getTime()) / (1000 * 60 * 60 * 24));

            if (daysDiff > 30) {
                periodDays = Math.min(daysDiff, 90); // Cap at 90 days
            } else if (daysDiff > 7) {
                periodDays = 30;
            }
        }

        // Initialize all days in the period with 0
        for (let i = 0; i < periodDays; i++) {
            const date = new Date(now);
            date.setDate(date.getDate() - i);
            const dateKey = date.toISOString().split('T')[0];
            activityMap.set(dateKey, { created: 0, downloads: 0 });
        }

        // Count documents created per day
        documents.forEach((doc) => {
            const dateKey = doc.$createdAt.split('T')[0];
            if (activityMap.has(dateKey)) {
                const current = activityMap.get(dateKey)!;
                activityMap.set(dateKey, { ...current, created: current.created + 1 });
            }
        });

        // Note: Downloads are tracked when download endpoint is called
        // For now, we'll use the downloads field from documents
        // In a real scenario, you'd want a separate downloads log table
        documents.forEach((doc) => {
            if (doc.downloads && doc.downloads > 0) {
                // Distribute downloads across the period (simplified approach)
                // In production, you'd track each download with a timestamp
                const dateKey = doc.$createdAt.split('T')[0];
                if (activityMap.has(dateKey)) {
                    const current = activityMap.get(dateKey)!;
                    activityMap.set(dateKey, { ...current, downloads: current.downloads + (doc.downloads || 0) });
                }
            }
        });

        // Convert to array and sort by date
        const activityData = Array.from(activityMap.entries())
            .map(([date, data]) => ({ date, created: data.created, downloads: data.downloads }))
            .sort((a, b) => a.date.localeCompare(b.date));

        return NextResponse.json({
            success: true,
            stats: {
                templatesCount,
                documentsCount,
                totalStorage, // in KB
                totalTransferred, // in KB
                periodDays,
            },
            activityData,
            recentDocuments,
        });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Failed to fetch dashboard stats";
        console.error("Dashboard stats error:", error);
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}
