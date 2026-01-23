"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useI18n } from "@/hooks/useI18n";
import { getAppwriteClientSafe, Databases } from "@/lib/appwrite-client";
import { Query } from "appwrite";
import JSZip from "jszip";

export interface Document {
    // ... (rest is same)
    $id: string;
    name: string;
    template_id: string;
    user_id: string;
    status: string;
    pdf_file: string;
    size?: number;
    downloads?: number;
    error_message?: string;
    webhook_callback?: string;
    webhook_response?: string;
    webhook_retry?: number;
    $createdAt: string;
    signature?: string;
}

export interface WebhookLog {
    $id: string;
    document_id: string;
    url: string;
    retry: number;
    response: string | null;
    execution_time: number;
    $createdAt: string;
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

    // Batch Actions State
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [isBatchProcessing, setIsBatchProcessing] = useState(false);
    const [batchType, setBatchType] = useState<'download' | 'delete' | null>(null);
    const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });

    // Track documents being deleted for UX effects
    const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
    // Track documents that should be animated out before removal
    const [animatingOutIds, setAnimatingOutIds] = useState<Set<string>>(new Set());

    // Toggle mobile bottom nav based on selection
    useEffect(() => {
        if (selectedIds.size > 0) {
            window.dispatchEvent(new CustomEvent("hide-bottom-nav"));
        } else {
            window.dispatchEvent(new CustomEvent("show-bottom-nav"));
        }
    }, [selectedIds.size]);

    // Toast state
    const [showNewDocToast, setShowNewDocToast] = useState(false);

    // Webhook Modal State
    const [selectedWebhookDoc, setSelectedWebhookDoc] = useState<Document | null>(null);
    const [webhookLogs, setWebhookLogs] = useState<WebhookLog[]>([]);
    const [loadingLogs, setLoadingLogs] = useState(false);
    const [selectedErrorDoc, setSelectedErrorDoc] = useState<Document | null>(null);

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

                            // Also update selected doc if it matches
                            if (selectedWebhookDoc && selectedWebhookDoc.$id === payload.$id) {
                                setSelectedWebhookDoc({ ...selectedWebhookDoc, ...payload });
                            }
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
    }, [currentUserId, selectedWebhookDoc]);

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

            // If the document is already gone (404), we also count it as success for the UI
            if (res.ok || res.status === 404) {
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
                const data = await res.json().catch(() => ({}));
                // Check for specific error message if it's not a 404 status but contains the error
                if (data.error === "Row with the requested ID could not be found.") {
                    setAnimatingOutIds(prev => new Set(prev).add(id));
                    // ... same logic as success
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
                    return;
                }

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

    // Batch Selection Helpers
    const toggleSelect = (id: string, isDeletingNow: boolean) => {
        if (isDeletingNow || isBatchProcessing) return;
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleSelectAll = () => {
        if (isBatchProcessing) return;
        if (selectedIds.size === filteredDocuments.length) {
            setSelectedIds(new Set());
        } else {
            const selectable = filteredDocuments
                .filter(d => !deletingIds.has(d.$id))
                .map(d => d.$id);
            setSelectedIds(new Set(selectable));
        }
    };

    const handleBatchDelete = async () => {
        if (selectedIds.size === 0 || isBatchProcessing) return;

        setIsBatchProcessing(true);
        setBatchType('delete');
        const idsToDelete = Array.from(selectedIds);
        setBatchProgress({ current: 0, total: idsToDelete.length });

        for (const id of idsToDelete) {
            // Re-use existing handleDelete logic but without confirm modal
            setDeletingIds(prev => new Set(prev).add(id));
            try {
                const res = await fetch(`/api/v1/documents/${id}`, { method: "DELETE" });
                if (res.ok || res.status === 404) {
                    setAnimatingOutIds(prev => new Set(prev).add(id));
                    // Local state removal
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
                    const data = await res.json().catch(() => ({}));
                    if (data.error === "Row with the requested ID could not be found.") {
                        setAnimatingOutIds(prev => new Set(prev).add(id));
                        setTimeout(() => {
                            setDocuments(prev => prev.filter(doc => doc.$id !== id));
                            setAnimatingOutIds(prev => { const next = new Set(prev); next.delete(id); return next; });
                            setDeletingIds(prev => { const next = new Set(prev); next.delete(id); return next; });
                            setTotal(prev => Math.max(0, prev - 1));
                        }, 500);
                    }
                }
            } catch (err) {
                console.error(`Batch delete error for ${id}:`, err);
            }
            setBatchProgress(prev => ({ ...prev, current: prev.current + 1 }));
            setSelectedIds(prev => {
                const next = new Set(prev);
                next.delete(id);
                return next;
            });
        }

        setIsBatchProcessing(false);
        setBatchType(null);

        // Reset to first page and reload to bring fresh data from server
        // Wait a bit for animations to finish
        setTimeout(async () => {
            setCurrentPage(1);
            await fetchDocuments(1);
        }, 600);
    };

    const handleBatchDownload = async () => {
        if (selectedIds.size === 0 || isBatchProcessing) return;

        setIsBatchProcessing(true);
        setBatchType('download');
        const idsToDownload = Array.from(selectedIds);

        try {
            // Direct download if only one item selected
            if (idsToDownload.length === 1) {
                const doc = documents.find(d => d.$id === idsToDownload[0]);
                if (doc && doc.status === 'completed') {
                    handleDownload(doc);
                }
                setSelectedIds(new Set());
                setIsBatchProcessing(false);
                setBatchType(null);
                return;
            }

            // Normal ZIP process for multiple items
            const zip = new JSZip();
            setBatchProgress({ current: 0, total: idsToDownload.length });

            for (const id of idsToDownload) {
                const doc = documents.find(d => d.$id === id);
                if (!doc || doc.status !== 'completed') {
                    setBatchProgress(prev => ({ ...prev, current: prev.current + 1 }));
                    continue;
                }

                const domain = process.env.NEXT_PUBLIC_DOMAIN || process.env.NEXT_PUBLIC_APP_URL || "";
                const url = `${domain}/api/v1/documents/${doc.$id}/download${doc.signature ? `?signature=${doc.signature}` : ''}`;

                const response = await fetch(url);
                if (response.ok) {
                    const blob = await response.blob();
                    zip.file(`${doc.name.replace(/\.[^/.]+$/, "") || "document"}.pdf`, blob);
                }

                setBatchProgress(prev => ({ ...prev, current: prev.current + 1 }));
            }

            const content = await zip.generateAsync({ type: "blob" });
            const zipUrl = URL.createObjectURL(content);
            const link = window.document.createElement("a");
            link.href = zipUrl;
            link.download = `documents_batch_${new Date().getTime()}.zip`;
            window.document.body.appendChild(link);
            link.click();
            window.document.body.removeChild(link);
            URL.revokeObjectURL(zipUrl);

            setSelectedIds(new Set());
        } catch (err) {
            console.error("Batch download error:", err);
            alert(t("Failed to create ZIP file"));
        } finally {
            setIsBatchProcessing(false);
            setBatchType(null);
        }
    };

    // Webhook Logs Fetching
    const openWebhookLogs = async (doc: Document) => {
        setSelectedWebhookDoc(doc);
        setLoadingLogs(true);
        setWebhookLogs([]);

        try {
            const client = getAppwriteClientSafe();
            const databases = new Databases(client);
            const databaseId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || "6968108e00298587f520";
            const webhookCollectionId = process.env.NEXT_PUBLIC_APPWRITE_WEBHOOK_COLLECTION_ID || "webhooks";

            const response = await databases.listDocuments(
                databaseId,
                webhookCollectionId,
                [
                    Query.equal("document_id", doc.$id),
                    Query.orderDesc("$createdAt")
                ]
            );

            // Cast generic document to WebhookLog
            const logs = response.documents.map(d => ({
                $id: d.$id,
                document_id: d.document_id,
                url: d.url,
                retry: d.retry,
                response: d.response,
                execution_time: d.execution_time,
                $createdAt: d.$createdAt
            })) as WebhookLog[];

            setWebhookLogs(logs);

        } catch (err) {
            console.error("Failed to fetch webhook logs", err);
        } finally {
            setLoadingLogs(false);
        }
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
                        <div className="flex items-center gap-4 mt-1">

                            <button
                                onClick={toggleSelectAll}
                                className={`flex items-center border-gray-300 gap-1.5 px-3 py-1 rounded-lg border text-[10px] font-black uppercase tracking-wider transition-all ${selectedIds.size > 0 ? 'bg-gray-900 border-gray-900 text-white' : 'bg-gray-50 border-gray-200 text-gray-400 hover:border-gray-900 hover:text-gray-900'}`}
                            >
                                <div className={`w-3 h-3 rounded border flex items-center justify-center transition-all ${selectedIds.size === filteredDocuments.length && filteredDocuments.length > 0 ? 'bg-white border-white' : 'border-current'}`}>
                                    {selectedIds.size === filteredDocuments.length && filteredDocuments.length > 0 && (
                                        <svg className="w-2 h-2 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" />
                                        </svg>
                                    )}
                                </div>
                                {selectedIds.size === filteredDocuments.length && filteredDocuments.length > 0 ? t("Deselect all in this page") : t("Select all in this page")}
                            </button>
                        </div>
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
                                        onClick={() => toggleSelect(doc.$id, isDeletingNow)}
                                        className={`bg-white rounded-2xl shadow-sm border p-5 transition-all duration-500 flex flex-col md:flex-row md:items-center justify-between group gap-4 relative overflow-hidden ${isExploding ? 'scale-0 opacity-0 blur-xl rotate-12' :
                                            isDeletingNow ? 'opacity-60 bg-gray-50' :
                                                selectedIds.has(doc.$id) ? 'border-gray-900 bg-gray-50 shadow-md ring-2 ring-gray-900/5' :
                                                    'hover:shadow-md hover:border-gray-900 cursor-pointer border-gray-300'
                                            }`}
                                    >
                                        <div className="flex items-center gap-5 min-w-0 flex-1">
                                            {/* Selection Checkbox */}
                                            {!isDeletingNow && (
                                                <div className="flex items-center justify-center">
                                                    <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${selectedIds.has(doc.$id) ? 'bg-gray-900 border-gray-900' : 'bg-white border-gray-200 group-hover:border-gray-400'}`}>
                                                        {selectedIds.has(doc.$id) && (
                                                            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                            </svg>
                                                        )}
                                                    </div>
                                                </div>
                                            )}

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
                                                    <div className="text-[10px] text-gray-400 font-mono tracking-tight mt-0.5 opacity-60">
                                                        ID: {doc.$id}
                                                    </div>
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
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                                            </svg>
                                                            {doc.downloads || 0} {t("downloads")}
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
                                                <div className="flex items-center gap-2">
                                                    <span
                                                        className={`text-[10px] px-2.5 py-1 rounded-full font-black uppercase tracking-wider ${doc.status === 'completed' ? 'bg-green-100 text-green-700 border border-green-200' :
                                                            doc.status === 'failed' ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-amber-100 text-amber-700 border border-amber-200 animate-pulse'
                                                            }`}
                                                        onClick={(e) => {
                                                            if (doc.status === 'failed') {
                                                                e.stopPropagation();
                                                                setSelectedErrorDoc(doc);
                                                            }
                                                        }}
                                                        title={doc.status === 'failed' ? (doc.error_message || t("Click to see error details")) : undefined}
                                                    >
                                                        {t(doc.status)}
                                                    </span>

                                                    {doc.webhook_callback ? (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                openWebhookLogs(doc);
                                                            }}
                                                            className="flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-full font-black uppercase tracking-wider bg-purple-100 text-purple-700 border border-purple-200 hover:bg-purple-200 transition-colors"
                                                        >
                                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                                            </svg>
                                                            {t("Async")}
                                                        </button>
                                                    ) : (
                                                        <span className="flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-full font-black uppercase tracking-wider bg-blue-50 text-blue-600 border border-blue-100/50">
                                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                            </svg>
                                                            {t("Sync")}
                                                        </span>
                                                    )}
                                                </div>
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
                                <p className="text-gray-500 text-sm">
                                    {total} {t("documents in total")}
                                </p>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Confirmation Modal */}
            {
                isDeleting && (
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
                )
            }

            {/* Webhook Logs Modal */}
            {
                selectedWebhookDoc && (
                    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-md animate-in fade-in duration-300">
                        <div className="bg-white rounded-[2rem] shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col transform animate-in zoom-in-95 duration-300 border border-gray-100">

                            {/* Header */}
                            <div className="p-8 border-b border-gray-100 flex items-start justify-between">
                                <div>
                                    <h3 className="text-2xl font-black text-gray-900 mb-2 flex items-center gap-3">
                                        <div className="p-2 bg-purple-100 rounded-lg text-purple-600">
                                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                            </svg>
                                        </div>
                                        {t("Webhook Logs")}
                                    </h3>
                                    <div className="text-gray-500 text-sm">
                                        {t("Delivery logs for document:")} <span className="font-bold text-gray-800">{selectedWebhookDoc?.name}</span>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setSelectedWebhookDoc(null)}
                                    className="p-2 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-all"
                                >
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>

                            {/* Content */}
                            <div className="flex-1 overflow-y-auto p-8 bg-gray-50/50">

                                {/* Callback URL Info */}
                                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm mb-6">
                                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">{t("Callback URL")}</label>
                                    <code className="text-sm text-gray-800 break-all font-mono block bg-gray-50 p-2 rounded-lg border border-gray-100">
                                        {selectedWebhookDoc?.webhook_callback}
                                    </code>
                                </div>

                                {loadingLogs ? (
                                    <div className="flex flex-col items-center justify-center py-12">
                                        <div className="w-10 h-10 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mb-4"></div>
                                        <div className="text-gray-500 font-medium animate-pulse">{t("Loading webhook logs...")}</div>
                                    </div>
                                ) : webhookLogs.length === 0 ? (
                                    <div className="text-center py-12">
                                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400">
                                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                            </svg>
                                        </div>
                                        <h4 className="text-lg font-bold text-gray-900 mb-1">{t("No logs found yet")}</h4>
                                        <p className="text-gray-500 text-sm max-w-xs mx-auto">
                                            {t("Webhook might still be processing or hasn't fired yet.")}
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {webhookLogs.map((log) => (
                                            <div key={log.$id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                                                <div className="p-4 border-b border-gray-50 flex items-center justify-between bg-gray-50/30">
                                                    <div className="flex items-center gap-3">
                                                        <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider border ${(log.response && log.response.includes('success')) || (log.response && log.response.includes('200'))
                                                            ? 'bg-green-50 text-green-700 border-green-200'
                                                            : 'bg-red-50 text-red-700 border-red-200'
                                                            }`}>
                                                            {(log.response && log.response.includes('200')) ? t("Success") : t("Failed")}
                                                        </span>
                                                        <span className="text-xs text-gray-400 font-mono">
                                                            {new Date(log.$createdAt).toLocaleString()}
                                                        </span>
                                                    </div>
                                                    <div className="text-xs font-bold text-gray-500">
                                                        {t("Attempt")}: {log.retry}
                                                    </div>
                                                </div>
                                                <div className="p-4 bg-gray-900 text-gray-300 font-mono text-xs overflow-x-auto">
                                                    <pre className="whitespace-pre-wrap break-all">
                                                        {log.response || t("No response data")}
                                                    </pre>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Footer */}
                            <div className="p-6 border-t border-gray-100 bg-gray-50 rounded-b-[2rem] flex justify-end">
                                <button
                                    onClick={() => setSelectedWebhookDoc(null)}
                                    className="px-6 py-2.5 bg-white border border-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm"
                                >
                                    {t("Close Log")}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Error Diagnostics Modal */}
            {selectedErrorDoc && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setSelectedErrorDoc(null)} />
                    <div className="relative bg-white w-full max-w-2xl rounded-[2rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                        {/* Header */}
                        <div className="p-8 border-b border-gray-100 flex items-start justify-between">
                            <div>
                                <h3 className="text-2xl font-black text-gray-900 mb-2 flex items-center gap-3">
                                    <div className="p-2 bg-red-100 rounded-lg text-red-600">
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                        </svg>
                                    </div>
                                    {t("Error Diagnostics")}
                                </h3>
                                <div className="text-gray-500 text-sm">
                                    {t("Document ID:")} <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded ml-1">{selectedErrorDoc.$id}</span>
                                </div>
                            </div>
                            <button
                                onClick={() => setSelectedErrorDoc(null)}
                                className="p-2 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-all"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-8 bg-gray-50/50">
                            <div className="bg-white p-6 rounded-2xl border border-red-100 shadow-sm">
                                <label className="text-xs font-bold text-red-400 uppercase tracking-widest mb-3 block">{t("Error Message")}</label>
                                <div className="bg-red-50/50 p-4 rounded-xl border border-red-100/50">
                                    <pre className="text-sm text-red-900 break-all font-mono whitespace-pre-wrap leading-relaxed">
                                        {selectedErrorDoc.error_message || t("No direct error message stored in document. Please check webhook logs for async errors.")}
                                    </pre>
                                </div>

                                {selectedErrorDoc.webhook_callback && (
                                    <div className="mt-8 pt-6 border-t border-gray-100">
                                        <p className="text-sm text-gray-500 mb-4">
                                            {t("This document has a webhook configured. Detailed delivery errors might be logged there.")}
                                        </p>
                                        <button
                                            onClick={() => {
                                                const doc = selectedErrorDoc;
                                                setSelectedErrorDoc(null);
                                                openWebhookLogs(doc);
                                            }}
                                            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-700 transition-all shadow-lg shadow-purple-200"
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                            </svg>
                                            {t("View Webhook Logs")}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-6 border-t border-gray-100 bg-gray-50 rounded-b-[2rem] flex justify-end">
                            <button
                                onClick={() => setSelectedErrorDoc(null)}
                                className="px-6 py-2.5 bg-white border border-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm"
                            >
                                {t("Close")}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Batch Floating Action Bar (Compact) */}
            {
                selectedIds.size > 0 && (
                    <div className="fixed bottom-10 left-1/2 transform -translate-x-1/2 z-[80] animate-in slide-in-from-bottom-10 duration-500">
                        <div className="bg-gray-900/95 backdrop-blur-2xl border border-white/10 rounded-2xl p-2.5 shadow-[0_20px_50px_-15px_rgba(0,0,0,0.5)] flex items-center gap-3">
                            <div className="flex items-center gap-3 pl-2.5 border-r border-white/10 pr-4">
                                <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center text-white">
                                    <span className="text-xs font-black">{selectedIds.size}</span>
                                </div>
                                <div className="hidden sm:block">
                                    <div className="text-white font-bold text-[10px] uppercase tracking-widest leading-none">
                                        {t("Selected")}
                                    </div>
                                    {isBatchProcessing && (
                                        <div className="text-[8px] text-gray-400 font-bold uppercase tracking-tighter mt-0.5">
                                            {batchProgress.current}/{batchProgress.total}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center gap-1.5">
                                {isBatchProcessing && batchType === 'download' ? (
                                    <div className="flex items-center gap-3 px-6 py-2 bg-white/5 rounded-xl border border-white/10 ml-2 animate-pulse">
                                        <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                                        <span className="text-[10px] font-black text-white uppercase tracking-widest">{t("Compacting...")}</span>
                                    </div>
                                ) : isBatchProcessing && batchType === 'delete' ? (
                                    <div className="flex flex-col gap-2 min-w-[200px] px-4 animate-in fade-in duration-300">
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="flex items-center gap-2">
                                                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.5)]"></div>
                                                <span className="text-[10px] font-black text-white uppercase tracking-widest">{t("Deleting...")}</span>
                                            </div>
                                            <span className="text-[10px] font-black text-white/40 tracking-widest">
                                                {Math.round((batchProgress.current / batchProgress.total) * 100)}%
                                            </span>
                                        </div>
                                        <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                                            <div
                                                className="h-full bg-gradient-to-r from-red-600 to-red-400 transition-all duration-500 ease-out shadow-[0_0_10px_rgba(239,68,68,0.3)]"
                                                style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }}
                                            />
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <button
                                            onClick={handleBatchDownload}
                                            disabled={isBatchProcessing}
                                            title={t("Download ZIP")}
                                            className="w-11 h-11 bg-white text-gray-900 rounded-xl flex items-center justify-center hover:bg-gray-100 transition-all active:scale-90 disabled:opacity-30 disabled:cursor-not-allowed"
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                            </svg>
                                        </button>
                                        <button
                                            onClick={handleBatchDelete}
                                            disabled={isBatchProcessing}
                                            title={t("Delete All")}
                                            className="w-11 h-11 bg-red-600 text-white rounded-xl flex items-center justify-center hover:bg-red-700 transition-all active:scale-90 disabled:opacity-30 disabled:cursor-not-allowed"
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                        </button>
                                        <div className="w-px h-6 bg-white/10 mx-1" />
                                        <button
                                            onClick={() => setSelectedIds(new Set())}
                                            disabled={isBatchProcessing}
                                            title={t("Cancel")}
                                            className="w-11 h-11 text-white/40 hover:text-white rounded-xl flex items-center justify-center transition-all active:scale-90 disabled:opacity-10"
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                )
            }
        </div>
    );
}
