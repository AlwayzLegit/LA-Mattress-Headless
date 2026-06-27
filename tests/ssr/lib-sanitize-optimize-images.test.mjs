/**
 * Unit tests for the optimizeBodyImages pass inside sanitizeShopifyHtml —
 * the deferred-loading + Shopify-CDN width-hint rewrite added after
 * SEMrush audit 20260627 flagged best-black-bedroom-sets at 5,274ms.
 *
 * The pass is invoked at the end of sanitizeShopifyHtml, so we exercise
 * it via the public sanitize entrypoint (matches real render-time).
 */
import test from 'node:test';
import assert from 'node:assert/strict';

const { sanitizeShopifyHtml } = await import('../../lib/sanitize.ts');

test('adds loading=lazy and decoding=async to plain <img>', () => {
  const html = '<p>Hi</p><img src="https://cdn.shopify.com/s/files/1/0001/example.jpg" alt="x">';
  const out = sanitizeShopifyHtml(html);
  assert.match(out, /loading="lazy"/);
  assert.match(out, /decoding="async"/);
});

test('preserves an existing loading attribute (e.g. eager)', () => {
  const html = '<img src="https://cdn.shopify.com/x.jpg" loading="eager" alt="hero">';
  const out = sanitizeShopifyHtml(html);
  assert.match(out, /loading="eager"/);
  // Should NOT add a second loading attribute.
  assert.equal((out.match(/\bloading=/g) ?? []).length, 1);
});

test('appends ?width=1200 to a Shopify-CDN <img src> with no query', () => {
  const html = '<img src="https://cdn.shopify.com/s/files/1/0001/foo.jpg" alt="a">';
  const out = sanitizeShopifyHtml(html);
  assert.match(out, /\?width=1200/);
});

test('appends &width=1200 when the CDN URL already has a query', () => {
  const html = '<img src="https://cdn.shopify.com/s/files/1/0001/foo.jpg?v=42" alt="a">';
  const out = sanitizeShopifyHtml(html);
  assert.match(out, /\?v=42&width=1200/);
});

test('does NOT add width when one is already in the URL', () => {
  const html = '<img src="https://cdn.shopify.com/s/files/1/0001/foo.jpg?width=600" alt="a">';
  const out = sanitizeShopifyHtml(html);
  // Original width preserved; no second width param appended.
  assert.match(out, /width=600/);
  assert.equal((out.match(/width=\d+/g) ?? []).length, 1);
});

test('does NOT add width to <img> with srcset (already responsive)', () => {
  const html =
    '<img src="https://cdn.shopify.com/x.jpg" srcset="https://cdn.shopify.com/x.jpg?width=400 400w, https://cdn.shopify.com/x.jpg?width=800 800w" alt="a">';
  const out = sanitizeShopifyHtml(html);
  // The bare src should be untouched (srcset already covers sizing).
  assert.match(out, /src="https:\/\/cdn\.shopify\.com\/x\.jpg"/);
});

test('does NOT touch non-Shopify-CDN <img src>', () => {
  const html = '<img src="https://example.com/photo.jpg" alt="a">';
  const out = sanitizeShopifyHtml(html);
  // Lazy/decoding still added, but width must NOT be appended.
  assert.doesNotMatch(out, /example\.com\/photo\.jpg.*width=/);
  assert.match(out, /loading="lazy"/);
});
