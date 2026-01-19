"use client";

import { useCallback, useEffect, useState } from "react";
import { useI18n } from "@/hooks/useI18n";
import { getAppwriteClientSafe } from "@/lib/appwrite-client";

interface Document {
    $id: string;
    name: string;
    template_id: string;
    status: string;
    pdf_file: string;
    size?: number;
    downloads?: number;
    error_message?: string;
    $createdAt: string;
}

export default function DocumentsPage() {
    const { t } = useI18n();
    const [documents, setDocuments] = useState<Document[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [isDeleting, setIsDeleting] = useState(false);
    const [documentToDelete, setDocumentToDelete] = useState<string | null>(null);
    const [actionLoading, setActionLoading] = useState(false);

    const fetchDocuments = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await fetch("/api/v1/documents");

            if (!response.ok) {
                throw new Error("Failed to fetch documents");
            }

            const data = await response.json();
            setDocuments(data.documents || []);
        } catch (err) {
            setError(t("Failed to load documents"));
            console.error("Error fetching documents:", err);
        } finally {
            setLoading(false);
        }
    }, [t]);

    useEffect(() => {
        fetchDocuments();
    }, [fetchDocuments]);

    // Realtime subscription
    useEffect(() => {
        const setupRealtime = async () => {
            try {
                // Get session from cookie
                const sessionCookie = document.cookie
                    .split('; ')
                    .find(row => row.startsWith('session='))
                    ?.split('=')[1];

                if (!sessionCookie) {
                    console.warn('No session found for realtime subscription');
                    return;
                }

                const client = getAppwriteClientSafe();
                client.setSession(sessionCookie);

                const unsubscribe = client.subscribe(
                    `databases.6968108e00298587f520.collections.documents.documents`,
                    (response) => {
                        console.log('Realtime event received:', response);
                        const event = response.events[0];
                        const payload = response.payload as Document;

                        if (event?.includes('.create')) {
                            setDocuments(prev => [payload, ...prev]);
                        } else if (event?.includes('.update')) {
                            setDocuments(prev => prev.map(doc =>
                                doc.$id === payload.$id ? payload : doc
                            ));
                        } else if (event?.includes('.delete')) {
                            setDocuments(prev => prev.filter(doc => doc.$id !== payload.$id));
                        }
                    }
                );

                return unsubscribe;
            } catch (error) {
                console.error('Error setting up realtime:', error);
            }
        };

        let unsubscribe: (() => void) | undefined;
        setupRealtime().then(unsub => {
            unsubscribe = unsub;
        });

        return () => {
            if (unsubscribe) {
                unsubscribe();
            }
        };
    }, []);

    const filteredDocuments = documents.filter((doc) =>
        doc.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString() + " " + new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const handleDelete = async () => {
        if (!documentToDelete) return;

        try {
            setActionLoading(true);
            const res = await fetch(`/api/v1/documents/${documentToDelete}`, {
                method: "DELETE",
            });
            if (res.ok) {
                setDocuments(prev => prev.filter(d => d.$id !== documentToDelete));
                setIsDeleting(false);
                setDocumentToDelete(null);
            } else {
                alert(t("Failed to delete document"));
            }
        } catch (err) {
            console.error("Delete error:", err);
            alert(t("An error occurred"));
        } finally {
            setActionLoading(false);
        }
    };

    const confirmDelete = (id: string) => {
        setDocumentToDelete(id);
        setIsDeleting(true);
    };

    const handleDownload = (doc: Document) => {
        // Implement download logic - usually redirecting to a proxy or direct file URL
        window.open(`/api/v1/documents/${doc.$id}/download`, "_blank");
    };

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <div className="ml-3 text-lg text-gray-600">{t("Loading...")}</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-7xl mx-auto">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 mb-6">
                        {t("My Documents")}
                    </h1>

                    <div className="relative">
                        <input
                            type="text"
                            placeholder={t("Search documents...")}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full px-4 py-3 pl-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-gray-900 shadow-sm"
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
                </div>

                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
                        {error}
                    </div>
                )}

                {filteredDocuments.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-xl border border-dashed border-gray-300">
                        <svg className="mx-auto h-12 w-12 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <h3 className="text-lg font-medium text-gray-900">{t("No documents found")}</h3>
                        <p className="text-gray-500">{t("Your generated PDFs will appear here.")}</p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-3">
                        {filteredDocuments.map((doc) => (
                            <div
                                key={doc.$id}
                                className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-all flex items-center justify-between group"
                            >
                                <div className="flex items-center gap-4 min-w-0 flex-1">
                                    <div className="p-3 bg-blue-50 text-blue-600 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                        </svg>
                                    </div>
                                    <div className="min-w-0">
                                        <h3 className="text-lg font-semibold text-gray-900 truncate">
                                            {doc.name}
                                        </h3>
                                        <div className="flex items-center gap-4 mt-0.5">
                                            <span className="text-xs text-gray-500 font-mono">ID: {doc.$id}</span>
                                            <span className="text-xs text-gray-400">{formatDate(doc.$createdAt)}</span>
                                            {doc.size !== undefined && (
                                                <span className="text-xs text-gray-500 font-medium">{doc.size} KB</span>
                                            )}
                                            {doc.downloads !== undefined && (
                                                <span className="flex items-center gap-1 text-xs text-gray-500">
                                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                                    </svg>
                                                    {doc.downloads}
                                                </span>
                                            )}
                                            <span
                                                className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase cursor-help ${doc.status === 'completed' ? 'bg-green-100 text-green-700' :
                                                    doc.status === 'failed' ? 'bg-red-100 text-red-700 border' : 'bg-amber-100 border text-amber-700'
                                                    }`}
                                                title={doc.status === 'failed' && doc.error_message ? doc.error_message : undefined}
                                            >
                                                {t(doc.status)}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 ml-4">
                                    <button
                                        onClick={() => handleDownload(doc)}
                                        disabled={doc.status !== 'completed'}
                                        className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                        title={t("Download")}
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                        </svg>
                                    </button>
                                    <button
                                        onClick={() => confirmDelete(doc.$id)}
                                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all transform hover:scale-110 active:scale-95"
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

            {/* Confirmation Modal */}
            {isDeleting && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 transform animate-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full mb-4">
                            <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                        </div>
                        <h3 className="text-xl font-bold text-center text-gray-900 mb-2">
                            {t("Delete Document")}
                        </h3>
                        <p className="text-center text-gray-500 mb-6">
                            {t("Are you sure you want to delete this document? This action cannot be undone and will also remove the file from storage.")}
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setIsDeleting(false)}
                                className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl font-medium transition-colors"
                                disabled={actionLoading}
                            >
                                {t("Cancel")}
                            </button>
                            <button
                                onClick={handleDelete}
                                className="flex-1 px-4 py-2 text-white bg-red-600 hover:bg-red-700 rounded-xl font-medium transition-all shadow-lg shadow-red-200 flex items-center justify-center disabled:opacity-50"
                                disabled={actionLoading}
                            >
                                {actionLoading ? (
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                ) : (
                                    t("Delete")
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
