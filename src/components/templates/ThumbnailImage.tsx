"use client";

interface ThumbnailImageProps {
    templateId: string;
    title: string;
    className?: string;
}

export default function ThumbnailImage({ templateId, title, className = "" }: ThumbnailImageProps) {
    const iframeUrl = `/api/v1/templates/${templateId}/html`;

    return (
        <div className={`w-full h-full relative border border-gray-200 shadow-sm rounded-sm overflow-hidden bg-white ${className}`}>
            <iframe
                src={iframeUrl}
                title={title}
                className="border-0 rounded-sm w-[400%] h-[400%] origin-top-left scale-[0.25] pointer-events-none"
                scrolling="no"
                tabIndex={-1}
            />
        </div>
    );
}
