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
                    Note: For advanced comparisons, use our helpers: <code>eq</code>, <code>notEq</code>, <code>gt</code>, <code>lt</code>.
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
                        <h3 className="text-lg font-medium mb-2 text-white">🔢 Number Formatting</h3>
                        <p className="mb-2">Format numbers with specific precision: <code>formatNumber</code>.</p>
                        <div className="bg-[#2d2d30] p-4 rounded-lg">
                            <code className="text-gray-300 text-sm">{`{{formatNumber quantity precision=0}}`}</code>
                            <p className="text-xs text-gray-500 mt-2">Example: 1250.5 &rarr; 1,250</p>
                        </div>
                    </div>

                    <div>
                        <h3 className="text-lg font-medium mb-2 text-white">📈 Percentage</h3>
                        <p className="mb-2">Format decimals as percentage: <code>formatPercent</code>.</p>
                        <div className="bg-[#2d2d30] p-4 rounded-lg">
                            <code className="text-gray-300 text-sm">{`{{formatPercent vatRate precision=0}}`}</code>
                            <p className="text-xs text-gray-500 mt-2">Example: 0.16 &rarr; 16%</p>
                        </div>
                    </div>

                    <div>
                        <h3 className="text-lg font-medium mb-2 text-white">💰 Money Format</h3>
                        <p className="mb-2">Format numbers as currency using <code>formatMoney</code>.</p>
                        <div className="bg-[#2d2d30] p-4 rounded-lg">
                            <code className="text-gray-300 text-sm">{`{{formatMoney total prefix="$" precision=2}}`}</code>
                            <p className="text-xs text-gray-500 mt-2">Example: 1250.5 &rarr; $1,250.50</p>
                        </div>
                    </div>

                    <div>
                        <h3 className="text-lg font-medium mb-2 text-white">➕ Plus One</h3>
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
                        <h3 className="text-lg font-medium mb-2 text-white">⚖️ Comparisons & Logic</h3>
                        <p className="mb-2">Combine logic with sub-expressions: <code>eq</code>, <code>notEq</code>, <code>gt</code>, <code>gte</code>, <code>lt</code>, <code>lte</code>, <code>and</code>, <code>or</code>, <code>not</code>.</p>
                        <div className="space-y-3">
                            <div className="bg-[#2d2d30] p-4 rounded-lg">
                                <code className="text-gray-300 text-sm">{`{{#if (notEq balance 0)}} Pay Now {{/if}}`}</code>
                            </div>
                            <div className="bg-[#2d2d30] p-4 rounded-lg">
                                <code className="text-gray-300 text-sm">{`{{#if (or (gt subtotal 0) (gt tax 0))}} Show Summary {{/if}}`}</code>
                            </div>
                        </div>
                    </div>

                    <div>
                        <h3 className="text-lg font-medium mb-2 text-white">🔠 String Manipulation</h3>
                        <p className="mb-2">Clean and format text using <code>upcase</code>, <code>strip</code> and <code>newline_to_br</code>.</p>
                        <div className="space-y-3">
                            <div className="bg-[#2d2d30] p-4 rounded-lg">
                                <code className="text-gray-300 text-sm">{`{{upcase name}}`}</code>
                                <p className="text-xs text-gray-500 mt-1">Example: &quot;John Doe&quot; &rarr; JOHN DOE</p>
                            </div>
                            <div className="bg-[#2d2d30] p-4 rounded-lg">
                                <code className="text-gray-300 text-sm">{`{{strip "  text  "}}`}</code>
                                <p className="text-xs text-gray-500 mt-1">Example: &quot;  text  &quot; &rarr; &quot;text&quot;</p>
                            </div>
                            <div className="bg-[#2d2d30] p-4 rounded-lg">
                                <code className="text-gray-300 text-sm">{`{{newline_to_br address}}`}</code>
                                <p className="text-xs text-gray-500 mt-1">Converts line breaks to &lt;br /&gt; tags.</p>
                            </div>
                        </div>
                    </div>

                    <div>
                        <h3 className="text-lg font-medium mb-2 text-white">📅 Date Formatting</h3>
                        <p className="mb-2">Format dates using Liquid-style format strings with <code>date</code>.</p>
                        <div className="bg-[#2d2d30] p-4 rounded-lg">
                            <code className="text-gray-300 text-sm">{`{{date createdAt "%m/%d/%Y"}}`}</code>
                            <p className="text-xs text-gray-500 mt-2">Example: 2024-01-19 &rarr; 01/19/2024</p>
                        </div>
                    </div>

                    <div>
                        <h3 className="text-lg font-medium mb-2 text-white">📝 Variable Assignment</h3>
                        <p className="mb-2">Assign values to variables using <code>set</code> or <code>assign</code>.</p>
                        <div className="bg-[#2d2d30] p-4 rounded-lg">
                            <code className="text-gray-300 text-sm">{`{{set "logoUrl" "https://example.com/logo.png"}}`}</code>
                            <p className="text-xs text-gray-400 mt-2">Available later as <code>{"{{logoUrl}}"}</code></p>
                        </div>
                    </div>

                    <div>
                        <h3 className="text-lg font-medium mb-2 text-white">🔢 Arithmetic (Math)</h3>
                        <p className="mb-2">Perform basic math operations with <code>math</code>.</p>
                        <div className="bg-[#2d2d30] p-4 rounded-lg">
                            <code className="text-gray-300 text-sm">{`{{set "total" (math price "*" quantity)}}`}</code>
                            <p className="text-xs text-gray-500 mt-2">Supports: <code>+</code>, <code>-</code>, <code>*</code>, <code>/</code>, <code>%</code></p>
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
}
img {
  max-width: 100%;
}`}</code>
                    </pre>
                </div>
            </section>

            <section className="mb-10 bg-blue-900/20 p-6 rounded-xl border border-blue-500/30">
                <h2 className="text-xl font-semibold mb-4 text-blue-300 flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Liquid to Handlebars Cheat Sheet
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-[#1e1e1e] p-4 rounded-lg border border-gray-700">
                        <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">Liquid (e.g. PDFMonkey)</h4>
                        <ul className="space-y-3 text-sm">
                            <li><code>{`{% assign x = "val" %}`}</code></li>
                            <li><code>{`{{ name | upcase }}`}</code></li>
                            <li><code>{`{% if a == "b" %}`}</code></li>
                            <li><code>{`{{ d | default: "val" }}`}</code></li>
                            <li><code>{`{% if x != blank %}`}</code></li>
                        </ul>
                    </div>
                    <div className="bg-[#1e1e1e] p-4 rounded-lg border border-gray-700">
                        <h4 className="text-xs font-bold text-blue-500 uppercase mb-2">Handlebars (PDFGenAI)</h4>
                        <ul className="space-y-3 text-sm">
                            <li><code>{`{{set "x" "val"}}`}</code></li>
                            <li><code>{`{{upcase name}}`}</code></li>
                            <li><code>{`{{#if (eq a "b")}}`}</code></li>
                            <li><code>{`{{default d "val"}}`}</code></li>
                            <li><code>{`{{#if x}}`}</code> (standard check)</li>
                        </ul>
                    </div>
                </div>
                <div className="mt-6">
                    <h4 className="text-sm font-semibold text-white mb-2">Pro Tip: Default values on assignments</h4>
                    <p className="text-sm mb-3">You can use sub-expressions (content inside parentheses) to set defaults while assigning:</p>
                    <div className="bg-[#2d2d30] p-3 rounded-md">
                        <code className="text-blue-300 text-sm">
                            {`{{set "useVat" (default useVat false)}}`}
                        </code>
                    </div>
                </div>
            </section>

            <footer className="mt-20 pt-8 border-t border-gray-700 text-center text-sm text-gray-500 pb-10">
                <p>PDFGenAI Documentation - Template Engine v1.0</p>
            </footer>
        </div>
    );
}
