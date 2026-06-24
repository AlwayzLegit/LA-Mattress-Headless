/**
 * Unit tests for lib/sale-handles.ts — isSalePage() pattern matcher.
 *
 * Locks down which page handles trigger the SalePage template (vs. the
 * default CMS template). Each pattern in SALE_HANDLE_PATTERNS has at
 * least one positive + one negative case here so a future regex edit
 * that accidentally over-/under-matches fails fast.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

const { isSalePage } = await import('../../lib/sale-handles.ts');

test('matches the canonical "-sale-" handle pattern', () => {
  assert.equal(isSalePage('4th-of-july-mattress-sale-2026'), true);
  assert.equal(isSalePage('labor-day-sale-2026'), true);
  assert.equal(isSalePage('mattress-sale'), true);
  assert.equal(isSalePage('sale-event'), true);
});

test('matches multi-year sale handles (new-years-sale-2026-2027)', () => {
  assert.equal(isSalePage('new-years-sale-2026-2027'), true);
});

test('matches the holiday-name patterns even without "sale" in handle', () => {
  assert.equal(isSalePage('memorial-day-2026'), true);
  assert.equal(isSalePage('labor-day-2026'), true);
  assert.equal(isSalePage('presidents-day-2027'), true);
  assert.equal(isSalePage('presidentsday-2027'), true);
  assert.equal(isSalePage('mlk-day-2027'), true);
  assert.equal(isSalePage('mlkday-2027'), true);
  assert.equal(isSalePage('july-4-savings'), true);
  assert.equal(isSalePage('july4-savings'), true);
  assert.equal(isSalePage('fourth-of-july-2026'), true);
  assert.equal(isSalePage('4th-of-july-2026'), true);
  assert.equal(isSalePage('4th-of-july-mattress-sale-2027'), true);
  assert.equal(isSalePage('independence-day-2026'), true);
  assert.equal(isSalePage('black-friday-2026'), true);
  assert.equal(isSalePage('cyber-monday-deals'), true);
  assert.equal(isSalePage('christmas-promo'), true);
  assert.equal(isSalePage('new-year-2027'), true);
});

test('matches seasonal -sale and clearance patterns', () => {
  assert.equal(isSalePage('spring-sale'), true);
  assert.equal(isSalePage('summer-sale'), true);
  assert.equal(isSalePage('fall-sale'), true);
  assert.equal(isSalePage('winter-sale'), true);
  assert.equal(isSalePage('mattress-clearance'), true);
  assert.equal(isSalePage('warehouse-clearance-2026'), true);
});

test('matches deals-event pattern (singular + plural)', () => {
  assert.equal(isSalePage('deal-event-2026'), true);
  assert.equal(isSalePage('deals-event-2026'), true);
});

test('does NOT match unrelated CMS page handles', () => {
  assert.equal(isSalePage('mattress-store-locations'), false);
  assert.equal(isSalePage('mattress-store-financing'), false);
  assert.equal(isSalePage('love-your-bed-guarantee'), false);
  assert.equal(isSalePage('returns'), false);
  assert.equal(isSalePage('privacy-policy'), false);
  assert.equal(isSalePage('sleep-quiz'), false);
});

test('does NOT match neighborhood handles that contain "la" but no sale token', () => {
  assert.equal(isSalePage('mattress-store-beverly-hills'), false);
  assert.equal(isSalePage('mattress-store-santa-monica'), false);
});

test('is case-insensitive on holiday name segments', () => {
  // Real Shopify handles are lowercase, but the regex is /i — guard
  // against a future un-normalized caller.
  assert.equal(isSalePage('Memorial-Day-2026'), true);
  assert.equal(isSalePage('BLACK-FRIDAY-2026'), true);
});
