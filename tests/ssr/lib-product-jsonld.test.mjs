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

// GSC 20260603 fix: `Product.offers` is a flat array of per-variant
// Offer only. We previously prepended an AggregateOffer, but Google
// Merchant listings flagged it "Invalid object type for field offers"
// (an AggregateOffer can't carry hasMerchantReturnPolicy/shippingDetails,
// so it's not a valid merchant offer). getAggregateOffer now returns null
// (asserts the AggregateOffer is gone); getVariantOffers returns the Offers.
function getAggregateOffer(lds) {
  const offers = getProduct(lds)?.offers;
  if (!Array.isArray(offers)) return null;
  return offers.find((o) => o['@type'] === 'AggregateOffer') ?? null;
}
function getVariantOffers(lds) {
  const offers = getProduct(lds)?.offers;
  if (!Array.isArray(offers)) return [];
  return offers.filter((o) => o['@type'] === 'Offer');
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
  const offer = getVariantOffers(lds)[0];
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
  const offer = getVariantOffers(lds)[0];
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
  const offer = getVariantOffers(lds)[0];
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
  const offers = getVariantOffers(lds);
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

test('Product does NOT emit a `breadcrumb` property (invalid per schema.org)', () => {
  // Schema.org's `breadcrumb` property is defined on `WebPage`, NOT on
  // `Product` (Product → Thing; sibling branch to CreativeWork →
  // WebPage). SEMrush 2026-05-25 drill-down flagged this as the SOLE
  // schema-validation error on all 299 affected PDPs: "The property
  // breadcrumb is not recognized by Schema.org vocabulary." The
  // BreadcrumbList sibling block still emits — Google's entity graph
  // picks up the page-level connection via the URL / @id.
  const ld = getProduct(getProductJsonLd(makeProduct()));
  assert.equal(ld.breadcrumb, undefined,
    'Product must not declare `breadcrumb` — it is a WebPage-only property');
  // BreadcrumbList sibling still emits.
  const breadcrumb = getBreadcrumb(getProductJsonLd(makeProduct()));
  assert.ok(breadcrumb, 'BreadcrumbList sibling block must still emit');
  assert.match(breadcrumb['@id'], /#breadcrumb$/);
});

/* --- Schema integrity smoke check -------------------------------------- */

test('Product LD has the required Google rich-results fields', () => {
  const ld = getProduct(getProductJsonLd(makeProduct()));
  assert.equal(ld['@type'], 'Product');
  assert.ok(ld.name, 'Product.name is required');
  assert.ok(Array.isArray(ld.offers), 'Product.offers is a flat array of per-variant Offer');
  assert.ok(ld.offers.length >= 1, 'at least one Offer');
  assert.equal(ld.offers[0]['@type'], 'Offer', 'each element is an Offer (no AggregateOffer — GSC merchant-listing fix)');
  // image, brand, sku are recommended; verify when fixture has them.
  assert.ok(ld.image);
  assert.ok(ld.brand);
  assert.ok(ld.sku);
});

/* --- Schema-spec compliance (SEMrush 20260524) ----------------------- */

test('Product does NOT emit dateModified (not a valid Product property per schema.org)', () => {
  // Product extends Thing, not CreativeWork — dateModified is a
  // CreativeWork property. Strict validators (incl. SEMrush) flag
  // its presence as "non-existent property" on every PDP.
  const ld = getProduct(getProductJsonLd(makeProduct({ updatedAt: '2026-05-21T00:00:00Z' })));
  assert.equal(ld.dateModified, undefined);
});

test('Product.offers is a flat array of per-variant Offer (no AggregateOffer)', () => {
  // GSC 20260603: Google Merchant listings flagged a prepended
  // AggregateOffer as "Invalid object type for field offers" (it can't
  // carry hasMerchantReturnPolicy/shippingDetails, so it's not a valid
  // merchant offer). offers is now just the per-variant Offer[]; Google
  // derives the price range from the array.
  const lds = getProductJsonLd(makeProduct({
    variants: [
      { sku: 'V1', barcode: null, price: { amount: '999.00', currencyCode: 'USD' }, compareAtPrice: null, availableForSale: true, selectedOptions: [{ name: 'Size', value: 'Queen' }] },
      { sku: 'V2', barcode: null, price: { amount: '1199.00', currencyCode: 'USD' }, compareAtPrice: null, availableForSale: true, selectedOptions: [{ name: 'Size', value: 'King' }] },
    ],
  }));
  const ld = getProduct(lds);
  assert.ok(Array.isArray(ld.offers), 'offers is an array');
  assert.equal(getAggregateOffer(lds), null, 'no AggregateOffer in offers (merchant-listing fix)');
  const variants = getVariantOffers(lds);
  assert.equal(variants.length, 2, 'one Offer per variant');
  assert.equal(ld.offers.length, 2, 'offers contains only the per-variant Offers');
  assert.equal(variants[0].sku, 'V1');
  assert.equal(variants[1].sku, 'V2');
  // Each offer is merchant-eligible: carries returns + shipping.
  assert.ok(variants[0].hasMerchantReturnPolicy, 'Offer carries return policy');
  assert.ok(variants[0].shippingDetails, 'Offer carries shipping details');
});
