"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { useI18n } from "@/hooks/useI18n";
import EditorTabPanel from "@/components/templates/EditorTabPanel";
import RealPDFViewer from "@/components/templates/RealPDFViewer";

interface Template {
    $id: string;
    name: string;
    description?: string;
    content: string;
    $createdAt: string;
}

export default function EditTemplatePage() {
    const router = useRouter();
    const params = useParams();
    const { t } = useI18n();
    const [template, setTemplate] = useState<Template | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
    const [leftWidth, setLeftWidth] = useState(50); // percentage
    const [isResizing, setIsResizing] = useState(false);
    const [isAutoSaveEnabled, setIsAutoSaveEnabled] = useState(true);
    const [isAutoSaving, setIsAutoSaving] = useState(false);
    const [validationError, setValidationError] = useState<string | null>(null);
    const [showSuccessToast, setShowSuccessToast] = useState(false);
    const [lastSavedData, setLastSavedData] = useState<string>("");
    const [activeTab, setActiveTab] = useState(0);
    const [isInitializing, setIsInitializing] = useState(true);
    const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);

    const handleMouseDown = (e: React.MouseEvent) => {
        setIsResizing(true);
        e.preventDefault();
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isResizing) return;
            const newWidth = (e.clientX / window.innerWidth) * 100;
            if (newWidth > 20 && newWidth < 80) {
                setLeftWidth(newWidth);
            }
        };

        const handleMouseUp = () => {
            setIsResizing(false);
        };

        if (isResizing) {
            window.addEventListener("mousemove", handleMouseMove);
            window.addEventListener("mouseup", handleMouseUp);
        }

        return () => {
            window.removeEventListener("mousemove", handleMouseMove);
            window.removeEventListener("mouseup", handleMouseUp);
        };
    }, [isResizing]);

    const [editorData, setEditorData] = useState({
        title: "",
        tags: [] as string[],
        html: "",
        css: "",
        testData: "{}",
        orientation: "portrait" as "portrait" | "landscape",
        paperSize: "A4",
        margins: {
            top: "20mm",
            right: "20mm",
            bottom: "20mm",
            left: "20mm",
        },
    });

    const templateId = params.id as string;

    useEffect(() => {
        fetchTemplate();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [templateId]);


    // Real-time validation for forbidden tags
    useEffect(() => {
        const forbiddenTags = [/<html>/i, /<head>/i, /<body>/i];
        const foundTag = forbiddenTags.find(tag => tag.test(editorData.html));

        if (foundTag) {
            const tagName = foundTag.source.replace(/\\/g, '').replace(/\//g, '');
            const errorMessage = `${t("Forbidden tag found:")} <${tagName}>. ${t("The template should only contain the content fragment.")}`;

            // Only update if the error message is different
            setError(prev => prev === errorMessage ? prev : errorMessage);
        } else {
            // Only clear if it was a forbidden tag error
            setError(prev => (prev && prev.includes(t("Forbidden tag found:"))) ? null : prev);
        }
    }, [editorData.html, t]);

    // Initialization sequence
    useEffect(() => {
        if (loading) return;

        const runSequence = async () => {
            // Wait 1s on HTML (activeTab 0)
            await new Promise(resolve => setTimeout(resolve, 100));

            // Switch to CSS
            setActiveTab(1);
            await new Promise(resolve => setTimeout(resolve, 200));

            // Switch to DATA
            setActiveTab(2);
            await new Promise(resolve => setTimeout(resolve, 100));

            // Finish initialization
            setIsInitializing(false);
            // Optionally switch back to HTML or stay in DATA? 
            // The prompt says: HTML -> 1s -> CSS -> 1s -> DATA -> 1s -> Preview.
        };

        runSequence();
    }, [loading]);

    // Auto-refresh preview when editor data changes
    useEffect(() => {
        const fetchPreview = async () => {
            if (isInitializing || !editorData.html) return;
            setIsGeneratingPreview(true);
            try {
                const response = await fetch("/api/v1/templates/preview", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        html: editorData.html,
                        css: editorData.css,
                        test_data: editorData.testData,
                        orientation: editorData.orientation,
                        paperSize: editorData.paperSize,
                        margins: editorData.margins,
                    }),
                });

                if (response.ok) {
                    const blob = await response.blob();
                    const url = URL.createObjectURL(blob);

                    // Revoke old URL to prevent memory leaks
                    setPreviewUrl(prev => {
                        if (prev) URL.revokeObjectURL(prev);
                        return url;
                    });
                }
            } catch (error) {
                console.error("Error fetching preview:", error);
            } finally {
                setIsGeneratingPreview(false);
            }
        };

        const timer = setTimeout(() => {
            fetchPreview();
        }, 1000); // Debounce 1 second

        return () => {
            clearTimeout(timer);
        };
    }, [editorData, isInitializing]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (previewUrl) URL.revokeObjectURL(previewUrl);
        };
    }, [previewUrl]);

    const fetchTemplate = useCallback(async () => {
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

            // Parse and set editor data
            try {

                const initialData = {
                    title: data.template.title,
                    tags: data.template.tags || [],
                    html: data.template.html || "",
                    css: data.template.css || "",
                    testData: JSON.stringify(data.template.test_data ?? {}),
                    orientation: data.template.orientation || "portrait",
                    paperSize: data.template.paperSize || "A4",
                    margins: data.template.margins || {
                        top: "20mm",
                        right: "20mm",
                        bottom: "20mm",
                        left: "20mm",
                    },
                };
                setEditorData(initialData);
                setLastSavedData(JSON.stringify(initialData));
            } catch (e) {
                console.error("Error parsing template content:", e);
                setEditorData({
                    title: data.template.title,
                    tags: [],
                    html: `<!-- Handlebars Template -->
<div class="document">
  <h1>{{title}}</h1>
  
  {{#if subtitle}}
  <h2>{{subtitle}}</h2>
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
}`,
                    testData: `{
  "title": "Sample Document",
  "subtitle": "Example"
}`,
                    orientation: "portrait",
                    paperSize: "A4",
                    margins: {
                        top: "20mm",
                        right: "20mm",
                        bottom: "20mm",
                        left: "20mm",
                    },
                });
            }
        } catch (err) {
            setError("Failed to load template");
            console.error("Error fetching template:", err);
        } finally {
            setLoading(false);
        }
    }, [templateId]);

    const handleSave = useCallback(async (silent = false) => {
        try {
            if (silent) setIsAutoSaving(true);

            setError(null);
            setValidationError(null);

            // Validate HTML content (forbidden tags)
            const forbiddenTags = [/<html>/i, /<head>/i, /<body>/i];
            const foundTag = forbiddenTags.find(tag => tag.test(editorData.html));
            if (foundTag) {
                const tagName = foundTag.source.replace(/\\/g, '').replace(/\//g, '');
                throw new Error(`${t("Forbidden tag found:")} <${tagName}>. ${t("The template should only contain the content fragment, as the system automatically wraps it with <html>, <head>, and <body>.")}`);
            }

            // --- Background PDF Validation ---
            const validateResponse = await fetch("/api/v1/templates/validate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    html: editorData.html,
                    css: editorData.css,
                    test_data: editorData.testData,
                    orientation: editorData.orientation,
                    paper_size: editorData.paperSize,
                    margins: editorData.margins,
                }),
            });

            if (!validateResponse.ok) {
                const errorData = await validateResponse.json();
                setValidationError(errorData.error || "Validation failed");
                return; // Stop saving if validation fails
            }
            // ---------------------------------

            const response = await fetch(`/api/v1/templates/${templateId}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                },
                credentials: "include",
                body: JSON.stringify({
                    title: editorData.title,
                    tags: editorData.tags || [],
                    html: editorData.html,
                    css: editorData.css,
                    test_data: editorData.testData,
                    orientation: editorData.orientation,
                    paper_size: editorData.paperSize,
                    margin_top: editorData.margins.top,
                    margin_right: editorData.margins.right,
                    margin_bottom: editorData.margins.bottom,
                    margin_left: editorData.margins.left

                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Failed to update template");
            }

            // Update local lastSavedData
            setLastSavedData(JSON.stringify(editorData));

            if (!silent) {
                setShowSuccessToast(true);
                setTimeout(() => setShowSuccessToast(false), 3000);
                // Only re-fetch full template metadata on manual save
                await fetchTemplate();
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : t("Failed to save template"));
        } finally {
            if (silent) setIsAutoSaving(false);
        }
    }, [editorData, templateId, t, fetchTemplate]);

    useEffect(() => {
        if (!isAutoSaveEnabled || loading) return;

        // Check if data has actually changed
        const isDirty = JSON.stringify(editorData) !== lastSavedData;
        if (!isDirty) return;

        const timer = setTimeout(() => {
            handleSave(true);
        }, 10000); // 10 seconds

        return () => clearTimeout(timer);
    }, [editorData, isAutoSaveEnabled, loading, handleSave, lastSavedData]);

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gray-900">
                <div className="text-lg text-white">{t("Loading...")}</div>
            </div>
        );
    }

    if (error && !template) {
        return (
            <div className="min-h-screen bg-gray-900 p-6">
                <div className="max-w-4xl mx-auto">
                    <div className="bg-red-900/50 border border-red-500 text-red-200 px-4 py-3 rounded-lg">
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

    if (!template) {
        return null;
    }

    return (
        <div className="flex flex-col h-screen bg-gray-900">
            {/* Header */}
            <div className="bg-[#1e1e1e] border-b border-gray-700 px-4 md:px-6 py-2.5 md:py-3 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-2 md:gap-4">
                    <button
                        onClick={() => router.push("/templates")}
                        className="flex items-center gap-1 md:gap-2 text-gray-400 hover:text-white transition-colors"
                        title={t("Back")}
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                        <span className="hidden md:inline">{t("Back")}</span>
                    </button>
                    <div className="h-6 w-px bg-gray-700"></div>
                    <div className="min-w-0">
                        <h1 className="text-sm md:text-lg font-semibold text-white truncate max-w-[150px] md:max-w-none">
                            {editorData.title || t("Untitled Template")}
                        </h1>
                        <p className="text-[10px] md:text-xs text-gray-400 truncate opacity-60">ID: {templateId}</p>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    {/* Manual Save Button - Desktop only, shown when auto-save is off */}
                    {!isAutoSaveEnabled && (
                        <button
                            onClick={() => handleSave(true)}
                            className="hidden md:flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors font-bold text-sm"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                            </svg>
                            {t("Save")}
                        </button>
                    )}

                    {/* Auto-save toggle - Desktop only */}
                    <div className="hidden md:flex items-center gap-3 px-4 py-2 bg-gray-800/50 rounded-xl border border-gray-700">
                        <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${isAutoSaveEnabled ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`}></div>
                            <span className="text-xs font-bold text-gray-300 uppercase tracking-wider">{t("Auto-save")}</span>
                        </div>
                        <button
                            onClick={() => setIsAutoSaveEnabled(!isAutoSaveEnabled)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${isAutoSaveEnabled ? "bg-white" : "bg-gray-700"
                                }`}
                        >
                            <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-gray-900 transition-transform ${isAutoSaveEnabled ? "translate-x-6" : "translate-x-1"
                                    }`}
                            />
                        </button>
                    </div>

                    {isAutoSaving && (
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 rounded-lg border border-gray-700">
                            <span className="animate-spin rounded-full h-3 w-3 border-b-2 border-gray-500"></span>
                            <span className="text-[10px] text-gray-400 font-medium">{t("Saving...")}</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Error Message */}
            {error && (
                <div className="bg-red-900/50 border-b border-red-500 text-red-200 px-6 py-3 flex-shrink-0">
                    {error}
                </div>
            )}

            {/* Main Content - Two Columns */}
            <div className="flex-1 flex overflow-hidden min-h-0 relative">
                {/* Left Panel - Code Editor */}
                <div
                    className="w-full md:border-r md:border-gray-700 flex flex-col min-h-0 overflow-hidden"
                    style={{
                        width: typeof window !== 'undefined' && window.innerWidth < 768 ? '100%' : `${leftWidth}%`
                    }}
                >
                    <EditorTabPanel
                        data={editorData}
                        onChange={setEditorData}
                        activeTab={activeTab}
                        onTabChange={setActiveTab}
                        isLoading={isAutoSaving}
                    />
                </div>

                {/* Resizer Divider - Hidden on mobile */}
                <div
                    onMouseDown={handleMouseDown}
                    className={`hidden md:flex w-[10px] cursor-col-resize flex-shrink-0 hover:bg-gray-500/50 transition-colors z-20 ${isResizing ? 'bg-gray-500' : 'bg-gray-800'}`}
                    title={t("Drag to resize")}
                />

                {/* Right Panel - Preview - Hidden on mobile (shown in modal) */}
                <div
                    style={{ width: `${100 - leftWidth}%` }}
                    className="hidden md:flex bg-gray-800 flex-col min-h-0 relative"
                >
                    {isGeneratingPreview && (
                        <div className="absolute top-4 right-4 z-40 bg-gray-900/80 px-3 py-1.5 rounded-full border border-gray-700 flex items-center gap-2 shadow-lg backdrop-blur-sm">
                            <span className="animate-spin rounded-full h-3 w-3 border-b-2 border-gray-500"></span>
                            <span className="text-[10px] font-medium text-gray-300 uppercase tracking-wider">{t("Refrescando...")}</span>
                        </div>
                    )}
                    {/* Overlay to catch mouse events while resizing (iframes swallow mousemove) */}
                    {isResizing && <div className="absolute inset-0 z-20" />}

                    <div className="flex-1 overflow-hidden">
                        {previewUrl && !isInitializing ? (
                            <RealPDFViewer
                                key={previewUrl}
                                url={previewUrl}
                                title="Template Preview"
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-500">
                                {isInitializing ? t("Cargando vista previa...") : t("Generando vista previa...")}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Floating Toasts */}
            <div className="fixed bottom-6 right-6 z-[60] flex flex-col gap-3 pointer-events-none">
                {/* Mobile Preview FAB */}
                <button
                    onClick={() => setIsPreviewModalOpen(true)}
                    className="md:hidden flex items-center justify-center w-14 h-14 bg-gray-900 text-white rounded-full shadow-2xl pointer-events-auto active:scale-95 transition-transform border border-gray-700 mb-2"
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                </button>

                {validationError && (
                    <div className="bg-red-600 text-white px-5 py-4 rounded-xl shadow-2xl border border-red-500 max-w-sm animate-in slide-in-from-right-full pointer-events-auto">
                        <div className="flex items-start gap-4">
                            <div className="bg-white/20 p-2 rounded-lg shrink-0">
                                <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                            </div>
                            <div className="flex-1 min-w-0">
                                <h4 className="font-bold text-sm mb-1">{t("Error de Validación (PDF Engine)")}</h4>
                                <p className="text-[10px] text-red-500 bg-white/95 p-2 rounded border border-red-200 font-mono overflow-auto max-h-32 mb-2 select-text whitespace-pre-wrap">
                                    {validationError}
                                </p>
                                <button
                                    onClick={() => setValidationError(null)}
                                    className="text-[10px] uppercase tracking-wider font-extrabold text-red-100 hover:text-white transition-colors"
                                >
                                    {t("Dismiss Error")}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {showSuccessToast && (
                    <div className="bg-green-600 text-white px-6 py-4 rounded-xl shadow-2xl border border-green-500 flex items-center gap-4 animate-in slide-in-from-right-full pointer-events-auto">
                        <div className="bg-white/20 p-1.5 rounded-full">
                            <svg className="w-5 h-5 fill-current" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                        </div>
                        <span className="text-sm font-bold tracking-tight">{t("Cambios guardados correctamente")}</span>
                    </div>
                )}
            </div>

            {/* Mobile Preview Modal */}
            {isPreviewModalOpen && (
                <div className="fixed inset-0 z-[100] flex flex-col bg-gray-900 md:hidden animate-in fade-in zoom-in-95 duration-200">
                    <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
                        <h2 className="text-white font-bold">{t("Preview")}</h2>
                        <button
                            onClick={() => setIsPreviewModalOpen(false)}
                            className="p-2 text-gray-400 hover:text-white"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                    <div className="flex-1 overflow-hidden relative">
                        {isGeneratingPreview && (
                            <div className="absolute top-4 right-4 z-40 bg-gray-900/80 px-3 py-1.5 rounded-full border border-gray-700 flex items-center gap-2 shadow-lg backdrop-blur-sm">
                                <span className="animate-spin rounded-full h-3 w-3 border-b-2 border-gray-500"></span>
                                <span className="text-[10px] font-medium text-gray-300 uppercase tracking-wider">{t("Refrescando...")}</span>
                            </div>
                        )}
                        {previewUrl && !isInitializing ? (
                            <RealPDFViewer
                                key={`modal-${previewUrl}`}
                                url={previewUrl}
                                title="Template Preview"
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-500">
                                {isInitializing ? t("Cargando vista previa...") : t("Generando vista previa...")}
                            </div>
                        )}
                    </div>
                    <div className="p-4 border-t border-gray-800 bg-gray-900">
                        <button
                            onClick={() => setIsPreviewModalOpen(false)}
                            className="w-full py-3 bg-gray-800 text-white rounded-xl font-bold active:bg-gray-750"
                        >
                            {t("Close Preview")}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
