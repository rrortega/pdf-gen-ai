"use client";

import { useI18n } from "@/hooks/useI18n";

interface LanguageSwitcherProps {
    variant?: "default" | "sidebar";
}

export default function LanguageSwitcher({ variant = "default" }: LanguageSwitcherProps) {
    const { locale, setLocale } = useI18n();

    if (variant === "sidebar") {
        return (
            <div className="flex w-full rounded-md overflow-hidden border border-blue-500">
                <button
                    onClick={() => setLocale("en")}
                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium transition-colors ${locale === "en"
                            ? "bg-white text-blue-600"
                            : "bg-blue-700 text-white hover:bg-blue-600"
                        }`}
                >
                    <span className="text-base">🇺🇸</span>
                    <span>EN</span>
                </button>
                <button
                    onClick={() => setLocale("es")}
                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium transition-colors ${locale === "es"
                            ? "bg-white text-blue-600"
                            : "bg-blue-700 text-white hover:bg-blue-600"
                        }`}
                >
                    <span className="text-base">🇪🇸</span>
                    <span>ES</span>
                </button>
            </div>
        );
    }

    return (
        <div className="flex items-center space-x-2">
            <button
                onClick={() => setLocale("en")}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${locale === "en"
                        ? "bg-blue-600 text-white"
                        : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                    }`}
            >
                EN
            </button>
            <button
                onClick={() => setLocale("es")}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${locale === "es"
                        ? "bg-blue-600 text-white"
                        : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                    }`}
            >
                ES
            </button>
        </div>
    );
}
