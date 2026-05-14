/**
 * Phase 207: CMS page (`/pages/[handle]`) assertions.
 *
 * Covers:
 *  - Phase 188: explicit `/opengraph-image` fallback on CMS pages
 *    that have no associated cover image (the hotfix from PR #53,
 *    which extended Phase 180's fallback to /pages/[handle]).
 *  - Phase 173-style: WebPage LD with `inLanguage`, `datePublished`,
 *    `dateModified`, and `isPartOf` linking to the site WebSite node.
 *  - BreadcrumbList final-item URL on the CMS page template.
 *
 * Target handle is `mattress-store-financing` — a long-standing
 * marketing page (since 2023) with stable copy. The route renders
 * through the `DefaultPage` branch of `app/pages/[handle]/page.tsx`
 * (not the showroom or locations-index branches), which is the path
 * that emits `ld-page` and `ld-breadcrumb-page` and which Phase 188's
 * OG fallback was applied to.
 */

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { fetchHtml, expect200, parseJsonLd, SHOPIFY_SKIP } from './_helpers.mjs';

const PAGE_PATH = '/pages/mattress-store-financing';
const SITE = 'https://www.mattressstoreslosangeles.com';

test('CMS page renders 200', { skip: SHOPIFY_SKIP }, async () => {
  const res = await fetchHtml(PAGE_PATH);
  expect200(res, PAGE_PATH);
});

test('CMS page serves /opengraph-image fallback (Phase 188)', { skip: SHOPIFY_SKIP }, async () => {
  const { $ } = await fetchHtml(PAGE_PATH);
  // The /pages/[handle] route template emits the Phase 188 explicit
  // fallback regardless of branch — CMS pages don't have a cover image
  // field on the Shopify Page resource, so this is always the brand OG
  // card. The same assertion shape as Phase 199's /sleep-quiz check.
  const ogImage = $('meta[property="og:image"]').attr('content');
  assert.ok(
    ogImage && ogImage.endsWith('/opengraph-image'),
    `expected og:image to end with /opengraph-image (Phase 188 fallback), got "${ogImage}"`,
  );
  assert.equal($('meta[property="og:image:width"]').attr('content'), '1200');
  assert.equal($('meta[property="og:image:height"]').attr('content'), '630');
});

test('CMS page ld-page has @type WebPage + canonical url', { skip: SHOPIFY_SKIP }, async () => {
  const { $ } = await fetchHtml(PAGE_PATH);
  const ld = parseJsonLd($, 'ld-page');
  assert.equal(ld['@type'], 'WebPage');
  assert.equal(ld.url, `${SITE}${PAGE_PATH}`);
});

test('CMS page ld-page declares inLanguage: en-US', { skip: SHOPIFY_SKIP }, async () => {
  const { $ } = await fetchHtml(PAGE_PATH);
  const ld = parseJsonLd($, 'ld-page');
  assert.equal(ld.inLanguage, 'en-US');
});

test('CMS page ld-page has datePublished + dateModified ISO strings', { skip: SHOPIFY_SKIP }, async () => {
  const { $ } = await fetchHtml(PAGE_PATH);
  const ld = parseJsonLd($, 'ld-page');
  // Phase 173-era enrichment: WebPage LD carries datePublished +
  // dateModified from Shopify's page.createdAt / page.updatedAt. We
  // don't pin the exact ISO; just that it parses as a valid Date.
  assert.ok(typeof ld.datePublished === 'string' && !Number.isNaN(Date.parse(ld.datePublished)));
  assert.ok(typeof ld.dateModified === 'string' && !Number.isNaN(Date.parse(ld.dateModified)));
});

test('CMS page ld-page has isPartOf pointing at the site WebSite', { skip: SHOPIFY_SKIP }, async () => {
  const { $ } = await fetchHtml(PAGE_PATH);
  const ld = parseJsonLd($, 'ld-page');
  assert.ok(ld.isPartOf && typeof ld.isPartOf === 'object', 'expected isPartOf object');
  assert.equal(ld.isPartOf['@type'], 'WebSite');
  assert.equal(ld.isPartOf.url, SITE);
});

test('CMS page breadcrumb position-2 has `item` URL (Phase 172 family)', { skip: SHOPIFY_SKIP }, async () => {
  const { $ } = await fetchHtml(PAGE_PATH);
  const ld = parseJsonLd($, 'ld-breadcrumb-page');
  assert.equal(ld['@type'], 'BreadcrumbList');
  const pos2 = ld.itemListElement.find((x) => x.position === 2);
  assert.ok(pos2, 'expected a position-2 breadcrumb entry');
  assert.equal(pos2.item, `${SITE}${PAGE_PATH}`);
});
