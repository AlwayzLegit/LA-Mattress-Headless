/**
 * Phase 206: BlogPosting LD + breadcrumb assertions on
 * `/blogs/[blog]/[article]`.
 *
 * Covers:
 *  - Phase 175: BlogPosting LD has `articleSection`, `wordCount`
 *  - Phase 179: `inLanguage: 'en-US'`
 *  - Phase 173-style: BreadcrumbList position-3 has `item` URL
 *
 * Intentionally does NOT assert `keywords` — it derives from
 * `article.tags`, and many real articles have no tags (verified
 * empirically on the test handle below — its keywords key is
 * omitted from the LD). Asserting `keywords` would fail on
 * tag-less articles and force a brittle test-article choice.
 *
 * Target handle is `sleep-blog/how-to-elevate-crib-mattress-for-congestion`
 * — a long-form article (1.5k+ words, ~Phase 175 expectations met,
 * stable URL since 2024). Has its own cover image so OG fallback
 * doesn't fire here (the coverless-article path is covered by Phase
 * 199's /sleep-quiz fallback assertion in og-meta.test.mjs).
 */

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { fetchHtml, expect200, parseJsonLd, SHOPIFY_SKIP } from './_helpers.mjs';

const ARTICLE_PATH = '/blogs/sleep-blog/how-to-elevate-crib-mattress-for-congestion';
const SITE = 'https://mattressstoreslosangeles.com';

test('article renders 200', { skip: SHOPIFY_SKIP }, async () => {
  const res = await fetchHtml(ARTICLE_PATH);
  expect200(res, ARTICLE_PATH);
});

test('article ld-article has @type BlogPosting', { skip: SHOPIFY_SKIP }, async () => {
  const { $ } = await fetchHtml(ARTICLE_PATH);
  const ld = parseJsonLd($, 'ld-article');
  assert.equal(ld['@type'], 'BlogPosting');
});

test('article ld-article has articleSection (Phase 175)', { skip: SHOPIFY_SKIP }, async () => {
  const { $ } = await fetchHtml(ARTICLE_PATH);
  const ld = parseJsonLd($, 'ld-article');
  assert.ok(
    typeof ld.articleSection === 'string' && ld.articleSection.length > 0,
    `expected articleSection to be a non-empty string, got ${JSON.stringify(ld.articleSection)}`,
  );
});

test('article ld-article has wordCount > 0 (Phase 175)', { skip: SHOPIFY_SKIP }, async () => {
  const { $ } = await fetchHtml(ARTICLE_PATH);
  const ld = parseJsonLd($, 'ld-article');
  // Phase 175 extracts wordCount from the rendered body HTML via the
  // shared helper. The exact number drifts as the merchant edits copy;
  // we only assert positivity.
  assert.ok(
    typeof ld.wordCount === 'number' && ld.wordCount > 0,
    `expected wordCount > 0, got ${ld.wordCount}`,
  );
});

test('article ld-article declares inLanguage: en-US (Phase 179)', { skip: SHOPIFY_SKIP }, async () => {
  const { $ } = await fetchHtml(ARTICLE_PATH);
  const ld = parseJsonLd($, 'ld-article');
  assert.equal(ld.inLanguage, 'en-US');
});

test('article ld-article has mainEntityOfPage pointing at canonical url', { skip: SHOPIFY_SKIP }, async () => {
  const { $ } = await fetchHtml(ARTICLE_PATH);
  const ld = parseJsonLd($, 'ld-article');
  assert.ok(ld.mainEntityOfPage && typeof ld.mainEntityOfPage === 'object');
  assert.equal(ld.mainEntityOfPage['@type'], 'WebPage');
  assert.equal(ld.mainEntityOfPage['@id'], `${SITE}${ARTICLE_PATH}`);
});

test('article breadcrumb position-3 has `item` URL (Phase 172 family)', { skip: SHOPIFY_SKIP }, async () => {
  const { $ } = await fetchHtml(ARTICLE_PATH);
  const ld = parseJsonLd($, 'ld-breadcrumb-article');
  assert.equal(ld['@type'], 'BreadcrumbList');
  const pos3 = ld.itemListElement.find((x) => x.position === 3);
  assert.ok(pos3, 'expected a position-3 breadcrumb entry');
  assert.equal(pos3.item, `${SITE}${ARTICLE_PATH}`);
});
