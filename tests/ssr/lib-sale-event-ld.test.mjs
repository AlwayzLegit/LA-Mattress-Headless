/**
 * Unit tests for lib/sale-event-ld.ts — the SaleEvent + AggregateOffer
 * JSON-LD emitted by the SalePage template.
 *
 * Locks down the Schema.org shape that powers Google's sale rich
 * result. Every claim in the build function is asserted here so any
 * future refactor that drops a required field (or worse, silently
 * changes the eventStatus to an invalid enum) fails CI.
 *
 * Imports the .ts module directly — Node 22's experimental-strip-types
 * handles type erasure at load time.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

const { buildSaleEventLd } = await import('../../lib/sale-event-ld.ts');

function makePage(overrides = {}) {
  return {
    handle: '4th-of-july-mattress-sale-2026',
    title: '4th of July Mattress Sale 2026 — Up to 70% Off in LA',
    bodySummary: '4th of July weekend at LA Mattress. Every mattress on the floor at all 5 LA showrooms is currently on sale.',
    seo: { title: null, description: null },
    saleStartsAt: '2026-07-01T07:00:00Z',
    saleEndsAt: '2026-07-06T06:59:59Z',
    ...overrides,
  };
}

function makeFeaturedProducts() {
  return [
    { priceRange: { minVariantPrice: { amount: '1599.0' }, maxVariantPrice: { amount: '3198.0' } } },
    { priceRange: { minVariantPrice: { amount: '2699.0' }, maxVariantPrice: { amount: '5398.0' } } },
    { priceRange: { minVariantPrice: { amount: '319.0' },  maxVariantPrice: { amount: '659.0' } } },
  ];
}

test('returns null when sale_starts_at is missing', () => {
  const ld = buildSaleEventLd(makePage({ saleStartsAt: null }), makeFeaturedProducts(), 123);
  assert.equal(ld, null);
});

test('Schema.org context + SaleEvent type', () => {
  const ld = buildSaleEventLd(makePage(), makeFeaturedProducts(), 123);
  assert.equal(ld['@context'], 'https://schema.org');
  assert.equal(ld['@type'], 'SaleEvent');
});

test('emits canonical absolute URL + matching @id', () => {
  const ld = buildSaleEventLd(makePage(), makeFeaturedProducts(), 123);
  assert.equal(ld.url, 'https://www.mattressstoreslosangeles.com/pages/4th-of-july-mattress-sale-2026');
  assert.equal(ld['@id'], 'https://www.mattressstoreslosangeles.com/pages/4th-of-july-mattress-sale-2026#sale-event');
});

test('startDate + endDate carry through unchanged (storefront date gate handles "active" semantics)', () => {
  const ld = buildSaleEventLd(makePage(), makeFeaturedProducts(), 123);
  assert.equal(ld.startDate, '2026-07-01T07:00:00Z');
  assert.equal(ld.endDate, '2026-07-06T06:59:59Z');
});

test('omits endDate when the page has no sale_ends_at metafield', () => {
  const ld = buildSaleEventLd(makePage({ saleEndsAt: null }), makeFeaturedProducts(), 123);
  assert.ok(!('endDate' in ld), 'endDate should be absent, not null');
});

test('eventStatus is always EventScheduled — Schema.org has no "completed" enum value', () => {
  // Critical: this is the bug that buildSaleEventLd was originally
  // shipped with. EventPostponed semantically means "delayed", not
  // "ended". Google's structured-data guidelines say to signal past
  // events via endDate < now, not via an eventStatus change.
  const ld = buildSaleEventLd(makePage(), makeFeaturedProducts(), 123);
  assert.equal(ld.eventStatus, 'https://schema.org/EventScheduled');
});

test('eventAttendanceMode is MixedEventAttendanceMode (in-showroom + online)', () => {
  const ld = buildSaleEventLd(makePage(), makeFeaturedProducts(), 123);
  assert.equal(ld.eventAttendanceMode, 'https://schema.org/MixedEventAttendanceMode');
});

test('location[] contains all 5 LA showrooms with FurnitureStore + PostalAddress shape', () => {
  const ld = buildSaleEventLd(makePage(), makeFeaturedProducts(), 123);
  assert.ok(Array.isArray(ld.location));
  assert.equal(ld.location.length, 5);
  for (const loc of ld.location) {
    assert.equal(loc['@type'], 'FurnitureStore');
    assert.equal(typeof loc.name, 'string');
    assert.ok(loc.name.length > 0);
    assert.equal(loc.address['@type'], 'PostalAddress');
    assert.equal(typeof loc.address.streetAddress, 'string');
    assert.ok(loc.address.streetAddress.length > 0);
    assert.equal(loc.address.addressCountry, 'US');
  }
});

test('AggregateOffer carries the resolved low/high price + offerCount', () => {
  const ld = buildSaleEventLd(makePage(), makeFeaturedProducts(), 123);
  const offers = ld.offers;
  assert.equal(offers['@type'], 'AggregateOffer');
  assert.equal(offers.priceCurrency, 'USD');
  // Min across all variants in the fixture = 319, max = 5398.
  assert.equal(offers.lowPrice, '319.00');
  assert.equal(offers.highPrice, '5398.00');
  // Google's spec wants integer offerCount; comes from onSaleCount.
  assert.equal(offers.offerCount, 123);
  assert.equal(offers.availability, 'https://schema.org/InStock');
});

test('AggregateOffer falls back to a store-wide range when featuredProducts is empty', () => {
  const ld = buildSaleEventLd(makePage(), [], 123);
  // No products → use fallback bounds so the schema still validates.
  assert.equal(ld.offers.lowPrice, '199.00');
  assert.equal(ld.offers.highPrice, '8999.00');
  // offerCount falls back to onSaleCount even when no featured products.
  assert.equal(ld.offers.offerCount, 123);
});

test('AggregateOffer.offerCount falls back to featuredProducts.length when onSaleCount is zero', () => {
  const ld = buildSaleEventLd(makePage(), makeFeaturedProducts(), 0);
  assert.equal(ld.offers.offerCount, 3);
});

test('AggregateOffer.offerCount falls back to 1 when both onSaleCount and featuredProducts are empty', () => {
  // Schema.org requires offerCount ≥ 1; "1" is the safe floor.
  const ld = buildSaleEventLd(makePage(), [], 0);
  assert.equal(ld.offers.offerCount, 1);
});

test('description prefers seo.description, falls back to bodySummary, omitted when both empty', () => {
  const seoDescPage = makePage({ seo: { title: null, description: 'SEO description' } });
  assert.equal(buildSaleEventLd(seoDescPage, [], 0).description, 'SEO description');

  const summaryPage = makePage({ seo: { title: null, description: null } });
  assert.equal(buildSaleEventLd(summaryPage, [], 0).description, summaryPage.bodySummary);

  const blankPage = makePage({ seo: { title: null, description: null }, bodySummary: '' });
  const blankLd = buildSaleEventLd(blankPage, [], 0);
  assert.ok(!('description' in blankLd), 'description should be omitted, not empty');
});

test('NaN / negative / zero prices in featured products are filtered out before min/max', () => {
  const products = [
    { priceRange: { minVariantPrice: { amount: '0' },       maxVariantPrice: { amount: '0' } } },
    { priceRange: { minVariantPrice: { amount: '-100' },    maxVariantPrice: { amount: '-50' } } },
    { priceRange: { minVariantPrice: { amount: 'invalid' }, maxVariantPrice: { amount: 'nope' } } },
    { priceRange: { minVariantPrice: { amount: '500' },     maxVariantPrice: { amount: '900' } } },
  ];
  const ld = buildSaleEventLd(makePage(), products, 0);
  // Only the (500, 900) entry survives the filter.
  assert.equal(ld.offers.lowPrice, '500.00');
  assert.equal(ld.offers.highPrice, '900.00');
});

test('organizer is a Schema.org @id reference to the site Organization graph node', () => {
  const ld = buildSaleEventLd(makePage(), makeFeaturedProducts(), 123);
  assert.deepEqual(ld.organizer, { '@id': 'https://www.mattressstoreslosangeles.com/#organization' });
});

test('JSON.stringify round-trips cleanly (no circular refs, no non-serializable values)', () => {
  const ld = buildSaleEventLd(makePage(), makeFeaturedProducts(), 123);
  const json = JSON.stringify(ld);
  assert.doesNotThrow(() => JSON.parse(json));
});
