"use client";

import { useState, useEffect } from "react";
import { useI18n } from "@/hooks/useI18n";

export default function ApiKeyPage() {
    const { t } = useI18n();
    const [apiKey, setApiKey] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [copied, setCopied] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [confirmText, setConfirmText] = useState("");

    useEffect(() => {
        const fetchApiKey = async () => {
            try {
                setLoading(true);
                const response = await fetch("/api/v1/auth/api-key");
                const data = await response.json();
                if (response.ok) {
                    setApiKey(data.apiKey);
                } else {
                    setError(t(data.error) || t("Failed to fetch API key"));
                }
            } catch (err) {
                console.error(err);
                setError(t("An error occurred while fetching the API key"));
            } finally {
                setLoading(false);
            }
        };

        fetchApiKey();
    }, [t]);

    const handleRegenerateClick = () => {
        setShowConfirmModal(true);
        setConfirmText("");
    };

    const handleGenerate = async () => {
        try {
            setGenerating(true);
            setError(null);
            setShowConfirmModal(false);
            setConfirmText("");
            const response = await fetch("/api/v1/auth/api-key", {
                method: "POST",
            });
            const data = await response.json();
            if (response.ok) {
                setApiKey(data.apiKey);
            } else {
                setError(t(data.error) || t("Failed to generate API key"));
            }
        } catch (err) {
            console.error(err);
            setError(t("An error occurred while generating the API key"));
        } finally {
            setGenerating(false);
        }
    };

    const copyToClipboard = () => {
        if (!apiKey) return;
        navigator.clipboard.writeText(apiKey);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const [activeExampleTab, setActiveExampleTab] = useState<"sync" | "async">("sync");

    const isConfirmTextValid = confirmText.toLowerCase() === "entiendo los riesgos";

    return (
        <div className="p-8 max-w-4xl mx-auto">
            <h1 className="text-3xl font-bold mb-2">{t("API Key configuration")}</h1>
            <p className="text-gray-600 mb-8">
                {t("Use this JWT to authenticate your requests from external APIs.")}
            </p>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-6">
                    <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-900">
                        <svg className="w-5 h-5 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                        </svg>
                        {t("Your API Key")}
                    </h2>

                    {loading ? (
                        <div className="h-24 flex items-center justify-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                        </div>
                    ) : (
                        <div>
                            {apiKey ? (
                                <div className="space-y-4">
                                    <div className="relative group">
                                        <div className="w-full bg-gray-50 border border-primary rounded-lg p-4 font-mono text-sm break-all pr-12 text-gray-900">
                                            {apiKey}
                                        </div>
                                        <button
                                            onClick={copyToClipboard}
                                            className="absolute top-3 right-3 p-3 rounded-md hover:bg-gray-200 hover:border-zinc  transition-colors text-gray-500"
                                            title={t("Copy to clipboard")}
                                        >
                                            {copied ? (
                                                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                </svg>
                                            ) : (
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m-3 3h3" />
                                                </svg>
                                            )}
                                        </button>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <p className="text-sm text-gray-500 italic">
                                            {t("Warning: Never share your API key. Anyone with this key can access your templates and documents.")}
                                        </p>
                                        <button
                                            onClick={handleRegenerateClick}
                                            disabled={generating}
                                            className="px-4 py-2 w-[150px] border border-red bg-red-50 text-red-600 text-sm font-medium rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50"
                                        >
                                            {generating ? t("Generating...") : t("Regenerate Key")}
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-8">
                                    <p className="text-gray-500 mb-6">{t("You haven't generated an API key yet.")}</p>
                                    <button
                                        onClick={handleGenerate}
                                        disabled={generating}
                                        className="px-6 py-2 bg-gray-900 text-white font-medium rounded-lg hover:bg-gray-950 transition-colors disabled:opacity-50"
                                    >
                                        {generating ? t("Generating...") : t("Generate API Key")}
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                    {error && (
                        <div className="mt-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">
                            {error}
                        </div>
                    )}
                </div>
            </div>

            {/* Confirmation Modal */}
            {showConfirmModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
                        <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                            </div>
                            <div className="flex-1">
                                <h3 className="text-lg font-semibold text-gray-900 mb-1">
                                    ⚠️ Advertencia: Regenerar API Key
                                </h3>
                                <p className="text-sm text-gray-600">
                                    Esta acción es irreversible y tendrá las siguientes consecuencias:
                                </p>
                            </div>
                        </div>

                        <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-2">
                            <p className="text-sm font-semibold text-red-900">
                                🔌 Desconexión inmediata:
                            </p>
                            <ul className="text-sm text-red-800 space-y-1 ml-4 list-disc">
                                <li>Todos los servidores MCP (Claude Desktop, VS Code, etc.) se desconectarán</li>
                                <li>Todas las integraciones REST API dejarán de funcionar</li>
                                <li>Las integraciones OAuth (ChatGPT Custom GPTs) perderán acceso</li>
                                <li>Cualquier aplicación que use tu API Key actual fallará</li>
                            </ul>
                        </div>

                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-gray-700">
                                Para confirmar, escribe: <span className="font-mono text-red-600">entiendo los riesgos</span>
                            </label>
                            <input
                                type="text"
                                value={confirmText}
                                onChange={(e) => setConfirmText(e.target.value)}
                                placeholder="entiendo los riesgos"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                                autoFocus
                            />
                        </div>

                        <div className="flex gap-3 pt-2">
                            <button
                                onClick={() => {
                                    setShowConfirmModal(false);
                                    setConfirmText("");
                                }}
                                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleGenerate}
                                disabled={!isConfirmTextValid || generating}
                                className="flex-1 px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {generating ? "Regenerando..." : "Regenerar API Key"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="mt-12 space-y-8">
                <section>
                    <h3 className="text-xl font-semibold mb-6">{t("How to use")}</h3>

                    <div className="bg-[#1e1e1e] rounded-xl overflow-hidden shadow-xl border border-gray-800">
                        {/* Tab Headers */}
                        <div className="flex border-b border-gray-800 bg-[#252526]">
                            <button
                                onClick={() => setActiveExampleTab("sync")}
                                className={`px-6 py-4 text-sm font-medium transition-colors border-b-2 ${activeExampleTab === "sync"
                                    ? "text-gray-700 border-gray-700 bg-[#1e1e1e]"
                                    : "text-gray-500 border-transparent hover:text-gray-300"
                                    }`}
                            >
                                {t("Synchronous")}
                            </button>
                            <button
                                onClick={() => setActiveExampleTab("async")}
                                className={`px-6 py-4 text-sm font-medium transition-colors border-b-2 ${activeExampleTab === "async"
                                    ? "text-gray-700 border-gray-700 bg-[#1e1e1e]"
                                    : "text-gray-500 border-transparent hover:text-gray-300"
                                    }`}
                            >
                                {t("Asynchronous")}
                            </button>
                        </div>

                        {/* Tab Content */}
                        <div className="p-6 text-gray-300">
                            {activeExampleTab === "sync" ? (
                                <div className="space-y-4">
                                    <p className="text-sm">
                                        {t("Send a request to generate a PDF and wait for the response binary data.")}
                                    </p>
                                    <div className="bg-[#2d2d30] p-4 rounded-lg overflow-x-auto border border-gray-700">
                                        <pre className="text-xs leading-relaxed text-gray-300">
                                            <code>{`curl -X POST "https://PDFGenAI.com/api/v1/documents" \\
  -H "Authorization: Bearer ${apiKey || "YOUR_API_KEY"}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "template_id": "696810c9003666d62326",
    "name": "Invoice_#123",
    "data": {
      "customer_name": "John Doe",
      "items": [
        { "description": "Consulting", "price": 100 }
      ]
    }
  }'`}</code>
                                        </pre>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    <div className="space-y-2">
                                        <p className="text-sm">
                                            {t("Send a request to generate a PDF in the background and get notified via webhook.")}
                                        </p>
                                        <div className="bg-[#2d2d30] p-4 rounded-lg overflow-x-auto border border-gray-700">
                                            <pre className="text-xs leading-relaxed text-gray-300">
                                                <code>{`curl -X POST "https://PDFGenAI.com/api/v1/documents" \\
  -H "Authorization: Bearer ${apiKey || "YOUR_API_KEY"}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "template_id": "696810c9003666d62326",
    "name": "Invoice_#123",
    "data": { "customer_name": "John Doe" },
    "webhook_callback": "https://your-api.com/webhooks/PDFGenAI"
  }'`}</code>
                                            </pre>
                                        </div>
                                    </div>

                                    <div className="pt-4 border-t border-gray-800">
                                        <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                                            <svg className="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            {t("Explain webhook")}
                                        </h4>
                                        <p className="text-xs text-gray-400 mb-4 bg-black/20 p-3 rounded border border-black/30">
                                            {t("The webhook callback URL will receive a POST request when the document generation is complete.")}
                                        </p>

                                        <h5 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
                                            {t("Webhook Payload Structure")}
                                        </h5>
                                        <div className="bg-[#2d2d30] p-4 rounded-lg border border-gray-700">
                                            <pre className="text-xs leading-relaxed text-green-400">
                                                <code>{`{
  "documentId": "6968...123",
  "status": "completed",
  "pdfUrl": "https://aw.chamba.pro/v1/storage/buckets/pdfs/...",
  "name": "Invoice_#123",
  "templateId": "696810c9003666d62326"
}`}</code>
                                            </pre>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>


                </section>
            </div>
        </div>
    );
}
