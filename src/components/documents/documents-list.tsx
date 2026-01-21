"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useI18n } from "@/hooks/useI18n";
import { getAppwriteClientSafe } from "@/lib/appwrite-client";

export interface Document {
    $id: string;
    name: string;
    template_id: string;
    user_id: string;
    status: string;
    pdf_file: string;
    size?: number;
    downloads?: number;
    error_message?: string;
    $createdAt: string;
    signature?: string;
}

interface DocumentsListProps {
    initialDocuments: Document[];
    initialTotal: number;
    currentUserId: string;
    jwt?: string;
}

const ITEMS_PER_PAGE = 10;

export default function DocumentsList({
    initialDocuments,
    initialTotal,
    currentUserId,
    jwt
}: DocumentsListProps) {
    const { t } = useI18n();
    const [documents, setDocuments] = useState<Document[]>(initialDocuments);
    const [total, setTotal] = useState(initialTotal);
    const [currentPage, setCurrentPage] = useState(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [isDeleting, setIsDeleting] = useState(false);
    const [documentToDelete, setDocumentToDelete] = useState<string | null>(null);

    // Track documents being deleted for UX effects
    const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
    // Track documents that should be animated out before removal
    const [animatingOutIds, setAnimatingOutIds] = useState<Set<string>>(new Set());

    // Toast state
    const [showNewDocToast, setShowNewDocToast] = useState(false);

    // Refs to store current state to use in realtime callback
    const pageRef = useRef(currentPage);

    useEffect(() => {
        pageRef.current = currentPage;
    }, [currentPage]);

    // Initialize JWT for client-side realtime if provided
    useEffect(() => {
        if (jwt) {
            const client = getAppwriteClientSafe();
            client.setJWT(jwt);
        }
    }, [jwt]);

    const fetchDocuments = useCallback(async (page: number) => {
        try {
            setLoading(true);
            setError(null);
            const response = await fetch(`/api/v1/documents?page=${page}&limit=${ITEMS_PER_PAGE}`);

            if (!response.ok) {
                throw new Error("Failed to fetch documents");
            }

            const data = await response.json();
            const sortedDocs = (data.documents || []).sort((a: Document, b: Document) =>
                new Date(b.$createdAt).getTime() - new Date(a.$createdAt).getTime()
            );
            setDocuments(sortedDocs);
            setTotal(data.total || 0);
        } catch (err) {
            setError("Failed to load documents");
            console.error("Error fetching documents:", err);
        } finally {
            setLoading(false);
        }
    }, []);

    // Effect to handle pagination changes (except initial load)
    const isFirstRender = useRef(true);
    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            // Don't fetch on first render as we have initial data
            return;
        }
        fetchDocuments(currentPage);
    }, [currentPage, fetchDocuments]);

    // Realtime subscription
    useEffect(() => {
        const unsubscribers: (() => void)[] = [];

        const setupRealtime = async () => {
            if (!currentUserId) return;

            try {
                const client = getAppwriteClientSafe();
                const databaseId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || "6968108e00298587f520";
                const collectionId = process.env.NEXT_PUBLIC_APPWRITE_DOCUMENTS_COLLECTION_ID || "documents";

                if (!databaseId || !collectionId) return;

                const channel = `databases.${databaseId}.collections.${collectionId}.documents`;

                const unsubConcrete = client.subscribe(
                    channel,
                    (response: { events: string[], payload: Document }) => {
                        const event = response.events[0];
                        const payload = response.payload as Document;

                        // Filter by user_id
                        if (payload.user_id !== currentUserId) {
                            return;
                        }

                        if (event?.includes('.create')) {
                            if (pageRef.current === 1) {
                                setDocuments(prev => {
                                    if (prev.find(d => d.$id === payload.$id)) return prev;
                                    const newDocs = [payload, ...prev].sort((a, b) =>
                                        new Date(b.$createdAt).getTime() - new Date(a.$createdAt).getTime()
                                    );
                                    return newDocs.slice(0, ITEMS_PER_PAGE);
                                });
                            } else {
                                setShowNewDocToast(true);
                            }
                            setTotal(prev => prev + 1);
                        } else if (event?.includes('.update')) {
                            setDocuments(prev => prev.map(doc =>
                                doc.$id === payload.$id ? { ...doc, ...payload } : doc
                            ));
                        } else if (event?.includes('.delete')) {
                            setAnimatingOutIds(prev => new Set(prev).add(payload.$id));
                            setTimeout(() => {
                                setDocuments(prev => prev.filter(doc => doc.$id !== payload.$id));
                                setAnimatingOutIds(prev => {
                                    const next = new Set(prev);
                                    next.delete(payload.$id);
                                    return next;
                                });
                                setDeletingIds(prev => {
                                    const next = new Set(prev);
                                    next.delete(payload.$id);
                                    return next;
                                });
                                setTotal(prev => Math.max(0, prev - 1));
                            }, 500);
                        }
                    }
                );
                unsubscribers.push(unsubConcrete);
            } catch (error) {
                console.error('Error setting up realtime:', error);
            }
        };

        setupRealtime();

        return () => {
            unsubscribers.forEach(unsub => unsub());
        };
    }, [currentUserId]);

    const handleGoToFirstPage = () => {
        setCurrentPage(1);
        setShowNewDocToast(false);
        fetchDocuments(1);
    };

    const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

    const filteredDocuments = documents.filter((doc) =>
        doc.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString() + " " + new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const handleDelete = async () => {
        if (!documentToDelete) return;

        const id = documentToDelete;
        setIsDeleting(false);
        setDocumentToDelete(null);
        setDeletingIds(prev => new Set(prev).add(id));

        try {
            const res = await fetch(`/api/v1/documents/${id}`, {
                method: "DELETE",
            });
            if (res.ok) {
                setAnimatingOutIds(prev => new Set(prev).add(id));
                setTimeout(() => {
                    setDocuments(prev => prev.filter(doc => doc.$id !== id));
                    setAnimatingOutIds(prev => {
                        const next = new Set(prev);
                        next.delete(id);
                        return next;
                    });
                    setDeletingIds(prev => {
                        const next = new Set(prev);
                        next.delete(id);
                        return next;
                    });
                    setTotal(prev => Math.max(0, prev - 1));
                }, 500);
            } else {
                setDeletingIds(prev => {
                    const next = new Set(prev);
                    next.delete(id);
                    return next;
                });
                alert(t("Failed to delete document"));
            }
        } catch (error) {
            console.error("Delete error:", error);
            setDeletingIds(prev => {
                const next = new Set(prev);
                next.delete(id);
                return next;
            });
            alert(t("An error occurred"));
        }
    };

    const confirmDelete = (id: string) => {
        setDocumentToDelete(id);
        setIsDeleting(true);
    };

    const handleDownload = (doc: Document) => {
        const domain = process.env.NEXT_PUBLIC_DOMAIN || process.env.NEXT_PUBLIC_APP_URL || "";
        const url = `${domain}/api/v1/documents/${doc.$id}/download${doc.signature ? `?signature=${doc.signature}` : ''}`;
        window.open(url, "_blank");
    };

    return (
        <div className="min-h-screen bg-gray-50 p-6 relative overflow-x-hidden">
            {/* New Document Toast */}
            {showNewDocToast && (
                <div className="fixed top-6 left-1/2 transform -translate-x-1/2 z-[60] animate-in slide-in-from-top-4 duration-300">
                    <div className="bg-gray-900 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-4 border border-white/10 backdrop-blur-md">
                        <div className="flex items-center gap-3">
                            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                            <span className="text-sm font-bold">{t("New document generated!")}</span>
                        </div>
                        <button
                            onClick={handleGoToFirstPage}
                            className="bg-white text-gray-900 px-4 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-gray-100 transition-colors"
                        >
                            {t("View First")}
                        </button>
                        <button
                            onClick={() => setShowNewDocToast(false)}
                            className="text-gray-400 hover:text-white transition-colors"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>
            )}

            <div className="max-w-7xl mx-auto">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">
                            {t("My Documents")}
                        </h1>
                        <p className="text-gray-500 mt-1">
                            {total} {t("documents in total")}
                        </p>
                    </div>

                    <div className="relative w-full md:w-96">
                        <input
                            type="text"
                            placeholder={t("Search documents...")}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full px-4 py-3 pl-12 border border-gray-300 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none text-gray-900 shadow-sm bg-white"
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
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-6 flex items-center gap-3">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {error}
                    </div>
                )}

                {filteredDocuments.length === 0 ? (
                    <div className="text-center py-24 bg-white rounded-2xl border border-dashed border-gray-300 shadow-sm">
                        <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="h-8 w-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 mb-1">{t("No documents found")}</h3>
                        <p className="text-gray-500">{t("Your generated PDFs will appear here in real-time.")}</p>
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-1 gap-4">
                            {filteredDocuments.map((doc) => {
                                const isDeletingNow = deletingIds.has(doc.$id);
                                const isExploding = animatingOutIds.has(doc.$id);

                                return (
                                    <div
                                        key={doc.$id}
                                        className={`bg-white rounded-2xl shadow-sm border border-gray-200 p-5 transition-all duration-500 flex flex-col md:flex-row md:items-center justify-between group gap-4 relative overflow-hidden ${isExploding ? 'scale-0 opacity-0 blur-xl rotate-12' :
                                            isDeletingNow ? 'opacity-60 bg-gray-50' : 'hover:shadow-md hover:border-gray-900 cursor-default'
                                            }`}
                                    >
                                        <div className="flex items-center gap-5 min-w-0 flex-1">
                                            <div className={`p-4 bg-gray-50 text-gray-900 rounded-xl transition-all duration-300 shadow-sm ${isDeletingNow ? 'grayscale opacity-30' : 'group-hover:bg-gray-900 group-hover:text-white'}`}>
                                                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                                </svg>
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <h3 className={`text-xl font-bold text-gray-900 truncate transition-all duration-300 ${isDeletingNow ? 'line-through text-gray-400' : ''}`}>
                                                        {doc.name}
                                                    </h3>
                                                    {!isDeletingNow && (
                                                        <span
                                                            className={`text-[10px] px-2.5 py-0.5 rounded-full font-black uppercase tracking-wider ${doc.status === 'completed' ? 'bg-green-100 text-green-700 border border-green-200' :
                                                                doc.status === 'failed' ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-amber-100 text-amber-700 border border-amber-200 animate-pulse'
                                                                }`}
                                                            title={doc.status === 'failed' && doc.error_message ? doc.error_message : undefined}
                                                        >
                                                            {t(doc.status)}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
                                                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                        </svg>
                                                        {formatDate(doc.$createdAt)}
                                                    </div>
                                                    {doc.size !== undefined && doc.size > 0 && !isDeletingNow && (
                                                        <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium">
                                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                                                            </svg>
                                                            {doc.size} KB
                                                        </div>
                                                    )}
                                                    {doc.downloads !== undefined && !isDeletingNow && (
                                                        <div className="flex items-center gap-1.5 text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md">
                                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                            </svg>
                                                            {doc.downloads} {t("views")}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3 self-end md:self-center h-10">
                                            {isDeletingNow ? (
                                                <div className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-xl font-bold text-xs border border-red-100 animate-pulse">
                                                    <div className="w-3 h-3 border-2 border-red-200 border-t-red-600 rounded-full animate-spin"></div>
                                                    {t("Deleting...")}
                                                </div>
                                            ) : (
                                                <>
                                                    <button
                                                        onClick={() => handleDownload(doc)}
                                                        disabled={doc.status !== 'completed'}
                                                        className="px-4 py-2 text-sm font-bold text-gray-900 border-2 border-gray-100 hover:border-gray-900 hover:bg-gray-900 hover:text-white rounded-xl transition-all flex items-center gap-2 disabled:opacity-20 disabled:cursor-not-allowed disabled:border-gray-100 shadow-sm"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                                        </svg>
                                                        {t("Download")}
                                                    </button>
                                                    <button
                                                        onClick={() => confirmDelete(doc.$id)}
                                                        className="p-2.5 text-gray-400 border-2 border-transparent hover:text-red-600 hover:bg-red-50 hover:border-red-100 rounded-xl transition-all transform hover:scale-110 active:scale-95"
                                                        title={t("Delete")}
                                                    >
                                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                        </svg>
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Pagination UI */}
                        {totalPages > 1 && (
                            <div className="mt-10 flex items-center justify-center gap-2 mb-20 md:mb-2">
                                <button
                                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                    disabled={currentPage === 1 || loading}
                                    className="p-2.5 rounded-xl border border-gray-200 bg-white text-gray-600 hover:border-gray-900 hover:text-gray-900 disabled:opacity-30 transition-all font-bold disabled:cursor-not-allowed shadow-sm"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                    </svg>
                                </button>

                                <div className="flex items-center gap-1.5 px-4 h-10 bg-white rounded-xl border border-gray-200 shadow-sm mx-2">
                                    <span className="text-sm font-black text-gray-900">{currentPage}</span>
                                    <span className="text-xs text-gray-400 font-bold uppercase tracking-tighter">/ {totalPages}</span>
                                </div>

                                <button
                                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                    disabled={currentPage === totalPages || loading}
                                    className="p-2.5 rounded-xl border border-gray-200 bg-white text-gray-600 hover:border-gray-900 hover:text-gray-900 disabled:opacity-30 transition-all font-bold disabled:cursor-not-allowed shadow-sm"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Confirmation Modal */}
            {isDeleting && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl max-w-md w-full p-8 transform animate-in zoom-in-95 duration-300 border border-gray-100">
                        <div className="flex items-center justify-center w-20 h-20 mx-auto bg-red-50 rounded-full mb-6 border-4 border-white shadow-inner">
                            <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                        </div>
                        <h3 className="text-2xl font-black text-center text-gray-900 mb-3">
                            {t("Delete Document")}
                        </h3>
                        <p className="text-center text-gray-500 mb-8 leading-relaxed">
                            {t("Are you sure you want to delete this document? This action cannot be undone and will also remove the file from storage.")}
                        </p>
                        <div className="flex gap-4">
                            <button
                                onClick={() => setIsDeleting(false)}
                                className="flex-1 px-6 py-3.5 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-2xl font-black transition-all"
                            >
                                {t("Cancel")}
                            </button>
                            <button
                                onClick={handleDelete}
                                className="flex-1 px-6 py-3.5 text-white bg-red-600 hover:bg-red-700 rounded-2xl font-black transition-all shadow-xl shadow-red-200 flex items-center justify-center"
                            >
                                {t("Delete")}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
