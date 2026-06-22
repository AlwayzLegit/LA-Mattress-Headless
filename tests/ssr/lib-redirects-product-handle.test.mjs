/**
 * Unit tests for isRedirectedProductHandle in lib/redirects-table.ts — the
 * guard that keeps internal-link surfaces (PDP recommendation rail, etc.)
 * from linking to product handles whose canonical URL 301-redirects
 * (SEMrush "Permanent redirects" notice 214, ~1,098 PDP-rail links).
 *
 * Pulls live data from the committed redirects table, so no mocking — it
 * exercises a known redirecting handle, a live handle, and edge cases.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

const { isRedirectedProductHandle } = await import('../../lib/redirects-table.ts');

test('true for a known redirecting product handle', () => {
  // /products/tempur-pedic-tempur-ergo-power-base 301s to the homepage.
  assert.equal(isRedirectedProductHandle('tempur-pedic-tempur-ergo-power-base'), true);
  assert.equal(isRedirectedProductHandle('tempur-pedic-tempur-adapt-medium-mattress'), true);
});

test('false for a live (non-redirecting) product handle', () => {
  // A current best-seller PDP that resolves 200.
  assert.equal(isRedirectedProductHandle('helix-midnight-11-5-medium-hybrid-mattress'), false);
});

test('false for empty / undefined input', () => {
  assert.equal(isRedirectedProductHandle(''), false);
  assert.equal(isRedirectedProductHandle(undefined), false);
});

test('matches on the /products/ prefix, not a bare path', () => {
  // The handle is matched as `/products/<handle>` — passing a path that
  // already includes the prefix would not double-match.
  assert.equal(isRedirectedProductHandle('/products/tempur-pedic-tempur-ergo-power-base'), false);
});
