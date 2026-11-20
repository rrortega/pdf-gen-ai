import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  computeDashboardStats,
} from '../src/backend/data/dashboard-stats.ts';
import {
  usesSelfHostedBackend,
} from '../src/lib/realtime-mode.ts';

const NOW = new Date('2026-02-10T12:00:00.000Z');

const day = (offset) => {
  const date = new Date('2026-02-10T12:00:00.000Z');
  date.setUTCDate(date.getUTCDate() - offset);
  return date.toISOString();
};

test('dashboard stats sum storage and transferred kilobytes per document', () => {
  const stats = computeDashboardStats({ now: NOW,
    templatesCount: 2,
    documents: [
      { $createdAt: day(0), size: 100, downloads: 3 },
      { $createdAt: day(0), size: 50, downloads: 0 },
    ],
  });

  assert.equal(stats.stats.templatesCount, 2);
  assert.equal(stats.stats.documentsCount, 2);
  assert.equal(stats.stats.totalStorage, 150);
  assert.equal(stats.stats.totalTransferred, 300);
});

test('period adapts to the oldest document and caps at 90 days', () => {
  assert.equal(computeDashboardStats({ now: NOW, templatesCount: 0, documents: [] }).stats.periodDays, 7);
  assert.equal(
    computeDashboardStats({ now: NOW, templatesCount: 0, documents: [{ $createdAt: day(10), size: 0, downloads: 0 }] }).stats.periodDays,
    30,
  );
  assert.equal(
    computeDashboardStats({ now: NOW, templatesCount: 0, documents: [{ $createdAt: day(40), size: 0, downloads: 0 }] }).stats.periodDays,
    40,
  );
  assert.equal(
    computeDashboardStats({ now: NOW, templatesCount: 0, documents: [{ $createdAt: day(200), size: 0, downloads: 0 }] }).stats.periodDays,
    90,
  );
});

test('activity buckets are sorted ascending and only count documents inside the window', () => {
  const activityData = computeDashboardStats({ now: NOW,
    templatesCount: 0,
    documents: [
      { $createdAt: day(1), size: 0, downloads: 2 },
      { $createdAt: day(0), size: 0, downloads: 1 },
      { $createdAt: day(400), size: 0, downloads: 99 },
    ],
  }).activityData;

  assert.ok(activityData.length >= 7);
  const dates = activityData.map((entry) => entry.date);
  assert.deepEqual(dates, [...dates].sort((a, b) => a.localeCompare(b)));

  const yesterday = activityData.find((entry) => entry.date === day(1).split('T')[0]);
  assert.equal(yesterday.downloads, 2);
  const today = activityData.find((entry) => entry.date === day(0).split('T')[0]);
  assert.equal(today.created, 1);
  assert.equal(today.downloads, 1);
});

test('recent documents join template titles with a stable fallback', () => {
  const recent = computeDashboardStats({ now: NOW,
    templatesCount: 2,
    documents: [
      { $id: 'd1', template_id: 't1', name: 'First', status: 'completed', user_id: 'u1', $createdAt: day(0), size: 5, downloads: 1 },
      { $id: 'd2', template_id: 'missing', name: 'Second', status: 'failed', user_id: 'u1', $createdAt: day(1), size: 0, downloads: 0 },
    ],
    templateTitles: { t1: 'Invoice' },
  }).recentDocuments;

  assert.equal(recent.length, 2);
  assert.equal(recent[0].template_name, 'Invoice');
  assert.equal(recent[1].template_name, 'Unknown');
  assert.equal(recent[0].name, 'First');
  assert.equal(recent[0].$id, 'd1');
});

test('the browser only polls when the self-hosted backend is selected', () => {
  assert.equal(usesSelfHostedBackend({}), false);
  assert.equal(usesSelfHostedBackend({ NEXT_PUBLIC_BACKEND_PROVIDER: 'appwrite' }), false);
  assert.equal(usesSelfHostedBackend({ NEXT_PUBLIC_BACKEND_PROVIDER: 'postgres' }), true);
});
