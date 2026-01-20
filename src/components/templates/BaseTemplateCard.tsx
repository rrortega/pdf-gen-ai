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
            className={`cursor-pointer group flex flex-col gap-3 transition-all ${isSelected ? "scale-105" : "hover:scale-102"
                }`}
        >
            <div
                className={`relative aspect-[3/4] w-full rounded-xl overflow-hidden border-2 transition-all ${isSelected
                        ? "border-gray-900 ring-4 ring-gray-900/20 shadow-lg"
                        : "border-gray-200 group-hover:border-gray-300 group-hover:shadow-md bg-white"
                    }`}
            >
                {templateId ? (
                    <div className="w-full h-full p-3 bg-gray-50 flex items-center justify-center">
                        <div className="w-full h-full bg-white shadow-sm rounded-sm overflow-hidden">
                            <ThumbnailImage templateId={templateId} title={title} />
                        </div>
                    </div>
                ) : (
                    <div className="w-full h-full bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center border border-dashed border-gray-300">
                        <svg
                            className="w-12 h-12 text-gray-400"
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
                    <div className="absolute top-3 right-3 bg-gray-900 text-white rounded-full p-1 shadow-lg">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                )}
            </div>
            <span
                className={`text-sm font-medium text-center truncate px-2 ${isSelected ? "text-gray-900 font-bold" : "text-gray-700 group-hover:text-gray-900"
                    }`}
            >
                {t(title)}
            </span>
        </div>
    );
}
