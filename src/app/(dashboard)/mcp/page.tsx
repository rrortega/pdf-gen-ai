"use client";

import { useState, useEffect } from "react";

export default function MCPServerPage() {
    const [copiedSection, setCopiedSection] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'claude' | 'chatgpt'>('claude');
    const [userId, setUserId] = useState<string>('');

    const appUrl = typeof window !== 'undefined'
        ? window.location.origin
        : process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3030';

    useEffect(() => {
        const fetchUser = async () => {
            try {
                const response = await fetch('/api/user');
                if (response.ok) {
                    const data = await response.json();
                    setUserId(data.user.$id);
                }
            } catch (error) {
                console.error('Error fetching user:', error);
            }
        };
        fetchUser();
    }, []);

    const copyToClipboard = (text: string, section: string) => {
        navigator.clipboard.writeText(text);
        setCopiedSection(section);
        setTimeout(() => setCopiedSection(null), 2000);
    };

    return (
        <div className="min-h-screen bg-white py-12">
            <div className="max-w-4xl mx-auto px-6">
                {/* Header */}
                <div className="mb-12">
                    <h1 className="text-5xl font-bold text-gray-900 mb-3">
                        Servidor MCP
                    </h1>
                    <p className="text-xl text-gray-600">
                        Integra PDFGenAI con Claude Code y ChatGPT usando el protocolo MCP
                    </p>
                </div>

                {/* What is MCP */}
                <div className="border border-gray-900 rounded-lg p-8 mb-8">
                    <h2 className="text-2xl font-bold text-gray-900 mb-4">
                        ¿Qué es MCP?
                    </h2>
                    <p className="text-gray-700 leading-relaxed mb-6">
                        El <strong>Model Context Protocol (MCP)</strong> es un estándar abierto que permite a las aplicaciones de IA conectarse con fuentes de datos y herramientas externas. Nuestro servidor MCP expone las capacidades de PDFGenAI para que puedas generar PDFs desde Claude Code, ChatGPT y otros clientes compatibles.
                    </p>
                    <div className="bg-gray-100 border border-gray-300 rounded p-4">
                        <p className="text-sm font-mono text-gray-900">
                            <span className="font-bold">Endpoint:</span> {appUrl}/api/llm/mcp
                        </p>
                    </div>
                </div>

                {/* Herramientas Disponibles */}
                <div className="border border-gray-900 rounded-lg p-8 mb-8">
                    <h2 className="text-2xl font-bold text-gray-900 mb-6">
                        Herramientas Disponibles
                    </h2>
                    <div className="space-y-4">
                        <div className="border border-gray-300 rounded-lg p-6">
                            <h3 className="text-lg font-bold text-gray-900 mb-2">generate_pdf</h3>
                            <p className="text-gray-600 mb-4">Genera un PDF usando una plantilla y datos dinámicos</p>
                            <div className="bg-gray-100 rounded p-4 text-sm font-mono space-y-1.5 text-gray-900">
                                <div><span className="font-bold">template_id</span>: ID de la plantilla</div>
                                <div><span className="font-bold">data</span>: Objeto JSON con los datos</div>
                                <div><span className="font-bold">name</span>: Nombre del archivo PDF</div>
                            </div>
                        </div>
                        <div className="border border-gray-300 rounded-lg p-6">
                            <h3 className="text-lg font-bold text-gray-900 mb-2">list_templates</h3>
                            <p className="text-gray-600">Lista todas las plantillas disponibles</p>
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="border border-gray-900 rounded-lg overflow-hidden mb-8">
                    {/* Tab Headers */}
                    <div className="flex border-b border-gray-900">
                        <button
                            onClick={() => setActiveTab('claude')}
                            className={`flex-1 px-8 py-4 text-base font-bold transition-all ${activeTab === 'claude'
                                ? 'bg-gray-900 text-white'
                                : 'bg-white text-gray-600 hover:bg-gray-50'
                                }`}
                        >
                            Claude Code
                        </button>
                        <button
                            onClick={() => setActiveTab('chatgpt')}
                            className={`flex-1 px-8 py-4 text-base font-bold transition-all ${activeTab === 'chatgpt'
                                ? 'bg-gray-900 text-white'
                                : 'bg-white text-gray-600 hover:bg-gray-50'
                                }`}
                        >
                            ChatGPT
                        </button>
                    </div>

                    {/* Tab Content */}
                    <div className="p-8 bg-white">
                        {/* Claude Code Tab */}
                        {activeTab === 'claude' && (
                            <div className="space-y-8">
                                <div>
                                    <h3 className="text-2xl font-bold text-gray-900 mb-3">Configurar Claude Code</h3>
                                    <p className="text-gray-600 text-lg">
                                        Claude Code soporta MCP de forma nativa. Usa tu API key local para autenticarte.
                                    </p>
                                </div>

                                {/* Step 1 */}
                                <div className="space-y-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-gray-900 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                                            1
                                        </div>
                                        <h4 className="text-lg font-bold text-gray-900">Configura tu API Key</h4>
                                    </div>
                                    <p className="text-gray-600 ml-11">
                                        Puedes usar una API key local (variable de entorno) o generar una desde tu dashboard.
                                    </p>
                                    <div className="ml-11 space-y-5">
                                        <div>
                                            <p className="text-sm font-bold text-gray-900 mb-3">Opción A: Variable de entorno</p>
                                            <div className="relative">
                                                <pre className="bg-gray-900 text-gray-100 p-4 rounded text-sm overflow-x-auto">
                                                    export MCP_API_KEY=&quot;tu-clave-secreta-aqui&quot;
                                                </pre>
                                                <button
                                                    onClick={() => copyToClipboard('export MCP_API_KEY="tu-clave-secreta-aqui"', 'env')}
                                                    className="absolute top-3 right-3 px-3 py-1.5 bg-white text-gray-900 text-xs font-semibold rounded hover:bg-gray-100 transition-colors"
                                                >
                                                    {copiedSection === 'env' ? '✓ Copiado' : 'Copiar'}
                                                </button>
                                            </div>
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-gray-900 mb-3">Opción B: Generar desde dashboard</p>
                                            <a href="/api-key" className="inline-block px-6 py-3 bg-gray-900 text-white text-sm font-bold rounded hover:bg-gray-800 transition-colors">
                                                Generar API Key →
                                            </a>
                                        </div>
                                    </div>
                                </div>

                                {/* Step 2 */}
                                <div className="space-y-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-gray-900 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                                            2
                                        </div>
                                        <h4 className="text-lg font-bold text-gray-900">Añade el servidor MCP</h4>
                                    </div>
                                    <p className="text-gray-600 ml-11">
                                        Ejecuta este comando para añadir PDFGenAI a Claude Code:
                                    </p>
                                    <div className="ml-11 relative">
                                        <pre className="bg-gray-900 text-gray-100 p-4 rounded text-sm overflow-x-auto">
                                            {`claude mcp add pdfgenai ${appUrl}/api/llm/mcp \\
  --env "AUTHORIZATION=Bearer \${MCP_API_KEY}"`}
                                        </pre>
                                        <button
                                            onClick={() => copyToClipboard(`claude mcp add pdfgenai ${appUrl}/api/llm/mcp --env "AUTHORIZATION=Bearer \${MCP_API_KEY}"`, 'claude-cmd')}
                                            className="absolute top-3 right-3 px-3 py-1.5 bg-white text-gray-900 text-xs font-semibold rounded hover:bg-gray-100 transition-colors"
                                        >
                                            {copiedSection === 'claude-cmd' ? '✓ Copiado' : 'Copiar'}
                                        </button>
                                    </div>
                                </div>

                                {/* Step 3 */}
                                <div className="space-y-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-gray-900 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                                            3
                                        </div>
                                        <h4 className="text-lg font-bold text-gray-900">Prueba la conexión</h4>
                                    </div>
                                    <p className="text-gray-600 ml-11 mb-3">
                                        Abre Claude Code y pregunta:
                                    </p>
                                    <div className="ml-11 bg-gray-900 text-gray-100 p-4 rounded text-base">
                                        &quot;Lista las plantillas de PDF disponibles&quot;
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ChatGPT Tab */}
                        {activeTab === 'chatgpt' && (
                            <div className="space-y-8">
                                <div>
                                    <h3 className="text-2xl font-bold text-gray-900 mb-3">Integración con ChatGPT</h3>
                                    <p className="text-gray-600 text-lg">
                                        Conecta PDFGenAI con ChatGPT usando OAuth 2.0 para crear Custom GPTs que generen PDFs.
                                    </p>
                                </div>

                                {/* Step 1 */}
                                <div className="space-y-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-gray-900 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                                            1
                                        </div>
                                        <h4 className="text-lg font-bold text-gray-900">Obtén tus credenciales</h4>
                                    </div>
                                    <div className="ml-11 space-y-5">
                                        <div>
                                            <p className="text-sm font-bold text-gray-900 mb-3">Client ID (Tu User ID)</p>
                                            <div className="bg-gray-900 text-gray-100 p-4 rounded text-sm font-mono break-all">
                                                {userId || 'Cargando...'}
                                            </div>
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-gray-900 mb-3">Client Secret (Tu API Key)</p>
                                            <a href="/api-key" className="inline-block px-6 py-3 bg-gray-900 text-white text-sm font-bold rounded hover:bg-gray-800 transition-colors">
                                                Generar API Key →
                                            </a>
                                        </div>
                                    </div>
                                </div>

                                {/* Step 2 */}
                                <div className="space-y-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-gray-900 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                                            2
                                        </div>
                                        <h4 className="text-lg font-bold text-gray-900">Configura en ChatGPT</h4>
                                    </div>
                                    <p className="text-gray-600 ml-11">
                                        En la configuración de MCP de tu Custom GPT, ingresa estos valores:
                                    </p>
                                    <div className="ml-11 space-y-4">
                                        <div className="border border-gray-300 rounded p-4">
                                            <p className="text-xs font-bold text-gray-700 mb-2 uppercase tracking-wide">URL</p>
                                            <code className="text-sm text-gray-900 break-all">{appUrl}/api/llm/mcp</code>
                                        </div>
                                        <div className="border border-gray-300 rounded p-4">
                                            <p className="text-xs font-bold text-gray-700 mb-2 uppercase tracking-wide">OAuth Client ID</p>
                                            <code className="text-sm text-gray-900 break-all">{userId || 'Tu User ID del paso 1'}</code>
                                        </div>
                                        <div className="border border-gray-300 rounded p-4">
                                            <p className="text-xs font-bold text-gray-700 mb-2 uppercase tracking-wide">OAuth Secret</p>
                                            <code className="text-sm text-gray-900">Tu API Key del paso 1</code>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Troubleshooting */}
                <div className="border border-gray-900 rounded-lg p-8">
                    <h2 className="text-2xl font-bold text-gray-900 mb-6">
                        Solución de Problemas
                    </h2>
                    <div className="space-y-6">
                        <div className="border-l-4 border-gray-900 bg-gray-50 p-5">
                            <h3 className="font-bold text-gray-900 mb-3">Error 401 Unauthorized</h3>
                            <ul className="list-disc list-inside text-gray-700 space-y-2">
                                <li>Verifica que tu API key sea correcta</li>
                                <li>Asegúrate de incluir el prefijo &quot;Bearer &quot; en el header (solo para Claude Code)</li>
                                <li>Revisa que la variable de entorno esté configurada correctamente</li>
                            </ul>
                        </div>
                        <div className="border-l-4 border-gray-900 bg-gray-50 p-5">
                            <h3 className="font-bold text-gray-900 mb-3">No se conecta el servidor</h3>
                            <ul className="list-disc list-inside text-gray-700 space-y-2">
                                <li>Verifica que el endpoint sea accesible: <code className="bg-gray-900 text-gray-100 px-2 py-0.5 rounded text-sm">{appUrl}/api/llm/mcp</code></li>
                                <li>Comprueba que el servidor esté corriendo en producción</li>
                                <li>Revisa los logs del servidor para errores específicos</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
