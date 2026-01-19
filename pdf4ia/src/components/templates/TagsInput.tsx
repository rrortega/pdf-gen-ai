"use client";

import { useState } from "react";
import { useI18n } from "@/hooks/useI18n";

interface TagsInputProps {
    value: string[];
    onChange: (tags: string[]) => void;
    placeholder?: string;
    disabled?: boolean;
}

export default function TagsInput({
    value,
    onChange,
    placeholder,
    disabled = false,
}: TagsInputProps) {
    const { t } = useI18n();
    const [inputValue, setInputValue] = useState("");

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter" && inputValue.trim()) {
            e.preventDefault();
            if (!value.includes(inputValue.trim())) {
                onChange([...value, inputValue.trim()]);
            }
            setInputValue("");
        } else if (e.key === "Backspace" && !inputValue && value.length > 0) {
            onChange(value.slice(0, -1));
        }
    };

    const removeTag = (tagToRemove: string) => {
        onChange(value.filter((tag) => tag !== tagToRemove));
    };

    return (
        <div className="w-full">
            <div className="flex flex-wrap gap-2 p-3 border border-gray-300 rounded-lg bg-white focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500">
                {value.map((tag) => (
                    <span
                        key={tag}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium"
                    >
                        {tag}
                        {!disabled && (
                            <button
                                type="button"
                                onClick={() => removeTag(tag)}
                                className="hover:bg-blue-200 rounded-full p-0.5 transition-colors"
                            >
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                    <path
                                        fillRule="evenodd"
                                        d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                                        clipRule="evenodd"
                                    />
                                </svg>
                            </button>
                        )}
                    </span>
                ))}
                <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={value.length === 0 ? placeholder || t("Add tag") : ""}
                    disabled={disabled}
                    className="flex-1 min-w-[120px] outline-none text-gray-900 placeholder-gray-400 disabled:bg-gray-50 disabled:cursor-not-allowed"
                />
            </div>
            <p className="mt-1 text-xs text-gray-500">{t("Press Enter to add")}</p>
        </div>
    );
}
