import assert from 'node:assert/strict';
import { test } from 'node:test';
import { NextRequest } from 'next/server';
import { renderHbsHtml, TemplateHtmlError } from '../src/lib/hbs.ts';
import { POST as previewHtml } from '../src/app/api/v1/templates/preview-html/route.ts';

test('renders valid Handlebars templates with existing helpers', () => {
  assert.equal(renderHbsHtml('<h1>{{uppercase title}}</h1>', { title: 'pdf' }), '<h1>PDF</h1>');
});

test('rejects non-string and oversized HTML before compilation', () => {
  assert.throws(() => renderHbsHtml({}), TemplateHtmlError);
  assert.throws(() => renderHbsHtml('x'.repeat(1_048_577), {}), TemplateHtmlError);
});

test('preview HTML returns 400 for malformed template input and preserves valid output', async () => {
  const malformed = await previewHtml(new NextRequest('http://localhost/api/v1/templates/preview-html', {
    method: 'POST', body: JSON.stringify({ html: { not: 'a string' } }),
  }));
  assert.equal(malformed.status, 400);

  const valid = await previewHtml(new NextRequest('http://localhost/api/v1/templates/preview-html', {
    method: 'POST', body: JSON.stringify({ html: '<h1>{{title}}</h1>', test_data: { title: 'PDF' } }),
  }));
  assert.equal(valid.status, 200);
  assert.match(await valid.text(), /<h1>PDF<\/h1>/);
});
