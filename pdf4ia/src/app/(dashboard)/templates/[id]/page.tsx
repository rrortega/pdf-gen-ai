"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useI18n } from "@/hooks/useI18n";

interface Template {
    $id: string;
    name: string;
    description?: string;
    content: string;
    $createdAt: string;
}

export default function ViewTemplatePage() {
    const router = useRouter();
    const params = useParams();
    const { t } = useI18n();
    const [template, setTemplate] = useState<Template | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const templateId = params.id as string;

    useEffect(() => {
        fetchTemplate();
    }, [templateId]);

    const fetchTemplate = async () => {
        try {
            setLoading(true);
            const response = await fetch(`/api/v1/templates/${templateId}`, {
                credentials: "include",
            });

            if (!response.ok) {
                throw new Error("Failed to fetch template");
            }

            const data = await response.json();
            setTemplate(data.template);
        } catch (err) {
            setError(t("Failed to load template"));
            console.error("Error fetching template:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        try {
            setIsDeleting(true);
            const response = await fetch(`/api/v1/templates/${templateId}`, {
                method: "DELETE",
                credentials: "include",
            });

            if (!response.ok) {
                throw new Error("Failed to delete template");
            }

            // Success - redirect to templates list
            router.push("/templates");
        } catch (err) {
            setError(t("Failed to delete template"));
            console.error("Error deleting template:", err);
            setIsDeleting(false);
            setShowDeleteModal(false);
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString();
    };

    const formatJSON = (jsonString: string) => {
        try {
            return JSON.stringify(JSON.parse(jsonString), null, 2);
        } catch (e) {
            return jsonString;
        }
    };

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <div className="text-lg">{t("Loading...")}</div>
            </div>
        );
    }

    if (error && !template) {
        return (
            <div className="min-h-screen bg-gray-50 p-6">
                <div className="max-w-4xl mx-auto">
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                        <p>{error}</p>
                        <button
                            onClick={() => router.push("/templates")}
                            className="mt-2 text-sm underline hover:no-underline"
                        >
                            {t("Back to Templates")}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-4xl mx-auto">
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
                        <h1 className="text-3xl font-bold text-gray-900">{t("Template Details")}</h1>
                        <div className="flex gap-3">
                            <button
                                onClick={() => router.push(`/templates/${templateId}/edit`)}
                                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                                {t("Edit")}
                            </button>
                            <button
                                onClick={() => setShowDeleteModal(true)}
                                className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                                {t("Delete")}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Template Details */}
                {template && (
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-6">
                        {/* Name */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                {t("Name")}
                            </label>
                            <p className="text-lg text-gray-900">{template.name}</p>
                        </div>

                        {/* Description */}
                        {template.description && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    {t("Description")}
                                </label>
                                <p className="text-gray-900">{template.description}</p>
                            </div>
                        )}

                        {/* Created Date */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                {t("Created")}
                            </label>
                            <p className="text-gray-900">{formatDate(template.$createdAt)}</p>
                        </div>

                        {/* Content */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                {t("Content")} (JSON)
                            </label>
                            <pre className="bg-gray-50 border border-gray-300 rounded-lg p-4 overflow-x-auto text-sm font-mono text-gray-900">
                                {formatJSON(template.content)}
                            </pre>
                        </div>
                    </div>
                )}

                {/* Delete Confirmation Modal */}
                {showDeleteModal && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">
                                {t("Delete Template")}
                            </h3>
                            <p className="text-gray-700 mb-2">
                                {t("Are you sure you want to delete this template?")}
                            </p>
                            <p className="text-sm text-gray-500 mb-6">
                                {t("This action cannot be undone.")}
                            </p>
                            <div className="flex gap-3">
                                <button
                                    onClick={handleDelete}
                                    disabled={isDeleting}
                                    className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isDeleting ? t("Loading...") : t("Delete")}
                                </button>
                                <button
                                    onClick={() => setShowDeleteModal(false)}
                                    disabled={isDeleting}
                                    className="flex-1 bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {t("Cancel")}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
