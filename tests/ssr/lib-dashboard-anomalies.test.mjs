/**
 * Unit tests for lib/dashboard/anomalies.ts.
 *
 * Each detector gets its own test (or pair: fires / doesn't fire) so
 * threshold tuning over time stays easy. Inputs are stubbed at the
 * minimum shape the function needs — full data fixtures would be noise.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

const { detectAnomalies } = await import('../../lib/dashboard/anomalies.ts');

/** Default empty input — every detector should bail cleanly. */
function emptyInput(overrides = {}) {
  return {
    orderSummary: null,
    refundHealth: null,
    customerInsights: null,
    lowStock: null,
    searches: null,
    funnelConvNow: null,
    funnelConvPrev: null,
    cartAbandonmentNow: null,
    cartAbandonmentPrev: null,
    // Default to a comfortable sample size so cart-abandonment tests
    // that pass cartAbandonment{Now,Prev} don't have to also remember
    // to override the small-sample guard. Tests that explicitly want
    // to verify the guard override these to a small number.
    cartViewersNow: 100,
    cartViewersPrev: 100,
    rangeLabel: 'Last 30 days',
    ...overrides,
  };
}

test('returns empty array when no data is present', () => {
  const out = detectAnomalies(emptyInput());
  assert.equal(out.length, 0);
});

/* --- Revenue-down detector --- */

test('revenue-down: fires when revenue is down 30%', () => {
  // Volume guard (cowork 20260521): requires ≥10 current-window orders.
  // Test uses 14/$7000 vs 20/$10000 to clear that floor.
  const out = detectAnomalies(emptyInput({
    orderSummary: {
      totalOrders: 14,
      totalRevenue: 7000,
      currency: 'USD',
      prev: { totalOrders: 20, totalRevenue: 10000 },
    },
  }));
  const a = out.find((x) => x.id === 'revenue-down');
  assert.ok(a, 'should fire revenue-down');
  assert.equal(a.severity, 'warn');
  assert.match(a.headline, /30%/);
});

test('revenue-down: critical when down 50%', () => {
  // ≥10 orders both windows clears the volume guard.
  const out = detectAnomalies(emptyInput({
    orderSummary: {
      totalOrders: 10,
      totalRevenue: 5000,
      currency: 'USD',
      prev: { totalOrders: 20, totalRevenue: 10000 },
    },
  }));
  const a = out.find((x) => x.id === 'revenue-down');
  assert.equal(a.severity, 'critical');
});

test('revenue-down: does NOT fire on a 20% drop (within noise band)', () => {
  const out = detectAnomalies(emptyInput({
    orderSummary: {
      totalOrders: 8, totalRevenue: 8000, currency: 'USD',
      prev: { totalOrders: 10, totalRevenue: 10000 },
    },
  }));
  assert.equal(out.find((x) => x.id === 'revenue-down'), undefined);
});

test('revenue-down: does NOT fire when prev is null (no comparison)', () => {
  const out = detectAnomalies(emptyInput({
    orderSummary: { totalOrders: 0, totalRevenue: 0, currency: 'USD', prev: null },
  }));
  assert.equal(out.find((x) => x.id === 'revenue-down'), undefined);
});

test('revenue-down: does NOT fire when prev revenue is 0 (divide by zero guard)', () => {
  const out = detectAnomalies(emptyInput({
    orderSummary: {
      totalOrders: 5, totalRevenue: 5000, currency: 'USD',
      prev: { totalOrders: 0, totalRevenue: 0 },
    },
  }));
  assert.equal(out.find((x) => x.id === 'revenue-down'), undefined);
});

/* --- Refund-rate detector --- */

test('refund-rate: critical when above 10%', () => {
  const out = detectAnomalies(emptyInput({
    refundHealth: { totalOrders: 100, refundRatePct: 12.5, cancellationRatePct: 1 },
  }));
  const a = out.find((x) => x.id === 'refund-rate-high');
  assert.ok(a);
  assert.equal(a.severity, 'critical');
});

test('refund-rate: warn when above 5%', () => {
  const out = detectAnomalies(emptyInput({
    refundHealth: { totalOrders: 100, refundRatePct: 7, cancellationRatePct: 1 },
  }));
  const a = out.find((x) => x.id === 'refund-rate-elevated');
  assert.ok(a);
  assert.equal(a.severity, 'warn');
});

