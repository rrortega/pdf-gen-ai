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

    const handleGenerate = async () => {
        try {
            setGenerating(true);
            setError(null);
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

    return (
        <div className="p-8 max-w-4xl mx-auto">
            <h1 className="text-3xl font-bold mb-2">{t("API Key configuration")}</h1>
            <p className="text-gray-600 mb-8">
                {t("Use this JWT to authenticate your requests from external APIs.")}
            </p>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-6">
                    <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-blue-600">
                        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                        </svg>
                        {t("Your API Key")}
                    </h2>

                    {loading ? (
                        <div className="h-24 flex items-center justify-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        </div>
                    ) : (
                        <div>
                            {apiKey ? (
                                <div className="space-y-4">
                                    <div className="relative group">
                                        <div className="w-full bg-gray-50 border border-primary rounded-lg p-4 font-mono text-sm break-all pr-12 text-blue-600">
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
                                            onClick={handleGenerate}
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
                                        className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
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

            <div className="mt-12 space-y-8">
                <section>
                    <h3 className="text-xl font-semibold mb-6">{t("How to use")}</h3>

                    <div className="bg-[#1e1e1e] rounded-xl overflow-hidden shadow-xl border border-gray-800">
                        {/* Tab Headers */}
                        <div className="flex border-b border-gray-800 bg-[#252526]">
                            <button
                                onClick={() => setActiveExampleTab("sync")}
                                className={`px-6 py-4 text-sm font-medium transition-colors border-b-2 ${activeExampleTab === "sync"
                                    ? "text-blue-400 border-blue-400 bg-[#1e1e1e]"
                                    : "text-gray-500 border-transparent hover:text-gray-300"
                                    }`}
                            >
                                {t("Synchronous")}
                            </button>
                            <button
                                onClick={() => setActiveExampleTab("async")}
                                className={`px-6 py-4 text-sm font-medium transition-colors border-b-2 ${activeExampleTab === "async"
                                    ? "text-blue-400 border-blue-400 bg-[#1e1e1e]"
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
                                        <pre className="text-xs leading-relaxed text-blue-300">
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
                                            <pre className="text-xs leading-relaxed text-blue-300">
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
                                            <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            {t("Explain webhook")}
                                        </h4>
                                        <p className="text-xs text-gray-400 mb-4 bg-blue-900/20 p-3 rounded border border-blue-900/30">
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
