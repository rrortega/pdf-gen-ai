"use client";

import { useRef } from "react";
import Editor from "@monaco-editor/react";
import { ensureMonacoLoaderConfigured } from "@/lib/monaco-loader";

interface CodeEditorProps {
    value: string;
    onChange: (value: string) => void;
    language: "css" | "html" | "json";
    placeholder?: string;
    disabled?: boolean;
    error?: string;
}

export default function CodeEditor({
    value,
    onChange,
    language,
    disabled = false,
    error,
}: CodeEditorProps) {
    const editorRef = useRef<any>(null);

    ensureMonacoLoaderConfigured();

    const handleEditorDidMount = (editor: any) => {
        editorRef.current = editor;

        // Auto-format on mount
        setTimeout(() => {
            editor.getAction('editor.action.formatDocument')?.run();
        }, 100);
    };

    const handleEditorChange = (value: string | undefined) => {
        if (value !== undefined) {
            onChange(value);
        }
    };

    return (
        <div className="w-full h-full flex flex-col">
            {error && (
                <div className="px-2 py-1 bg-red-900 border-b border-red-700">
                    <span className="text-xs text-red-200">{error}</span>
                </div>
            )}
            <div className="flex-1 overflow-hidden">
                <Editor
                    height="100%"
                    language={language}
                    value={value}
                    onChange={handleEditorChange}
                    onMount={handleEditorDidMount}
                    theme="vs-dark"
                    options={{
                        minimap: { enabled: false },
                        fontSize: 14,
                        lineNumbers: "on",
                        roundedSelection: false,
                        scrollBeyondLastLine: false,
                        readOnly: disabled,
                        automaticLayout: true,
                        tabSize: 2,
                        formatOnPaste: true,
                        formatOnType: true,
                        wordWrap: "on",
                        wrappingIndent: "indent",
                        scrollbar: {
                            vertical: "auto",
                            horizontal: "auto",
                            useShadows: false,
                            verticalScrollbarSize: 10,
                            horizontalScrollbarSize: 10,
                        },
                    }}
                />
            </div>
        </div>
    );
}
