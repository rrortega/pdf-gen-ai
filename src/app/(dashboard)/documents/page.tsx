import { Suspense } from "react";
import DocumentsList, { type Document } from "@/components/documents/documents-list";
import { getCachedDocuments } from "./data";
import { getAppwriteAccount, getSessionSecret } from "@/lib/appwrite";
import { redirect } from "next/navigation";

// Simple Loading Skeleton
function DocumentsSkeleton() {
    return (
        <div className="min-h-screen bg-gray-50 p-6 relative overflow-x-hidden">
            <div className="max-w-7xl mx-auto">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                    <div>
                        <div className="h-8 w-48 bg-gray-200 rounded-lg animate-pulse mb-2"></div>
                        <div className="h-4 w-32 bg-gray-200 rounded-lg animate-pulse"></div>
                    </div>
                </div>
                <div className="grid grid-cols-1 gap-4">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 h-32 animate-pulse"></div>
                    ))}
                </div>
            </div>
        </div>
    );
}

// Dynamic Content
async function DocumentsContent() {
    // 1. Authenticate server-side
    let user;
    let sessionSecret;
    try {
        const account = await getAppwriteAccount();
        user = await account.get();
        if (!user || !user.$id) {
            redirect("/login");
        }

        sessionSecret = await getSessionSecret();
    } catch {
        redirect("/login");
    }

    // 2. Fetch data using cached function
    const { documents, total } = await getCachedDocuments(user.$id, sessionSecret || "");

    return (
        <DocumentsList
            initialDocuments={documents as Document[]}
            initialTotal={total}
            currentUserId={user.$id}
        />
    );
}

// Static Shell
export default function DocumentsPage() {
    return (
        <Suspense fallback={<DocumentsSkeleton />}>
            <DocumentsContent />
        </Suspense>
    );
}
