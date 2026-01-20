"use client";

import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

export default function OAuthConsentPage() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const clientId = searchParams.get('client_id');
    const redirectUri = searchParams.get('redirect_uri');
    const scope = searchParams.get('scope') || 'read write';
    const state = searchParams.get('state');

    const handleAuthorize = async () => {
        setLoading(true);
        setError(null);

        try {
            // Construir la URL con todos los parámetros
            const params = new URLSearchParams();
            if (clientId) params.set('client_id', clientId);
            if (redirectUri) params.set('redirect_uri', redirectUri);
            if (scope) params.set('scope', scope);
            if (state) params.set('state', state);

            // Copiar todos los demás parámetros (code_challenge, etc.)
            searchParams.forEach((value, key) => {
                if (!['client_id', 'redirect_uri', 'scope', 'state'].includes(key)) {
                    params.set(key, value);
                }
            });

            // Redirigir al endpoint de autorización
            router.push(`/api/llm/mcp/auth?${params.toString()}`);
        } catch (err) {
            setError((err as Error).message);
            setLoading(false);
        }
    };

    const handleCancel = () => {
        if (redirectUri) {
            const url = new URL(redirectUri);
            url.searchParams.set('error', 'access_denied');
            url.searchParams.set('error_description', 'User denied access');
            if (state) url.searchParams.set('state', state);
            router.push(url.toString());
        }
    };

    return (
        <div className="min-h-screen bg-white flex items-center justify-center p-6">
            <div className="max-w-md w-full">
                <div className="border-2 border-gray-900 rounded-lg p-8">
                    {/* Header */}
                    <div className="text-center mb-8">
                        <div className="w-16 h-16 bg-gray-900 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                        </div>
                        <h1 className="text-2xl font-bold text-gray-900 mb-2">
                            Autorizar Acceso
                        </h1>
                        <p className="text-gray-600">
                            OpenAI ChatGPT solicita acceso a tu cuenta
                        </p>
                    </div>

                    {/* Permissions */}
                    <div className="bg-gray-50 border border-gray-300 rounded-lg p-6 mb-6">
                        <h2 className="font-bold text-gray-900 mb-4">Permisos solicitados:</h2>
                        <ul className="space-y-3">
                            {scope.split(' ').map((s) => (
                                <li key={s} className="flex items-start gap-3">
                                    <svg className="w-5 h-5 text-gray-900 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                    <span className="text-gray-700">
                                        {s === 'read' && 'Leer tus plantillas y documentos'}
                                        {s === 'write' && 'Generar nuevos documentos PDF'}
                                        {!['read', 'write'].includes(s) && s}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="bg-red-50 border border-red-300 rounded-lg p-4 mb-6">
                            <p className="text-sm text-red-900">{error}</p>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="space-y-3">
                        <button
                            onClick={handleAuthorize}
                            disabled={loading}
                            className="w-full px-6 py-3 bg-gray-900 text-white font-bold rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? 'Autorizando...' : 'Autorizar'}
                        </button>
                        <button
                            onClick={handleCancel}
                            disabled={loading}
                            className="w-full px-6 py-3 bg-white text-gray-900 font-bold border-2 border-gray-900 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Cancelar
                        </button>
                    </div>

                    {/* Info */}
                    <p className="text-xs text-gray-500 text-center mt-6">
                        Al autorizar, permitirás que ChatGPT acceda a tu cuenta de PDFGenAI con los permisos especificados.
                    </p>
                </div>
            </div>
        </div>
    );
}
