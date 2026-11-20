/**
 * Pure dashboard statistics computation shared by the postgres branches of the
 * dashboard stats API route and the cached dashboard server data.
 */

interface StatDocument {
  $id?: string;
  template_id?: string;
  name?: string;
  status?: string;
  user_id?: string;
  $createdAt: string;
  size?: number | null;
  downloads?: number | null;
}

export interface DashboardStatsInput {
  templatesCount: number;
  documents: StatDocument[];
  /** template_id -> title lookup for the recent documents join. */
  templateTitles?: Record<string, string>;
  now?: Date;
}

export interface ComputedDashboardStats {
  stats: {
    templatesCount: number;
    documentsCount: number;
    totalStorage: number;
    totalTransferred: number;
    periodDays: number;
  };
  activityData: { date: string; created: number; downloads: number }[];
  recentDocuments: Record<string, unknown>[];
}

export function computeDashboardStats(input: DashboardStatsInput): ComputedDashboardStats {
  const documents = input.documents;
  const now = input.now ?? new Date();

  let totalStorage = 0;
  let totalTransferred = 0;
  for (const doc of documents) {
    const size = doc.size ?? 0;
    const downloads = doc.downloads ?? 0;
    totalStorage += size;
    totalTransferred += size * downloads;
  }

  // Adaptive period, mirroring the legacy route: 7 default, 30 after a week,
  // oldest window capped at 90 days.
  let periodDays = 7;
  if (documents.length > 0) {
    const oldest = documents[documents.length - 1];
    const oldestDate = new Date(oldest.$createdAt);
    const daysDiff = Math.ceil((now.getTime() - oldestDate.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff > 30) {
      periodDays = Math.min(daysDiff, 90);
    } else if (daysDiff > 7) {
      periodDays = 30;
    }
  }

  const activityMap = new Map<string, { created: number; downloads: number }>();
  for (let i = 0; i < periodDays; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    activityMap.set(date.toISOString().split("T")[0], { created: 0, downloads: 0 });
  }

  for (const doc of documents) {
    const dateKey = doc.$createdAt.split("T")[0];
    const bucket = activityMap.get(dateKey);
    if (bucket) {
      bucket.created += 1;
      const downloads = doc.downloads ?? 0;
      if (downloads > 0) {
        bucket.downloads += downloads;
      }
    }
  }

  const activityData = Array.from(activityMap.entries())
    .map(([date, data]) => ({ date, created: data.created, downloads: data.downloads }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const recentDocuments = documents.slice(0, 5).map((doc) => ({
    ...doc,
    template_name:
      (doc.template_id && input.templateTitles?.[doc.template_id]) || "Unknown",
  }));

  return {
    stats: {
      templatesCount: input.templatesCount,
      documentsCount: documents.length,
      totalStorage,
      totalTransferred,
      periodDays,
    },
    activityData,
    recentDocuments,
  };
}
