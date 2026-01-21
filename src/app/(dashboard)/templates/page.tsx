import { Suspense } from "react";
import TemplatesList, { type Template } from "@/components/templates/templates-list";
import { getCachedTemplates } from "./data";
import { getAppwriteAccount, getSessionSecret } from "@/lib/appwrite";
import { redirect } from "next/navigation";

// Simple Loading Skeleton
function TemplatesSkeleton() {
    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-7xl mx-auto">
                <div className="mb-8">
                    <div className="flex items-center justify-between mb-6">
                        <div className="h-8 w-48 bg-gray-200 rounded animate-pulse"></div>
                        <div className="h-10 w-32 bg-gray-200 rounded animate-pulse"></div>
                    </div>
                    <div className="h-12 w-full bg-gray-200 rounded animate-pulse mb-6"></div>
                </div>
                <div className="grid grid-cols-1 md:flex md:flex-col gap-4">
                    {[...Array(5)].map((_, i) => (
                        <div key={i} className="bg-white h-32 rounded-xl shadow-sm border border-gray-100 p-4"></div>
                    ))}
                </div>
            </div>
        </div>
    );
}

// Dynamic Content
async function TemplatesContent() {
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
    const { templates } = await getCachedTemplates(user.$id, sessionSecret || "");

    return (
        <TemplatesList initialTemplates={templates as Template[]} />
    );
}

// Static Shell
export default function TemplatesPage() {
    return (
        <Suspense fallback={<TemplatesSkeleton />}>
            <TemplatesContent />
        </Suspense>
    );
}
