/**
 * JSON-LD structured data — protects Phases 170-180 (Product / BlogPosting
 * / CollectionPage enrichments) at the SSR level. Test surface is the
 * non-Shopify routes only — homepage (Organization, LocalBusiness,
 * WebSite, FAQPage) and /sleep-quiz (Quiz, BreadcrumbList).
 *
 * Each test parses a specific <script id="ld-*" type="application/ld+json">
 * block and asserts on its @type plus the most load-bearing enrichment
 * fields that prior phases added. These are the assertions that would
 * fire if a future refactor accidentally dropped a structured-data field
 * (which is invisible at runtime — the page still renders).
 */

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { fetchHtml, expect200 } from './_helpers.mjs';

function parseLd($, id) {
  const raw = $(`script#${id}`).text();
  if (!raw) throw new Error(`missing <script id="${id}"> on the page`);
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(`<script id="${id}"> JSON parse failed: ${err.message}\n--- raw ---\n${raw.slice(0, 400)}`);
  }
}

test('homepage emits ld-organization with Organization @type', async () => {
  const res = await fetchHtml('/');
  expect200(res, '/');
  const ld = parseLd(res.$, 'ld-organization');
  assert.equal(ld['@type'], 'Organization');
  assert.ok(ld.name, 'Organization LD should have a name');
  assert.ok(ld.url, 'Organization LD should have a url');
});

test('homepage emits ld-website with WebSite @type', async () => {
  const res = await fetchHtml('/');
  const ld = parseLd(res.$, 'ld-website');
  assert.equal(ld['@type'], 'WebSite');
  assert.ok(ld.url, 'WebSite LD should have a url');
});

test('homepage emits ld-localbusiness-home with department[] (Phase 171)', async () => {
  const res = await fetchHtml('/');
  const ld = parseLd(res.$, 'ld-localbusiness-home');
  // FurnitureStore / Store / LocalBusiness all acceptable
  assert.ok(
    String(ld['@type']).includes('Store') || ld['@type'] === 'LocalBusiness',
    `expected LocalBusiness-flavoured @type, got ${ld['@type']}`,
  );
  assert.ok(Array.isArray(ld.department), 'expected department[] array (Phase 171)');
  assert.equal(
    ld.department.length,
    5,
    `expected 5 LA showrooms in department[], got ${ld.department.length}`,
  );
});

test('/sleep-quiz emits ld-sleep-quiz with Quiz @type and inLanguage (Phase 179)', async () => {
  const res = await fetchHtml('/sleep-quiz');
  expect200(res, '/sleep-quiz');
  const ld = parseLd(res.$, 'ld-sleep-quiz');
  assert.equal(ld['@type'], 'Quiz');
  assert.equal(ld.inLanguage, 'en-US', 'Phase 179 added inLanguage to Quiz LD');
  assert.ok(ld.name, 'Quiz LD should have a name');
});

test('/sleep-quiz BreadcrumbList final item has an `item` URL (Phase 173-style)', async () => {
  const res = await fetchHtml('/sleep-quiz');
  const ld = parseLd(res.$, 'ld-breadcrumb-sleep-quiz');
  assert.equal(ld['@type'], 'BreadcrumbList');
  assert.ok(Array.isArray(ld.itemListElement), 'expected itemListElement[]');
  const last = ld.itemListElement[ld.itemListElement.length - 1];
  assert.ok(
    last && typeof last.item === 'string' && last.item.length > 0,
    `expected final breadcrumb item to have a URL, got: ${JSON.stringify(last)}`,
  );
  assert.match(
    last.item,
    /\/sleep-quiz$/,
    `final breadcrumb URL should end with /sleep-quiz, got: ${last.item}`,
  );
});
