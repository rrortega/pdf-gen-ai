"use client";

import { useState } from "react";
import { useI18n } from "@/hooks/useI18n";
import CodeEditor from "./CodeEditor";
import TemplateSettingsForm from "./TemplateSettingsForm";
import TemplateDocs from "./TemplateDocs";

interface EditorTabPanelProps {
    data: {
        title: string;
        tags: string[];
        html: string;
        css: string;
        testData: string;
        orientation: "portrait" | "landscape";
        paperSize: string;
        margins: {
            top: string;
            right: string;
            bottom: string;
            left: string;
        };
    };
    onChange: (data: EditorTabPanelProps["data"]) => void;
    activeTab: number;
    onTabChange: (tab: number) => void;
    isLoading?: boolean;
}

export default function EditorTabPanel({
    data,
    onChange,
    activeTab,
    onTabChange,
    isLoading = false,
}: EditorTabPanelProps) {
    const { t } = useI18n();
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [showSettings, setShowSettings] = useState(false);
    const [showDocs, setShowDocs] = useState(false);

    const tabs = [
        { id: 0, name: "HTML", icon: "📄" },
        { id: 1, name: "CSS", icon: "🎨" },
        { id: 2, name: "DATA", icon: "🧪" },
    ];

    const handleChange = (field: string, value: unknown) => {
        const newData = { ...data, [field]: value };
        onChange(newData);
    };

    const validateJSON = (value: string) => {
        try {
            JSON.parse(value);
            setErrors({ ...errors, testData: "" });
        } catch {
            setErrors((prev) => ({ ...prev, testData: t("Invalid test data JSON") }));
        }
    };

    return (
        <div className="h-full flex flex-col bg-[#1e1e1e]">
            {/* Tab Navigation */}
            <nav className="flex w-full h-[60px] flex-shrink-0">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        type="button"
                        onClick={() => {
                            setShowSettings(false);
                            setShowDocs(false);
                            onTabChange(tab.id);
                        }}
                        className={`px-4 py-2 text-sm font-medium transition-colors border-r border-gray-700/50 ${activeTab === tab.id && !showSettings && !showDocs
                            ? "text-white bg-[#1e1e1e] border-b-2 border-gray-900"
                            : "text-gray-400 hover:text-gray-200"
                            }`}
                    >
                        {t(tab.name)}
                    </button>
                ))}

                <div className="flex-1"></div>

                <div className="flex items-center">
                    <button
                        onClick={() => {
                            setShowSettings(!showSettings);
                            setShowDocs(false);
                        }}
                        className={`px-4 py-2 flex items-center gap-2 text-sm font-medium transition-colors border-l border-gray-700/50 ${showSettings
                            ? "text-white bg-[#1e1e1e] border-b-2 border-gray-900"
                            : "text-gray-400 hover:text-white"}`}
                        title={t("Settings")}
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        {t("Settings")}
                    </button>
                    <button
                        onClick={() => {
                            setShowDocs(!showDocs);
                            setShowSettings(false);
                        }}
                        className={`px-4 py-2 flex items-center gap-2 text-sm font-medium transition-colors border-l border-gray-700/50 ${showDocs
                            ? "text-white bg-[#1e1e1e] border-b-2 border-gray-900"
                            : "text-gray-400 hover:text-white"}`}
                        title={t("Documentation")}
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        {t("Docs")}
                    </button>
                </div>
            </nav>

            {/* Tab Content */}
            <div className="flex-1 overflow-hidden relative min-h-0 flex flex-col">
                {showDocs ? (
                    <div className="flex-1 overflow-auto bg-[#1e1e1e]">
                        <TemplateDocs />
                    </div>
                ) : showSettings ? (
                    <div className="flex-1 overflow-auto bg-[#1e1e1e]">
                        <TemplateSettingsForm
                            data={data}
                            onChange={(partialData) => {
                                const updated = { ...data, ...partialData };
                                onChange(updated);
                            }}
                        />
                    </div>
                ) : (
                    <div className="flex-1 min-h-0 flex flex-col">
                        {/* HTML Tab */}
                        {activeTab === 0 && (
                            <div className="flex-1 min-h-0">
                                <CodeEditor
                                    value={data.html}
                                    onChange={(value) => handleChange("html", value)}
                                    language="html"
                                    disabled={isLoading}
                                />
                            </div>
                        )}

                        {/* CSS Tab */}
                        {activeTab === 1 && (
                            <div className="flex-1 min-h-0">
                                <CodeEditor
                                    value={data.css}
                                    onChange={(value) => handleChange("css", value)}
                                    language="css"
                                    disabled={isLoading}
                                />
                            </div>
                        )}

                        {/* Test Data Tab */}
                        {activeTab === 2 && (
                            <div className="flex-1 min-h-0">
                                <CodeEditor
                                    value={data.testData}
                                    onChange={(value) => {
                                        handleChange("testData", value);
                                        validateJSON(value);
                                    }}
                                    language="json"
                                    disabled={isLoading}
                                    error={errors.testData}
                                />
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
