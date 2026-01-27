"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/hooks/useI18n";
import { ComposedChart, Area, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { getAppwriteClientSafe } from "@/lib/appwrite-client";
import { useRouter } from "next/navigation";

export interface DashboardData {
    stats: {
        templatesCount: number;
        documentsCount: number;
        totalFiles: number;
        totalStorage: number;
        totalTransferred: number;
        periodDays: number;
    };
    activityData: {
        date: string;
        created: number;
        downloads: number;
    }[];
    recentDocuments: {
        $id: string;
        name: string;
        template_name: string;
        size?: number;
        status: string;
        user_id: string;
        $createdAt: string;
    }[];
}

interface DashboardViewProps {
    initialData: DashboardData;
    currentUserId: string;
}

interface MetricCardProps {
    title: string;
    value: string | number;
    icon: React.ReactNode;
    color: string;
}

const MetricCard: React.FC<MetricCardProps> = ({ title, value, icon, color }) => {
    const styles: Record<string, { border: string, bg: string, text: string, iconBg: string }> = {
        blue: {
            border: "border-gray-300",
            bg: "bg-gradient-to-br from-blue-50 to-white",
            text: "text-blue-900",
            iconBg: "bg-blue-100"
        },
        green: {
            border: "border-green-300",
            bg: "bg-gradient-to-br from-green-50 to-white",
            text: "text-green-900",
            iconBg: "bg-green-100"
        },
        purple: {
            border: "border-purple-300",
            bg: "bg-gradient-to-br from-purple-50 to-white",
            text: "text-purple-900",
            iconBg: "bg-purple-100"
        },
        orange: {
            border: "border-orange-300",
            bg: "bg-gradient-to-br from-orange-50 to-white",
            text: "text-orange-900",
            iconBg: "bg-orange-100"
        }
    };

    const style = styles[color] || styles.blue;

    return (
        <div className={`rounded-lg border-2 ${style.border} ${style.bg} p-6 shadow-sm hover:shadow-md transition-shadow`}>
            <div className="flex items-center justify-between">
                <div>
                    <p className={`text-sm font-medium ${style.text}`}>{title}</p>
                    <p className="mt-2 text-3xl font-bold text-black">{value}</p>
                </div>
                <div className={`p-3 ${style.iconBg} rounded-lg`}>
                    {icon}
                </div>
            </div>
        </div>
    );
};

export default function DashboardView({ initialData, currentUserId }: DashboardViewProps) {
    const { t, locale } = useI18n();
    const router = useRouter();

    const [stats, setStats] = useState(initialData.stats);
    const [activityData, setActivityData] = useState(initialData.activityData);
    const [recentDocuments, setRecentDocuments] = useState(initialData.recentDocuments);

    // We already have data, so not initial loading.
    // However, if we refresh data via realtime, we might want a loading indicator?
    // Or just valid SWR-like behavior.

    const [jwtReady, setJwtReady] = useState(false);

    const userIdRef = useRef(currentUserId);

    // Sync ref
    useEffect(() => {
        userIdRef.current = currentUserId;
    }, [currentUserId]);

    // Realtime Setup
    useEffect(() => {
        // Authenticate Client SDK for realtime
        const initRealtimeAuth = async () => {
            try {
                const authResponse = await fetch("/api/v1/auth/me");
                if (authResponse.ok) {
                    const data = await authResponse.json();
                    if (data.jwt) {
                        const client = getAppwriteClientSafe();
                        client.setJWT(data.jwt);
                        setJwtReady(true);
                    }
                }
            } catch (e) {
                console.error("Failed to init realtime auth:", e);
            }
        };
        initRealtimeAuth();
    }, []);

    // Realtime Subscription
    useEffect(() => {
        if (!jwtReady) return;

        const unsubscribers: (() => void)[] = [];

        const setupRealtime = () => {
            try {
                const client = getAppwriteClientSafe();
                const databaseId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || "6968108e00298587f520";
                const collectionId = process.env.NEXT_PUBLIC_APPWRITE_DOCUMENTS_COLLECTION_ID || "documents";
                const channel = `databases.${databaseId}.collections.${collectionId}.documents`;

                console.log(`[DASHBOARD-REALTIME] Subscribing to: ${channel}`);

                const unsubscribe = client.subscribe(
                    channel,
                    (response: { events: string[], payload: DashboardData['recentDocuments'][0] }) => {
                        const event = response.events[0];
                        const payload = response.payload;

                        // Security check
                        if (userIdRef.current && payload.user_id !== userIdRef.current) return;

                        // If create/delete/update, we should refresh stats.
                        // Since stats are calculated on server, we need to re-fetch from server.
                        // The best way in Next.js Server Components world is `router.refresh()`.
                        if (event.includes('.create') || event.includes('.delete') || event.includes('.update')) {
                            console.log('[DASHBOARD-REALTIME] Refreshing data...');
                            router.refresh();
                            // router.refresh() will re-run the Server Component (Cached),
                            // BUT if the Server Component is cached with `use cache` and a time-based life,
                            // it might return stale data unless we invalidate it.
                            // We used `cacheTag("dashboard", ...)` in `data.ts`.
                            // Ideally we should call a Server Action to revalidate tag.
                            // Or relying on `stale: 60` means it updates eventually.
                            // For immediate feedback, we might want to manually update purely UI state if possible,
                            // or just accept eventual consistency.
                            // The previous implementation fetched `/api/v1/dashboard/stats` which was dynamic.

                            // Update local `recentDocuments` for smooth updates if it's an update event
                            if (event.includes('.update')) {
                                setRecentDocuments((prev) => {
                                    const exists = prev.some(doc => doc.$id === payload.$id);
                                    if (!exists) return prev;
                                    return prev.map(doc =>
                                        doc.$id === payload.$id ? { ...doc, ...payload, template_name: doc.template_name /* carry over */ } : doc
                                    );
                                });
                            }
                        }
                    }
                );
                unsubscribers.push(unsubscribe);
            } catch (error) {
                console.error('Dashboard realtime setup error:', error);
            }
        };

        setupRealtime();

        return () => {
            unsubscribers.forEach(unsub => unsub());
        };
    }, [jwtReady, router]);

    // Update state when initialData changes (e.g. after router.refresh())
    useEffect(() => {
        setStats(initialData.stats);
        setActivityData(initialData.activityData);
        setRecentDocuments(initialData.recentDocuments);
    }, [initialData]);

    const formatStorage = (kb: number) => {
        if (kb < 1024) return `${kb.toFixed(2)} KB`;
        const mb = kb / 1024;
        if (mb < 1024) return `${mb.toFixed(2)} MB`;
        const gb = mb / 1024;
        return `${gb.toFixed(2)} GB`;
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString(locale === 'es' ? 'es-ES' : 'en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <div className="px-4 py-6 sm:px-6 lg:px-8">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900">{t("Dashboard")}</h1>
            </div>

            {/* Statistics Grid */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
                <MetricCard
                    title={t("Total Templates")}
                    value={stats?.templatesCount || 0}
                    color="blue"
                    icon={<svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>}
                />
                <MetricCard
                    title={t("Documents Generated")}
                    value={stats?.documentsCount || 0}
                    color="green"
                    icon={<svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>}
                />
                <MetricCard
                    title={t("Storage Used")}
                    value={formatStorage(stats?.totalStorage || 0)}
                    color="purple"
                    icon={<svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" /></svg>}
                />
                <MetricCard
                    title={t("Data Transferred")}
                    value={formatStorage(stats?.totalTransferred || 0)}
                    color="orange"
                    icon={
                        <svg className="w-8 h-8 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                        </svg>
                    }
                />
            </div>

            {/* Activity Chart */}
            <h2 className="text-xl font-bold text-gray-900 mb-6">
                {t("Document Generation Activity")} ({stats?.periodDays} {t("days")})
            </h2>
            <div className="mb-8 bg-white p-6 rounded-2xl border border-gray-300 shadow-sm">

                <div className="w-full h-80">
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={activityData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorDownloads" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.1} />
                                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                            <XAxis
                                dataKey="date"
                                tickFormatter={(v) => formatDate(v).split(',')[0]}
                                stroke="#9ca3af"
                                fontSize={10}
                                fontWeight={600}
                                axisLine={false}
                                tickLine={false}
                                dy={10}
                            />
                            <YAxis
                                stroke="#9ca3af"
                                fontSize={10}
                                fontWeight={600}
                                axisLine={false}
                                tickLine={false}
                            />
                            <Tooltip
                                contentStyle={{
                                    borderRadius: '16px',
                                    border: 'none',
                                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                                    padding: '12px'
                                }}
                            />
                            <Area
                                type="monotone"
                                dataKey="downloads"
                                fill="url(#colorDownloads)"
                                stroke="#8b5cf6"
                                strokeWidth={3}
                                dot={{ r: 4, fill: '#8b5cf6', strokeWidth: 2, stroke: '#fff' }}
                                activeDot={{ r: 6, strokeWidth: 0 }}
                            />
                            <Bar
                                dataKey="created"
                                fill="#3b82f6"
                                radius={[6, 6, 0, 0]}
                                maxBarSize={30}
                            />
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Recent Documents */}
            <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">{t("Recent Documents")}</h2>
                <div className="rounded-lg border border-gray-300 bg-white shadow-sm overflow-hidden min-h-[200px] ">
                    {recentDocuments.length === 0 ? (
                        <p className="text-center text-gray-500 py-12">
                            {t("No documents yet. Start by generating your first PDF.")}
                        </p>
                    ) : (
                        <div className="divide-y divide-gray-200 mb-20 md:mb-2">
                            {recentDocuments.map((doc) => (
                                <div key={doc.$id} className="p-4 hover:bg-gray-50 transition-colors">
                                    <div className="flex items-center justify-between">
                                        <div className="flex-1 min-w-0">
                                            <h3 className="text-sm font-semibold text-gray-900 truncate">{doc.name}</h3>
                                            <p className="text-xs text-gray-500 mt-1">{doc.template_name} • {doc.size ? `${doc.size} KB` : '0 KB'} • {formatDate(doc.$createdAt)}</p>
                                        </div>
                                        <span className={`text-[10px] px-2.1 py-1 rounded-full font-bold uppercase ${doc.status === 'completed' ? 'bg-green-100 text-green-700' :
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
    );
}
