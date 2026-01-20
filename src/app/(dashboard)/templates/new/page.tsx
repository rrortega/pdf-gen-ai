"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/hooks/useI18n";
import SimpleTemplateForm from "@/components/templates/SimpleTemplateForm";
import BaseTemplateCard from "@/components/templates/BaseTemplateCard";

interface Template {
    $id: string;
    title: string;
    tags: string[];
    [key: string]: unknown;
}

export default function NewTemplatePage() {
    const router = useRouter();
    const { t } = useI18n();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [baseTemplates, setBaseTemplates] = useState<Template[]>([]);
    const [selectedBaseId, setSelectedBaseId] = useState<string | null>(null);

    useEffect(() => {
        const fetchBaseTemplates = async () => {
            try {
                const res = await fetch("/api/v1/templates?base=true");
                const data = await res.json();
                if (data.success) {
                    setBaseTemplates(data.templates || []);
                }
            } catch (err) {
                console.error("Failed to fetch base templates:", err);
            }
        };
        fetchBaseTemplates();
    }, []);

    const handleSubmit = async (data: { title: string; tags: string[] }) => {
        try {
            setIsLoading(true);
            setError(null);

            // Create template with minimal data
            // HTML, CSS, and testData will have default values
            const response = await fetch("/api/v1/templates", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                credentials: "include",
                body: JSON.stringify({
                    title: data.title,
                    tags: data.tags,
                    baseTemplateId: selectedBaseId,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Failed to create template");
            }

            const result = await response.json();

            // Redirect to edit page with the new template ID
            router.push(`/templates/${result.template.$id}/edit`);
        } catch (err) {
            setError(err instanceof Error ? err.message : t("Failed to create template"));
            console.error("Error creating template:", err);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 p-6 w-full">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <button
                        onClick={() => router.push("/templates")}
                        className="hidden md:flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 group transition-colors"
                    >
                        <div className="p-1.5 bg-white rounded-md shadow-sm border border-gray-200 group-hover:border-gray-300">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                        </div>
                        <span className="font-medium text-sm">{t("Back to Templates")}</span>
                    </button>

                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900">
                                {t("Create New Template")}
                            </h1>
                            <p className="text-gray-500 mt-2">
                                {t("Choose a base and provide a name to get started")}
                            </p>
                        </div>
                        <button
                            onClick={() => (document.getElementById('template-form') as HTMLFormElement)?.requestSubmit()}
                            disabled={isLoading}
                            className="hidden md:flex items-center gap-2 bg-gray-900 text-white px-6 py-2.5 rounded-lg hover:bg-gray-950 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-sm"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                            </svg>
                            {isLoading ? t("Creating...") : t("Create & Edit")}
                        </button>
                    </div>
                </div>

                {/* Error Message */}
                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 flex items-center gap-3">
                        <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        <span className="font-medium text-sm">{error}</span>
                    </div>
                )}

                {/* Form Section - Left Aligned */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
                    <SimpleTemplateForm onSubmit={handleSubmit} isLoading={isLoading} />
                </div>

                {/* Base Selection - Full Width Grid */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-32 md:mb-0">
                    <label className="block text-sm font-bold text-gray-900 mb-6 uppercase tracking-wider">
                        {t("Select Base Template")}
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 2xl:grid-cols-6 gap-6">
                        <BaseTemplateCard
                            title="Blank Sheet"
                            isSelected={selectedBaseId === null}
                            onSelect={() => setSelectedBaseId(null)}
                        />
                        {baseTemplates.map((template) => (
                            <BaseTemplateCard
                                key={template.$id}
                                templateId={template.$id}
                                title={template.title}
                                isSelected={selectedBaseId === template.$id}
                                onSelect={() => setSelectedBaseId(template.$id)}
                            />
                        ))}
                    </div>
                </div>
            </div>

            {/* Mobile Fixed Bottom Action Bar */}
            <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 z-50 shadow-[0_-4px_10px_rgba(0,0,0,0.05)]">
                <div className="flex gap-3 max-w-lg mx-auto">
                    <button
                        onClick={() => router.push("/templates")}
                        className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-xl font-bold bg-white active:bg-gray-50 transition-colors"
                    >
                        {t("Cancel")}
                    </button>
                    <button
                        onClick={() => (document.getElementById('template-form') as HTMLFormElement)?.requestSubmit()}
                        disabled={isLoading}
                        className="flex-3 px-8 py-3 bg-gray-900 text-white rounded-xl font-bold active:bg-gray-950 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {isLoading ? (
                            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                        ) : null}
                        {t("Next")}
                    </button>
                </div>
            </div>
        </div>
    );
}
