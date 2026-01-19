"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/hooks/useI18n";
import SimpleTemplateForm from "@/components/templates/SimpleTemplateForm";

export default function NewTemplatePage() {
    const router = useRouter();
    const { t } = useI18n();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

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
                    html: `<!-- Handlebars Template -->
<div class="document">
  <h1>{{title}}</h1>
  
  {{#if subtitle}}
  <h2>{{subtitle}}</h2>
  {{/if}}
  
  {{#if items}}
  <ul>
    {{#each items}}
    <li>{{this.name}} - {{this.value}}</li>
    {{/each}}
  </ul>
  {{/if}}
</div>`,
                    css: `/* PDF Styles */
body {
  font-family: Arial, sans-serif;
  padding: 20px;
  color: #333;
}

.document {
  max-width: 800px;
  margin: 0 auto;
}

h1 {
  color: #2c3e50;
  border-bottom: 2px solid #3498db;
  padding-bottom: 10px;
}

h2 {
  color: #7f8c8d;
  margin-top: 20px;
}

ul {
  list-style-type: none;
  padding: 0;
}

li {
  padding: 8px;
  margin: 5px 0;
  background: #ecf0f1;
  border-left: 3px solid #3498db;
}`,
                    testData: `{
  "title": "Sample Document",
  "subtitle": "Handlebars Template Example",
  "items": [
    { "name": "Item 1", "value": "Value A" },
    { "name": "Item 2", "value": "Value B" },
    { "name": "Item 3", "value": "Value C" }
  ]
}`,
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
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-2xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <button
                        onClick={() => router.push("/templates")}
                        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                        {t("Back to Templates")}
                    </button>
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900">{t("Create New Template")}</h1>
                            <p className="text-gray-600 mt-2">{t("Start by giving your template a name")}</p>
                        </div>
                        <button
                            onClick={() => document.getElementById('template-form')?.requestSubmit()}
                            disabled={isLoading}
                            className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
                        {error}
                    </div>
                )}

                {/* Form */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
                    <SimpleTemplateForm onSubmit={handleSubmit} isLoading={isLoading} />
                </div>
            </div>
        </div>
    );
}
