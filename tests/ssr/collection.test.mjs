/**
 * Phase 205: CollectionPage assertions on `/collections/[handle]`.
 *
 * Covers:
 *  - Phase 172: BreadcrumbList final-item `item` URL on the PLP template
 *  - Phase 179: CollectionPage LD `inLanguage: 'en-US'`
 *  - Phase 176 / 180: explicit `/opengraph-image` fallback on coverless
 *    collections (the Phase 180 hotfix that drained the original
 *    no-og-image-anywhere bug)
 *
 * Two target handles:
 *
 *  - `mattresses` — the canonical "everything mattress" collection,
 *    always populated, always live. Used for the structural LD
 *    assertions (CollectionPage @type, ItemList nested entity, inLanguage,
 *    breadcrumb URL). Has its own cover image so og:image won't be the
 *    fallback.
 *
 *  - `sheets-pillowcases` — coverless niche collection (confirmed
 *    empirically during PR-#53 verification). Used only for the OG
 *    fallback assertion. If the merchant ever adds a cover image to
 *    this collection, this single assertion will fail loudly — swap
 *    to another known-coverless collection at that point.
 */

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { fetchHtml, expect200, parseJsonLd, SHOPIFY_SKIP } from './_helpers.mjs';

const STABLE_HANDLE = 'mattresses';
const STABLE_PATH = `/collections/${STABLE_HANDLE}`;
const COVERLESS_PATH = '/collections/sheets-pillowcases';
const SITE = 'https://www.mattressstoreslosangeles.com';

test('collection page renders 200', { skip: SHOPIFY_SKIP }, async () => {
  const res = await fetchHtml(STABLE_PATH);
  expect200(res, STABLE_PATH);
});

test('collection ld has @type CollectionPage + canonical url', { skip: SHOPIFY_SKIP }, async () => {
  const { $ } = await fetchHtml(STABLE_PATH);
  const ld = parseJsonLd($, 'ld-collection');
  assert.equal(ld['@type'], 'CollectionPage');
  assert.equal(ld.url, `${SITE}${STABLE_PATH}`);
});

test('collection ld declares inLanguage: en-US (Phase 179)', { skip: SHOPIFY_SKIP }, async () => {
  const { $ } = await fetchHtml(STABLE_PATH);
  const ld = parseJsonLd($, 'ld-collection');
  assert.equal(ld.inLanguage, 'en-US');
});

test('collection ld nests an ItemList mainEntity with numberOfItems', { skip: SHOPIFY_SKIP }, async () => {
  const { $ } = await fetchHtml(STABLE_PATH);
  const ld = parseJsonLd($, 'ld-collection');
  assert.ok(ld.mainEntity && typeof ld.mainEntity === 'object', 'expected mainEntity object');
  assert.equal(ld.mainEntity['@type'], 'ItemList');
  assert.ok(
    typeof ld.mainEntity.numberOfItems === 'number' && ld.mainEntity.numberOfItems > 0,
    `expected mainEntity.numberOfItems > 0, got ${ld.mainEntity.numberOfItems}`,
  );
});

test('collection breadcrumb position-2 has `item` URL (Phase 172)', { skip: SHOPIFY_SKIP }, async () => {
  const { $ } = await fetchHtml(STABLE_PATH);
  const ld = parseJsonLd($, 'ld-breadcrumb-collection');
  assert.equal(ld['@type'], 'BreadcrumbList');
  const pos2 = ld.itemListElement.find((x) => x.position === 2);
  assert.ok(pos2, 'expected a position-2 breadcrumb entry');
  assert.equal(pos2.item, `${SITE}${STABLE_PATH}`);
});

test('coverless collection serves /opengraph-image fallback (Phase 176/180)', { skip: SHOPIFY_SKIP }, async () => {
  const { $ } = await fetchHtml(COVERLESS_PATH);
  // The sheets-pillowcases collection has no cover image, so the route
  // emits the explicit `/opengraph-image` fallback URL. If the merchant
  // adds a cover, this assertion will fail and the test handle should
  // be swapped to another coverless collection.
  const ogImage = $('meta[property="og:image"]').attr('content');
  assert.ok(
    ogImage && ogImage.endsWith('/opengraph-image'),
    `expected og:image to end with /opengraph-image (Phase 180 fallback), got "${ogImage}"`,
  );
  assert.equal($('meta[property="og:image:width"]').attr('content'), '1200');
  assert.equal($('meta[property="og:image:height"]').attr('content'), '630');
});
