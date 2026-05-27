/**
 * Unit tests for the UCP → ChatProductCard mapper in
 * lib/chat/shopify-mcp.ts.
 *
 * Pure-function tests — no Shopify, no network. Locks in the contract
 * between Shopify's hosted Storefront Catalog MCP response shape and
 * the inline-card payload our chat UI already renders. If Shopify
 * ever changes the UCP catalog response (additional optional fields,
 * renamed money shape, etc.) these tests catch the regression
 * deterministically without needing a live MCP roundtrip.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

const { ucpProductToCard } = await import('../../lib/chat/ucp-mapper.ts');

test('maps a complete UCP product node to a ChatProductCard', () => {
  const card = ucpProductToCard({
    id: 'gid://shopify/Product/123',
    title: 'Tempur-ProAdapt Firm',
    vendor: 'Tempur-Pedic',
    url: 'https://www.mattressstoreslosangeles.com/products/tempur-pedic-tempur-proadapt-firm-mattress?variant=42',
    price_range: {
      min: { amount: '299900', currency: 'USD' },
      max: { amount: '599900', currency: 'USD' },
    },
    media: [{ url: 'https://cdn.shopify.com/x.jpg', alt: 'side angle' }],
    rating: { value: 4.6, count: 128 },
  });
  assert.ok(card);
  assert.equal(card.handle, 'tempur-pedic-tempur-proadapt-firm-mattress');
  assert.equal(card.url, '/products/tempur-pedic-tempur-proadapt-firm-mattress');
  assert.equal(card.title, 'Tempur-ProAdapt Firm');
  assert.equal(card.vendor, 'Tempur-Pedic');
  assert.equal(card.imageUrl, 'https://cdn.shopify.com/x.jpg');
  assert.equal(card.imageAlt, 'side angle');
  // UCP returns price in MINOR units (cents); our cards use MAJOR (dollars).
  assert.equal(card.priceRange.minPrice, 2999);
  assert.equal(card.priceRange.maxPrice, 5999);
  assert.equal(card.priceRange.currency, 'USD');
  assert.equal(card.rating, 4.6);
  assert.equal(card.ratingCount, 128);
});

test('returns null when the UCP product has no parseable handle', () => {
  const card = ucpProductToCard({
    title: 'No URL Product',
    vendor: 'Acme',
  });
  assert.equal(card, null);
});

test('handles missing optional fields gracefully', () => {
  const card = ucpProductToCard({
    url: 'https://example.com/products/minimal',
    title: 'Minimal',
  });
  assert.ok(card);
  assert.equal(card.handle, 'minimal');
  assert.equal(card.vendor, '');
  assert.equal(card.imageUrl, null);
  assert.equal(card.imageAlt, 'Minimal');
  assert.equal(card.priceRange.minPrice, 0);
  assert.equal(card.priceRange.maxPrice, 0);
  assert.equal(card.priceRange.currency, 'USD');
  assert.equal(card.rating, null);
  assert.equal(card.ratingCount, null);
  assert.equal(card.firmness, null);
  assert.equal(card.material, null);
});

test('falls back to handle field when url is absent', () => {
  const card = ucpProductToCard({
    handle: 'fallback-handle',
    title: 'Bare',
    url: undefined,
  });
  assert.ok(card);
  assert.equal(card.handle, 'fallback-handle');
  assert.equal(card.url, '/products/fallback-handle');
});

test('mirrors maxPrice from minPrice when only min is provided', () => {
  const card = ucpProductToCard({
    url: 'https://example.com/products/single-price',
    title: 'Single Price',
    price_range: { min: { amount: '12900', currency: 'USD' } },
  });
  assert.ok(card);
  assert.equal(card.priceRange.minPrice, 129);
  assert.equal(card.priceRange.maxPrice, 129);
});

test('accepts numeric price amounts (not just strings)', () => {
  const card = ucpProductToCard({
    url: 'https://example.com/products/num-price',
    title: 'Num Price',
    price_range: {
      min: { amount: 9900, currency: 'USD' },
      max: { amount: 19900, currency: 'USD' },
    },
  });
  assert.ok(card);
  assert.equal(card.priceRange.minPrice, 99);
  assert.equal(card.priceRange.maxPrice, 199);
});
