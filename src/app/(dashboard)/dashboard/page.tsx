"use client";

import { useCallback, useEffect, useState } from "react";
import { useI18n } from "@/hooks/useI18n";
import { ComposedChart, Area, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface DashboardStats {
    templatesCount: number;
    documentsCount: number;
    totalStorage: number;
    periodDays: number;
}

interface ActivityData {
    date: string;
    created: number;
    downloads: number;
}

interface RecentDocument {
    $id: string;
    name: string;
    template_name: string;
    size?: number;
    status: string;
    $createdAt: string;
}

export default function DashboardPage() {
    const { t, locale } = useI18n();
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [activityData, setActivityData] = useState<ActivityData[]>([]);
    const [recentDocuments, setRecentDocuments] = useState<RecentDocument[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchDashboardData = useCallback(async () => {
        try {
            setLoading(true);
            const response = await fetch("/api/v1/dashboard/stats");
            if (!response.ok) throw new Error("Failed to fetch dashboard data");

            const data = await response.json();
            setStats(data.stats);
            setActivityData(data.activityData);
            setRecentDocuments(data.recentDocuments);
        } catch (error) {
            console.error("Error fetching dashboard data:", error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchDashboardData();
    }, [fetchDashboardData]);

    const formatStorage = (kb: number) => {
        if (kb < 1024) return `${kb} KB`;
        const mb = kb / 1024;
        if (mb < 1024) return `${mb.toFixed(2)} MB`;
        const gb = mb / 1024;
        return `${gb.toFixed(2)} GB`;
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString(locale === 'es' ? 'es-ES' : 'en-US');
    };


    if (loading) {
        return (
            <div className="px-4 py-6 sm:px-6 lg:px-8 animate-pulse">
                {/* Header Skeleton */}
                <div className="mb-8">
                    <div className="h-10 bg-gray-200 rounded-lg w-48 mb-3"></div>
                    <div className="h-5 bg-gray-100 rounded-md w-96"></div>
                </div>

                {/* Statistics Tiles Skeletons */}
                <div className="grid gap-6 md:grid-cols-3 mb-8">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="h-32 bg-gray-200 rounded-xl border-2 border-gray-100"></div>
                    ))}
                </div>

                {/* Activity Chart Skeleton */}
                <div className="mb-8 bg-white p-8 border-y border-gray-200">
                    <div className="h-7 bg-gray-200 rounded-lg w-64 mb-6"></div>
                    <div className="h-80 bg-gray-100 rounded-xl w-full"></div>
                </div>

                {/* Recent Documents Skeleton */}
                <div>
                    <div className="h-8 bg-gray-200 rounded-lg w-56 mb-5"></div>
                    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                        {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="p-5 border-b border-gray-100 flex justify-between items-center">
                                <div className="space-y-2">
                                    <div className="h-4 bg-gray-200 rounded w-48"></div>
                                    <div className="h-3 bg-gray-100 rounded w-32"></div>
                                </div>
                                <div className="h-6 bg-gray-200 rounded-full w-20"></div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <>
            <div className="px-4 py-6 sm:px-6 lg:px-8">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900">{t("Dashboard")}</h1>
                    <p className="mt-2 text-gray-600">{t("Overview of your PDF generation activity")}</p>
                </div>

                {/* Statistics Tiles */}
                <div className="grid gap-6 md:grid-cols-3 mb-8">
                    {/* Templates Count */}
                    <div className="rounded-lg border-2 border-gray-200 bg-gradient-to-br from-gray-50 to-white p-6 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-950">{t("Total Templates")}</p>
                                <p className="mt-2 text-3xl font-bold text-black">{stats?.templatesCount || 0}</p>
                            </div>
                            <div className="p-3 bg-gray-100 rounded-lg">
                                <svg className="w-8 h-8 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                            </div>
                        </div>
                    </div>

                    {/* Documents Count */}
                    <div className="rounded-lg border-2 border-green-200 bg-gradient-to-br from-green-50 to-white p-6 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-green-700">{t("Documents Generated")}</p>
                                <p className="mt-2 text-3xl font-bold text-green-900">{stats?.documentsCount || 0}</p>
                            </div>
                            <div className="p-3 bg-green-100 rounded-lg">
                                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                </svg>
                            </div>
                        </div>
                    </div>

                    {/* Storage Used */}
                    <div className="rounded-lg border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-white p-6 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-purple-700">{t("Storage Used")}</p>
                                <p className="mt-2 text-3xl font-bold text-purple-900">{formatStorage(stats?.totalStorage || 0)}</p>
                            </div>
                            <div className="p-3 bg-purple-100 rounded-lg">
                                <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                                </svg>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Activity Chart - Full Width */}
            <div className="mb-8">
                <div className="bg-white p-6 sm:p-8 shadow-sm border-y border-gray-200">
                    <h2 className="text-xl font-bold text-gray-900 mb-4">
                        {t("Document Generation Activity")} ({stats?.periodDays} {t("days")})
                    </h2>
                    <div className="mb-4 flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 bg-gray-500 rounded"></div>
                            <span className="text-gray-600">{t("Documents Created")}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 bg-green-400 rounded"></div>
                            <span className="text-gray-600">{t("Downloads")}</span>
                        </div>
                    </div>
                    <div className="w-full h-80">
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart
                                data={activityData}
                                margin={{ top: 10, right: 30, left: 0, bottom: 20 }}
                            >
                                <defs>
                                    <linearGradient id="colorDownloads" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#4ade80" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#4ade80" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                <XAxis
                                    dataKey="date"
                                    tickFormatter={(value) => {
                                        const date = new Date(value);
                                        return date.toLocaleDateString(locale === 'es' ? 'es-ES' : 'en-US', { month: 'short', day: 'numeric' });
                                    }}
                                    stroke="#6b7280"
                                    fontSize={12}
                                    angle={-45}
                                    textAnchor="end"
                                    height={60}
                                />
                                <YAxis stroke="#6b7280" fontSize={12} />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: 'white',
                                        border: '1px solid #e5e7eb',
                                        borderRadius: '8px',
                                        padding: '12px'
                                    }}
                                    labelFormatter={(value) => {
                                        const date = new Date(value);
                                        return date.toLocaleDateString(locale === 'es' ? 'es-ES' : 'en-US', {
                                            weekday: 'short',
                                            month: 'short',
                                            day: 'numeric'
                                        });
                                    }}
                                    formatter={(value: number | undefined, name: string | undefined) => {
                                        if (value === undefined) return ['', ''];
                                        const label = name === 'created' ? t('created') : t('downloads');
                                        return [value, label];
                                    }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="downloads"
                                    fill="url(#colorDownloads)"
                                    stroke="#4ade80"
                                    strokeWidth={2}
                                />
                                <Bar
                                    dataKey="created"
                                    fill="#3b82f6"
                                    radius={[4, 4, 0, 0]}
                                    maxBarSize={20}
                                />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            <div className="px-4 py-6 sm:px-6 lg:px-8">
                {/* Recent Documents */}
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-4">{t("Recent Documents")}</h2>
                    <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
                        {recentDocuments.length === 0 ? (
                            <p className="text-center text-gray-500 py-8">
                                {t("No documents yet. Start by generating your first PDF.")}
                            </p>
                        ) : (
                            <div className="divide-y divide-gray-200">
                                {recentDocuments.map((doc) => (
                                    <div key={doc.$id} className="p-4 hover:bg-gray-50 transition-colors">
                                        <div className="flex items-center justify-between">
                                            <div className="flex-1 min-w-0">
                                                <h3 className="text-sm font-semibold text-gray-900 truncate">{doc.name}</h3>
                                                <div className="flex items-center gap-3 mt-1">
                                                    <span className="text-xs text-gray-500">{doc.template_name}</span>
                                                    {doc.size !== undefined && (
                                                        <span className="text-xs text-gray-500">{doc.size} KB</span>
                                                    )}
                                                    <span className="text-xs text-gray-400">{formatDate(doc.$createdAt)}</span>
                                                </div>
                                            </div>
                                            <span className={`ml-4 text-[10px] px-2 py-1 rounded-full font-bold uppercase ${doc.status === 'completed' ? 'bg-green-100 text-green-700' :
                                                doc.status === 'failed' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                                                }`}>
                                                {t(doc.status)}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

        </>
    );
}
