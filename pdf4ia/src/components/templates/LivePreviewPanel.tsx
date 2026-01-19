"use client";

import { useI18n } from "@/hooks/useI18n";

interface LivePreviewPanelProps {
    pdfUrl: string | null;
    isLoading: boolean;
}

export default function LivePreviewPanel({
    pdfUrl,
    isLoading,
}: LivePreviewPanelProps) {
    const { t } = useI18n();

    return (
        <div className="h-full flex flex-col bg-white border-l border-gray-200">

            {/* Preview Content */}
            <div className="flex-1 relative">
                {isLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-90 z-10">
                        <div className="text-center">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                            <p className="text-gray-600">{t("Generating preview...")}</p>
                        </div>
                    </div>
                )}

                {!pdfUrl && !isLoading && (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-center text-gray-400">
                            <svg className="mx-auto h-16 w-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                            <p className="text-sm">{t("Click Save to generate preview")}</p>
                        </div>
                    </div>
                )}

                {pdfUrl && !isLoading && (
                    <iframe
                        src={pdfUrl}
                        className="w-full h-full"
                        title="PDF Preview"
                    />
                )}
            </div>
        </div>
    );
}
