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
            <div className="max-w-[1600px] mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <button
                        onClick={() => router.push("/templates")}
                        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 group transition-colors"
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
                            <h1 className="text-4xl font-extrabold text-gray-900 transition-all">
                                {t("Create New Template")}
                            </h1>
                            <p className="text-gray-500 mt-2 text-lg">
                                {t("Choose a base and provide a name to get started")}
                            </p>
                        </div>
                        <button
                            onClick={() => (document.getElementById('template-form') as HTMLFormElement)?.requestSubmit()}
                            disabled={isLoading}
                            className="flex items-center gap-2 bg-blue-600 text-white px-8 py-3.5 rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-600/20 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-lg"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                            </svg>
                            {isLoading ? t("Creating...") : t("Create & Edit")}
                        </button>
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="grid grid-cols-1 gap-10">
                    {/* Error Message */}
                    {error && (
                        <div className="bg-red-50 border-l-4 border-red-500 text-red-700 px-6 py-4 rounded-lg shadow-sm animate-in fade-in slide-in-from-top-2">
                            <div className="flex items-center gap-3">
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                                <span className="font-medium">{error}</span>
                            </div>
                        </div>
                    )}

                    <div className="flex flex-col gap-10">
                        {/* Form Card (Centered Narrowly) */}
                        <div className="w-full max-w-2xl mx-auto bg-white rounded-2xl shadow-sm border border-gray-200 p-10">
                            <SimpleTemplateForm onSubmit={handleSubmit} isLoading={isLoading} />

                            {/* Base Selection (Part of the form experience) */}
                            <div className="mt-10 border-t border-gray-100 pt-10">
                                <label className="block text-sm font-semibold text-gray-700 mb-6 uppercase tracking-wider">
                                    {t("Select Base Template")}
                                </label>
                                <div className="flex flex-wrap gap-6 justify-center">
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
                    </div>
                </div>
            </div>
        </div>
    );
}
