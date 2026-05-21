/**
 * Unit tests for lib/product-jsonld.ts — the Product + BreadcrumbList
 * JSON-LD emitter.
 *
 * Locks down the three SEMrush 20260521 fixes that knocked out ~2,700
 * sitewide structured-data validator errors:
 *
 *   1. Variant priceSpecification uses the schema.org/ListPrice pattern
 *      instead of the nonexistent `referencePrice` property.
 *   2. Per-variant Offers no longer emit a schema-incomplete itemOffered
 *      nested Product (was missing required image/offers fields).
 *   3. Product.brand is omitted when vendor is empty (vs rendering
 *      { name: '' } which is invalid).
 *   4. Product.image is omitted when no images exist (vs rendering an
 *      empty array, which validators reject).
 *
 * The Product type comes from @/lib/shopify and would drag in
 * server-only at runtime, but `import type` is erased by Node 22's
 * experimental-strip-types, so the test imports just the pure function.
 *
 * Product fixtures are minimal — only the fields the JSON-LD generator
 * reads. Constructed inline in each test for clarity rather than a
 * shared fixture file.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

const { getProductJsonLd, pickPrimaryCollection } = await import('../../lib/product-jsonld.ts');

/**
 * Minimal Product fixture builder. Pass overrides to vary the shape;
 * everything else gets a reasonable default that matches the real
 * Shopify Storefront API response.
 */
function makeProduct(overrides = {}) {
  return {
    id: 'gid://shopify/Product/1',
    handle: 'test-product',
    title: 'Test Mattress',
    description: 'A really nice test mattress.',
    vendor: 'TestBrand',
    productType: 'Mattress',
    updatedAt: '2026-05-21T00:00:00Z',
    availableForSale: true,
    images: [{ url: 'https://cdn.example.com/test.jpg' }],
    featuredImage: { url: 'https://cdn.example.com/test.jpg' },
    priceRange: {
      minVariantPrice: { amount: '999.00', currencyCode: 'USD' },
      maxVariantPrice: { amount: '1999.00', currencyCode: 'USD' },
    },
    variants: [
      {
        sku: 'TEST-Q',
        barcode: '012345678905',
        price: { amount: '999.00', currencyCode: 'USD' },
        compareAtPrice: null,
        availableForSale: true,
        selectedOptions: [{ name: 'Size', value: 'Queen' }],
      },
    ],
    collections: [],
    specs: { firmness: null, heightInches: null, materialType: null, warrantyYears: null, trialNights: null },
    editorial: { firmnessScore: null, positionFit: null },
    reviews: null,
    ...overrides,
  };
}

function getProduct(lds) {
  const found = lds.find((x) => x.key === 'ld-product');
  return found ? found.data : null;
}

function getBreadcrumb(lds) {
  const found = lds.find((x) => x.key === 'ld-breadcrumb-product');
  return found ? found.data : null;
}

/* --- Sale-price schema (the big one) ----------------------------------- */

test('sale variant emits priceSpecification with ListPrice (not referencePrice)', () => {
  const lds = getProductJsonLd(makeProduct({
    variants: [{
      sku: 'TEST-Q-SALE',
      barcode: null,
      price: { amount: '799.00', currencyCode: 'USD' },
      compareAtPrice: { amount: '1199.00', currencyCode: 'USD' },
      availableForSale: true,
      selectedOptions: [{ name: 'Size', value: 'Queen' }],
    }],
  }));
  const offer = getProduct(lds).offers.offers[0];
  // Offer.price is the SALE price.
  assert.equal(offer.price, '799.00');
  // priceSpecification carries the original (higher) price tagged
  // with priceType=ListPrice — Google's canonical strikethrough pattern.
  assert.ok(offer.priceSpecification, 'expected priceSpecification on discounted variant');
  assert.equal(offer.priceSpecification['@type'], 'UnitPriceSpecification');
  assert.equal(offer.priceSpecification.price, '1199.00');
  assert.equal(offer.priceSpecification.priceType, 'https://schema.org/ListPrice');
  // The old buggy property must NOT appear anywhere.
  const json = JSON.stringify(offer);
  assert.equal(json.includes('referencePrice'), false, 'referencePrice is not a schema.org property; should not appear');
});

