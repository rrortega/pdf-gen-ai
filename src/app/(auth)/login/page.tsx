"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useI18n } from "@/hooks/useI18n";

export default function LoginPage() {
    const router = useRouter();
    const { t } = useI18n();
    const [formData, setFormData] = useState({
        email: "",
        password: "",
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            const response = await fetch("/api/v1/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify(formData),
            });

            const data = await response.json();

            if (data.success) {
                router.push("/dashboard");
            } else {
                setError(data.error || t("Login failed"));
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
                <h2 className="text-3xl font-bold text-gray-900">{t("Welcome back")}</h2>
                <p className="mt-2 text-gray-600">{t("Sign in to your account")}</p>
            </div>

            {error && (
                <div className="mb-4 rounded-lg border border-red-400 bg-red-50 px-4 py-3 text-red-700">
                    {error}
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
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 focus:border-gray-500 focus:ring-2 focus:ring-gray-500 focus:outline-none"
                        required
                    />
                </div>

                <div>
                    <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                        {t("Password")}
                    </label>
                    <input
                        id="password"
                        type="password"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 focus:border-gray-500 focus:ring-2 focus:ring-gray-500 focus:outline-none"
                        required
                    />
                </div>

                <div className="flex items-center justify-between">
                    <div className="text-sm">
                        <Link href="/recovery" className="font-medium text-gray-900 hover:text-gray-500">
                            {t("Forgot your password?")}
                        </Link>
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full rounded-lg bg-gray-900 px-4 py-3 font-semibold text-white hover:bg-gray-950 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:bg-gray-700 disabled:cursor-not-allowed transition-colors"
                >
                    {loading ? t("Signing in...") : t("Sign in")}
                </button>
            </form>

            <div className="mt-6 text-center">
                <p className="text-sm text-gray-600">
                    {t("Don't have an account?")}{" "}
                    <Link href="/register" className="font-medium text-gray-900 hover:text-gray-500">
                        {t("Sign up")}
                    </Link>
                </p>
            </div>
        </div>
    );
}
