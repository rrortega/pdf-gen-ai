"use client";

import { useState } from "react";
import { useI18n } from "@/hooks/useI18n";
import TagsInput from "./TagsInput";

interface SimpleTemplateFormProps {
    onSubmit: (data: { title: string; tags: string[] }) => Promise<void>;
    isLoading?: boolean;
}

export default function SimpleTemplateForm({
    onSubmit,
    isLoading = false,
}: SimpleTemplateFormProps) {
    const { t } = useI18n();
    const [formData, setFormData] = useState({
        title: "",
        tags: [] as string[],
    });
    const [errors, setErrors] = useState<Record<string, string>>({});

    const validateForm = () => {
        const newErrors: Record<string, string> = {};

        if (!formData.title.trim()) {
            newErrors.title = t("Title is required");
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validateForm()) {
            return;
        }

        await onSubmit(formData);
    };

    return (
        <form id="template-form" onSubmit={handleSubmit} className="space-y-6">
            {/* Title Input */}
            <div>
                <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                    {t("Template Name")} <span className="text-red-500">*</span>
                </label>
                <input
                    type="text"
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className={`w-full px-4 py-3 border rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none ${errors.title ? "border-red-500" : "border-gray-300"
                        }`}
                    placeholder={t("Enter template name")}
                    disabled={isLoading}
                    autoFocus
                />
                {errors.title && (
                    <p className="mt-1 text-sm text-red-600">{errors.title}</p>
                )}
            </div>

            {/* Tags Input */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t("Tags")} <span className="text-gray-400 text-xs">({t("optional")})</span>
                </label>
                <TagsInput
                    value={formData.tags}
                    onChange={(tags) => setFormData({ ...formData, tags })}
                    placeholder={t("Add tag")}
                    disabled={isLoading}
                />

            </div>
        </form>
    );
}
