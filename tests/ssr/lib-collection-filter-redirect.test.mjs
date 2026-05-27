/**
 * Unit tests for canonicalizeCollectionFilterPath in
 * lib/collection-filter-redirect.ts.
 *
 * Locks the regex boundary — we want every legacy Shopify Liquid
 * filter subpath (Brand_*, brand_*, size_*, type_*, Comfort_*) to
 * 301 to the parent collection, but NOT swallow other paths the
 * storefront might legitimately route to in the future.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

const { canonicalizeCollectionFilterPath } = await import('../../lib/collection-filter-redirect.ts');

test('SEMrush-flagged Brand_X capital prefix redirects to parent', () => {
  assert.equal(
    canonicalizeCollectionFilterPath('/collections/englander-mattresses/Brand_Englander'),
    '/collections/englander-mattresses',
  );
  assert.equal(
    canonicalizeCollectionFilterPath('/collections/bedroom-furniture/Brand_Bed-In-A-Box'),
    '/collections/bedroom-furniture',
  );
});

test('lowercase brand_x prefix redirects to parent', () => {
  assert.equal(
    canonicalizeCollectionFilterPath('/collections/mattresses/brand_stress-o-pedic'),
    '/collections/mattresses',
  );
});

test('size_*, type_*, Comfort_* filter variants all redirect', () => {
  assert.equal(canonicalizeCollectionFilterPath('/collections/mattresses/size_queen'), '/collections/mattresses');
  assert.equal(canonicalizeCollectionFilterPath('/collections/mattresses/size_ca-king'), '/collections/mattresses');
  assert.equal(canonicalizeCollectionFilterPath('/collections/mattresses/type_hybrid'), '/collections/mattresses');
  assert.equal(canonicalizeCollectionFilterPath('/collections/mattresses/Comfort_Pillowtop'), '/collections/mattresses');
});

test('plain collection path is NOT redirected', () => {
  assert.equal(canonicalizeCollectionFilterPath('/collections/mattresses'), null);
  assert.equal(canonicalizeCollectionFilterPath('/collections/englander-mattresses'), null);
});

test('non-filter sub-segments are NOT redirected', () => {
  // No underscore-separated value → not the filter convention. Leave
  // alone in case we add a real sub-route in the future.
  assert.equal(canonicalizeCollectionFilterPath('/collections/mattresses/products'), null);
  assert.equal(canonicalizeCollectionFilterPath('/collections/mattresses/foo-bar'), null);
});

test('deeper paths are NOT matched (only one segment past the handle)', () => {
  assert.equal(canonicalizeCollectionFilterPath('/collections/mattresses/size_queen/extra'), null);
  assert.equal(canonicalizeCollectionFilterPath('/collections/mattresses/Brand_X/Y'), null);
});

test('non-collection paths are ignored', () => {
  assert.equal(canonicalizeCollectionFilterPath('/products/some-product'), null);
  assert.equal(canonicalizeCollectionFilterPath('/pages/about'), null);
  assert.equal(canonicalizeCollectionFilterPath('/blogs/mattress-buying-guide/foo'), null);
  assert.equal(canonicalizeCollectionFilterPath('/collections'), null);
  assert.equal(canonicalizeCollectionFilterPath('/'), null);
});

test('handle must be valid Shopify shape (lowercase + hyphens + digits)', () => {
  // Uppercase handle won't match — Shopify handles are always lowercased.
  // No risk of swallowing /Collections/X/Y (capital C).
  assert.equal(canonicalizeCollectionFilterPath('/Collections/mattresses/Brand_X'), null);
  // Numeric handle works.
  assert.equal(canonicalizeCollectionFilterPath('/collections/2024-sale/Brand_X'), '/collections/2024-sale');
});

test('value with dots and underscores in filter value still matches', () => {
  // Some Shopify tags carry dots or underscores. Match permissively.
  assert.equal(
    canonicalizeCollectionFilterPath('/collections/mattresses/size_twin.xl'),
    '/collections/mattresses',
  );
  assert.equal(
    canonicalizeCollectionFilterPath('/collections/mattresses/type_memory_foam'),
    '/collections/mattresses',
  );
});
