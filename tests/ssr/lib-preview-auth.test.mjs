/**
 * Unit tests for lib/preview-auth.ts — verifyPreviewToken() constant-time
 * comparison.
 *
 * The other export, isPreviewEnabled(), reads Next.js's draftMode()
 * cookie via the next/headers API; that's only invokable inside a
 * request context (route handler, server component, or middleware),
 * so it's covered by SSR / E2E tests at the route layer instead of
 * here. This file pins the pure-function token verifier.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

// Set the env var BEFORE the module loads so the closure sees it.
process.env.SALE_PAGE_PREVIEW_TOKEN = 'test-token-abcdef-1234567890';

const { verifyPreviewToken } = await import('../../lib/preview-auth.ts');

test('returns true for an exact token match', () => {
  assert.equal(verifyPreviewToken('test-token-abcdef-1234567890'), true);
});

test('returns false for a wrong token of the same length', () => {
  assert.equal(verifyPreviewToken('test-token-abcdef-1234567891'), false);
});

test('returns false for a token of a different length (timingSafeEqual would otherwise throw)', () => {
  assert.equal(verifyPreviewToken('test-token-abcdef'), false);
  assert.equal(verifyPreviewToken('test-token-abcdef-1234567890-too-long'), false);
});

test('returns false for null / undefined / empty candidate', () => {
  assert.equal(verifyPreviewToken(null), false);
  assert.equal(verifyPreviewToken(undefined), false);
  assert.equal(verifyPreviewToken(''), false);
});

test('returns false when env var is unset (preview disabled by default)', async () => {
  // Re-import with the env var cleared. Each `await import` returns
  // the same module instance, so we set the env var globally before
  // import and toggle the runtime check instead — verifyPreviewToken
  // reads process.env.SALE_PAGE_PREVIEW_TOKEN on every call.
  const original = process.env.SALE_PAGE_PREVIEW_TOKEN;
  delete process.env.SALE_PAGE_PREVIEW_TOKEN;
  try {
    assert.equal(verifyPreviewToken('test-token-abcdef-1234567890'), false);
    assert.equal(verifyPreviewToken('anything-at-all'), false);
  } finally {
    process.env.SALE_PAGE_PREVIEW_TOKEN = original;
  }
});

test('rejects bytewise-similar but length-different tokens', () => {
  // Prefix matches but length differs — must reject (otherwise an
  // attacker could probe one byte at a time).
  assert.equal(verifyPreviewToken('test-token-abcdef-123456789'), false);
});
