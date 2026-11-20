import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import {
  runPostgresDataMigrations,
} from '../src/backend/postgres/migrate.ts';

const migrationSql = readFileSync(
  new URL('../scripts/migrations/001-postgres-data-backend.sql', import.meta.url),
  'utf8',
);

test('every migration statement is idempotent and non-destructive', () => {
  const createTableStatements = migrationSql.match(/create table[^;]+;/gis) ?? [];
  assert.ok(createTableStatements.length >= 3);
  for (const statement of createTableStatements) {
    assert.match(statement, /if not exists/i);
  }

  const createIndexStatements = migrationSql.match(/create index[^;]+;/gis) ?? [];
  for (const statement of createIndexStatements) {
    assert.match(statement, /if not exists/i);
  }

  assert.doesNotMatch(migrationSql, /drop (table|column|index)/i);
  assert.doesNotMatch(migrationSql, /truncate/i);
});

test('document statuses cover queued, pending, completed, failed and trashed', () => {
  assert.match(migrationSql, /'queued'\s*,\s*'pending'\s*,\s*'completed'\s*,\s*'failed'\s*,\s*'trashed'/);
});

test('templates, documents and webhook deliveries cover the fields the legacy path writes', () => {
  const tables = { templates: '', documents: '', webhook_deliveries: '' };
  for (const match of migrationSql.matchAll(/create table (?:if not exists )?(\w+)\s*\(([\s\S]*?)\n\);/gi)) {
    tables[match[1]] = match[2];
  }

  for (const column of ['user_id', 'title', 'description', 'tags', 'html', 'css', 'test_data', 'orientation', 'paper_size', 'margin_top', 'margin_right', 'margin_bottom', 'margin_left']) {
    assert.match(tables.templates, new RegExp(column, 'i'), `templates.${column}`);
  }

  for (const column of ['user_id', 'template_id', 'name', 'pdf_file', 'data', 'status', 'size', 'downloads', 'signature', 'error_message', 'webhook_callback', 'webhook_response', 'webhook_retry']) {
    assert.match(tables.documents, new RegExp(column, 'i'), `documents.${column}`);
  }

  for (const column of ['document_id', 'url', 'retry', 'response', 'payload', 'execution_time']) {
    assert.match(tables.webhook_deliveries, new RegExp(column, 'i'), `webhook_deliveries.${column}`);
  }
});

test('migration runner executes the whole script and repeats it unchanged', async () => {
  const executed = [];
  const executor = {
    async query(text) {
      executed.push(text);
      return { rows: [] };
    },
  };

  await runPostgresDataMigrations(executor, migrationSql);
  await runPostgresDataMigrations(executor, migrationSql);

  assert.equal(executed.length, 2);
  assert.equal(executed[0], migrationSql);
  assert.equal(executed[1], migrationSql);
});
