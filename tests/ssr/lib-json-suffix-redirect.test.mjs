/**
 * Unit tests for canonicalizeProductJsonPath in
 * lib/json-suffix-redirect.ts.
 *
 * Locks the regex boundary — legacy Shopify `/products/<handle>.json`
 * endpoint URLs (SEMrush 20260701 orphan audit) must 301 to the
 * product page, without swallowing normal product routes or paths
 * where `.json` isn't the terminal suffix.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

const { canonicalizeProductJsonPath } = await import('../../lib/json-suffix-redirect.ts');

test('SEMrush-flagged product .json endpoint redirects to product page', () => {
  assert.equal(
    canonicalizeProductJsonPath('/products/standard-foundation-box-spring.json'),
    '/products/standard-foundation-box-spring',
  );
});

test('mixed-case handle is accepted', () => {
  assert.equal(
    canonicalizeProductJsonPath('/products/Some-Handle.json'),
    '/products/Some-Handle',
  );
});

test('plain product path is NOT redirected', () => {
  assert.equal(canonicalizeProductJsonPath('/products/standard-foundation-box-spring'), null);
});

test('non-terminal .json is NOT redirected', () => {
  assert.equal(canonicalizeProductJsonPath('/products/foo.json/extra'), null);
});

test('empty handle is NOT redirected', () => {
  assert.equal(canonicalizeProductJsonPath('/products/.json'), null);
});

test('non-product resources are NOT redirected', () => {
  assert.equal(canonicalizeProductJsonPath('/collections/mattresses.json'), null);
  assert.equal(canonicalizeProductJsonPath('/pages/about.json'), null);
});

test('product index .json is NOT redirected', () => {
  assert.equal(canonicalizeProductJsonPath('/products.json'), null);
});
