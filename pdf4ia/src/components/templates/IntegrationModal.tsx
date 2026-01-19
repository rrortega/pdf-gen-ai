"use client";

import { useState } from "react";
import { useI18n } from "@/hooks/useI18n";

interface IntegrationModalProps {
    isOpen: boolean;
    onClose: () => void;
    templateId: string;
    templateTitle: string;
    testData: any;
}

export default function IntegrationModal({
    isOpen,
    onClose,
    templateId,
    templateTitle,
    testData,
}: IntegrationModalProps) {
    const { t } = useI18n();
    const [activeTab, setActiveTab] = useState(0);

    if (!isOpen) return null;

    const domain = typeof window !== "undefined" ? window.location.origin : "";
    const apiUrl = `${domain}/api/documents`;

    // Decode or use testData
    let parsedData: any = { example_key: "example_value" };
    if (testData) {
        if (typeof testData === 'object') {
            parsedData = testData;
        } else if (typeof testData === 'string') {
            try {
                // Try as JSON first
                parsedData = JSON.parse(testData);
            } catch {
                try {
                    // Try as base64
                    parsedData = JSON.parse(atob(testData));
                } catch (e) {
                    console.error("Failed to parse/decode testData:", e);
                }
            }
        }
    }

    const tabs = [
        { id: 0, name: "Curl", icon: "🔗" },
        { id: 1, name: "Node.js", icon: "🟢" },
        { id: 2, name: "PHP", icon: "🐘" },
        { id: 3, name: "Python", icon: "🐍" },
    ];

    const generateCode = (lang: string) => {
        const body = JSON.stringify({
            template_id: templateId,
            name: "document_name",
            data: parsedData
        }, null, 2);

        switch (lang) {
            case "Curl":
                return `curl -X POST "${apiUrl}" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '${body}'`;
            case "Node.js":
                return `// Example using fetch (Standard in Node 18+)
const data = ${body};

fetch('${apiUrl}', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_API_KEY'
  },
  body: JSON.stringify(data)
})
.then(res => res.json())
.then(json => console.log(json))
.catch(err => console.error(err));`;
            case "PHP":
                return `<?php
$apiUrl = "${apiUrl}";
$apiKey = "YOUR_API_KEY";

$data = array(
    "template_id" => "${templateId}",
    "name" => "document_name",
    "data" => json_decode('${JSON.stringify(parsedData)}', true)
);

$options = array(
    'http' => array(
        'header'  => "Content-Type: application/json\\r\\n" .
                     "Authorization: Bearer $apiKey\\r\\n",
        'method'  => 'POST',
        'content' => json_encode($data)
    )
);

$context  = stream_context_create($options);
$result = file_get_contents($apiUrl, false, $context);
if ($result === FALSE) { /* Handle error */ }

var_dump(json_decode($result));
?>`;
            case "Python":
                return `import requests
import json

api_url = "${apiUrl}"
api_key = "YOUR_API_KEY"

data = ${body}

headers = {
    "Content-Type": "application/json",
    "Authorization": f"Bearer {api_key}"
}

response = requests.post(api_url, headers=headers, data=json.dumps(data))
print(response.json())`;
            default:
                return "";
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 transition-all animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">{t("Integration Code")}</h2>
                        <p className="text-sm text-gray-500 mt-1">{templateTitle}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-white rounded-lg transition-all shadow-sm"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex bg-gray-50/50 px-6 border-b border-gray-100 overflow-x-auto no-scrollbar">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`px-6 py-3 text-sm font-semibold transition-all border-b-2 whitespace-nowrap flex items-center gap-2 ${activeTab === tab.id
                                ? "border-gray-900 text-gray-900 bg-white"
                                : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-100/50"
                                }`}
                        >
                            <span>{tab.icon}</span>
                            {tab.name}
                        </button>
                    ))}
                </div>

                {/* Code Area */}
                <div className="flex-1 overflow-hidden flex flex-col bg-[#1e1e1e]">
                    <div className="flex-1 overflow-auto p-6 scrollbar-thin scrollbar-thumb-gray-700">
                        <div className="relative group">
                            <pre className="text-sm text-gray-300 font-mono leading-relaxed">
                                {generateCode(tabs[activeTab].name)}
                            </pre>

                            <button
                                onClick={() => {
                                    navigator.clipboard.writeText(generateCode(tabs[activeTab].name));
                                }}
                                className="absolute top-0 right-0 p-2 bg-gray-800 text-gray-400 rounded-lg hover:text-white transition-all shadow-lg border border-gray-700 hover:scale-105 active:scale-95"
                                title={t("Copy to clipboard")}
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m-3 8h1m0-3h-1m1 3h1m-1-6h1" />
                                </svg>
                            </button>
                        </div>
                    </div>

                    {/* Footer Info */}
                    <div className="p-4 bg-gray-900 border-t border-gray-800">
                        <div className="flex items-center gap-2 text-amber-400">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="text-xs font-medium">
                                {t("Important")}: {t("Replace YOUR_API_KEY with your actual secure token.")}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
