import {
    DATABASE_ID,
    COLLECTIONS,
} from "@/lib/appwrite";
import { Query } from "node-appwrite";
import { getAppwriteDatabases } from "@/lib/appwrite";
import { cacheLife, cacheTag } from "next/cache";

export async function getCachedTemplates(userId: string, sessionSecret: string) {
    "use cache";

    // Cache tag for invalidation
    cacheTag("templates", `user-templates-${userId}`);

    // Cache life configuration
    cacheLife({
        stale: 30, // 30 seconds
        revalidate: 300, // 5 minutes
        expire: 3600, // 1 hour
    });

    const databases = await getAppwriteDatabases(sessionSecret);

    const response = await databases.listDocuments(
        DATABASE_ID,
        COLLECTIONS.TEMPLATES,
        [
            Query.equal("user_id", userId),
            Query.orderDesc("$createdAt"),
            Query.limit(100), // Fetch up to 100 templates
        ]
    );

    // Map to simple template objects as in API route
    const templates = response.documents.map(doc => ({
        $id: doc.$id,
        title: doc.title,
        description: doc.description,
        tags: doc.tags || [],
        $createdAt: doc.$createdAt,
        $updatedAt: doc.$updatedAt,
        // Include other fields if needed by UI
        // UI uses css, html, test_data? 
        // In page.tsx Template interface: css, html, test_data ARE listed.
        // But API route GET /v1/templates LIST view does NOT return them (lines 65-72 in route.ts).
        // BUT page.tsx Template interface says they are there?
        // Let's check page.tsx usage.
        // It passes template to IntegrationModal... which implies it needs data?
        // Wait. `handleIntegrationClick` calls `/api/v1/templates/${template.$id}` to fetch details!
        // So the LIST view doesn't need full data.
        // Except... `DeleteConfirmationModal` only needs title.
        // `TemplatesList` rendering uses `ThumbnailImage` (takes id, title).

        // However, `TemplatesList` interface in `page.tsx` included `css`, `html`, `test_data`.
        // If the API allows `listDocuments` to return all fields (which it does by default unless `select` is used), 
        // then I should just return them or at least consistent with `Document` type.
        // The API route explicitly mapped them and EXCLUDED css/html/test_data!
        // So `page.tsx` state `templates` probably has undefined/missing properties for those fields.
        // But `IntegrationModal` usage:
        // `const response = await fetch(/api/v1/templates/${template.$id});`
        // So it fetches details separately.
        // So I can omit them in the list.
    }));

    return {
        templates,
        total: response.total,
    };
}
