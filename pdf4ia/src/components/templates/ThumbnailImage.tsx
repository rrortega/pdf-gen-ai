"use client";

import { useState } from "react";

interface ThumbnailImageProps {
    templateId: string;
    title: string;
    className?: string;
}

export default function ThumbnailImage({ templateId, title, className = "" }: ThumbnailImageProps) {
    const [hasError, setHasError] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    const imageUrl = `/api/v1/templates/${templateId}/thumbnail`;
    const fallbackUrl = `/api/v1/templates/${templateId}/html`;

    return (
        <div className={`w-full h-full relative border border-gray-200 shadow-sm rounded-sm overflow-hidden bg-white ${className}`}>
            {!hasError ? (
                <>
                    {isLoading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
                            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                        </div>
                    )}
                    <img
                        src={imageUrl}
                        alt={title}
                        className={`w-full h-full object-cover transition-opacity duration-300 ${isLoading ? 'opacity-0' : 'opacity-100'}`}
                        onLoad={() => setIsLoading(false)}
                        onError={() => {
                            setHasError(true);
                            setIsLoading(false);
                        }}
                    />
                </>
            ) : (
                <div className="w-full h-full overflow-hidden pointer-events-none select-none bg-white">
                    <iframe
                        src={fallbackUrl}
                        className="border-0 rounded-sm w-[400%] h-[400%] origin-top-left scale-[0.25]"
                        scrolling="no"
                        tabIndex={-1}
                    />
                </div>
            )}
        </div>
    );
}
