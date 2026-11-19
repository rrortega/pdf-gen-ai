import assert from 'node:assert/strict';
import { test } from 'node:test';
import { McpSessionStore } from '../src/lib/mcp-session.ts';
import { McpInputError, parseMcpRequest } from '../src/lib/mcp-input.ts';

test('keeps two MCP sessions isolated and cleans only their own resources', async () => {
  const store = new McpSessionStore();
  const closed = [];
  store.add('first', 'Bearer first', { close: async () => closed.push('first') });
  store.add('second', 'Bearer second', { close: async () => closed.push('second') });

  assert.equal(store.get('first', 'Bearer first')?.owner, 'Bearer first');
  assert.equal(store.get('first', 'Bearer second'), undefined);
  await store.close('first', 'Bearer second');
  assert.equal(store.get('first', 'Bearer first')?.owner, 'Bearer first');
  await store.close('first', 'Bearer first');
  assert.deepEqual(closed, ['first']);
  assert.equal(store.get('second', 'Bearer second')?.owner, 'Bearer second');
});

test('rejects oversized, malformed, batched, and deeply nested MCP input', () => {
  assert.throws(() => parseMcpRequest('{', 1), McpInputError);
  assert.throws(() => parseMcpRequest(JSON.stringify(Array(11).fill({}))), McpInputError);
  assert.throws(() => parseMcpRequest(JSON.stringify({ method: 'tools/call', params: { name: 'generate_pdf', arguments: { data: { a: { b: { c: { d: { e: { f: { g: { h: { i: 1 } } } } } } } } } } } })), McpInputError);
  assert.throws(() => parseMcpRequest('{}', 1_048_577), McpInputError);
});

test('accepts the existing single generate_pdf request shape', () => {
  const message = parseMcpRequest(JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: { name: 'generate_pdf', arguments: { template_id: 'template', name: 'invoice', data: { title: 'PDF' } } },
  }));
  assert.equal(message.params.arguments.data.title, 'PDF');
});
