import { Suspense } from "react";
import DashboardView from "@/components/dashboard/dashboard-view";
import { getCachedDashboardStats } from "./data";
import { getAppwriteAccount, getSessionSecret } from "@/lib/appwrite";
import { redirect } from "next/navigation";


// Loading Skeleton
function DashboardSkeleton() {
    return (
        <div className="px-4 py-6 sm:px-6 lg:px-8 animate-pulse">
            <div className="mb-8">
                <div className="h-10 bg-gray-200 rounded-lg w-48 mb-3"></div>
                <div className="h-5 bg-gray-100 rounded-md w-96"></div>
            </div>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
                {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-32 bg-gray-200 rounded-xl border-2 border-gray-100"></div>
                ))}
            </div>
            <div className="mb-8 bg-white p-8 border-y border-gray-200">
                <div className="h-80 bg-gray-100 rounded-xl w-full"></div>
            </div>
        </div>
    );
}

// Dynamic Inner Component
async function DashboardContent() {
    // 1. Authenticate server-side
    let user;
    let sessionSecret;
    try {
        const account = await getAppwriteAccount();
        user = await account.get();
        if (!user || !user.$id) {
            redirect("/login");
        }

        // Retrieve session secret to pass to cached function
        // We must do this OUTSIDE the cached function to avoid accessing cookies inside "use cache"
        sessionSecret = await getSessionSecret();

    } catch {
        redirect("/login");
    }

    // 2. Fetch data using cached function
    const dashboardData = await getCachedDashboardStats(user.$id, sessionSecret || "");

    return (
        <DashboardView
            initialData={dashboardData}
            currentUserId={user.$id}
        />
    );
}

// Static Shell (mostly)
export default function DashboardPage() {
    return (
        <Suspense fallback={<DashboardSkeleton />}>
            <DashboardContent />
        </Suspense>
    );
}

