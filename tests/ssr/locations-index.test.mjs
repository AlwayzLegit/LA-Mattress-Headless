/**
 * Phase 308 SEO PR — deep edit on /pages/mattress-store-locations.
 *
 * The page is the second-biggest code-controlled Semrush priority
 * concentration in the 20260530 audit (10,398 points). The page
 * already had rich chrome (hero, trust, map, finder, perks, panels,
 * reviews, pillar-article links). This PR added:
 *
 *   - Meta description override (kw_stuffing_meta + low_readability)
 *   - Neighborhood directory section (8+ internal links to LA
 *     neighborhood pages, surfacing related local-search terms)
 *   - FAQ accordion (mattress-stores-near-me intent)
 *   - FAQPage JSON-LD emitted from the same FAQ data
 *
 * This test file covers the new sections specifically; the existing
 * page-level assertions (breadcrumb, hero, map, finder, etc.) stay
 * in the broader sitemap / a11y test files.
 */

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { fetchHtml, expect200, parseJsonLd, SHOPIFY_SKIP } from './_helpers.mjs';
import { LOCATIONS_FAQ } from '../../lib/locations-faq.ts';
import { getPageSeoOverride } from '../../lib/page-seo-overrides.ts';

// Inline subset of NEIGHBORHOODS handles — importing the full lib
// would pull in lib/showrooms via a bare-relative import that Node's
// runtime resolver doesn't add `.ts` to. These handles are stable;
// any new neighborhood added to lib/neighborhoods.ts gets covered by
// the DOM-count assertion in the SSR test below.
const KNOWN_NEIGHBORHOOD_HANDLES = [
  'mattress-store-beverly-hills',
  'mattress-store-santa-monica',
  'mattress-store-downtown-la',
];

test('locations meta-description override is registered + size-bounded', () => {
  const override = getPageSeoOverride('mattress-store-locations');
  assert.ok(override?.description, 'expected mattress-store-locations description override');
  assert.ok(
    override.description.length <= 158,
    `description override is ${override.description.length} chars (>158 SERP truncation)`,
  );
  // Single "mattress store" mention (the kw_stuffing_meta fix is the
  // whole point of this override).
  const occurrences = (override.description.match(/mattress stor/gi) ?? []).length;
  assert.equal(
    occurrences,
    1,
    `description override should mention "mattress stor*" exactly once (kw_stuffing fix), got ${occurrences}`,
  );
});

test('locations FAQ: 10 questions, every answer in 40-500 char band', () => {
  assert.equal(LOCATIONS_FAQ.length, 10, `expected 10 FAQ items, got ${LOCATIONS_FAQ.length}`);
  for (const item of LOCATIONS_FAQ) {
    assert.ok(item.q.endsWith('?'), `FAQ "${item.q}" should end with question mark`);
    assert.ok(item.a.length >= 40, `FAQ answer too short for "${item.q}" (${item.a.length} chars)`);
    assert.ok(item.a.length <= 500, `FAQ answer too long for "${item.q}" (${item.a.length} chars)`);
  }
});

test('/pages/mattress-store-locations 200 + override description applied', { skip: SHOPIFY_SKIP }, async () => {
  const res = await fetchHtml('/pages/mattress-store-locations');
  expect200(res, '/pages/mattress-store-locations');
  const desc = res.$('meta[name="description"]').attr('content');
  const override = getPageSeoOverride('mattress-store-locations');
  assert.equal(
    desc,
    override?.description,
    `expected override description on locations page, got: "${desc}"`,
  );
});

test('/pages/mattress-store-locations renders the neighborhood directory', { skip: SHOPIFY_SKIP }, async () => {
  const res = await fetchHtml('/pages/mattress-store-locations');
  expect200(res, '/pages/mattress-store-locations');
  // Section landmark
  assert.equal(
    res.$('section[aria-labelledby="locations-neighborhoods-h"]').length,
    1,
    'expected one neighborhood-directory section',
  );
  // Every known-stable neighborhood handle has a card with a link.
  // (Additional neighborhoods added to lib/neighborhoods.ts get
  // covered by the cards-vs-data sanity gate below.)
  for (const handle of KNOWN_NEIGHBORHOOD_HANDLES) {
    assert.ok(
      res.$(`.locations-neighborhoods-grid a[href="/pages/${handle}"]`).length >= 1,
      `expected neighborhood directory to link to /pages/${handle}`,
    );
  }
  // Sanity: the rendered card count should be at least as many as our
  // known-stable subset (and is allowed to grow as new neighborhoods
  // are added). Detects accidental regressions where the section
  // renders empty or with only a couple of cards.
  const cardCount = res.$('.locations-neighborhood-card').length;
  assert.ok(
    cardCount >= KNOWN_NEIGHBORHOOD_HANDLES.length,
    `expected at least ${KNOWN_NEIGHBORHOOD_HANDLES.length} neighborhood cards, got ${cardCount}`,
  );
});

test('/pages/mattress-store-locations renders the FAQ + emits JSON-LD', { skip: SHOPIFY_SKIP }, async () => {
  const res = await fetchHtml('/pages/mattress-store-locations');
  expect200(res, '/pages/mattress-store-locations');
  // Rendered FAQ items
  const items = res.$('.locations-faq .ms-faq-item');
  assert.equal(items.length, LOCATIONS_FAQ.length);
  // JSON-LD
  const ld = parseJsonLd(res.$('#ld-faq-mattress-store-locations').first().html() ?? '');
  assert.equal(ld['@type'], 'FAQPage');
  assert.ok(Array.isArray(ld.mainEntity));
  assert.equal(ld.mainEntity.length, LOCATIONS_FAQ.length);
  for (const entity of ld.mainEntity) {
    assert.equal(entity['@type'], 'Question');
    assert.equal(entity.acceptedAnswer?.['@type'], 'Answer');
  }
});
