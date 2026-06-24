#!/usr/bin/env node
/**
 * One-shot validator: builds the SaleEvent JSON-LD for Independence
 * Day 2026 by importing the SAME `buildSaleEventLd` function the
 * prod code uses, then runs basic structural checks.
 *
 * Run: node --experimental-strip-types scripts/validate-sale-event-ld.mjs
 *
 * Now that lib/sale-event-ld.ts is unit-tested by
 * tests/ssr/lib-sale-event-ld.test.mjs, this script is mainly a
 * "paste the output into Google's Rich Results Test" helper — it
 * prints the rendered LD for Independence Day so you can copy/paste
 * into https://search.google.com/test/rich-results.
 *
 * Source of truth for the schema:
 * https://schema.org/SaleEvent
 * https://developers.google.com/search/docs/appearance/structured-data/event
 */

const { buildSaleEventLd } = await import('../lib/sale-event-ld.ts');

// Representative 4th of July 2026 sale page + featured products.
const page = {
  handle: '4th-of-july-mattress-sale-2026',
  title: '4th of July Mattress Sale 2026 — Up to 70% Off in LA',
  bodySummary: '4th of July weekend at LA Mattress. Every mattress on the floor at all 5 LA showrooms is currently on sale.',
  seo: { title: null, description: null },
  saleStartsAt: '2026-07-01T07:00:00Z',
  saleEndsAt: '2026-07-06T06:59:59Z',
};
const featuredProducts = [
  { priceRange: { minVariantPrice: { amount: '1599.0' }, maxVariantPrice: { amount: '3198.0' } } },
  { priceRange: { minVariantPrice: { amount: '2699.0' }, maxVariantPrice: { amount: '5398.0' } } },
  { priceRange: { minVariantPrice: { amount: '2649.0' }, maxVariantPrice: { amount: '5298.0' } } },
  { priceRange: { minVariantPrice: { amount: '319.0' },  maxVariantPrice: { amount: '659.0' } } },
  { priceRange: { minVariantPrice: { amount: '499.0' },  maxVariantPrice: { amount: '999.0' } } },
];
const onSaleCount = 123;

const ld = buildSaleEventLd(page, featuredProducts, onSaleCount);
console.log('=== Generated SaleEvent JSON-LD ===\n');
console.log(JSON.stringify(ld, null, 2));
console.log('\n=== Quick structural checks ===\n');

const checks = [];
const expect = (cond, msg) => checks.push({ ok: !!cond, msg });

expect(ld['@context'] === 'https://schema.org', '@context = https://schema.org');
expect(ld['@type'] === 'SaleEvent', '@type = SaleEvent');
expect(typeof ld.name === 'string' && ld.name.length > 0, 'name populated');
expect(typeof ld.startDate === 'string' && !Number.isNaN(Date.parse(ld.startDate)), 'startDate is a valid ISO date');
expect(typeof ld.endDate === 'string' && !Number.isNaN(Date.parse(ld.endDate)), 'endDate is a valid ISO date');
expect(Date.parse(ld.endDate) > Date.parse(ld.startDate), 'endDate is after startDate');
expect(ld.eventStatus === 'https://schema.org/EventScheduled', 'eventStatus is a valid Schema.org EventStatus enum');
expect(ld.eventAttendanceMode === 'https://schema.org/MixedEventAttendanceMode', 'eventAttendanceMode is a valid Schema.org enum');
expect(Array.isArray(ld.location) && ld.location.length === 5, 'location is an array of 5 showrooms');
expect(ld.offers['@type'] === 'AggregateOffer', 'offers @type = AggregateOffer');
expect(/^\d+\.\d{2}$/.test(ld.offers.lowPrice), 'offers.lowPrice formatted "N.NN"');
expect(/^\d+\.\d{2}$/.test(ld.offers.highPrice), 'offers.highPrice formatted "N.NN"');
expect(Number(ld.offers.highPrice) >= Number(ld.offers.lowPrice), 'highPrice >= lowPrice');
expect(typeof ld.offers.offerCount === 'number' && ld.offers.offerCount > 0, 'offers.offerCount is a positive integer');

let failed = 0;
for (const c of checks) {
  console.log(`${c.ok ? 'OK   ' : 'FAIL '} ${c.msg}`);
  if (!c.ok) failed++;
}
console.log(`\n${checks.length - failed}/${checks.length} passed.`);
process.exit(failed > 0 ? 1 : 0);
