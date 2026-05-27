/**
 * Unit tests for the custom Next.js image loader in lib/image-loader.ts.
 *
 * Locks in the contract that every <Image src="..."> goes through this
 * function (next.config.mjs#images.loader: 'custom') so any regression
 * here breaks every product/article/hero image. Specifically guards
 * the format=webp pin — Next.js's preload tag for LCP candidates
 * doesn't send Accept: image/webp, and a missing pin can silently
 * 5x the LCP payload on cached pages.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

const { default: imageLoader } = await import('../../lib/image-loader.ts');

test('Shopify CDN URL gets width + format=webp + quality params', () => {
  const out = imageLoader({
    src: 'https://cdn.shopify.com/s/files/1/0123/abc/files/hero.jpg',
    width: 1600,
    quality: 75,
  });
  const u = new URL(out);
  assert.equal(u.hostname, 'cdn.shopify.com');
  assert.equal(u.searchParams.get('width'), '1600');
  assert.equal(u.searchParams.get('format'), 'webp');
  assert.equal(u.searchParams.get('quality'), '75');
});

test('Shopify CDN URL defaults quality to 75 when not provided', () => {
  const out = imageLoader({
    src: 'https://cdn.shopify.com/s/files/1/0/x.png',
    width: 800,
  });
  assert.equal(new URL(out).searchParams.get('quality'), '75');
});

test('Shopify CDN URL preserves existing query params (e.g. v= cache buster)', () => {
  const out = imageLoader({
    src: 'https://cdn.shopify.com/s/files/1/0/x.jpg?v=1234567890',
    width: 1200,
  });
  const u = new URL(out);
  assert.equal(u.searchParams.get('v'), '1234567890');
  assert.equal(u.searchParams.get('format'), 'webp');
  assert.equal(u.searchParams.get('width'), '1200');
});

test('Unsplash URL gets w + q + auto + fit params (unchanged behavior)', () => {
  const out = imageLoader({
    src: 'https://images.unsplash.com/photo-123abc',
    width: 1200,
    quality: 80,
  });
  const u = new URL(out);
  assert.equal(u.searchParams.get('w'), '1200');
  assert.equal(u.searchParams.get('q'), '80');
  assert.equal(u.searchParams.get('auto'), 'format');
  assert.equal(u.searchParams.get('fit'), 'crop');
});

test('Local asset path is returned unchanged', () => {
  const out = imageLoader({ src: '/assets/logo.svg', width: 200 });
  assert.equal(out, '/assets/logo.svg');
});

test('Unknown remote host is returned unchanged', () => {
  const out = imageLoader({ src: 'https://example.com/img.png', width: 400 });
  assert.equal(out, 'https://example.com/img.png');
});
