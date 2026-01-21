"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/hooks/useI18n";
import ThumbnailImage from "@/components/templates/ThumbnailImage";
import IntegrationModal from "@/components/templates/IntegrationModal";

export interface Template {
    $id: string;
    title: string;
    tags: string[];
    css?: string;
    html?: string;
    test_data?: Record<string, unknown>;
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

interface TemplatesListProps {
    initialTemplates: Template[];
}

export default function TemplatesList({ initialTemplates }: TemplatesListProps) {
    const router = useRouter();
    const { t } = useI18n();
    const [templates, setTemplates] = useState<Template[]>(initialTemplates);
    // Since we provide initial templates, we don't need initial loading state
    // BUT if we want to support re-fetching/refreshing, we can keep fetch logic.
    // However, for simplicity and "App-like" feel, we rely on Server Actions or router.refresh() for updates.
    // But existing code used client-side fetch.
    // I will keep client-side fetch as fallback or for "Create/Delete" updates?
    // Actually, delete logic refetches.
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [templateToDelete, setTemplateToDelete] = useState<Template | null>(null);
    const [templateForIntegration, setTemplateForIntegration] = useState<Template | null>(null);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [isIntegrationModalOpen, setIsIntegrationModalOpen] = useState(false);
    const [fetchingIntegrationId, setFetchingIntegrationId] = useState<string | null>(null);

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
            setError("Failed to load templates");
            console.error("Error fetching templates:", err);
        } finally {
            setLoading(false);
        }
    }, []);

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

    const handleDeleteClick = (template: Template) => {
        setTemplateToDelete(template);
        setIsDeleteModalOpen(true);
    };

    const handleIntegrationClick = async (template: Template) => {
        try {
            setFetchingIntegrationId(template.$id);
            const response = await fetch(`/api/v1/templates/${template.$id}`);
            if (!response.ok) throw new Error("Failed to fetch template details");

            const data = await response.json();
            setTemplateForIntegration(data.template);
            setIsIntegrationModalOpen(true);
        } catch (err) {
            console.error("Error fetching template details:", err);
            alert(t("Failed to load template details"));
        } finally {
            setFetchingIntegrationId(null);
        }
    };

    const handleConfirmDelete = async () => {
        if (!templateToDelete) return;

        try {
            const res = await fetch(`/api/v1/templates/${templateToDelete.$id}`, {
                method: "DELETE",
            });
            if (res.ok) {
                // Refresh list
                fetchTemplates();
                // Or locally filter: setTemplates(prev => prev.filter(t => t.$id !== templateToDelete.$id));
                // fetchTemplates is better to ensure sync, but Router.refresh() is even better if using Server Component.
                // But since we are inside Client Component with local state 'templates', we must update local state.
                // Re-fetching ensures truth.
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
                            className="bg-gray-900 text-white transition-colors shadow-lg z-30 fixed bottom-20 right-6 md:static md:bottom-auto md:right-auto md:shadow-none md:flex md:items-center md:gap-2 md:px-4 md:py-2 md:rounded-lg hover:bg-gray-950 w-14 h-14 md:w-auto md:h-auto rounded-full md:rounded-lg flex items-center justify-center"
                        >
                            <svg className="w-6 h-6 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            <span className="hidden md:inline">{t("Create New Template")}</span>
                        </button>
                    </div>

                    {/* Search Bar */}
                    <div className="relative mb-4">
                        <input
                            type="text"
                            placeholder={t("Search templates...")}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full px-4 py-3 pl-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500 outline-none text-gray-900"
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
                                        ? "bg-gray-900 text-white"
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

                {/* Templates List */}
                {loading ? (
                    <div className="grid grid-cols-1 md:flex md:flex-col gap-4">
                        {[...Array(8)].map((_, i) => (
                            <div
                                key={i}
                                className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex flex-col md:flex-row md:items-center justify-between"
                            >
                                <div className="flex items-center gap-4 flex-1 min-w-0 md:pr-4">
                                    {/* Thumbnail Skeleton */}
                                    <div className="w-20 h-28 md:w-24 md:h-32 bg-gray-100 rounded animate-pulse flex-shrink-0" />

                                    <div className="flex flex-col min-w-0 flex-1 pl-2 space-y-3">
                                        {/* Title Skeleton */}
                                        <div className="h-6 bg-gray-100 rounded w-1/2 animate-pulse" />

                                        {/* Tags Skeleton */}
                                        <div className="flex gap-2">
                                            <div className="h-5 bg-gray-100 rounded w-16 animate-pulse" />
                                            <div className="h-5 bg-gray-100 rounded w-16 animate-pulse" />
                                        </div>

                                        {/* ID and Date Skeleton */}
                                        <div className="hidden md:flex gap-4 mt-1">
                                            <div className="h-4 bg-gray-100 rounded w-32 animate-pulse" />
                                            <div className="h-4 bg-gray-100 rounded w-32 animate-pulse" />
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 mt-4 md:mt-0 pt-4 md:pt-0 border-t border-gray-100 md:border-t-0">
                                    <div className="flex-1 md:w-9 h-10 md:h-9 bg-gray-100 rounded-lg animate-pulse" />
                                    <div className="flex-1 md:w-9 h-10 md:h-9 bg-gray-100 rounded-lg animate-pulse" />
                                    <div className="flex-1 md:w-9 h-10 md:h-9 bg-gray-100 rounded-lg animate-pulse" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : filteredTemplates.length === 0 ? (
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
                                className="mt-4 inline-flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-950 transition-colors"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                {t("Create New Template")}
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:flex md:flex-col gap-4 ">
                        {filteredTemplates.map((template) => (
                            <div
                                key={template.$id}
                                className="bg-white rounded-xl shadow-md border border-gray-200 p-4 hover:shadow-md hover:border-gray-900 transition-all flex flex-col md:flex-row md:items-center justify-between group"
                            >
                                <div className="flex items-center gap-4 flex-1 min-w-0 md:pr-4">
                                    {/* Template Thumbnail */}
                                    <div className="relative w-20 h-28 md:w-24 md:h-32 flex-shrink-0 bg-gray-100 rounded lg border border-gray-200 overflow-hidden shadow-sm group-hover:scale-105 transition-transform duration-300 origin-left z-10 transition-all flex items-center justify-center">
                                        <ThumbnailImage
                                            templateId={template.$id}
                                            title={template.title}
                                        />
                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors pointer-events-none" />
                                    </div>

                                    <div className="flex flex-col min-w-0 flex-1 pl-2">
                                        <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-3">
                                            <h3 className="text-lg font-bold text-gray-900 truncate">
                                                {template.title}
                                            </h3>
                                            {template.tags && template.tags.length > 0 && (
                                                <div className="flex flex-wrap gap-1">
                                                    {template.tags.map((tag) => (
                                                        <span
                                                            key={tag}
                                                            className="inline-block px-2 py-0.5 bg-gray-100 text-gray-950 rounded text-[10px] md:text-xs font-medium uppercase tracking-wider"
                                                        >
                                                            {tag}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-4 mt-2 md:mt-1 text-gray-500">
                                            <span className="text-[10px] md:text-xs font-mono opacity-60">
                                                ID: {template.$id}
                                            </span>
                                            <span className="text-[10px] md:text-xs">
                                                {t("Created")}: {formatDate(template.$createdAt)}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-col xs:flex-row md:flex-row items-stretch md:items-center gap-2 mt-4 md:mt-0 pt-4 md:pt-0 border-t border-gray-100 md:border-t-0">
                                    <button
                                        onClick={() => handleIntegrationClick(template)}
                                        disabled={fetchingIntegrationId === template.$id}
                                        className={`flex items-center justify-center gap-2 px-3 py-2 md:p-2 border rounded-lg transition-colors text-sm font-medium ${fetchingIntegrationId === template.$id
                                            ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                                            : "text-gray-600 hover:text-gray-900 hover:bg-gray-50 bg-gray-50 md:bg-transparent"
                                            }`}
                                    >
                                        {fetchingIntegrationId === template.$id ? (
                                            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                        ) : (
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                                            </svg>
                                        )}
                                        <span className="md:hidden">{t("Integration")}</span>
                                    </button>
                                    <button
                                        onClick={() => router.push(`/templates/${template.$id}/edit`)}
                                        className="flex items-center justify-center gap-2 px-3 py-2 border  md:p-2 text-gray-600 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors bg-amber-50/50 md:bg-transparent text-sm font-medium"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                        </svg>
                                        <span className="md:hidden">{t("Edit")}</span>
                                    </button>
                                    <button
                                        onClick={() => handleDeleteClick(template)}
                                        className="flex items-center justify-center gap-2 px-3  border py-2 md:p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors bg-red-50/50 md:bg-transparent text-sm font-medium"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                        <span className="md:hidden">{t("Delete")}</span>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

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

                <IntegrationModal
                    isOpen={isIntegrationModalOpen}
                    onClose={() => {
                        setIsIntegrationModalOpen(false);
                        setTemplateForIntegration(null);
                    }}
                    templateId={templateForIntegration?.$id || ""}
                    templateTitle={templateForIntegration?.title || ""}
                    testData={(templateForIntegration?.test_data as Record<string, unknown>) || {}}
                />
            </div>
        </div>
    );
}
