"use client";

import type { Metadata } from "next";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useI18n } from "@/hooks/useI18n";

export default function AuthLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const { t } = useI18n();

    return (
        <div className="min-h-screen flex">
            {/* Left side - Form area */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-white relative">
                {/* Language Switcher */}
                <div className="absolute top-4 right-4">
                    <LanguageSwitcher />
                </div>

                <div className="w-full max-w-md">
                    {children}
                </div>
            </div>

            {/* Right side - Preview carousel (hidden on mobile) */}
            <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-600 to-purple-700 items-center justify-center p-12">
                <div className="max-w-2xl">
                    <div className="text-white">
                        <h1 className="text-4xl font-bold mb-6">{t("PDFGenAI")}</h1>
                        <p className="text-xl mb-8 text-blue-100">
                            {t("Generate professional PDFs with AI-powered templates")}
                        </p>

                        {/* Feature highlights */}
                        <div className="space-y-6">
                            <div className="flex items-start space-x-4">
                                <div className="flex-shrink-0 w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                </div>
                                <div>
                                    <h3 className="font-semibold text-lg mb-1">{t("Smart Templates")}</h3>
                                    <p className="text-blue-100">{t("Create and manage reusable PDF templates")}</p>
                                </div>
                            </div>

                            <div className="flex items-start space-x-4">
                                <div className="flex-shrink-0 w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                    </svg>
                                </div>
                                <div>
                                    <h3 className="font-semibold text-lg mb-1">{t("Fast Generation")}</h3>
                                    <p className="text-blue-100">{t("Generate PDFs in seconds with dynamic data")}</p>
                                </div>
                            </div>

                            <div className="flex items-start space-x-4">
                                <div className="flex-shrink-0 w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                    </svg>
                                </div>
                                <div>
                                    <h3 className="font-semibold text-lg mb-1">{t("Secure Storage")}</h3>
                                    <p className="text-blue-100">{t("Your documents are safely stored and encrypted")}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
