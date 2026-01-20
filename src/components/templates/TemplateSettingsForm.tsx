"use client";

import { useState } from "react";
import { useI18n } from "@/hooks/useI18n";

interface TemplateSettingsFormProps {
    data: {
        title: string;
        tags: string[];
        orientation: "portrait" | "landscape";
        paperSize: string;
        margins: {
            top: string;
            right: string;
            bottom: string;
            left: string;
        };
    };
    onChange: (data: Partial<TemplateSettingsFormProps["data"]>) => void;
}

export default function TemplateSettingsForm({ data, onChange }: TemplateSettingsFormProps) {
    const { t } = useI18n();
    const [formData, setFormData] = useState(data);

    const handleChange = (field: keyof TemplateSettingsFormProps["data"], value: string | string[]) => {
        const newData = { ...formData, [field]: value };
        setFormData(newData);
        onChange({ [field]: value });
    };

    const handleMarginChange = (margin: string, value: string) => {
        const newMargins = {
            ...formData.margins,
            [margin]: value
        };
        const newData = {
            ...formData,
            margins: newMargins
        };
        setFormData(newData);
        onChange({ margins: newMargins });
    };

    const paperSizes = ["A0", "A1", "A2", "A3", "A4", "A5", "A6", "Letter"];

    return (
        <div className="p-6 bg-[#1e1e1e] text-gray-300 h-full overflow-y-auto w-full">
            <div className="max-w-2xl mx-auto">
                <h2 className="text-xl font-semibold mb-6 text-white text-center">{t("Template Settings")}</h2>

                <div className="space-y-6">
                    {/* Title */}
                    <div>
                        <label className="block text-sm font-medium mb-1">{t("Title")}</label>
                        <input
                            type="text"
                            value={formData.title}
                            onChange={(e) => handleChange("title", e.target.value)}
                            className="w-full h-10 bg-[#2d2d30] border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-gray-500"
                        />
                    </div>

                    {/* Tags */}
                    <div>
                        <label className="block text-sm font-medium mb-1">{t("Tags (comma separated)")}</label>
                        <input
                            type="text"
                            value={formData.tags.join(", ")}
                            onChange={(e) => {
                                const tags = e.target.value
                                    .split(",")
                                    .map(t => t.trim().replace(/\s+/g, "")) // Remove all spaces within tags
                                    .filter(Boolean);
                                handleChange("tags", tags);
                            }}
                            className="w-full h-10 bg-[#2d2d30] border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-gray-500"
                            placeholder="invoice, internal, personal"
                        />
                        <p className="text-xs text-gray-500 mt-1">{t("Each tag must be a single word without spaces")}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                        {/* Orientation */}
                        <div>
                            <label className="block text-sm font-medium mb-1">{t("Orientation")}</label>
                            <select
                                value={formData.orientation}
                                onChange={(e) => handleChange("orientation", e.target.value)}
                                className="w-full h-10 bg-[#2d2d30] border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-gray-500"
                            >
                                <option value="portrait">{t("Portrait")}</option>
                                <option value="landscape">{t("Landscape")}</option>
                            </select>
                        </div>

                        {/* Paper Size */}
                        <div>
                            <label className="block text-sm font-medium mb-1">{t("Paper Size")}</label>
                            <select
                                value={formData.paperSize}
                                onChange={(e) => handleChange("paperSize", e.target.value)}
                                className="w-full h-10 bg-[#2d2d30] border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-gray-500"
                            >
                                {paperSizes.map(size => (
                                    <option key={size} value={size}>{size}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Margins */}
                    <div>
                        <label className="block text-sm font-medium mb-3">{t("Margins")}</label>
                        <div className="grid grid-cols-4 gap-4">
                            <div>
                                <label className="block text-xs text-gray-500 mb-1">{t("Top")}</label>
                                <input
                                    type="text"
                                    value={formData.margins.top}
                                    onChange={(e) => handleMarginChange("top", e.target.value)}
                                    className="w-full h-10 bg-[#2d2d30] border border-gray-700 rounded px-2 py-1 text-white text-sm focus:outline-none focus:border-gray-500"
                                    placeholder="20px"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-500 mb-1">{t("Right")}</label>
                                <input
                                    type="text"
                                    value={formData.margins.right}
                                    onChange={(e) => handleMarginChange("right", e.target.value)}
                                    className="w-full h-10 bg-[#2d2d30] border border-gray-700 rounded px-2 py-1 text-white text-sm focus:outline-none focus:border-gray-500"
                                    placeholder="20px"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-500 mb-1">{t("Bottom")}</label>
                                <input
                                    type="text"
                                    value={formData.margins.bottom}
                                    onChange={(e) => handleMarginChange("bottom", e.target.value)}
                                    className="w-full h-10 bg-[#2d2d30] border border-gray-700 rounded px-2 py-1 text-white text-sm focus:outline-none focus:border-gray-500"
                                    placeholder="20px"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-500 mb-1">{t("Left")}</label>
                                <input
                                    type="text"
                                    value={formData.margins.left}
                                    onChange={(e) => handleMarginChange("left", e.target.value)}
                                    className="w-full h-10 bg-[#2d2d30] border border-gray-700 rounded px-2 py-1 text-white text-sm focus:outline-none focus:border-gray-500"
                                    placeholder="20px"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
