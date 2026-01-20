"use client";

import { createContext, useContext, useState, ReactNode, useEffect, useCallback, useMemo } from "react";
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
                setLocale(savedLocale);
            }
        }
    }, []);

    // Guardar idioma en localStorage cuando cambie
    const handleSetLocale = useCallback((newLocale: Locale) => {
        setLocale(newLocale);
        localStorage.setItem("pdf4ia-locale", newLocale);
    }, []);

    const t = useCallback((key: string): string => {
        if (locale === "es") {
            // Try to find translation in es.json
            const translation = esTranslations[key as keyof typeof esTranslations];
            return translation || key; // Fallback to original key if no translation found
        }
        return key; // Default to English (the key itself)
    }, [locale]);

    const contextValue = useMemo(() => ({
        locale,
        setLocale: handleSetLocale,
        t
    }), [locale, handleSetLocale, t]);

    return (
        <I18nContext.Provider value={contextValue}>
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
