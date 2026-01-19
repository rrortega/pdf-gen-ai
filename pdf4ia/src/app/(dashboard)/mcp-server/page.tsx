"use client";

import { useState } from "react";
import { useI18n } from "@/hooks/useI18n";
import dynamic from 'next/dynamic';

const MermaidDiagram = dynamic(() => import('@/components/MermaidDiagram'), {
    ssr: false,
    loading: () => <div className="text-center py-8 text-gray-500">Cargando diagrama...</div>
});

export default function MCPServerPage() {
    const { t } = useI18n();
    const [copiedSection, setCopiedSection] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'claude' | 'vscode' | 'n8n' | 'langchain'>('claude');

    // Get the app URL from environment or use localhost as fallback
    const appUrl = typeof window !== 'undefined'
        ? window.location.origin
        : process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    const copyToClipboard = (text: string, section: string) => {
        navigator.clipboard.writeText(text);
        setCopiedSection(section);
        setTimeout(() => setCopiedSection(null), 2000);
    };

    const configExample = `{
  "mcpServers": {
    "pdfgenai": {
      "command": "node",
      "args": [
        "/ruta/absoluta/al/mcp-server/index.js"
      ],
      "env": {
        "PDFGENAI_API_URL": "${appUrl}",
        "PDFGENAI_API_KEY": "tu-api-key-aqui"
      }
    }
  }
}`;

    const vscodeConfigExample = `{
  "mcp.servers": {
    "pdfgenai": {
      "command": "node",
      "args": ["/ruta/absoluta/al/mcp-server/index.js"],
      "env": {
        "PDFGENAI_API_URL": "${appUrl}",
        "PDFGENAI_API_KEY": "tu-api-key-aqui"
      }
    }
  }
}`;

    const n8nConfigExample = `// En N8N, crea un nodo MCP Tool con:
{
  "serverUrl": "stdio://node",
  "args": ["/ruta/absoluta/al/mcp-server/index.js"],
  "env": {
    "PDFGENAI_API_URL": "${appUrl}",
    "PDFGENAI_API_KEY": "tu-api-key-aqui"
  }
}`;

    const langchainExample = `import { MCPClient } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

// Crear cliente MCP
const transport = new StdioClientTransport({
  command: 'node',
  args: ['/ruta/absoluta/al/mcp-server/index.js'],
  env: {
    PDFGENAI_API_URL: '${appUrl}',
    PDFGENAI_API_KEY: 'tu-api-key-aqui'
  }
});

const client = new MCPClient({
  name: 'pdfgenai-client',
  version: '1.0.0'
});

await client.connect(transport);

// Listar herramientas disponibles
const tools = await client.listTools();

// Generar PDF
const result = await client.callTool({
  name: 'generate_pdf',
  arguments: {
    template_id: 'invoice_template_123',
    data: {
      customer_name: 'John Doe',
      invoice_number: 'INV-001',
      total: 100
    }
  }
});`;

    const generatePdfExample = `{
  "template_id": "invoice_template_123",
  "data": {
    "invoice_number": "INV-001",
    "customer_name": "John Doe",
    "items": [
      { "name": "Product A", "price": 100 }
    ],
    "total": 100
  },
  "filename": "invoice-001"
}`;

    return (
        <div className="min-h-screen bg-gray-50 py-8">
            <div className="max-w-7xl mx-auto px-6">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-4xl font-bold text-gray-900 mb-2">
                        Servidor MCP
                    </h1>
                    <p className="text-lg text-gray-600">
                        Integra PDFGenAI con cualquier cliente MCP: Claude Desktop, VS Code, N8N, LangChain y más
                    </p>
                </div>

                {/* What is MCP */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 mb-6">
                    <div className="flex items-start gap-4">
                        <div className="p-3 bg-gray-900 rounded-lg">
                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <div className="flex-1">
                            <h2 className="text-2xl font-bold text-gray-900 mb-3">
                                ¿Qué es el Servidor MCP?
                            </h2>
                            <p className="text-gray-600 mb-4">
                                El <strong>Model Context Protocol (MCP)</strong> es un estándar abierto que permite a aplicaciones de IA conectarse con herramientas externas.
                                Nuestro servidor MCP te permite generar y gestionar PDFs desde cualquier cliente compatible: Claude Desktop, VS Code, N8N, LangChain, y más.
                            </p>
                            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                                <p className="text-sm text-gray-700 mb-2">
                                    <strong>Ejemplo de uso:</strong>
                                </p>
                                <p className="text-sm text-gray-600 italic">
                                    "Genera una factura para el cliente John Doe con número INV-001 y total de $100"
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Architecture Diagram */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 mb-6">
                    <h2 className="text-2xl font-bold text-gray-900 mb-6">Arquitectura</h2>
                    <div className="bg-gray-50 rounded-lg p-6 overflow-x-auto">
                        <MermaidDiagram
                            chart={`graph TD
    A[Cliente MCP<br/>Claude / VS Code / N8N / LangChain] -->|Natural Language / API Calls| B[MCP Server<br/>PDFGenAI Server]
    B -->|HTTP API Calls<br/>POST /api/v1/generate| C[PDFGenAI API<br/>Next.js App]
    C -->|Puppeteer + Handlebars| D[PDF Output<br/>Appwrite Storage]
    
    style A fill:#1f2937,stroke:#374151,stroke-width:2px,color:#fff
    style B fill:#4b5563,stroke:#6b7280,stroke-width:2px,color:#fff
    style C fill:#6b7280,stroke:#9ca3af,stroke-width:2px,color:#fff
    style D fill:#9ca3af,stroke:#d1d5db,stroke-width:2px,color:#000`}
                            className="flex justify-center"
                        />
                    </div>
                    <div className="mt-4 text-sm text-gray-600">
                        <p className="mb-2">
                            <strong>Flujo de datos:</strong>
                        </p>
                        <ol className="list-decimal list-inside space-y-1 ml-2">
                            <li>El cliente MCP (Claude Desktop, VS Code, N8N, LangChain, etc.) envía solicitudes</li>
                            <li>El servidor MCP traduce las solicitudes a llamadas API de PDFGenAI</li>
                            <li>PDFGenAI procesa la plantilla con Handlebars y genera el PDF con Puppeteer</li>
                            <li>El documento se almacena en Appwrite y se devuelve la URL de descarga</li>
                        </ol>
                    </div>
                </div>

                {/* Installation Steps */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 mb-6">
                    <h2 className="text-2xl font-bold text-gray-900 mb-6">Configuración por Plataforma</h2>

                    {/* Tabs */}
                    <div className="border-b border-gray-200 mb-6">
                        <nav className="flex gap-4" aria-label="Tabs">
                            <button
                                onClick={() => setActiveTab('claude')}
                                className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${activeTab === 'claude'
                                    ? 'border-gray-900 text-gray-900'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                    }`}
                            >
                                Claude Desktop
                            </button>
                            <button
                                onClick={() => setActiveTab('vscode')}
                                className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${activeTab === 'vscode'
                                    ? 'border-gray-900 text-gray-900'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                    }`}
                            >
                                VS Code
                            </button>
                            <button
                                onClick={() => setActiveTab('n8n')}
                                className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${activeTab === 'n8n'
                                    ? 'border-gray-900 text-gray-900'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                    }`}
                            >
                                N8N
                            </button>
                            <button
                                onClick={() => setActiveTab('langchain')}
                                className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${activeTab === 'langchain'
                                    ? 'border-gray-900 text-gray-900'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                    }`}
                            >
                                LangChain
                            </button>
                        </nav>
                    </div>

                    {/* Claude Desktop Tab */}
                    {activeTab === 'claude' && (
                        <div className="space-y-6">
                            <div>
                                <h3 className="text-lg font-bold text-gray-900 mb-3">Configurar Claude Desktop</h3>
                                <p className="text-gray-600 mb-4">
                                    Edita el archivo de configuración de Claude Desktop:
                                </p>
                                <div className="bg-gray-50 rounded-lg p-4 mb-4 border border-gray-200">
                                    <p className="text-sm font-semibold text-gray-700 mb-2">macOS:</p>
                                    <code className="text-sm text-gray-600">
                                        ~/Library/Application Support/Claude/claude_desktop_config.json
                                    </code>
                                </div>
                                <div className="bg-gray-50 rounded-lg p-4 mb-4 border border-gray-200">
                                    <p className="text-sm font-semibold text-gray-700 mb-2">Windows:</p>
                                    <code className="text-sm text-gray-600">
                                        %APPDATA%\Claude\claude_desktop_config.json
                                    </code>
                                </div>
                                <p className="text-gray-600 mb-3">
                                    Agrega la siguiente configuración:
                                </p>
                                <div className="relative">
                                    <pre className="bg-gray-900 text-gray-100 rounded-lg p-4 overflow-x-auto text-sm">
                                        <code>{configExample}</code>
                                    </pre>
                                    <button
                                        onClick={() => copyToClipboard(configExample, 'claude-config')}
                                        className="absolute top-2 right-2 p-2 bg-gray-800 hover:bg-gray-700 rounded text-white text-xs"
                                    >
                                        {copiedSection === 'claude-config' ? '✓ Copiado' : 'Copiar'}
                                    </button>
                                </div>
                                <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                                    <div className="flex gap-3">
                                        <svg className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                        </svg>
                                        <div>
                                            <p className="text-sm font-semibold text-yellow-800 mb-1">Importante:</p>
                                            <p className="text-sm text-yellow-700">
                                                Reemplaza la ruta con la ruta absoluta real en tu sistema y reinicia Claude Desktop.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* VS Code Tab */}
                    {activeTab === 'vscode' && (
                        <div className="space-y-6">
                            <div>
                                <h3 className="text-lg font-bold text-gray-900 mb-3">Configurar VS Code</h3>
                                <p className="text-gray-600 mb-4">
                                    Instala la extensión MCP para VS Code y configura el servidor:
                                </p>
                                <div className="bg-gray-50 rounded-lg p-4 mb-4 border border-gray-200">
                                    <p className="text-sm font-semibold text-gray-700 mb-2">Archivo de configuración:</p>
                                    <code className="text-sm text-gray-600">
                                        .vscode/settings.json
                                    </code>
                                </div>
                                <p className="text-gray-600 mb-3">
                                    Agrega la siguiente configuración:
                                </p>
                                <div className="relative">
                                    <pre className="bg-gray-900 text-gray-100 rounded-lg p-4 overflow-x-auto text-sm">
                                        <code>{vscodeConfigExample}</code>
                                    </pre>
                                    <button
                                        onClick={() => copyToClipboard(vscodeConfigExample, 'vscode-config')}
                                        className="absolute top-2 right-2 p-2 bg-gray-800 hover:bg-gray-700 rounded text-white text-xs"
                                    >
                                        {copiedSection === 'vscode-config' ? '✓ Copiado' : 'Copiar'}
                                    </button>
                                </div>
                                <div className="mt-4 bg-gray-50 border border-gray-200 rounded-lg p-4">
                                    <p className="text-sm text-gray-700">
                                        <strong>Nota:</strong> Asegúrate de tener instalada la extensión MCP para VS Code desde el marketplace.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* N8N Tab */}
                    {activeTab === 'n8n' && (
                        <div className="space-y-6">
                            <div>
                                <h3 className="text-lg font-bold text-gray-900 mb-3">Configurar N8N</h3>
                                <p className="text-gray-600 mb-4">
                                    En N8N, crea un workflow y agrega un nodo <strong>MCP Tool</strong>:
                                </p>
                                <div className="space-y-4 mb-4">
                                    <div className="flex items-start gap-3">
                                        <div className="w-6 h-6 bg-gray-900 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                                            1
                                        </div>
                                        <p className="text-gray-600">Arrastra un nodo <code className="bg-gray-100 px-1 rounded">MCP Tool</code> al canvas</p>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <div className="w-6 h-6 bg-gray-900 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                                            2
                                        </div>
                                        <p className="text-gray-600">Configura la conexión con el servidor MCP:</p>
                                    </div>
                                </div>
                                <div className="relative">
                                    <pre className="bg-gray-900 text-gray-100 rounded-lg p-4 overflow-x-auto text-sm">
                                        <code>{n8nConfigExample}</code>
                                    </pre>
                                    <button
                                        onClick={() => copyToClipboard(n8nConfigExample, 'n8n-config')}
                                        className="absolute top-2 right-2 p-2 bg-gray-800 hover:bg-gray-700 rounded text-white text-xs"
                                    >
                                        {copiedSection === 'n8n-config' ? '✓ Copiado' : 'Copiar'}
                                    </button>
                                </div>
                                <div className="mt-4 bg-gray-50 border border-gray-200 rounded-lg p-4">
                                    <p className="text-sm text-gray-700 mb-2">
                                        <strong>Herramientas disponibles:</strong>
                                    </p>
                                    <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                                        <li>generate_pdf - Generar PDFs</li>
                                        <li>list_templates - Listar plantillas</li>
                                        <li>list_documents - Listar documentos</li>
                                        <li>get_document - Obtener documento</li>
                                        <li>search_documents - Buscar documentos</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* LangChain Tab */}
                    {activeTab === 'langchain' && (
                        <div className="space-y-6">
                            <div>
                                <h3 className="text-lg font-bold text-gray-900 mb-3">Integración con LangChain</h3>
                                <p className="text-gray-600 mb-4">
                                    Usa el cliente MCP en tu aplicación LangChain:
                                </p>
                                <div className="bg-gray-50 rounded-lg p-4 mb-4 border border-gray-200">
                                    <p className="text-sm font-semibold text-gray-700 mb-2">Instalar dependencias:</p>
                                    <code className="text-sm text-gray-600">
                                        npm install @modelcontextprotocol/sdk
                                    </code>
                                </div>
                                <p className="text-gray-600 mb-3">
                                    Ejemplo de código:
                                </p>
                                <div className="relative">
                                    <pre className="bg-gray-900 text-gray-100 rounded-lg p-4 overflow-x-auto text-sm">
                                        <code>{langchainExample}</code>
                                    </pre>
                                    <button
                                        onClick={() => copyToClipboard(langchainExample, 'langchain-code')}
                                        className="absolute top-2 right-2 p-2 bg-gray-800 hover:bg-gray-700 rounded text-white text-xs"
                                    >
                                        {copiedSection === 'langchain-code' ? '✓ Copiado' : 'Copiar'}
                                    </button>
                                </div>
                                <div className="mt-4 bg-gray-50 border border-gray-200 rounded-lg p-4">
                                    <p className="text-sm text-gray-700 mb-2">
                                        <strong>Uso en agentes:</strong>
                                    </p>
                                    <p className="text-sm text-gray-600">
                                        Puedes integrar estas herramientas MCP en tus agentes de LangChain para que generen PDFs automáticamente como parte de sus flujos de trabajo.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Common Steps */}
                    <div className="mt-8 pt-6 border-t border-gray-200">
                        <h3 className="text-lg font-bold text-gray-900 mb-4">Pasos Comunes</h3>
                        <div className="space-y-4">
                            <div className="flex items-start gap-3">
                                <div className="w-8 h-8 bg-gray-900 text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">
                                    1
                                </div>
                                <div className="flex-1">
                                    <h4 className="font-semibold text-gray-900 mb-1">Instalar Dependencias</h4>
                                    <p className="text-gray-600 text-sm mb-2">
                                        Navega al directorio del servidor MCP e instala:
                                    </p>
                                    <div className="relative">
                                        <pre className="bg-gray-900 text-gray-100 rounded-lg p-3 text-sm">
                                            <code>cd mcp-server{'\n'}npm install</code>
                                        </pre>
                                        <button
                                            onClick={() => copyToClipboard('cd mcp-server\nnpm install', 'install')}
                                            className="absolute top-2 right-2 p-1.5 bg-gray-800 hover:bg-gray-700 rounded text-white text-xs"
                                        >
                                            {copiedSection === 'install' ? '✓' : 'Copiar'}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-start gap-3">
                                <div className="w-8 h-8 bg-gray-900 text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">
                                    2
                                </div>
                                <div className="flex-1">
                                    <h4 className="font-semibold text-gray-900 mb-1">Obtener API Key</h4>
                                    <p className="text-gray-600 text-sm mb-2">
                                        Obtén tu API key desde el dashboard:
                                    </p>
                                    <a
                                        href="/api-key"
                                        className="inline-flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                                        </svg>
                                        Ir a API Key
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Available Tools */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 mb-6">
                    <h2 className="text-2xl font-bold text-gray-900 mb-6">Herramientas Disponibles</h2>

                    <div className="space-y-6">
                        {/* Tool 1 */}
                        <div className="border border-gray-200 rounded-lg p-6">
                            <div className="flex items-start gap-4 mb-4">
                                <div className="p-2 bg-gray-100 rounded">
                                    <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-lg font-bold text-gray-900 mb-2">
                                        <code className="bg-gray-100 px-2 py-1 rounded text-sm">generate_pdf</code>
                                    </h3>
                                    <p className="text-gray-600 mb-3">
                                        Genera un PDF desde una plantilla con datos dinámicos.
                                    </p>
                                    <div className="bg-gray-50 rounded p-3 mb-2">
                                        <p className="text-sm font-semibold text-gray-700 mb-1">Ejemplo de uso:</p>
                                        <p className="text-sm text-gray-600 italic">
                                            "Genera una factura para el cliente John Doe con número INV-001 y total de $100"
                                        </p>
                                    </div>
                                    <details className="mt-3">
                                        <summary className="cursor-pointer text-sm font-semibold text-gray-700 hover:text-gray-900">
                                            Ver parámetros
                                        </summary>
                                        <div className="mt-2 bg-gray-900 text-gray-100 rounded p-3 text-xs overflow-x-auto">
                                            <pre>{generatePdfExample}</pre>
                                        </div>
                                    </details>
                                </div>
                            </div>
                        </div>

                        {/* Tool 2 */}
                        <div className="border border-gray-200 rounded-lg p-6">
                            <div className="flex items-start gap-4">
                                <div className="p-2 bg-gray-100 rounded">
                                    <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                                    </svg>
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-lg font-bold text-gray-900 mb-2">
                                        <code className="bg-gray-100 px-2 py-1 rounded text-sm">list_templates</code>
                                    </h3>
                                    <p className="text-gray-600 mb-3">
                                        Lista todas las plantillas disponibles.
                                    </p>
                                    <div className="bg-gray-50 rounded p-3">
                                        <p className="text-sm font-semibold text-gray-700 mb-1">Ejemplo de uso:</p>
                                        <p className="text-sm text-gray-600 italic">
                                            "Muéstrame todas las plantillas de facturas disponibles"
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Tool 3 */}
                        <div className="border border-gray-200 rounded-lg p-6">
                            <div className="flex items-start gap-4">
                                <div className="p-2 bg-gray-100 rounded">
                                    <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                    </svg>
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-lg font-bold text-gray-900 mb-2">
                                        <code className="bg-gray-100 px-2 py-1 rounded text-sm">list_documents</code>
                                    </h3>
                                    <p className="text-gray-600 mb-3">
                                        Lista los documentos PDF generados.
                                    </p>
                                    <div className="bg-gray-50 rounded p-3">
                                        <p className="text-sm font-semibold text-gray-700 mb-1">Ejemplo de uso:</p>
                                        <p className="text-sm text-gray-600 italic">
                                            "Muéstrame los últimos 10 PDFs generados"
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Tool 4 */}
                        <div className="border border-gray-200 rounded-lg p-6">
                            <div className="flex items-start gap-4">
                                <div className="p-2 bg-gray-100 rounded">
                                    <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-lg font-bold text-gray-900 mb-2">
                                        <code className="bg-gray-100 px-2 py-1 rounded text-sm">get_document</code>
                                    </h3>
                                    <p className="text-gray-600 mb-3">
                                        Obtiene detalles y URL de descarga de un documento específico.
                                    </p>
                                    <div className="bg-gray-50 rounded p-3">
                                        <p className="text-sm font-semibold text-gray-700 mb-1">Ejemplo de uso:</p>
                                        <p className="text-sm text-gray-600 italic">
                                            "Dame el enlace de descarga del documento doc_abc123"
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Tool 5 */}
                        <div className="border border-gray-200 rounded-lg p-6">
                            <div className="flex items-start gap-4">
                                <div className="p-2 bg-gray-100 rounded">
                                    <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-lg font-bold text-gray-900 mb-2">
                                        <code className="bg-gray-100 px-2 py-1 rounded text-sm">search_documents</code>
                                    </h3>
                                    <p className="text-gray-600 mb-3">
                                        Busca documentos por nombre o rango de fechas.
                                    </p>
                                    <div className="bg-gray-50 rounded p-3">
                                        <p className="text-sm font-semibold text-gray-700 mb-1">Ejemplo de uso:</p>
                                        <p className="text-sm text-gray-600 italic">
                                            "Busca todas las facturas generadas en enero de 2024"
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Troubleshooting */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
                    <h2 className="text-2xl font-bold text-gray-900 mb-6">Solución de Problemas</h2>

                    <div className="space-y-4">
                        <div className="border-l-4 border-gray-900 pl-4">
                            <h3 className="font-bold text-gray-900 mb-2">El servidor no se conecta</h3>
                            <ul className="list-disc list-inside text-gray-600 space-y-1">
                                <li>Verifica que la URL de la API sea correcta</li>
                                <li>Confirma que tu API key sea válida</li>
                                <li>Asegúrate de que PDFGenAI esté corriendo</li>
                            </ul>
                        </div>

                        <div className="border-l-4 border-gray-900 pl-4">
                            <h3 className="font-bold text-gray-900 mb-2">Las herramientas no aparecen en Claude</h3>
                            <ul className="list-disc list-inside text-gray-600 space-y-1">
                                <li>Reinicia Claude Desktop completamente</li>
                                <li>Verifica la sintaxis del archivo de configuración</li>
                                <li>Revisa los logs de Claude Desktop para errores</li>
                            </ul>
                        </div>

                        <div className="border-l-4 border-gray-900 pl-4">
                            <h3 className="font-bold text-gray-900 mb-2">Error al generar PDFs</h3>
                            <ul className="list-disc list-inside text-gray-600 space-y-1">
                                <li>Verifica que la plantilla exista</li>
                                <li>Confirma que los datos sean válidos</li>
                                <li>Revisa los permisos de tu API key</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