test('refund-rate: does NOT fire under 5%', () => {
  const out = detectAnomalies(emptyInput({
    refundHealth: { totalOrders: 100, refundRatePct: 3, cancellationRatePct: 1 },
  }));
  assert.equal(out.length, 0);
});

test('refund-rate: does NOT fire below the 20-order sample guard', () => {
  // Cowork 20260521 raised the floor from 5 → 20 orders. At 5 orders,
  // 1 refund = 20% rate which always tripped critical. At 20+, one
  // refund = 5% — right at the boundary, meaningful but not panicky.
  // This test exercises the under-floor case: 15 orders is below the
  // new floor → detector silent regardless of the rate.
  const out = detectAnomalies(emptyInput({
    refundHealth: { totalOrders: 15, refundRatePct: 33, cancellationRatePct: 0 },
  }));
  assert.equal(out.length, 0);
});

/* --- Cart-abandonment detector --- */

test('cart-abandonment: warn when up 12pp', () => {
  const out = detectAnomalies(emptyInput({
    cartAbandonmentNow: 0.72,
    cartAbandonmentPrev: 0.60,
  }));
  const a = out.find((x) => x.id === 'cart-abandonment-up');
  assert.ok(a);
  assert.equal(a.severity, 'warn');
  assert.match(a.headline, /12.0pp/);
});

test('cart-abandonment: critical when up 25pp', () => {
  const out = detectAnomalies(emptyInput({
    cartAbandonmentNow: 0.85,
    cartAbandonmentPrev: 0.60,
  }));
  const a = out.find((x) => x.id === 'cart-abandonment-up');
  assert.equal(a.severity, 'critical');
});

test('cart-abandonment: does NOT fire when only up 5pp', () => {
  const out = detectAnomalies(emptyInput({
    cartAbandonmentNow: 0.65,
    cartAbandonmentPrev: 0.60,
  }));
  assert.equal(out.find((x) => x.id === 'cart-abandonment-up'), undefined);
});

test('cart-abandonment: does NOT fire when prev is null', () => {
  const out = detectAnomalies(emptyInput({
    cartAbandonmentNow: 0.95,
    cartAbandonmentPrev: null,
  }));
  assert.equal(out.find((x) => x.id === 'cart-abandonment-up'), undefined);
});

test('cart-abandonment: does NOT fire on a tiny sample (QA round 2 B2)', () => {
  // The scenario QA round 2 caught on production: 2 cart_view events,
  // 1 checkout_started, prior window all zeros. The math says "50pp
  // jump from 0%", but it's noise. Detector should skip when current
  // cart viewers < 5.
  const out = detectAnomalies(emptyInput({
    cartAbandonmentNow: 0.50,
    cartAbandonmentPrev: 0.00,
    cartViewersNow: 2,
    cartViewersPrev: 0,
  }));
  assert.equal(out.find((x) => x.id === 'cart-abandonment-up'), undefined);
});

test('cart-abandonment: fires once BOTH windows cross the 5-viewer threshold', () => {
  // Cowork 20260521 follow-up: both cartViewersNow AND cartViewersPrev
  // must clear ≥5. Otherwise "was 0%, now 80%" can fire when the
  // previous window had 1 cart_view that left without checking out.
  const out = detectAnomalies(emptyInput({
    cartAbandonmentNow: 0.50,
    cartAbandonmentPrev: 0.10,
    cartViewersNow: 5,
    cartViewersPrev: 5,
  }));
  const a = out.find((x) => x.id === 'cart-abandonment-up');
  assert.ok(a, 'should fire when both windows have ≥5 cart viewers');
});

test('cart-abandonment: does NOT fire when only cartViewersPrev is below the floor', () => {
  // Cowork 20260521 follow-up: the prev-window guard.
  const out = detectAnomalies(emptyInput({
    cartAbandonmentNow: 0.80,
    cartAbandonmentPrev: 0.00,
    cartViewersNow: 50,
    cartViewersPrev: 1,  // ← below floor
  }));
  assert.equal(out.find((x) => x.id === 'cart-abandonment-up'), undefined);
});

/* --- Conversion-down detector --- */

