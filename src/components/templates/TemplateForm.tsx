"use client";

import { useState } from "react";
import { useI18n } from "@/hooks/useI18n";
import TagsInput from "./TagsInput";
import CodeEditor from "./CodeEditor";

interface TemplateFormProps {
    initialData?: {
        title: string;
        tags: string[];
        css: string;
        html: string;
        testData: string;
    };
    onSubmit: (data: {
        title: string;
        tags: string[];
        css: string;
        html: string;
        testData: string;
    }) => Promise<void>;
    onPreview?: (data: {
        title: string;
        tags: string[];
        css: string;
        html: string;
        testData: string;
    }) => void;
    submitLabel: string;
    isLoading?: boolean;
    showPreview?: boolean;
    previewUrl?: string | null;
    isGeneratingPreview?: boolean;
}

export default function TemplateForm({
    initialData,
    onSubmit,
    onPreview,
    submitLabel,
    isLoading = false,
    showPreview = false,
    previewUrl = null,
    isGeneratingPreview = false,
}: TemplateFormProps) {
    const { t } = useI18n();
    const [activeTab, setActiveTab] = useState(0);
    const [formData, setFormData] = useState({
        title: initialData?.title || "",
        tags: initialData?.tags || [],
        css: initialData?.css || "/* Add your CSS styles here */\nbody {\n  font-family: Arial, sans-serif;\n  padding: 20px;\n}",
        html: initialData?.html || "<!-- Add your HTML template here -->\n<h1>{{title}}</h1>\n<p>{{description}}</p>",
        testData: initialData?.testData || '{\n  "title": "Sample Title",\n  "description": "Sample description"\n}',
    });
    const [errors, setErrors] = useState<Record<string, string>>({});

    const tabs = [
        { id: 0, name: t("Title") + " & " + t("Tags"), icon: "📝" },
        { id: 1, name: t("CSS Styles"), icon: "🎨" },
        { id: 2, name: t("HTML Template"), icon: "📄" },
        { id: 3, name: t("Test Data"), icon: "🧪" },
        { id: 4, name: t("Preview PDF"), icon: "👁️" },
    ];

    const validateForm = () => {
        const newErrors: Record<string, string> = {};

        if (!formData.title.trim()) {
            newErrors.title = t("Title is required");
        }

        if (!formData.css.trim()) {
            newErrors.css = t("CSS is required");
        }

        if (!formData.html.trim()) {
            newErrors.html = t("HTML is required");
        }

        if (!formData.testData.trim()) {
            newErrors.testData = t("Test data is required");
        } else {
            try {
                JSON.parse(formData.testData);
            } catch {
                newErrors.testData = t("Invalid test data JSON");
            }
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validateForm()) {
            return;
        }

        await onSubmit(formData);
    };

    const handlePreview = () => {
        if (validateForm() && onPreview) {
            onPreview(formData);
            setActiveTab(4); // Switch to preview tab
        }
    };

    return (
        <form id="template-form" onSubmit={handleSubmit} className="space-y-6">
            {/* Tab Navigation */}
            <div className="border-b border-gray-200">
                <nav className="flex -mb-px space-x-8 overflow-x-auto">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => setActiveTab(tab.id)}
                            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === tab.id
                                ? "border-gray-900 text-gray-900"
                                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                                }`}
                        >
                            <span className="mr-2">{tab.icon}</span>
                            {tab.name}
                        </button>
                    ))}
                </nav>
            </div>

            {/* Tab Content - Fixed height container */}
            <div className="h-[600px]">
                {/* Tab 0: Title & Tags */}
                {activeTab === 0 && (
                    <div className="space-y-6 p-4">
                        <div>
                            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                                {t("Title")} <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                id="title"
                                value={formData.title}
                                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                className={`w-full px-4 py-3 border rounded-lg text-gray-900 focus:ring-2 focus:ring-gray-500 focus:border-gray-500 outline-none ${errors.title ? "border-red-500" : "border-gray-300"
                                    }`}
                                placeholder={t("Template Name")}
                                disabled={isLoading}
                            />
                            {errors.title && (
                                <p className="mt-1 text-sm text-red-600">{errors.title}</p>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                {t("Tags")}
                            </label>
                            <TagsInput
                                value={formData.tags}
                                onChange={(tags) => setFormData({ ...formData, tags })}
                                placeholder={t("Add tag")}
                                disabled={isLoading}
                            />
                        </div>
                    </div>
                )}

                {/* Tab 1: CSS - Full height editor */}
                {activeTab === 1 && (
                    <div className="h-full p-4">
                        <CodeEditor
                            value={formData.css}
                            onChange={(css) => setFormData({ ...formData, css })}
                            language="css"
                            disabled={isLoading}
                            error={errors.css}
                        />
                    </div>
                )}

                {/* Tab 2: HTML - Full height editor */}
                {activeTab === 2 && (
                    <div className="h-full p-4 flex flex-col">
                        <p className="text-xs text-gray-500 mb-2">
                            Use Handlebars syntax: {`{{variable}}`}
                        </p>
                        <div className="flex-1">
                            <CodeEditor
                                value={formData.html}
                                onChange={(html) => setFormData({ ...formData, html })}
                                language="html"
                                disabled={isLoading}
                                error={errors.html}
                            />
                        </div>
                    </div>
                )}

                {/* Tab 3: Test Data - Full height editor */}
                {activeTab === 3 && (
                    <div className="h-full p-4">
                        <CodeEditor
                            value={formData.testData}
                            onChange={(testData) => setFormData({ ...formData, testData })}
                            language="json"
                            disabled={isLoading}
                            error={errors.testData}
                        />
                    </div>
                )}

                {/* Tab 4: Preview */}
                {activeTab === 4 && (
                    <div className="h-full overflow-auto p-4">
                        {!showPreview && !previewUrl && (
                            <div className="text-center py-12">
                                <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                                <p className="text-gray-500 mb-4">{t("Click the button below to generate a preview")}</p>
                                <button
                                    type="button"
                                    onClick={handlePreview}
                                    disabled={isLoading}
                                    className="inline-flex items-center gap-2 bg-green-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                    </svg>
                                    {t("Generate Preview")}
                                </button>
                            </div>
                        )}

                        {isGeneratingPreview && (
                            <div className="flex items-center justify-center py-12">
                                <div className="text-center">
                                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
                                    <p className="text-gray-600">{t("Generating preview...")}</p>
                                </div>
                            </div>
                        )}

                        {previewUrl && !isGeneratingPreview && (
                            <div className="space-y-4">
                                <div className="flex justify-between items-center">
                                    <h3 className="text-lg font-semibold text-gray-900">{t("PDF Preview")}</h3>
                                    <div className="flex gap-2">
                                        <a
                                            href={previewUrl}
                                            download="preview.pdf"
                                            className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-950 transition-colors text-sm"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                            </svg>
                                            {t("Download PDF")}
                                        </a>
                                        <button
                                            type="button"
                                            onClick={handlePreview}
                                            className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors text-sm"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                            </svg>
                                            {t("Refresh")}
                                        </button>
                                    </div>
                                </div>
                                <iframe
                                    src={previewUrl}
                                    className="w-full h-[500px] border border-gray-300 rounded-lg"
                                    title="PDF Preview"
                                />
                            </div>
                        )}
                    </div>
                )}
            </div>
        </form>
    );
}
