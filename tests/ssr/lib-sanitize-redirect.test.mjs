/**
 * Unit tests for resolveRedirectPath in lib/sanitize.ts — the single-
 * path resolver used by the HTML sitemap page + PLP guides block to
 * rewrite hardcoded internal hrefs through redirects.json before the
 * crawler ever sees a 301.
 *
 * The function pulls live data from the committed redirects.json, so
 * the tests don't need to mock anything — they just exercise the
 * known SEMrush-flagged redirect sources and a handful of structural
 * edge cases.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

const { resolveRedirectPath } = await import('../../lib/sanitize.ts');

test('returns the input unchanged for a non-redirect path', () => {
  // /collections/mattresses is a live PLP, NOT a redirect source.
  assert.equal(resolveRedirectPath('/collections/mattresses'), '/collections/mattresses');
});

test('chain-collapses a known multi-source slug to the final destination', () => {
  // /collections/box-spring-foundations → /collections/foundations
  // (added in PR #232's SEMrush backfill).
  assert.equal(
    resolveRedirectPath('/collections/box-spring-foundations'),
    '/collections/foundations',
  );
});

test('rewrites a /pages variant slug to its canonical handle', () => {
  // /pages/hancock-park-best-mattress-store → /pages/best-mattress-store-la-brea
  // (added in PR #232).
  assert.equal(
    resolveRedirectPath('/pages/hancock-park-best-mattress-store'),
    '/pages/best-mattress-store-la-brea',
  );
});

test('rewrites a blog-article slug variant', () => {
  // /blogs/mattress-buying-guide/queen-mattress-size-guide-inches-feet-how-to-pick-the-perfect-fit
  //   → /blogs/mattress-buying-guide/full-vs-queen-mattress
  // (from the size-cluster redirect group).
  assert.equal(
    resolveRedirectPath(
      '/blogs/mattress-buying-guide/queen-mattress-size-guide-inches-feet-how-to-pick-the-perfect-fit',
    ),
    '/blogs/mattress-buying-guide/full-vs-queen-mattress',
  );
});

test('preserves query string + hash on rewrite', () => {
  // A redirected path with ?foo=bar should land at <dest>?foo=bar.
  assert.equal(
    resolveRedirectPath('/collections/box-spring-foundations?sort_by=price-ascending'),
    '/collections/foundations?sort_by=price-ascending',
  );
  assert.equal(
    resolveRedirectPath('/collections/box-spring-foundations#section'),
    '/collections/foundations#section',
  );
});

test('returns external URLs unchanged (defensive)', () => {
  // Function is for internal paths only; full URLs should pass through.
  assert.equal(
    resolveRedirectPath('https://example.com/collections/foundations'),
    'https://example.com/collections/foundations',
  );
});

test('returns protocol-relative URLs unchanged (defensive)', () => {
  // //example.com/foo is protocol-relative; not an internal path.
  assert.equal(
    resolveRedirectPath('//cdn.shopify.com/files/foo.jpg'),
    '//cdn.shopify.com/files/foo.jpg',
  );
});

test('returns root path unchanged', () => {
  assert.equal(resolveRedirectPath('/'), '/');
});

test('handles malformed inputs gracefully', () => {
  // The function is called from server-rendered Link hrefs; bad input
  // shouldn't crash the page render.
  assert.equal(resolveRedirectPath(''), '');
  assert.equal(resolveRedirectPath('relative/path'), 'relative/path');
});
