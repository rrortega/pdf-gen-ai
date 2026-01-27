"use client";

import { useI18n } from "@/hooks/useI18n";

interface DocumentApiDocsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function DocumentApiDocsModal({ isOpen, onClose }: DocumentApiDocsModalProps) {
    const { t } = useI18n();

    if (!isOpen) return null;

    const hostname = typeof window !== 'undefined' ? window.location.origin : 'https://pdf4ia.com';

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black bg-opacity-50 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-0 overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                    <div className="flex items-center gap-3">
                        <div className="bg-gray-900 p-2 rounded-lg text-white">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                            </svg>
                        </div>
                        <h2 className="text-xl font-bold text-gray-900">{t("API Documentation")} - {t("Documents")}</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-200 rounded-lg transition-colors text-gray-500"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto space-y-8">
                    {/* List Documents */}
                    <section>
                        <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 text-xs text-gray-600 font-mono">1</span>
                            {t("List Generated Documents")}
                        </h3>
                        <p className="text-gray-600 text-sm mb-4">
                            {t("Retrieve a paginated list of your generated PDF documents.")}
                        </p>

                        <div className="space-y-4">
                            {/* GET Request */}
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">{t("Endpoint")}</label>
                                <div className="bg-gray-900 rounded-lg p-3 flex items-center justify-between group">
                                    <code className="text-amber-400 text-sm font-mono break-all">
                                        <span className="text-blue-400">GET</span> {hostname}/api/v1/documents
                                    </code>
                                </div>
                            </div>

                            {/* Query Params */}
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">{t("Query Parameters")}</label>
                                <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-gray-50 text-gray-600 font-medium">
                                            <tr>
                                                <th className="px-4 py-3">{t("Parameter")}</th>
                                                <th className="px-4 py-3">{t("Description")}</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            <tr>
                                                <td className="px-4 py-3 font-mono text-xs text-blue-600">page</td>
                                                <td className="px-4 py-3 text-gray-600 text-xs">{t("The page number to retrieve.")}</td>
                                            </tr>
                                            <tr>
                                                <td className="px-4 py-3 font-mono text-xs text-blue-600">limit</td>
                                                <td className="px-4 py-3 text-gray-600 text-xs">{t("Number of items per page (default: 10).")}</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Example Response */}
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">{t("Example Response")}</label>
                                <pre className="bg-gray-900 rounded-xl p-4 overflow-x-auto text-xs text-gray-300 font-mono">
                                    {`{
  "success": true,
  "total": 42,
  "page": 1,
  "limit": 10,
  "documents": [
    {
      "$id": "doc_678a...",
      "name": "January Invoice",
      "status": "completed",
      "pdf_file": "https://...",
      "$createdAt": "2024-01-25T...",
      "data": { "total": 1500, "client": "..." }
    }
  ]
}`}
                                </pre>
                            </div>
                        </div>
                    </section>

                    {/* Authentication Hint */}
                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-3">
                        <div className="text-blue-500 flex-shrink-0">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <div className="text-sm">
                            <h4 className="font-bold text-blue-900 mb-1">{t("Authentication Required")}</h4>
                            <p className="text-blue-700 leading-relaxed">
                                {t("All requests must include a valid Session cookie or an API Key in the Authorization: Bearer <key> header.")}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-end">
                    <button
                        onClick={onClose}
                        className="bg-gray-900 text-white px-6 py-2 rounded-xl hover:bg-gray-950 transition-all font-medium text-sm shadow-md"
                    >
                        {t("Close")}
                    </button>
                </div>
            </div>
        </div>
    );
}
