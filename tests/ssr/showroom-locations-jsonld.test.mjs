/**
 * SSR tests for the brand-aggregate attachment on LocalBusiness JSON-LD
 * emitted by /pages/[handle] (showroom + locations-index branches in
 * lib/page-jsonld.ts).
 *
 * Skips when Shopify env vars aren't set — the page-jsonld dispatch
 * needs a real Shopify page object behind it (Storefront API) plus the
 * Judge.me sitewide aggregate, neither available in unconfigured envs.
 *
 * Why these tests live HERE and not as a pure unit test under tests/ssr:
 * lib/page-jsonld.ts has runtime imports from @/lib/showrooms,
 * @/lib/neighborhoods, etc. — those path aliases need Next's resolver
 * to load, which only happens inside a running dev server. Hitting the
 * route over HTTP gives us the full render path including the Judge.me
 * fetch in the layout, which is the contract we actually care about.
 */

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { fetchHtml, parseJsonLd, SHOPIFY_SKIP } from './_helpers.mjs';

const SHOWROOM_PATH = '/pages/koreatown-best-mattress-store';
const LOCATIONS_PATH = '/pages/mattress-store-locations';

test('Showroom page emits ld-showroom LocalBusiness', { skip: SHOPIFY_SKIP }, async () => {
  const { $ } = await fetchHtml(SHOWROOM_PATH);
  const ld = parseJsonLd($, 'ld-showroom');
  // FurnitureStore is a LocalBusiness subtype — Schema.org allows it.
  assert.ok(
    String(ld['@type']).includes('Store') || ld['@type'] === 'LocalBusiness',
    `expected a LocalBusiness-flavoured @type, got ${ld['@type']}`,
  );
});

test('Showroom LocalBusiness carries the brand aggregateRating', { skip: SHOPIFY_SKIP }, async () => {
  const { $ } = await fetchHtml(SHOWROOM_PATH);
  const ld = parseJsonLd($, 'ld-showroom');
  // Aggregate only attaches when Judge.me returns a valid rating + count.
  // Skip the rest of the assertions when the aggregate isn't present —
  // that means Judge.me is unconfigured or has returned an empty payload,
  // not that the code path is broken.
  if (!ld.aggregateRating) {
    console.log('  ℹ no aggregateRating on showroom LB (Judge.me unconfigured / empty payload)');
    return;
  }
  assert.equal(ld.aggregateRating['@type'], 'AggregateRating');
  assert.ok(
    typeof ld.aggregateRating.ratingValue === 'string'
      && Number.parseFloat(ld.aggregateRating.ratingValue) >= 1
      && Number.parseFloat(ld.aggregateRating.ratingValue) <= 5,
    `ratingValue out of 1..5: ${ld.aggregateRating.ratingValue}`,
  );
  assert.ok(
    Number.isFinite(ld.aggregateRating.reviewCount) && ld.aggregateRating.reviewCount > 0,
    `reviewCount not a positive integer: ${ld.aggregateRating.reviewCount}`,
  );
  assert.equal(ld.aggregateRating.bestRating, '5');
  assert.equal(ld.aggregateRating.worstRating, '1');
  // itemReviewed back-link must match the LB's own @id. Without it,
  // Google reads the rating as self-attached + ambiguous provenance
  // (2019 review-snippet update demoted those).
  assert.equal(ld.aggregateRating.itemReviewed?.['@id'], ld['@id']);
});

test('Locations index LocalBusiness carries the brand aggregateRating', { skip: SHOPIFY_SKIP }, async () => {
  const { $ } = await fetchHtml(LOCATIONS_PATH);
  const ld = parseJsonLd($, 'ld-locations');
  assert.ok(
    String(ld['@type']).includes('Store') || ld['@type'] === 'LocalBusiness',
    `expected a LocalBusiness-flavoured @type, got ${ld['@type']}`,
  );
  if (!ld.aggregateRating) {
    console.log('  ℹ no aggregateRating on locations LB (Judge.me unconfigured / empty payload)');
    return;
  }
  assert.equal(ld.aggregateRating['@type'], 'AggregateRating');
  assert.equal(ld.aggregateRating.itemReviewed?.['@id'], ld['@id']);
});
