"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useI18n } from "@/hooks/useI18n";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { Logo } from "@/components/ui/logo";

interface User {
    id: string;
    email: string;
    name: string;
}

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const router = useRouter();
    const pathname = usePathname();
    const { t } = useI18n();
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(false);

    useEffect(() => {
        const checkAuth = async () => {
            try {
                const response = await fetch("/api/v1/auth/me", {
                    credentials: "include",
                });
                const data = await response.json();

                if (response.ok && data.success) {
                    setUser(data.user);
                } else {
                    router.push("/login");
                }
            } catch (error) {
                console.error("Auth check failed:", error);
                router.push("/login");
            } finally {
                setLoading(false);
            }
        };

        checkAuth();
    }, [router]);

    const handleLogout = async () => {
        try {
            await fetch("/api/v1/auth/logout", {
                method: "POST",
                credentials: "include",
            });
            router.push("/login");
        } catch (error) {
            console.error("Logout failed:", error);
        }
    };

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <div className="text-lg">{t("Loading...")}</div>
            </div>
        );
    }

    if (!user) {
        return null;
    }

    const navigation = [
        {
            name: t("Dashboard"),
            href: "/dashboard",
            icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
            )
        },
        {
            name: t("Templates"),
            href: "/templates",
            icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
            )
        },
        {
            name: t("Documents"),
            href: "/documents",
            icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
            )
        },
        {
            name: t("Api Key"),
            href: "/api-key",
            icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
            )
        },
        {
            name: t("MCP Server"),
            href: "/mcp",
            icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
            )
        },
    ];

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Desktop Sidebar */}
            <div
                className={`hidden lg:fixed lg:inset-y-0 lg:flex lg:flex-col transition-all duration-300 ${isCollapsed ? "lg:w-20" : "lg:w-64"
                    }`}
            >
                <div className="flex min-h-0 flex-1 flex-col bg-gray-900">
                    {/* Header with Logo and Collapse Button */}
                    <div className="flex items-center justify-between p-4 border-b border-gray-500">
                        {!isCollapsed && (
                            <Logo size="md" theme="dark" />
                        )}
                        {isCollapsed && (
                            <Logo size="sm" showText={false} theme="dark" />
                        )}
                        <button
                            onClick={() => setIsCollapsed(!isCollapsed)}
                            className="p-2 rounded-md text-white hover:bg-gray-950 transition-colors"
                            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                        >
                            {isCollapsed ? (
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                                </svg>
                            ) : (
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                                </svg>
                            )}
                        </button>
                    </div>

                    {/* Navigation Links */}
                    <nav className="flex-1 space-y-1 px-2 py-4">
                        {navigation.map((item) => {
                            const isActive = pathname === item.href;
                            return (
                                <a
                                    key={item.name}
                                    href={item.href}
                                    className={`group flex items-center rounded-md px-3 py-3 text-sm font-medium transition-colors ${isActive
                                        ? "bg-white text-gray-950"
                                        : "text-white hover:bg-gray-950"
                                        }`}
                                    title={isCollapsed ? item.name : undefined}
                                >
                                    <span className="flex-shrink-0">{item.icon}</span>
                                    {!isCollapsed && <span className="ml-3">{item.name}</span>}
                                </a>
                            );
                        })}
                    </nav>

                    {/* Bottom Section */}
                    <div className="border-t border-gray-500">
                        {/* User Info */}
                        <div className="p-4 border-b border-gray-500">
                            <div className="flex items-center">
                                <div className="flex-shrink-0">
                                    <div className="w-10 h-10 rounded-full bg-gray-950 flex items-center justify-center text-white font-semibold">
                                        {user.name.charAt(0).toUpperCase()}
                                    </div>
                                </div>
                                {!isCollapsed && (
                                    <div className="ml-3 flex-1 min-w-0">
                                        <p className="text-sm font-medium text-white truncate">
                                            {user.name}
                                        </p>
                                        <p className="text-xs text-gray-200 truncate">
                                            {user.email}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Language Switcher */}
                        <div className="p-4 border-b border-gray-500">
                            {isCollapsed ? (
                                <button
                                    className="w-full p-2 rounded-md text-white hover:bg-gray-950 transition-colors flex items-center justify-center"
                                    title="Change language"
                                    onClick={() => setIsCollapsed(false)}
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                                    </svg>
                                </button>
                            ) : (
                                <LanguageSwitcher variant="sidebar" />
                            )}
                        </div>

                        {/* Logout Button */}
                        <div className="p-4">
                            <button
                                onClick={handleLogout}
                                className="w-full flex items-center justify-center rounded-md bg-primary cursor-pointer border px-3 py-3 text-sm font-medium text-white hover:bg-red-700 transition-colors"
                                title={isCollapsed ? t("Logout") : undefined}
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                </svg>
                                {!isCollapsed && <span className="ml-2">{t("Logout")}</span>}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Mobile Header */}
            <div className="lg:hidden sticky top-0 z-10 flex h-16 flex-shrink-0 border-b border-gray-200 bg-white shadow-sm">
                <button
                    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    className="border-r border-gray-200 px-4 text-gray-500 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-gray-500"
                >
                    <span className="sr-only">Open sidebar</span>
                    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                </button>
                <div className="flex flex-1 justify-between px-4">
                    <div className="flex flex-1 items-center">
                        <Logo size="md" />
                    </div>
                </div>
            </div>

            {/* Mobile Sidebar Overlay */}
            {isMobileMenuOpen && (
                <div className="lg:hidden">
                    <div className="fixed inset-0 z-40 flex">
                        <div
                            className="fixed inset-0 bg-gray-600 bg-opacity-75"
                            onClick={() => setIsMobileMenuOpen(false)}
                        />
                        <div className="relative flex w-full max-w-xs flex-1 flex-col bg-gray-900">
                            <div className="absolute top-0 right-0 -mr-12 pt-2">
                                <button
                                    onClick={() => setIsMobileMenuOpen(false)}
                                    className="ml-1 flex h-10 w-10 items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
                                >
                                    <span className="sr-only">Close sidebar</span>
                                    <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>

                            <div className="flex flex-1 flex-col overflow-y-auto pt-5 pb-4">
                                <div className="flex flex-shrink-0 items-center px-4 mb-5">
                                    <Logo size="md" theme="dark" />
                                </div>
                                <nav className="flex-1 space-y-1 px-2">
                                    {navigation.map((item) => {
                                        const isActive = pathname === item.href;
                                        return (
                                            <a
                                                key={item.name}
                                                href={item.href}
                                                className={`group flex items-center rounded-md px-3 py-3 text-sm font-medium ${isActive
                                                    ? "bg-white text-gray-950"
                                                    : "text-white hover:bg-gray-950"
                                                    }`}
                                                onClick={() => setIsMobileMenuOpen(false)}
                                            >
                                                <span className="mr-3 flex-shrink-0">{item.icon}</span>
                                                {item.name}
                                            </a>
                                        );
                                    })}
                                </nav>
                            </div>

                            {/* Mobile Bottom Section */}
                            <div className="border-t border-gray-500">
                                <div className="p-4 border-b border-gray-500">
                                    <div className="flex items-center">
                                        <div className="flex-shrink-0">
                                            <div className="w-10 h-10 rounded-full bg-gray-950 flex items-center justify-center text-white font-semibold">
                                                {user.name.charAt(0).toUpperCase()}
                                            </div>
                                        </div>
                                        <div className="ml-3 flex-1">
                                            <p className="text-sm font-medium text-white">{user.name}</p>
                                            <p className="text-xs text-gray-200">{user.email}</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="p-4 border-b border-gray-500">
                                    <LanguageSwitcher variant="sidebar" />
                                </div>
                                <div className="p-4">
                                    <button
                                        onClick={handleLogout}
                                        className="w-full flex items-center justify-center rounded-md bg-transparent border border-promary px-3 py-3 text-sm font-medium text-white hover:bg-red-700"
                                    >
                                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                        </svg>
                                        {t("Logout")}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Main Content */}
            <div className={`transition-all duration-300 ${isCollapsed ? "lg:pl-20" : "lg:pl-64"}`}>
                <main className="flex-1">{children}</main>
            </div>

            {/* Mobile Bottom Navigation */}
            <div className="lg:hidden fixed bottom-0 left-0 right-0 z-10 border-t border-gray-200 bg-white">
                <nav className="flex justify-around">
                    {navigation.map((item) => {
                        const isActive = pathname === item.href;
                        return (
                            <a
                                key={item.name}
                                href={item.href}
                                className={`flex flex-col items-center px-3 py-2 text-xs font-medium ${isActive ? "text-gray-900" : "text-gray-600 hover:text-gray-900"
                                    }`}
                            >
                                <span className="mb-1">{item.icon}</span>
                                <span>{item.name}</span>
                            </a>
                        );
                    })}
                </nav>
            </div>
        </div>
    );
}