test('non-sale variant has no priceSpecification', () => {
  // compareAtPrice <= price (or null) means no discount; no priceSpecification.
  const lds = getProductJsonLd(makeProduct());
  const offer = getProduct(lds).offers.offers[0];
  assert.equal(offer.priceSpecification, undefined);
});

test('compareAtPrice <= price (defensive) does not emit priceSpecification', () => {
  // A misconfigured product where compareAtPrice equals the sale price
  // should NOT render a fake strikethrough.
  const lds = getProductJsonLd(makeProduct({
    variants: [{
      sku: 'X',
      barcode: null,
      price: { amount: '999.00', currencyCode: 'USD' },
      compareAtPrice: { amount: '999.00', currencyCode: 'USD' },
      availableForSale: true,
      selectedOptions: [],
    }],
  }));
  const offer = getProduct(lds).offers.offers[0];
  assert.equal(offer.priceSpecification, undefined);
});

/* --- itemOffered removed -------------------------------------------------- */

test('per-variant Offer does NOT emit itemOffered (was schema-incomplete)', () => {
  const lds = getProductJsonLd(makeProduct({
    variants: [
      { sku: 'A', barcode: null, price: { amount: '999.00', currencyCode: 'USD' }, compareAtPrice: null, availableForSale: true, selectedOptions: [{ name: 'Size', value: 'Queen' }] },
      { sku: 'B', barcode: null, price: { amount: '1199.00', currencyCode: 'USD' }, compareAtPrice: null, availableForSale: true, selectedOptions: [{ name: 'Size', value: 'King' }] },
    ],
  }));
  const offers = getProduct(lds).offers.offers;
  for (const o of offers) {
    assert.equal(o.itemOffered, undefined, 'variant Offer.itemOffered should be omitted');
  }
});

/* --- Brand guard --------------------------------------------------------- */

test('omits brand when vendor is empty string', () => {
  const ld = getProduct(getProductJsonLd(makeProduct({ vendor: '' })));
  assert.equal(ld.brand, undefined);
});

test('omits brand when vendor is whitespace only', () => {
  // Common Shopify quirk — merchants paste a value, delete it, leave a
  // trailing space.
  const ld = getProduct(getProductJsonLd(makeProduct({ vendor: '   ' })));
  assert.equal(ld.brand, undefined);
});

test('emits brand when vendor is present', () => {
  const ld = getProduct(getProductJsonLd(makeProduct({ vendor: 'Tempur-Pedic' })));
  assert.deepEqual(ld.brand, { '@type': 'Brand', name: 'Tempur-Pedic' });
});

test('trims surrounding whitespace from vendor', () => {
  const ld = getProduct(getProductJsonLd(makeProduct({ vendor: '  Stearns & Foster  ' })));
  assert.equal(ld.brand.name, 'Stearns & Foster');
});

/* --- Image guard --------------------------------------------------------- */

test('omits image field entirely when product has no images', () => {
  const ld = getProduct(getProductJsonLd(makeProduct({
    images: [],
    featuredImage: null,
  })));
  assert.equal(ld.image, undefined, 'empty image: [] would fail schema validators; field must be omitted');
});

test('falls back to featuredImage when images array is empty', () => {
  const ld = getProduct(getProductJsonLd(makeProduct({
    images: [],
    featuredImage: { url: 'https://cdn.example.com/featured.jpg' },
  })));
  assert.deepEqual(ld.image, ['https://cdn.example.com/featured.jpg']);
});

