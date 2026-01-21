import { Suspense } from "react";
import EditTemplate from "@/components/templates/edit-template";

export async function generateStaticParams() {
    return [{ id: "static-build-placeholder" }];
}

export default function EditTemplatePage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">Loading Editor...</div>}>
            <EditTemplate />
        </Suspense>
    );
}
