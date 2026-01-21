import {
    DATABASE_ID,
    COLLECTIONS,
} from "@/lib/appwrite";
import { Query, Models } from "node-appwrite";
import { getAppwriteDatabases } from "@/lib/appwrite";
import { cacheLife, cacheTag } from "next/cache";

interface DocumentWithStats extends Models.Document {
    name: string;
    size?: number;
    downloads?: number;
    template_id?: string;
    status: string;
    user_id: string;
}

export interface DashboardData {
    stats: {
        templatesCount: number;
        documentsCount: number;
        totalFiles: number;
        totalStorage: number;
        totalTransferred: number;
        periodDays: number;
    };
    activityData: {
        date: string;
        created: number;
        downloads: number;
    }[];
    recentDocuments: {
        $id: string;
        name: string;
        template_name: string;
        size?: number;
        status: string;
        user_id: string;
        $createdAt: string;
    }[];
}

export async function getCachedDashboardStats(userId: string, sessionSecret: string): Promise<DashboardData> {
    "use cache";

    // Cache tag for invalidation
    cacheTag("dashboard", `user-dashboard-${userId}`);

    // Cache life configuration
    cacheLife({
        stale: 60, // 60 seconds
        revalidate: 300, // 5 minutes
        expire: 3600, // 1 hour
    });

    const databases = await getAppwriteDatabases(sessionSecret);

    // Parallel fetch for templates and documents
    const [templatesResponse, documentsResponse] = await Promise.all([
        databases.listDocuments(
            DATABASE_ID,
            COLLECTIONS.TEMPLATES,
            [Query.equal("user_id", userId)]
        ),
        databases.listDocuments(
            DATABASE_ID,
            COLLECTIONS.DOCUMENTS,
            [
                Query.equal("user_id", userId),
                Query.orderDesc("$createdAt"),
                Query.limit(500) // Limit for stats calculation
            ]
        )
    ]);

    const templatesCount = templatesResponse.total;
    const documents = (documentsResponse.documents || []) as unknown as DocumentWithStats[];
    const documentsCount = documentsResponse.total;

    // Calculate total storage and total transferred data
    let totalStorage = 0;
    let totalTransferred = 0;

    documents.forEach((doc: DocumentWithStats) => {
        // cast to any for custom attributes that might not be in base Document type explicitly typed in SDK?
        // Actually Document extends Preferences which has [key: string]: any.
        const size = doc.size || 0;
        const downloads = doc.downloads || 0;
        totalStorage += size;
        totalTransferred += (size * downloads);
    });

    // Get recent 5 documents with template info
    // Only take top 5 from the fetched documents
    // Note: If we fetched just 5, we wouldn't have stats for all documents.
    // Ideally we should do a separate fetch for recent docs OR fetch all (expensive)
    // The previous API implementation fetched ALL documents first (filtered by user) but without limit?
    // Use `listRows` in API which defaults to 25? Ah API checked `rows` and `total`.
    // The API probably defaulted to limit 25 if not specified.
    // But then it iterated to calculate storage... only for the first 25?
    // Wait, the API `queries` for documents: `[Query.equal("user_id", user.id), Query.orderDesc("$createdAt")]`.
    // Defaults to 25. So stats were only for 25 most recent documents!
    // I will increase limit to 100 for better stats, but still keeps performance in mind.

    const recentDocumentsPromise = documents.slice(0, 5).map(async (doc: DocumentWithStats) => {
        try {
            // We need to fetch template name.
            // This N+1 query is bad but consistent with previous implementation.
            // Cached in parallel helps.
            const template = await databases.getDocument(
                DATABASE_ID,
                COLLECTIONS.TEMPLATES,
                doc.template_id || ""
            );
            return {
                $id: doc.$id,
                name: doc.name,
                template_name: template.name || template.title, // 'title' in previous API return but 'name' used? API accessed `template.name`. But template creation uses `title`.
                // Let's check `template` structure. `title` is standard. API might have been buggy or using different field.
                // In `v1/templates/route.ts` create uses `title`.
                // In `v1/dashboard/stats/route.ts` line 60 uses `template.name`.
                // I suspect `template.name` might be undefined if it is `title`.
                // I'll check `templates-list` uses `title`.
                // I will safely use `title`.
                size: doc.size,
                status: doc.status,
                user_id: doc.user_id,
                $createdAt: doc.$createdAt,
            };
        } catch {
            return {
                $id: doc.$id,
                name: doc.name,
                template_name: "Unknown",
                size: doc.size,
                status: doc.status,
                user_id: doc.user_id,
                $createdAt: doc.$createdAt,
            };
        }
    });

    const recentDocuments = await Promise.all(recentDocumentsPromise);

    // Activity Data Calculation
    const now = new Date();
    const activityMap = new Map<string, { created: number; downloads: number }>();

    let periodDays = 7;
    if (documents.length > 0) {
        const oldestDoc = documents[documents.length - 1]; // This is the oldest of the FETCHED (limit 100/500)
        const oldestDate = new Date(oldestDoc.$createdAt);
        const daysDiff = Math.ceil((now.getTime() - oldestDate.getTime()) / (1000 * 60 * 60 * 24));

        if (daysDiff > 30) {
            periodDays = Math.min(daysDiff, 90);
        } else if (daysDiff > 7) {
            periodDays = 30;
        }
    }

    for (let i = 0; i < periodDays; i++) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        const dateKey = date.toISOString().split('T')[0];
        activityMap.set(dateKey, { created: 0, downloads: 0 });
    }

    documents.forEach((doc: DocumentWithStats) => {
        const dateKey = doc.$createdAt.split('T')[0];
        if (activityMap.has(dateKey)) {
            const current = activityMap.get(dateKey)!;
            activityMap.set(dateKey, { ...current, created: current.created + 1 });

            if (doc.downloads && doc.downloads > 0) {
                activityMap.set(dateKey, { ...current, downloads: current.downloads + doc.downloads });
            }
        }
    });

    const activityData = Array.from(activityMap.entries())
        .map(([date, data]) => ({ date, created: data.created, downloads: data.downloads }))
        .sort((a, b) => a.date.localeCompare(b.date));

    return {
        stats: {
            templatesCount,
            documentsCount,
            totalFiles: documentsCount,
            totalStorage, // KB
            totalTransferred, // KB
            periodDays,
        },
        activityData,
        recentDocuments,
    };
}
