"use client";

import { useState } from "react";
import Link from "next/link";
import { useI18n } from "@/hooks/useI18n";

export default function RecoveryPage() {
    const { t } = useI18n();
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");
        setSuccess(false);

        try {
            const response = await fetch("/api/v1/auth/recovery", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email }),
            });

            const data = await response.json();

            if (data.success) {
                setSuccess(true);
                setEmail("");
            } else {
                setError(data.error || t("Failed to send recovery email"));
            }
        } catch (err) {
            setError(t("Network error occurred"));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-full">
            <div className="mb-8">
                <h2 className="text-3xl font-bold text-gray-900">{t("Reset password")}</h2>
                <p className="mt-2 text-gray-600">
                    {t("Enter your email address and we'll send you a link to reset your password")}
                </p>
            </div>

            {error && (
                <div className="mb-4 rounded-lg border border-red-400 bg-red-50 px-4 py-3 text-red-700">
                    {error}
                </div>
            )}

            {success && (
                <div className="mb-4 rounded-lg border border-green-400 bg-green-50 px-4 py-3 text-green-700">
                    {t("Recovery email sent! Please check your inbox and follow the instructions.")}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                        {t("Email address")}
                    </label>
                    <input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 focus:border-gray-500 focus:ring-2 focus:ring-gray-500 focus:outline-none"
                        required
                    />
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full rounded-lg bg-gray-900 px-4 py-3 font-semibold text-white hover:bg-gray-950 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:bg-gray-700 disabled:cursor-not-allowed transition-colors"
                >
                    {loading ? t("Sending...") : t("Send recovery email")}
                </button>
            </form>

            <div className="mt-6 text-center">
                <Link href="/login" className="text-sm font-medium text-gray-900 hover:text-gray-500">
                    {t("Back to sign in")}
                </Link>
            </div>
        </div>
    );
}
