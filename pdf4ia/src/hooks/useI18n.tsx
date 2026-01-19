"use client";

import { createContext, useContext, useState, ReactNode, useEffect } from "react";
import esTranslations from "@/locales/es.json";

type Locale = "en" | "es";

interface I18nContextType {
    locale: Locale;
    setLocale: (locale: Locale) => void;
    t: (key: string) => string;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export function I18nProvider({ children }: { children: ReactNode }) {
    const [locale, setLocale] = useState<Locale>("en");

    // Cargar idioma desde localStorage al montar
    useEffect(() => {
        if (typeof window !== "undefined") {
            const savedLocale = localStorage.getItem("pdf4ia-locale") as Locale;
            if (savedLocale && (savedLocale === "en" || savedLocale === "es")) {
                setTimeout(() => setLocale(savedLocale), 0);
            }
        }
    }, []);

    // Guardar idioma en localStorage cuando cambie
    const handleSetLocale = (newLocale: Locale) => {
        setLocale(newLocale);
        localStorage.setItem("pdf4ia-locale", newLocale);
    };

    const t = (key: string): string => {
        if (locale === "es") {
            // Try to find translation in es.json
            const translation = esTranslations[key as keyof typeof esTranslations];
            return translation || key; // Fallback to original key if no translation found
        }
        return key; // Default to English (the key itself)
    };

    return (
        <I18nContext.Provider value={{ locale, setLocale: handleSetLocale, t }}>
            {children}
        </I18nContext.Provider>
    );
}

export function useI18n() {
    const context = useContext(I18nContext);
    if (context === undefined) {
        throw new Error("useI18n must be used within an I18nProvider");
    }
    return context;
}