test('conversion-down: warn when down 1pp', () => {
  const out = detectAnomalies(emptyInput({
    funnelConvNow: 0.018,
    funnelConvPrev: 0.030,
  }));
  const a = out.find((x) => x.id === 'conversion-down');
  assert.ok(a);
  // 0.030 → 0.018 is -1.20pp → warn (not critical, which is at -2pp)
  assert.equal(a.severity, 'warn');
});

test('conversion-down: critical when down 2.5pp', () => {
  const out = detectAnomalies(emptyInput({
    funnelConvNow: 0.005,
    funnelConvPrev: 0.030,
  }));
  const a = out.find((x) => x.id === 'conversion-down');
  assert.equal(a.severity, 'critical');
});

test('conversion-down: does NOT fire on a 0.3pp drop (noise band)', () => {
  const out = detectAnomalies(emptyInput({
    funnelConvNow: 0.027,
    funnelConvPrev: 0.030,
  }));
  assert.equal(out.find((x) => x.id === 'conversion-down'), undefined);
});

/* --- Oversold inventory detector --- */

test('oversold-inventory: critical when any variant <= 0', () => {
  const out = detectAnomalies(emptyInput({
    lowStock: [
      { productHandle: 'foo', productTitle: 'Foo Mattress', variantTitle: 'Queen', quantity: -2, productId: '1' },
      { productHandle: 'bar', productTitle: 'Bar Mattress', variantTitle: 'King', quantity: 1, productId: '2' },
    ],
  }));
  const a = out.find((x) => x.id === 'oversold-inventory');
  assert.ok(a);
  assert.equal(a.severity, 'critical');
  // Detail should mention the offending variant by name.
  assert.match(a.detail, /Foo Mattress/);
});

test('oversold-inventory: does NOT fire when all variants > 0', () => {
  const out = detectAnomalies(emptyInput({
    lowStock: [
      { productHandle: 'foo', productTitle: 'Foo', variantTitle: 'Queen', quantity: 2, productId: '1' },
    ],
  }));
  assert.equal(out.find((x) => x.id === 'oversold-inventory'), undefined);
});

test('oversold-inventory: summarizes when multiple variants are oversold', () => {
  const out = detectAnomalies(emptyInput({
    lowStock: [
      { productHandle: 'foo', productTitle: 'Foo', variantTitle: 'Q', quantity: -3, productId: '1' },
      { productHandle: 'bar', productTitle: 'Bar', variantTitle: 'K', quantity: 0, productId: '2' },
      { productHandle: 'baz', productTitle: 'Baz', variantTitle: 'F', quantity: -1, productId: '3' },
    ],
  }));
  const a = out.find((x) => x.id === 'oversold-inventory');
  assert.match(a.headline, /3 variants/);
});

/* --- Zero-result searches detector --- */

test('zero-result searches: fires when ≥25% of searches return nothing', () => {
  const out = detectAnomalies(emptyInput({
    searches: [
      { query: 'topper', searches: 50, zeroResult: 0, zeroPct: 0 },
      { query: 'tempurpedic', searches: 30, zeroResult: 30, zeroPct: 100 },
      { query: 'foundation', searches: 20, zeroResult: 0, zeroPct: 0 },
    ],
  }));
  // total = 100, zero = 30 → 30%
  const a = out.find((x) => x.id === 'zero-result-searches-high');
  assert.ok(a);
  assert.match(a.headline, /30%/);
  // Should call out the top zero-result query.
  assert.match(a.detail, /tempurpedic/);
});

test('zero-result searches: does NOT fire below 20-search threshold', () => {
  const out = detectAnomalies(emptyInput({
    searches: [
      { query: 'a', searches: 5, zeroResult: 5, zeroPct: 100 },
      { query: 'b', searches: 3, zeroResult: 3, zeroPct: 100 },
      { query: 'c', searches: 2, zeroResult: 0, zeroPct: 0 },
    ],
  }));
  assert.equal(out.find((x) => x.id === 'zero-result-searches-high'), undefined);
});

test('zero-result searches: does NOT fire when zero-rate is under 25%', () => {
  const out = detectAnomalies(emptyInput({
    searches: [
      { query: 'a', searches: 100, zeroResult: 10, zeroPct: 10 },
      { query: 'b', searches: 50, zeroResult: 5, zeroPct: 10 },
      { query: 'c', searches: 30, zeroResult: 0, zeroPct: 0 },
    ],
  }));
  assert.equal(out.find((x) => x.id === 'zero-result-searches-high'), undefined);
});

