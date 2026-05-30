/**
 * Phase 308 SEO PR — dedicated /pages/mattress-sizes template.
 *
 * The page is the single biggest Semrush priority concentration in
 * the 20260530 audit (21,599 points). This test covers:
 *   - The page returns 200
 *   - Title carries the code-side override (covers all flagged
 *     keyword variants Semrush wanted)
 *   - The new dimensions reference table is present with all 7
 *     sizes + every dimension-format column
 *   - The FAQ section has 14 questions (all targeting flagged kws)
 *   - FAQPage JSON-LD is emitted with the same 14 Q&A entries, with
 *     valid schema.org structure
 *
 * The merchant body assertions stay in collection.test.mjs / blog
 * tests — this file only covers the code-added surfaces.
 */

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { fetchHtml, expect200, parseJsonLd, SHOPIFY_SKIP } from './_helpers.mjs';
import { MATTRESS_SIZES, MATTRESS_SIZES_FAQ } from '../../lib/mattress-sizes-data.ts';

test('mattress-sizes data: 7 sizes with every dimension format', () => {
  assert.equal(MATTRESS_SIZES.length, 7, `expected 7 mattress sizes, got ${MATTRESS_SIZES.length}`);
  for (const size of MATTRESS_SIZES) {
    assert.ok(size.inches.includes('"'), `${size.name} missing inches with " unit`);
    assert.ok(/ft/.test(size.feet), `${size.name} missing feet ("ft") in feet field`);
    assert.ok(/cm/.test(size.cm), `${size.name} missing cm unit in cm field`);
    assert.ok(size.bestFor.length > 0, `${size.name} missing bestFor`);
    assert.ok(/ft/.test(size.minRoom), `${size.name} missing minRoom`);
    assert.ok(size.collectionHref.startsWith('/collections/'), `${size.name} bad collectionHref`);
  }
});

test('mattress-sizes FAQ: 14 questions, each with a non-empty answer', () => {
  assert.equal(MATTRESS_SIZES_FAQ.length, 14, `expected 14 FAQ items, got ${MATTRESS_SIZES_FAQ.length}`);
  for (const item of MATTRESS_SIZES_FAQ) {
    assert.ok(item.q.length > 0, 'FAQ item missing question');
    assert.ok(item.q.endsWith('?'), `FAQ "${item.q}" should end with question mark`);
    assert.ok(item.a.length >= 40, `FAQ answer too short for "${item.q}" (${item.a.length} chars)`);
    assert.ok(item.a.length <= 500, `FAQ answer too long for "${item.q}" (${item.a.length} chars; Google truncates rich-snippet at ~300)`);
  }
});

test('mattress-sizes FAQ covers every Semrush-flagged keyword variant', () => {
  // The audit flagged these phrases as missing from the page in
  // various forms (title, body, related-words). The FAQ Q&A pairs
  // collectively need to surface each one — checked as a sanity
  // gate so future FAQ edits can't accidentally drop coverage.
  const allText = MATTRESS_SIZES_FAQ
    .flatMap((item) => [item.q, item.a])
    .join(' ')
    .toLowerCase();
  for (const kw of [
    '60', 'queen', '76', 'king', 'cal king', '72', '38', 'twin', '54', 'full',
    'split king', 'inches', 'feet', 'cm',
  ]) {
    assert.ok(
      allText.includes(kw.toLowerCase()),
      `FAQ corpus should mention "${kw}" — Semrush flagged related variants`,
    );
  }
});

test('/pages/mattress-sizes returns 200 with the override title', { skip: SHOPIFY_SKIP }, async () => {
  const res = await fetchHtml('/pages/mattress-sizes');
  expect200(res, '/pages/mattress-sizes');
  const title = res.$('title').text();
  assert.equal(
    title,
    'Mattress Size Chart · Bed Dimensions in Feet & Inches | LA Mattress',
    `expected mattress-sizes override title, got: "${title}"`,
  );
});

test('/pages/mattress-sizes renders the dimensions reference table', { skip: SHOPIFY_SKIP }, async () => {
  const res = await fetchHtml('/pages/mattress-sizes');
  expect200(res, '/pages/mattress-sizes');
  // Section landmark by aria-labelledby
  assert.equal(
    res.$('section[aria-labelledby="mattress-sizes-dims-heading"]').length,
    1,
    'expected one dimensions-reference section',
  );
  // Table + every size row
  const rows = res.$('.ms-dims-table tbody tr');
  assert.equal(
    rows.length,
    MATTRESS_SIZES.length,
    `expected ${MATTRESS_SIZES.length} size rows, got ${rows.length}`,
  );
  // Each row has an anchor to its collection
  for (const size of MATTRESS_SIZES) {
    assert.ok(
      res.$(`.ms-dims-table a[href="${size.collectionHref}"]`).length >= 1,
      `expected dimensions table to link to ${size.collectionHref}`,
    );
  }
});

test('/pages/mattress-sizes renders the FAQ section with all Q&A items', { skip: SHOPIFY_SKIP }, async () => {
  const res = await fetchHtml('/pages/mattress-sizes');
  expect200(res, '/pages/mattress-sizes');
  const items = res.$('.ms-faq .ms-faq-item');
  assert.equal(
    items.length,
    MATTRESS_SIZES_FAQ.length,
    `expected ${MATTRESS_SIZES_FAQ.length} FAQ items, got ${items.length}`,
  );
  for (const item of MATTRESS_SIZES_FAQ) {
    const found = res.$('.ms-faq-q').filter((_, el) => res.$(el).text().trim() === item.q);
    assert.ok(found.length >= 1, `FAQ question missing from DOM: "${item.q}"`);
  }
});

test('/pages/mattress-sizes emits FAQPage JSON-LD with all 14 questions', { skip: SHOPIFY_SKIP }, async () => {
  const res = await fetchHtml('/pages/mattress-sizes');
  expect200(res, '/pages/mattress-sizes');
  const ld = parseJsonLd(res.$('#ld-faq-mattress-sizes').first().html() ?? '');
  assert.equal(ld['@type'], 'FAQPage', `expected @type FAQPage, got ${ld['@type']}`);
  assert.ok(Array.isArray(ld.mainEntity), 'mainEntity should be an array');
  assert.equal(
    ld.mainEntity.length,
    MATTRESS_SIZES_FAQ.length,
    `FAQPage mainEntity length ${ld.mainEntity.length} ≠ FAQ data length ${MATTRESS_SIZES_FAQ.length}`,
  );
  for (const entity of ld.mainEntity) {
    assert.equal(entity['@type'], 'Question');
    assert.ok(typeof entity.name === 'string' && entity.name.length > 0);
    assert.equal(entity.acceptedAnswer?.['@type'], 'Answer');
    assert.ok(typeof entity.acceptedAnswer?.text === 'string' && entity.acceptedAnswer.text.length > 0);
  }
});
