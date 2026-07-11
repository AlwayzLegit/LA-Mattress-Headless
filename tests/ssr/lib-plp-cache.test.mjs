/**
 * Unit tests for plpCdnCacheControl in lib/plp-cache.ts.
 *
 * Locks the CDN-cacheable request class (audit perf-isr-07): exactly
 * the canonical param-less `/collections/<handle>` view. Anything
 * dynamic — query variants (sort/filter/pagination), legacy filter
 * sub-paths, trailing slashes (normalized upstream), non-collection
 * routes — must return null so it stays uncached.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

const { plpCdnCacheControl, PLP_CDN_CACHE_CONTROL } = await import('../../lib/plp-cache.ts');

test('canonical collection PLP gets the CDN policy', () => {
  assert.equal(
    plpCdnCacheControl('/collections/mattresses', ''),
    PLP_CDN_CACHE_CONTROL,
  );
  assert.equal(
    plpCdnCacheControl('/collections/tempur-pedic-adjustable-bases', ''),
    PLP_CDN_CACHE_CONTROL,
  );
});

test('policy value is the audited s-maxage + SWR pair', () => {
  assert.equal(PLP_CDN_CACHE_CONTROL, 'public, s-maxage=300, stale-while-revalidate=600');
});

test('query-carrying requests stay dynamic', () => {
  assert.equal(plpCdnCacheControl('/collections/mattresses', '?sort=price-asc'), null);
  assert.equal(plpCdnCacheControl('/collections/mattresses', '?after=abc123'), null);
  assert.equal(plpCdnCacheControl('/collections/mattresses', '?firmness=firm'), null);
});

test('bare "?" is treated as no query', () => {
  assert.equal(plpCdnCacheControl('/collections/mattresses', '?'), PLP_CDN_CACHE_CONTROL);
});

test('legacy filter sub-paths are not cached (they 301 upstream)', () => {
  assert.equal(plpCdnCacheControl('/collections/mattresses/Brand_Sealy', ''), null);
  assert.equal(plpCdnCacheControl('/collections/mattresses/brand_sealy', ''), null);
});

test('trailing slash is not matched (normalized before lookup upstream)', () => {
  assert.equal(plpCdnCacheControl('/collections/mattresses/', ''), null);
});

test('non-collection routes are never cached', () => {
  assert.equal(plpCdnCacheControl('/', ''), null);
  assert.equal(plpCdnCacheControl('/collections', ''), null);
  assert.equal(plpCdnCacheControl('/products/some-mattress', ''), null);
  assert.equal(plpCdnCacheControl('/pages/mattress-store-locations', ''), null);
  assert.equal(plpCdnCacheControl('/admin/orders', ''), null);
});

test('uppercase / invalid handle characters are not matched', () => {
  assert.equal(plpCdnCacheControl('/collections/Mattresses', ''), null);
  assert.equal(plpCdnCacheControl('/collections/mattresses%2F..', ''), null);
});
