"use client";

import { useState } from "react";

interface RealPDFViewerProps {
    url: string;
    title?: string;
    className?: string;
}

export default function RealPDFViewer({ url, title = "PDF Preview", className = "" }: RealPDFViewerProps) {
    const [useFallback, setUseFallback] = useState(false);

    // We can use the 'key' prop on this component from the parent to reset state when URL changes.

    // Construct the URL with browser PDF parameters
    // #toolbar=1 enables the standard PDF toolbar (zoom, search, etc.)
    const viewerUrl = `${url}#toolbar=1&navpanes=0&scrollbar=1`;

    if (useFallback) {
        return (
            <iframe
                src={viewerUrl}
                className={`w-full h-full border-0 bg-gray-800 ${className}`}
                title={title}
            />
        );
    }

    return (
        <div className={`w-full h-full relative bg-gray-800 ${className}`}>
            <object
                data={viewerUrl}
                type="application/pdf"
                className="w-full h-full border-0"
                onError={() => setUseFallback(true)}
            >
                {/* Fallback internal to object if it's not supported at all */}
                <iframe
                    src={viewerUrl}
                    className="w-full h-full border-0"
                    title={title}
                />
            </object>
        </div>
    );
}
