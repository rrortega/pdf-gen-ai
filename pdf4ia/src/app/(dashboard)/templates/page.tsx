"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/hooks/useI18n";

interface Template {
    $id: string;
    title: string;
    tags: string[];
    css: string;
    html: string;
    testData: string;
    $createdAt: string;
}

interface DeleteConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    templateTitle: string;
    t: (key: string) => string;
}

function DeleteConfirmationModal({
    isOpen,
    onClose,
    onConfirm,
    templateTitle,
    t,
}: DeleteConfirmationModalProps) {
    const [inputValue, setInputValue] = useState("");
    const confirmationText = t("confirm delete");

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 animate-in fade-in zoom-in duration-200">
                <div className="flex items-center gap-3 mb-4 text-red-600">
                    <div className="bg-red-100 p-2 rounded-full">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <h2 className="text-xl font-bold text-gray-900">{t("Confirm Deletion")}</h2>
                </div>

                <p className="text-gray-600 mb-4">
                    {t("Are you sure you want to delete the template")} <span className="font-semibold text-gray-900">&quot;{templateTitle}&quot;</span>? {t("This action is irreversible.")}
                </p>

                <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        {t("Please type \"confirm delete\" to confirm:")}
                    </label>
                    <input
                        type="text"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all"
                        placeholder={confirmationText}
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        autoFocus
                    />
                </div>

                <div className="flex gap-3 justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors font-medium"
                    >
                        {t("Cancel")}
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={inputValue !== confirmationText}
                        className={`px-4 py-2 rounded-lg transition-all font-medium flex items-center gap-2 ${inputValue === confirmationText
                            ? "bg-red-600 text-white hover:bg-red-700"
                            : "bg-gray-200 text-gray-400 cursor-not-allowed"
                            }`}
                    >
                        {t("Delete Formally")}
                    </button>
                </div>
            </div>
        </div>
    );
}

function ThumbnailImage({ templateId, title }: { templateId: string; title: string }) {
    const [hasError, setHasError] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    const imageUrl = `/api/v1/templates/${templateId}/thumbnail`;
    const fallbackUrl = `/api/v1/templates/${templateId}/html`;

    return (
        <div className="w-full h-full relative border border-gray-200 shadow-sm rounded-sm overflow-hidden">
            {!hasError ? (
                <>
                    {isLoading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
                            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                        </div>
                    )}
                    <img
                        src={imageUrl}
                        alt={title}
                        className={`w-full h-full object-cover transition-opacity duration-300 ${isLoading ? 'opacity-0' : 'opacity-100'}`}
                        onLoad={() => setIsLoading(false)}
                        onError={() => {
                            setHasError(true);
                            setIsLoading(false);
                        }}
                    />
                </>
            ) : (
                <div className="w-full h-full overflow-hidden pointer-events-none select-none bg-white">
                    <iframe
                        src={fallbackUrl}
                        className="border-0 rounded-sm w-[400%] h-[400%] origin-top-left scale-[0.25]"
                        scrolling="no"
                        tabIndex={-1}
                    />
                </div>
            )}
        </div>
    );
}

