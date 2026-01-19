"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useI18n } from "@/hooks/useI18n";

import { Suspense } from "react";

function ResetPasswordContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { t } = useI18n();
    const [formData, setFormData] = useState({
        password: "",
        passwordConfirm: "",
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [userId, setUserId] = useState("");
    const [secret, setSecret] = useState("");

    useEffect(() => {
        const userIdParam = searchParams.get("userId");
        const secretParam = searchParams.get("secret");

        if (!userIdParam || !secretParam) {
            setError(t("This password reset link is invalid or has expired."));
        } else {
            setUserId(userIdParam);
            setSecret(secretParam);
        }
    }, [searchParams, t]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

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
            const response = await fetch("/api/v1/auth/recovery/confirm", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    userId,
                    secret,
                    password: formData.password,
                    passwordConfirm: formData.passwordConfirm,
                }),
            });

            const data = await response.json();

            if (data.success) {
                // Redirect to login with success message
                router.push("/login?reset=success");
            } else {
                setError(data.error || t("Failed to reset password"));
            }
        } catch (err) {
            setError(t("Network error occurred"));
        } finally {
            setLoading(false);
        }
    };

    if (!userId || !secret) {
        return (
            <div className="w-full">
                <div className="mb-8">
                    <h2 className="text-3xl font-bold text-gray-900">{t("Invalid Link")}</h2>
                    <p className="mt-2 text-gray-600">
                        {t("This password reset link is invalid or has expired.")}
                    </p>
                </div>
                <Link
                    href="/recovery"
                    className="inline-block rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700"
                >
                    {t("Request new reset link")}
                </Link>
            </div>
        );
    }

    return (
        <div className="w-full">
            <div className="mb-8">
                <h2 className="text-3xl font-bold text-gray-900">{t("Set new password")}</h2>
                <p className="mt-2 text-gray-600">{t("Enter your new password below")}</p>
            </div>

            {error && (
                <div className="mb-4 rounded-lg border border-red-400 bg-red-50 px-4 py-3 text-red-700">
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                    <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                        {t("New password")}
                    </label>
                    <input
                        id="password"
                        type="password"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        required
                        minLength={8}
                    />
                    <p className="mt-1 text-sm text-gray-500">{t("Must be at least 8 characters")}</p>
                </div>

                <div>
                    <label htmlFor="passwordConfirm" className="block text-sm font-medium text-gray-700 mb-2">
                        {t("Confirm new password")}
                    </label>
                    <input
                        id="passwordConfirm"
                        type="password"
                        value={formData.passwordConfirm}
                        onChange={(e) => setFormData({ ...formData, passwordConfirm: e.target.value })}
                        className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        required
                        minLength={8}
                    />
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors"
                >
                    {loading ? t("Resetting password...") : t("Reset password")}
                </button>
            </form>

            <div className="mt-6 text-center">
                <Link href="/login" className="text-sm font-medium text-blue-600 hover:text-blue-500">
                    {t("Back to sign in")}
                </Link>
            </div>
        </div>
    );
}

export default function ResetPasswordPage() {
    return (
        <Suspense fallback={<div className="p-8 text-center">Loading...</div>}>
            <ResetPasswordContent />
        </Suspense>
    );
}