test('emits full images array when populated', () => {
  const ld = getProduct(getProductJsonLd(makeProduct({
    images: [
      { url: 'https://cdn.example.com/1.jpg' },
      { url: 'https://cdn.example.com/2.jpg' },
    ],
  })));
  assert.deepEqual(ld.image, ['https://cdn.example.com/1.jpg', 'https://cdn.example.com/2.jpg']);
});

/* --- Description guard (SEMrush 20260521_1 follow-up) --- */

test('omits description when empty string', () => {
  const ld = getProduct(getProductJsonLd(makeProduct({ description: '' })));
  assert.equal(ld.description, undefined);
});

test('omits description when whitespace only', () => {
  const ld = getProduct(getProductJsonLd(makeProduct({ description: '   \n  \t  ' })));
  assert.equal(ld.description, undefined);
});

test('omits description when null (defensive — Storefront type is string but)', () => {
  const ld = getProduct(getProductJsonLd(makeProduct({ description: null })));
  assert.equal(ld.description, undefined);
});

test('emits description when populated, trimmed at 5000 chars', () => {
  // Real-world products easily exceed 5000 chars in the body. The cap
  // protects against the Schema.org soft size limit; trim verifies the
  // empty-after-trim check fires only when trimmed string is empty.
  const ld = getProduct(getProductJsonLd(makeProduct({
    description: '  A genuinely useful product body that goes on for a while.  ',
  })));
  assert.equal(ld.description, 'A genuinely useful product body that goes on for a while.');
});

/* --- pickPrimaryCollection (exported helper, used for breadcrumb) ------ */

test('pickPrimaryCollection: skips meta collections, returns first real one', () => {
  const result = pickPrimaryCollection([
    { handle: 'all', title: 'All' },
    { handle: 'on-sale', title: 'On Sale' },
    { handle: 'memory-foam-mattresses', title: 'Memory Foam Mattresses' },
    { handle: 'best-sellers', title: 'Best Sellers' },
  ]);
  assert.equal(result.handle, 'memory-foam-mattresses');
});

test('pickPrimaryCollection: returns null when only meta collections present', () => {
  const result = pickPrimaryCollection([
    { handle: 'all', title: 'All' },
    { handle: 'on-sale', title: 'On Sale' },
    { handle: 'frontpage', title: 'Front Page' },
  ]);
  assert.equal(result, null);
});

test('pickPrimaryCollection: handles empty array', () => {
  assert.equal(pickPrimaryCollection([]), null);
});

/* --- Breadcrumb with primary collection -------------------------------- */

test('breadcrumb includes primary collection when product has a category', () => {
  const lds = getProductJsonLd(makeProduct({
    collections: [
      { handle: 'all', title: 'All' },
      { handle: 'tempur-pedic-mattresses', title: 'Tempur-Pedic Mattresses' },
    ],
  }));
  const breadcrumb = getBreadcrumb(lds);
  assert.equal(breadcrumb.itemListElement.length, 4);
  assert.equal(breadcrumb.itemListElement[2].name, 'Tempur-Pedic Mattresses');
});

test('breadcrumb has 3 levels when product has only meta collections', () => {
  // Home → Mattresses → Product (no category in between)
  const lds = getProductJsonLd(makeProduct({ collections: [{ handle: 'all', title: 'All' }] }));
  const breadcrumb = getBreadcrumb(lds);
  assert.equal(breadcrumb.itemListElement.length, 3);
});

/* --- Schema integrity smoke check -------------------------------------- */

test('Product LD has the required Google rich-results fields', () => {
  const ld = getProduct(getProductJsonLd(makeProduct()));
  assert.equal(ld['@type'], 'Product');
  assert.ok(ld.name, 'Product.name is required');
  assert.ok(ld.offers, 'Product.offers is required');
  assert.ok(ld.offers['@type'], 'AggregateOffer or Offer');
  // image, brand, sku are recommended; verify when fixture has them.
  assert.ok(ld.image);
  assert.ok(ld.brand);
  assert.ok(ld.sku);
});
