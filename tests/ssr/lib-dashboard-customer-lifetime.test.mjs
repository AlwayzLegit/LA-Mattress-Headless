/**
 * Unit tests for lib/dashboard/customer-lifetime.ts — the LTV /
 * lifecycle aggregation behind the dashboard's two new Customers cards.
 *
 * Locks down:
 *   - Bucket boundaries (1, 2, 3, 4-9, 10+)
 *   - Mean + median across odd + even sample sizes
 *   - Top-N picking with mixed input order
 *   - Empty-input behavior (the renderer falls back to "no data")
 *   - The five buckets are always present in the output, even when empty
 */
import test from 'node:test';
import assert from 'node:assert/strict';

const { summarizeCustomerLifetime } = await import('../../lib/dashboard/customer-lifetime.ts');

/** Helper: build a customer fixture with sane defaults. */
function c(amount, orders, name = `cust-${amount}-${orders}`) {
  return {
    id: name,
    displayName: name,
    email: `${name}@example.com`,
    ordersCount: orders,
    amountSpent: amount,
    currency: 'USD',
  };
}

/* --- Empty-input --- */

test('returns a zero summary for an empty sample', () => {
  const r = summarizeCustomerLifetime([]);
  assert.equal(r.sampleSize, 0);
  assert.equal(r.averageLtv, 0);
  assert.equal(r.medianLtv, 0);
  assert.equal(r.topByLtv.length, 0);
  // All 5 buckets are still present (with zero counts) so the renderer
  // has a stable row count.
  assert.equal(r.buckets.length, 5);
  for (const b of r.buckets) {
    assert.equal(b.customers, 0);
    assert.equal(b.revenue, 0);
  }
});

/* --- Bucketing --- */

test('bucketing: each tier matches its ordersCount range', () => {
  const r = summarizeCustomerLifetime([
    c(100, 1, 'a'),     // 1 order
    c(200, 1, 'b'),     // 1 order
    c(500, 2, 'c'),     // 2 orders
    c(800, 3, 'd'),     // 3 orders
    c(1200, 5, 'e'),    // 4-9 orders
    c(2000, 9, 'f'),    // 4-9 orders (upper boundary)
    c(3000, 10, 'g'),   // 10+ orders (lower boundary)
    c(9999, 47, 'h'),   // 10+ orders
  ]);

  const labels = r.buckets.map((b) => `${b.label}:${b.customers}`);
  assert.deepEqual(labels, [
    '1 order:2',
    '2 orders:1',
    '3 orders:1',
    '4–9 orders:2',
    '10+ orders:2',
  ]);
});

test('bucketing: revenue sums per tier', () => {
  const r = summarizeCustomerLifetime([
    c(100, 1, 'one-a'),
    c(200, 1, 'one-b'),
    c(500, 4, 'mid'),
    c(1500, 12, 'top'),
  ]);
  const get = (label) => r.buckets.find((b) => b.label === label);
  assert.equal(get('1 order').revenue, 300);
  assert.equal(get('4–9 orders').revenue, 500);
  assert.equal(get('10+ orders').revenue, 1500);
  // Untouched tier reads as zero, not undefined.
  assert.equal(get('2 orders').revenue, 0);
});

test('bucketing: customers with 0 orders are silently excluded (defensive)', () => {
  // numberOfOrders is the lifetime count and should always be >= 1 for
  // a customer who's spent money. But Shopify quirks happen — make sure
  // zero-order customers don't accidentally count in the "1 order" tier.
  const r = summarizeCustomerLifetime([
    c(0, 0, 'never-bought'),
    c(100, 1, 'real'),
  ]);
  const oneTier = r.buckets.find((b) => b.label === '1 order');
  assert.equal(oneTier.customers, 1);
  assert.equal(oneTier.revenue, 100);
});

/* --- Mean + median --- */

test('mean: simple arithmetic across the sample', () => {
  const r = summarizeCustomerLifetime([c(100, 1), c(200, 1), c(300, 1)]);
  assert.equal(r.averageLtv, 200);
});

test('median: odd-sized sample picks the middle value', () => {
  const r = summarizeCustomerLifetime([c(100, 1), c(500, 1), c(2000, 1)]);
  assert.equal(r.medianLtv, 500);
});

test('median: even-sized sample averages the two middle values', () => {
  // sorted: [100, 200, 400, 800] → median = (200 + 400) / 2 = 300
  const r = summarizeCustomerLifetime([c(100, 1), c(200, 1), c(400, 1), c(800, 1)]);
  assert.equal(r.medianLtv, 300);
});

test('median: handles input in random order', () => {
  // Same sample as the previous test, but shuffled — should still hit 300.
  const r = summarizeCustomerLifetime([c(800, 1), c(100, 1), c(400, 1), c(200, 1)]);
  assert.equal(r.medianLtv, 300);
});

/* --- topByLtv --- */

test('topByLtv: sorted descending by amountSpent regardless of input order', () => {
  const r = summarizeCustomerLifetime([
    c(100, 1, 'low'),
    c(5000, 3, 'high'),
    c(1500, 2, 'mid'),
  ]);
  assert.deepEqual(
    r.topByLtv.map((x) => x.displayName),
    ['high', 'mid', 'low'],
  );
});

test('topByLtv: respects the topN parameter', () => {
  const customers = Array.from({ length: 20 }, (_, i) => c(i * 100, 1, `c${i}`));
  const r = summarizeCustomerLifetime(customers, 5);
  assert.equal(r.topByLtv.length, 5);
  // Should be the 5 highest-spending: c19, c18, c17, c16, c15.
  assert.deepEqual(
    r.topByLtv.map((x) => x.displayName),
    ['c19', 'c18', 'c17', 'c16', 'c15'],
  );
});

test('topByLtv: default of 10 when topN is omitted', () => {
  const customers = Array.from({ length: 15 }, (_, i) => c(i * 10, 1, `c${i}`));
  const r = summarizeCustomerLifetime(customers);
  assert.equal(r.topByLtv.length, 10);
});

/* --- Currency --- */

test('currency: carries through from the first customer', () => {
  const r = summarizeCustomerLifetime([
    { id: '1', displayName: 'a', email: null, ordersCount: 1, amountSpent: 100, currency: 'CAD' },
  ]);
  assert.equal(r.currency, 'CAD');
});

test('currency: falls back to USD when sample is empty', () => {
  const r = summarizeCustomerLifetime([]);
  assert.equal(r.currency, 'USD');
});
