"use client";

import { useI18n } from "@/hooks/useI18n";

export default function TemplateDocs() {
    const { t } = useI18n();

    return (
        <div className="p-8 bg-[#1e1e1e] text-gray-300 h-full overflow-y-auto max-w-4xl mx-auto scrollbar-thin scrollbar-thumb-gray-700">
            <h1 className="text-3xl font-bold mb-8 text-white border-b border-gray-700 pb-4">{t("Template Engine Documentation")}</h1>

            <section className="mb-10">
                <h2 className="text-xl font-semibold mb-4 text-blue-400">Introduction</h2>
                <p className="mb-4">
                    PDFGenAI uses <strong>Handlebars</strong> as its template engine. Handlebars allows you to create dynamic HTML templates by using placeholders like <code>{"{{variable}}"}</code>.
                </p>
            </section>

            <section className="mb-10">
                <h2 className="text-xl font-semibold mb-4 text-blue-400">Basic Usage</h2>
                <div className="bg-[#2d2d30] p-4 rounded-lg mb-4">
                    <pre className="text-sm text-gray-300 overflow-x-auto">
                        <code>{`<h1>{{title}}</h1>
<p>User: {{user.name}}</p>`}</code>
                    </pre>
                </div>
            </section>

            <section className="mb-10">
                <h2 className="text-xl font-semibold mb-4 text-blue-400">Conditionals (If)</h2>
                <p className="mb-4">Use <code>{"{{#if}}"}</code> to conditionally render content.</p>
                <div className="bg-[#2d2d30] p-4 rounded-lg mb-4">
                    <pre className="text-sm text-gray-300 overflow-x-auto">
                        <code>{`{{#if isActive}}
  <span className="status">Active</span>
{{else}}
  <span className="status">Inactive</span>
{{/if}}`}</code>
                    </pre>
                </div>
                <p className="text-sm text-gray-400 mt-2">
                    Note: For advanced comparisons, use our helpers: <code>eq</code>, <code>neq</code>, <code>gt</code>, <code>lt</code>.
                </p>
                <div className="bg-[#2d2d30] p-4 rounded-lg mt-4">
                    <pre className="text-sm text-gray-300 overflow-x-auto">
                        <code>{`{{#if (eq status "completed")}}
  <p>Finished!</p>
{{/if}}`}</code>
                    </pre>
                </div>
            </section>

            <section className="mb-10">
                <h2 className="text-xl font-semibold mb-4 text-blue-400">Loops (Each)</h2>
                <p className="mb-4">Iterate over arrays using <code>{"{{#each}}"}</code>.</p>
                <div className="bg-[#2d2d30] p-4 rounded-lg mb-4">
                    <pre className="text-sm text-gray-300 overflow-x-auto">
                        <code>{`<ul>
  {{#each items}}
    <li>{{this.name}} - {{this.price}}</li>
  {{/each}}
</ul>`}</code>
                    </pre>
                </div>
                <p className="text-sm text-gray-400">Inside the loop, <code>this</code> refers to the current item.</p>
            </section>

            <section className="mb-10">
                <h2 className="text-xl font-semibold mb-4 text-blue-400">Core Helpers</h2>
                <div className="space-y-6">
                    <div>
                        <h3 className="text-lg font-medium mb-2 text-white">💰 Money Format</h3>
                        <p className="mb-2">Format numbers as currency using <code>formatMoney</code>.</p>
                        <div className="bg-[#2d2d30] p-4 rounded-lg">
                            <code className="text-gray-300 text-sm">{`{{formatMoney total prefix="$" precision=2}}`}</code>
                            <p className="text-xs text-gray-500 mt-2">Example: 1250.5 &rarr; $1,250.50</p>
                        </div>
                    </div>

                    <div>
                        <h3 className="text-lg font-medium mb-2 text-white">🔢 Increment</h3>
                        <p className="mb-2">Increments a value (useful for 1-based lists): <code>inc</code>.</p>
                        <div className="bg-[#2d2d30] p-4 rounded-lg">
                            <code className="text-gray-300 text-sm">{`{{inc @index}}`}</code>
                        </div>
                    </div>

                    <div>
                        <h3 className="text-lg font-medium mb-2 text-white">🛡️ Default Value</h3>
                        <p className="mb-2">Fallback value if a variable is empty: <code>default</code>.</p>
                        <div className="bg-[#2d2d30] p-4 rounded-lg">
                            <code className="text-gray-300 text-sm">{`{{default note "No notes provided"}}`}</code>
                        </div>
                    </div>

                    <div>
                        <h3 className="text-lg font-medium mb-2 text-white">⚖️ Comparisons</h3>
                        <p className="mb-2">Use within sub-expressions: <code>eq</code>, <code>neq</code>, <code>gt</code>, <code>lt</code>.</p>
                        <div className="bg-[#2d2d30] p-4 rounded-lg">
                            <code className="text-gray-300 text-sm">{`{{#if (gt total 1000)}} High priority {{/if}}`}</code>
                        </div>
                    </div>
                </div>
            </section>

            <section className="mb-10">
                <h2 className="text-xl font-semibold mb-4 text-blue-400">CSS Styling</h2>
                <p className="mb-4">
                    You can use standard CSS in the &quot;CSS&quot; tab. All styles are scoped to the PDF.
                    <strong>Tip:</strong> Use <code>@page</code> for page-specific styles like page breaks or backgrounds.
                </p>
                <div className="bg-[#2d2d30] p-4 rounded-lg">
                    <pre className="text-sm text-gray-300 overflow-x-auto">
                        <code>{`@page {
  margin: 0;
}
.page-break {
  page-break-after: always;
}`}</code>
                    </pre>
                </div>
            </section>

            <footer className="mt-20 pt-8 border-t border-gray-700 text-center text-sm text-gray-500 pb-10">
                <p>PDFGenAI Documentation - Template Engine v1.0</p>
            </footer>
        </div>
    );
}