/* --- Revenue-up detector (positive sibling of revenue-down) --- */

test('revenue-up: info when up 30%', () => {
  const out = detectAnomalies(emptyInput({
    orderSummary: {
      totalOrders: 13,
      totalRevenue: 13000,
      avgOrderValue: 1000,
      currency: 'USD',
      prev: { totalOrders: 10, totalRevenue: 10000, avgOrderValue: 1000 },
    },
  }));
  const a = out.find((x) => x.id === 'revenue-up');
  assert.ok(a, 'should fire revenue-up at +30%');
  assert.equal(a.severity, 'info');
  assert.match(a.headline, /30%/);
});

test('revenue-up: warn when up 50% (real signal worth confirming)', () => {
  const out = detectAnomalies(emptyInput({
    orderSummary: {
      totalOrders: 15,
      totalRevenue: 15000,
      avgOrderValue: 1000,
      currency: 'USD',
      prev: { totalOrders: 10, totalRevenue: 10000, avgOrderValue: 1000 },
    },
  }));
  const a = out.find((x) => x.id === 'revenue-up');
  assert.equal(a.severity, 'warn');
});

test('revenue-up: does NOT fire on a 20% lift (within noise band)', () => {
  const out = detectAnomalies(emptyInput({
    orderSummary: {
      totalOrders: 12, totalRevenue: 12000, avgOrderValue: 1000, currency: 'USD',
      prev: { totalOrders: 10, totalRevenue: 10000, avgOrderValue: 1000 },
    },
  }));
  assert.equal(out.find((x) => x.id === 'revenue-up'), undefined);
});

test('revenue-up: does NOT fire when revenue went down (sibling owns the other half)', () => {
  // Revenue-down detector covers the negative side; revenue-up shouldn't
  // fire on negative deltas even though the conditional structure is
  // mirrored.
  const out = detectAnomalies(emptyInput({
    orderSummary: {
      totalOrders: 7, totalRevenue: 7000, avgOrderValue: 1000, currency: 'USD',
      prev: { totalOrders: 10, totalRevenue: 10000, avgOrderValue: 1000 },
    },
  }));
  assert.equal(out.find((x) => x.id === 'revenue-up'), undefined);
});

/* --- AOV-shift detector --- */

test('aov-shift: fires when AOV up 20%', () => {
  // Revenue stayed flat but AOV moved — classic mix-shift toward premium.
  // Volume guard (cowork 20260521): bumped to ≥15 orders both windows.
  const out = detectAnomalies(emptyInput({
    orderSummary: {
      totalOrders: 15, totalRevenue: 18000, avgOrderValue: 1200, currency: 'USD',
      prev: { totalOrders: 15, totalRevenue: 15000, avgOrderValue: 1000 },
    },
  }));
  const a = out.find((x) => x.id === 'aov-shift');
  assert.ok(a);
  assert.match(a.headline, /up 20%/);
});

test('aov-shift: fires when AOV down 20% (discount-campaign signal)', () => {
  const out = detectAnomalies(emptyInput({
    orderSummary: {
      totalOrders: 15, totalRevenue: 12000, avgOrderValue: 800, currency: 'USD',
      prev: { totalOrders: 15, totalRevenue: 15000, avgOrderValue: 1000 },
    },
  }));
  const a = out.find((x) => x.id === 'aov-shift');
  assert.ok(a);
  assert.match(a.headline, /down 20%/);
});

test('aov-shift: does NOT fire on 10% AOV move (noise)', () => {
  const out = detectAnomalies(emptyInput({
    orderSummary: {
      totalOrders: 10, totalRevenue: 11000, avgOrderValue: 1100, currency: 'USD',
      prev: { totalOrders: 10, totalRevenue: 10000, avgOrderValue: 1000 },
    },
  }));
  assert.equal(out.find((x) => x.id === 'aov-shift'), undefined);
});

