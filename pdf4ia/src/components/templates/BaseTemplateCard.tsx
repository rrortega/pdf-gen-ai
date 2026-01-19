"use client";

import { useI18n } from "@/hooks/useI18n";
import ThumbnailImage from "./ThumbnailImage";

interface BaseTemplateCardProps {
    templateId?: string; // If undefined, it's the "Blank Sheet"
    title: string;
    isSelected: boolean;
    onSelect: () => void;
}

export default function BaseTemplateCard({
    templateId,
    title,
    isSelected,
    onSelect,
}: BaseTemplateCardProps) {
    const { t } = useI18n();

    return (
        <div
            onClick={onSelect}
            className={`cursor-pointer group flex flex-col gap-2 transition-all ${isSelected ? "scale-105" : "hover:scale-102"
                }`}
        >
            <div
                className={`relative aspect-[3/4] w-32 rounded-lg overflow-hidden border-2 transition-all shadow-sm ${isSelected
                    ? "border-blue-600 ring-2 ring-blue-600/20 shadow-md"
                    : "border-transparent group-hover:border-gray-300 bg-white"
                    }`}
            >
                {templateId ? (
                    <ThumbnailImage templateId={templateId} title={title} />
                ) : (
                    <div className="w-full h-full bg-white flex items-center justify-center border border-dashed border-gray-300">
                        <svg
                            className="w-8 h-8 text-gray-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 4v16m8-8H4"
                            />
                        </svg>
                    </div>
                )}
                {isSelected && (
                    <div className="absolute top-2 right-2 bg-blue-600 text-white rounded-full p-0.5 shadow-sm">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                )}
            </div>
            <span
                className={`text-xs font-medium text-center truncate w-32 ${isSelected ? "text-blue-600 font-bold" : "text-gray-600"
                    }`}
            >
                {t(title)}
            </span>
        </div>
    );
}