export default function TemplatesPage() {
    const router = useRouter();
    const { t } = useI18n();
    const [templates, setTemplates] = useState<Template[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [templateToDelete, setTemplateToDelete] = useState<Template | null>(null);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

    const fetchTemplates = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await fetch("/api/v1/templates", {
                credentials: "include",
            });

            if (!response.ok) {
                throw new Error("Failed to fetch templates");
            }

            const data = await response.json();
            setTemplates(data.templates || []);
        } catch (err) {
            setError(t("Failed to load templates"));
            console.error("Error fetching templates:", err);
        } finally {
            setLoading(false);
        }
    }, [t]);

    useEffect(() => {
        fetchTemplates();
    }, [fetchTemplates]);

    // Get all unique tags
    const allTags = Array.from(
        new Set(templates.flatMap((template) => template.tags))
    );

    const filteredTemplates = templates.filter((template) => {
        const matchesSearch = template.title
            .toLowerCase()
            .includes(searchQuery.toLowerCase());
        const matchesTags =
            selectedTags.length === 0 ||
            selectedTags.some((tag) => template.tags.includes(tag));
        return matchesSearch && matchesTags;
    });

    const toggleTag = (tag: string) => {
        setSelectedTags((prev) =>
            prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
        );
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString();
    };

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <div className="text-lg">{t("Loading...")}</div>
            </div>
        );
    }

    const handleDeleteClick = (template: Template) => {
        setTemplateToDelete(template);
        setIsDeleteModalOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (!templateToDelete) return;

        try {
            const res = await fetch(`/api/v1/templates/${templateToDelete.$id}`, {
                method: "DELETE",
            });
            if (res.ok) {
                fetchTemplates();
                setIsDeleteModalOpen(false);
                setTemplateToDelete(null);
            } else {
                const data = await res.json();
                alert(t(data.error) || t("Failed to delete template"));
            }
        } catch (err) {
            console.error("Delete error:", err);
            alert(t("An error occurred while deleting the template"));
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <div className="flex items-center justify-between mb-6">
                        <h1 className="text-3xl font-bold text-gray-900">
                            {t("My Templates")}
                        </h1>
                        <button
                            onClick={() => router.push("/templates/new")}
                            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            {t("Create New Template")}
                        </button>
                    </div>

                    {/* Search Bar */}
                    <div className="relative mb-4">
                        <input
                            type="text"
                            placeholder={t("Search templates...")}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full px-4 py-3 pl-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-gray-900"
                        />
                        <svg
                            className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>

                    {/* Tags Filter */}
                    {allTags.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                            {allTags.map((tag) => (
                                <button
                                    key={tag}
                                    onClick={() => toggleTag(tag)}
                                    className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${selectedTags.includes(tag)
                                        ? "bg-blue-600 text-white"
                                        : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                                        }`}
                                >
                                    {tag}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Error State */}
                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
                        <p>{error}</p>
                        <button
                            onClick={fetchTemplates}
                            className="mt-2 text-sm underline hover:no-underline"
                        >
                            {t("Try again")}
                        </button>
                    </div>
                )}

                {/* Templates Grid */}
                {filteredTemplates.length === 0 ? (
                    <div className="text-center py-12">
                        <svg
                            className="mx-auto h-12 w-12 text-gray-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <h3 className="mt-2 text-sm font-medium text-gray-900">
                            {t("No templates found")}
                        </h3>
                        <p className="mt-1 text-sm text-gray-500">
                            {searchQuery || selectedTags.length > 0
                                ? t("Try a different search term")
                                : t("Create your first template to get started.")}
                        </p>
                        {!searchQuery && selectedTags.length === 0 && (
                            <button
                                onClick={() => router.push("/templates/new")}
                                className="mt-4 inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                {t("Create New Template")}
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="flex flex-col gap-4">
                        {filteredTemplates.map((template) => (
                            <div
                                key={template.$id}
                                className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow flex items-center justify-between group"
                            >
                                <div className="flex items-center gap-4 flex-1 min-w-0 pr-4">
                                    {/* Template Thumbnail */}
                                    <div className="relative w-24 h-32 flex-shrink-0 bg-gray-100 rounded border border-gray-200 overflow-hidden shadow-sm group-hover:scale-110 transition-transform duration-300 origin-left z-10 transition-all flex items-center justify-center">
                                        <ThumbnailImage
                                            templateId={template.$id}
                                            title={template.title}
                                        />
                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors pointer-events-none" />
                                    </div>

                                    <div className="flex flex-col min-w-0 flex-1 pl-2">
                                        <div className="flex items-center gap-3">
                                            <h3 className="text-lg font-semibold text-gray-900 truncate">
                                                {template.title}
                                            </h3>
                                            {template.tags && template.tags.length > 0 && (
                                                <div className="flex flex-wrap gap-1">
                                                    {template.tags.map((tag) => (
                                                        <span
                                                            key={tag}
                                                            className="inline-block px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium"
                                                        >
                                                            {tag}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-4 mt-1 text-gray-500">
                                            <span className="text-xs font-mono">
                                                ID: {template.$id}
                                            </span>
                                            <span className="text-xs">
                                                {t("Created")}: {formatDate(template.$createdAt)}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => router.push(`/templates/${template.$id}/edit`)}
                                        className="p-2 text-gray-600 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                                        title={t("Edit")}
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                        </svg>
                                    </button>
                                    <button
                                        onClick={() => handleDeleteClick(template)}
                                        className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                        title={t("Delete")}
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <DeleteConfirmationModal
                isOpen={isDeleteModalOpen}
                onClose={() => {
                    setIsDeleteModalOpen(false);
                    setTemplateToDelete(null);
                }}
                onConfirm={handleConfirmDelete}
                templateTitle={templateToDelete?.title || ""}
                t={t}
            />
        </div>
    );
}
