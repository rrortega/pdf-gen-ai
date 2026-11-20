import {
    DATABASE_ID,
    COLLECTIONS,
} from "@/lib/appwrite";
import { Query } from "node-appwrite";
import { getAppwriteDatabases } from "@/lib/appwrite";
import { isPostgresBackend } from "@/backend/config";
import { getDataRepositories } from "@/backend/data/repositories";
import { toDocumentListRow } from "@/backend/data/presenter";
import { cacheLife, cacheTag } from "next/cache";

export async function getCachedDocuments(userId: string, sessionSecret: string, page = 1, limit = 10) {
    "use cache";

    // Cache tag for invalidation
    cacheTag("documents", `user-documents-${userId}`);

    // Cache life configuration - short stale time for snappy feel, longer background revalidation
    cacheLife({
        stale: 30, // 30 seconds
        revalidate: 300, // 5 minutes
        expire: 3600, // 1 hour
    });

    // The self-hosted backend reads through the postgres repositories; the
    // browser never accesses PostgreSQL directly.
    if (isPostgresBackend()) {
      const { total, rows } = await getDataRepositories().documents.list(userId, {
        page,
        limit,
      });
      return {
        documents: rows.map((row) => toDocumentListRow(row)),
        total,
      };
    }

    const databases = await getAppwriteDatabases(sessionSecret);

    const offset = (page - 1) * limit;

    const response = await databases.listDocuments(
        DATABASE_ID,
        COLLECTIONS.DOCUMENTS,
        [
            Query.equal("user_id", userId),
            Query.notEqual("status", "trashed"),
            Query.orderDesc("$createdAt"),
            Query.limit(limit),
            Query.offset(offset),
        ]
    );

    // Decode data from base64
    const decodedDocuments = (response.documents || []).map((doc: any) => {
        if (doc.data && typeof doc.data === 'string') {
            try {
                const decoded = Buffer.from(doc.data, 'base64').toString('utf8');
                doc.data = JSON.parse(decoded);
            } catch (e) {
                console.warn("Could not decode data for document:", doc.$id, e);
            }
        }
        return doc;
    });

    return {
        documents: decodedDocuments,
        total: response.total,
    };
}
