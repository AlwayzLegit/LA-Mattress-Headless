/**
 * Unit tests for lib/shopify/gid.ts — the GID → numeric-ID helper used
 * to build admin.shopify.com deep-links from GraphQL IDs.
 *
 * Lives in tests/ssr/ so the existing tests/run.mjs glob picks it up,
 * but doesn't need the dev server (pure function). Node 22's
 * --experimental-strip-types handles the .ts import directly.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

const { numericIdFromGid } = await import('../../lib/shopify/gid.ts');

test('extracts numeric tail from a standard Product GID', () => {
  assert.equal(numericIdFromGid('gid://shopify/Product/12345'), '12345');
});

test('extracts numeric tail from a Customer GID', () => {
  assert.equal(numericIdFromGid('gid://shopify/Customer/7890123456'), '7890123456');
});

test('extracts numeric tail from a ProductVariant GID', () => {
  assert.equal(numericIdFromGid('gid://shopify/ProductVariant/42'), '42');
});

test('returns input unchanged when there is no numeric tail', () => {
  // Defensive fallback — never throw, always return a string the caller
  // can stuff into a URL even if the format ever changes.
  assert.equal(numericIdFromGid('not-a-gid'), 'not-a-gid');
  assert.equal(numericIdFromGid(''), '');
});

test('handles GIDs with query strings appended (uncommon but legal)', () => {
  // The regex anchors to /(\d+)$, so a trailing query string means no
  // match and we return the input. That's the safe default — the
  // alternative would be to strip the query, but Shopify Admin
  // doesn't actually produce these and the wrong heuristic could
  // mask a real bug.
  assert.equal(
    numericIdFromGid('gid://shopify/Product/12345?foo=bar'),
    'gid://shopify/Product/12345?foo=bar',
  );
});

test('matches only the final numeric segment', () => {
  // Some Shopify resources use nested paths with multiple numeric
  // segments — e.g., metafield definitions. The helper should pick
  // the LAST one, which is the resource's own ID.
  assert.equal(
    numericIdFromGid('gid://shopify/Metafield/12345/67890'),
    '67890',
  );
});
