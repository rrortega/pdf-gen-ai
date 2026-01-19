"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useI18n } from "@/hooks/useI18n";

export default function RegisterPage() {
    const router = useRouter();
    const { t } = useI18n();
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        password: "",
        passwordConfirm: "",
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        // Client-side validation
        if (formData.password !== formData.passwordConfirm) {
            setError(t("Passwords do not match"));
            setLoading(false);
            return;
        }

        if (formData.password.length < 8) {
            setError(t("Password must be at least 8 characters"));
            setLoading(false);
            return;
        }

        try {
            const response = await fetch("/api/v1/auth/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                    name: formData.name,
                    email: formData.email,
                    password: formData.password,
                }),
            });

            const data = await response.json();

            if (data.success) {
                router.push("/dashboard");
            } else {
                setError(data.error || t("Registration failed"));
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
                <h2 className="text-3xl font-bold text-gray-900">{t("Create account")}</h2>
                <p className="mt-2 text-gray-600">{t("Get started with PDFGenAI")}</p>
            </div>

            {error && (
                <div className="mb-4 rounded-lg border border-red-400 bg-red-50 px-4 py-3 text-red-700">
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                        {t("Full name")}
                    </label>
                    <input
                        id="name"
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 focus:border-gray-500 focus:ring-2 focus:ring-gray-500 focus:outline-none"
                        required
                    />
                </div>

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
                        minLength={8}
                    />
                    <p className="mt-1 text-sm text-gray-500">{t("Must be at least 8 characters")}</p>
                </div>

                <div>
                    <label htmlFor="passwordConfirm" className="block text-sm font-medium text-gray-700 mb-2">
                        {t("Confirm password")}
                    </label>
                    <input
                        id="passwordConfirm"
                        type="password"
                        value={formData.passwordConfirm}
                        onChange={(e) => setFormData({ ...formData, passwordConfirm: e.target.value })}
                        className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 focus:border-gray-500 focus:ring-2 focus:ring-gray-500 focus:outline-none"
                        required
                        minLength={8}
                    />
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full rounded-lg bg-gray-900 px-4 py-3 font-semibold text-white hover:bg-gray-950 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:bg-gray-700 disabled:cursor-not-allowed transition-colors"
                >
                    {loading ? t("Creating account...") : t("Create account")}
                </button>
            </form>

            <div className="mt-6 text-center">
                <p className="text-sm text-gray-600">
                    {t("Already have an account?")}{" "}
                    <Link href="/login" className="font-medium text-gray-900 hover:text-gray-500">
                        {t("Sign in")}
                    </Link>
                </p>
            </div>
        </div>
    );
}