test('aov-shift: does NOT fire below the 15-order sample guard', () => {
  // Cowork 20260521 raised the floor from 5 → 15 orders. At AOV ~$2,400
  // (this merchant's level), a single $4,000 line item swings AOV +17%
  // on a 5-order denominator — past the 15% threshold but pure noise.
  // 10 orders both windows is below the new floor → detector silent.
  const out = detectAnomalies(emptyInput({
    orderSummary: {
      totalOrders: 10, totalRevenue: 12000, avgOrderValue: 1200, currency: 'USD',
      prev: { totalOrders: 10, totalRevenue: 10000, avgOrderValue: 1000 },
    },
  }));
  assert.equal(out.find((x) => x.id === 'aov-shift'), undefined);
});

/* --- New-customer-share-down detector --- */

test('new-customer-share-down: warn when share drops 20pp', () => {
  // 80% new → 60% new = -20pp share.
  const out = detectAnomalies(emptyInput({
    customerInsights: {
      totalCustomers: 10,
      newCustomers: 6,
      returningCustomers: 4,
      repeatRatePct: 40,
      prev: { totalCustomers: 10, newCustomers: 8, returningCustomers: 2 },
    },
  }));
  const a = out.find((x) => x.id === 'new-customer-share-down');
  assert.ok(a);
  assert.equal(a.severity, 'warn');
});

test('new-customer-share-down: critical when share drops 30pp', () => {
  const out = detectAnomalies(emptyInput({
    customerInsights: {
      totalCustomers: 10,
      newCustomers: 5,
      returningCustomers: 5,
      repeatRatePct: 50,
      prev: { totalCustomers: 10, newCustomers: 8, returningCustomers: 2 },
    },
  }));
  // 80 - 50 = 30pp drop
  const a = out.find((x) => x.id === 'new-customer-share-down');
  assert.equal(a.severity, 'critical');
});

test('new-customer-share-down: does NOT fire when share only dropped 10pp', () => {
  const out = detectAnomalies(emptyInput({
    customerInsights: {
      totalCustomers: 10,
      newCustomers: 7,
      returningCustomers: 3,
      repeatRatePct: 30,
      prev: { totalCustomers: 10, newCustomers: 8, returningCustomers: 2 },
    },
  }));
  assert.equal(out.find((x) => x.id === 'new-customer-share-down'), undefined);
});

test('new-customer-share-down: does NOT fire when prev is null', () => {
  const out = detectAnomalies(emptyInput({
    customerInsights: {
      totalCustomers: 10,
      newCustomers: 1,
      returningCustomers: 9,
      repeatRatePct: 90,
      prev: null,
    },
  }));
  assert.equal(out.find((x) => x.id === 'new-customer-share-down'), undefined);
});

test('new-customer-share-down: does NOT fire on tiny samples (< 5 customers)', () => {
  // 1/1 vs 1/1 — share went from 100% to 0%, but the sample is too
  // small to be a meaningful signal. Skip.
  const out = detectAnomalies(emptyInput({
    customerInsights: {
      totalCustomers: 1,
      newCustomers: 0,
      returningCustomers: 1,
      repeatRatePct: 100,
      prev: { totalCustomers: 1, newCustomers: 1, returningCustomers: 0 },
    },
  }));
  assert.equal(out.find((x) => x.id === 'new-customer-share-down'), undefined);
});

/* --- Composition: multiple anomalies fire together --- */

test('multiple detectors fire together in severity-arbitrary order', () => {
  // A bad-day scenario: revenue down (with the new ≥10 volume guard
  // satisfied), refund sample too small (<20), inventory oversold.
  const out = detectAnomalies(emptyInput({
    orderSummary: {
      totalOrders: 15, totalRevenue: 3000, currency: 'USD',
      prev: { totalOrders: 20, totalRevenue: 10000 },
    },
    refundHealth: { totalOrders: 15, refundRatePct: 0, cancellationRatePct: 0 },  // <20 orders → skip
    lowStock: [
      { productHandle: 'x', productTitle: 'X', variantTitle: 'Default Title', quantity: -1, productId: '1' },
    ],
  }));
  const ids = new Set(out.map((a) => a.id));
  // Revenue and oversold should fire; refund should NOT (sample under
  // the 20-order floor).
  assert.ok(ids.has('revenue-down'));
  assert.ok(ids.has('oversold-inventory'));
  assert.equal(ids.has('refund-rate-elevated'), false);
});
