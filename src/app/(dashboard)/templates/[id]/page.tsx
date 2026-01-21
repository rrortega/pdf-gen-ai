import { Suspense } from "react";
import ViewTemplate from "@/components/templates/view-template";

function TemplateSkeleton() {
    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-4xl mx-auto">
                <div className="mb-8">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="h-5 w-5 bg-gray-200 rounded animate-pulse"></div>
                        <div className="h-5 w-32 bg-gray-200 rounded animate-pulse"></div>
                    </div>
                    <div className="flex items-center justify-between">
                        <div className="h-10 w-64 bg-gray-200 rounded animate-pulse"></div>
                        <div className="flex gap-3">
                            <div className="h-10 w-24 bg-gray-200 rounded animate-pulse"></div>
                            <div className="h-10 w-24 bg-gray-200 rounded animate-pulse"></div>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-6">
                    <div className="h-20 bg-gray-200 rounded animate-pulse"></div>
                    <div className="h-20 bg-gray-200 rounded animate-pulse"></div>
                    <div className="h-40 bg-gray-200 rounded animate-pulse"></div>
                </div>
            </div>
        </div>
    );
}

// export const dynamic = "force-dynamic";

export async function generateStaticParams() {
    return [{ id: "static-build-placeholder" }];
}

export default function ViewTemplatePage() {
    return (
        <Suspense fallback={<TemplateSkeleton />}>
            <ViewTemplate />
        </Suspense>
    );
}
