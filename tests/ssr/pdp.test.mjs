/**
 * Phase 204: Product structured-data assertions on `/products/[handle]`.
 *
 * Protects the Phase 170 enrichments — without these, the PDP Product LD
 * silently regresses to its pre-170 shape (no `@id`, no `url`, no
 * `category`, no `offers.itemCondition`, no breadcrumb position-3 URL),
 * which costs rich-result eligibility on Google.
 *
 * All assertions skip cleanly when Shopify env vars aren't configured
 * (the `app/products/[handle]/page.tsx` route calls `notFound()` when
 * `SHOPIFY_CONFIGURED` is false). See tests/ssr/_helpers.mjs:SHOPIFY_SKIP.
 *
 * Target handle is `tempur-pedic-tempur-proadapt-medium-hybrid` — chosen
 * because it has the full set of Phase 94 editorial metafields populated
 * (Overview / Firmness / Materials sections) plus stable Shopify data.
 * If the merchant ever discontinues this handle, switch to another
 * always-available product handle.
 */

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { fetchHtml, expect200, parseJsonLd, SHOPIFY_SKIP } from './_helpers.mjs';

const PRODUCT_PATH = '/products/tempur-pedic-tempur-proadapt-medium-hybrid';
const SITE = 'https://www.mattressstoreslosangeles.com';

test('PDP renders 200', { skip: SHOPIFY_SKIP }, async () => {
  const res = await fetchHtml(PRODUCT_PATH);
  expect200(res, PRODUCT_PATH);
});

test('PDP ld-product has @id ending in #product (Phase 170)', { skip: SHOPIFY_SKIP }, async () => {
  const { $ } = await fetchHtml(PRODUCT_PATH);
  const ld = parseJsonLd($, 'ld-product');
  assert.equal(ld['@type'], 'Product');
  assert.ok(typeof ld['@id'] === 'string', `expected ld-product["@id"] to be a string, got ${typeof ld['@id']}`);
  assert.ok(
    ld['@id'].endsWith('#product'),
    `expected ld-product["@id"] to end with #product, got "${ld['@id']}"`,
  );
});

test('PDP ld-product has canonical url (Phase 170)', { skip: SHOPIFY_SKIP }, async () => {
  const { $ } = await fetchHtml(PRODUCT_PATH);
  const ld = parseJsonLd($, 'ld-product');
  assert.equal(ld.url, `${SITE}${PRODUCT_PATH}`, `expected ld-product.url to equal canonical PDP url`);
});

test('PDP ld-product has category from Shopify productType (Phase 170)', { skip: SHOPIFY_SKIP }, async () => {
  const { $ } = await fetchHtml(PRODUCT_PATH);
  const ld = parseJsonLd($, 'ld-product');
  // category is the Shopify productType — for mattress products it's
  // typically "Hybrid Mattress", "Memory Foam Mattress", etc. We don't
  // pin the exact string (merchant can edit it), just that it's a
  // non-empty string.
  assert.ok(
    typeof ld.category === 'string' && ld.category.length > 0,
    `expected ld-product.category to be a non-empty string, got ${JSON.stringify(ld.category)}`,
  );
});

test('PDP ld-product.offers has itemCondition: NewCondition (Phase 170)', { skip: SHOPIFY_SKIP }, async () => {
  const { $ } = await fetchHtml(PRODUCT_PATH);
  const ld = parseJsonLd($, 'ld-product');
  assert.ok(ld.offers && typeof ld.offers === 'object', 'expected ld-product.offers to be an object');
  assert.equal(
    ld.offers.itemCondition,
    'https://schema.org/NewCondition',
    `expected ld-product.offers.itemCondition === "https://schema.org/NewCondition"`,
  );
});

test('PDP ld-breadcrumb-product position 3 has `item` URL (Phase 170)', { skip: SHOPIFY_SKIP }, async () => {
  const { $ } = await fetchHtml(PRODUCT_PATH);
  const ld = parseJsonLd($, 'ld-breadcrumb-product');
  assert.equal(ld['@type'], 'BreadcrumbList');
  assert.ok(Array.isArray(ld.itemListElement), 'expected itemListElement to be an array');
  const pos3 = ld.itemListElement.find((x) => x.position === 3);
  assert.ok(pos3, 'expected a position-3 breadcrumb entry');
  assert.equal(
    pos3.item,
    `${SITE}${PRODUCT_PATH}`,
    `expected breadcrumb position-3 .item to equal canonical PDP url`,
  );
});
