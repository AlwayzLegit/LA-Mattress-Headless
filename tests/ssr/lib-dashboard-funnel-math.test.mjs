/**
 * Unit tests for lib/dashboard/funnel-math.ts.
 *
 * These cover the same edge cases the dashboard relies on for the
 * vs-previous-period delta + cart-abandonment cards. Catches drift if
 * someone changes the math without thinking about the divide-by-zero
 * + null-coalesce semantics.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

const { funnelConversionRate, computeAbandonment } = await import(
  '../../lib/dashboard/funnel-math.ts'
);

/* --- funnelConversionRate ------------------------------------------------ */

test('funnelConversionRate: returns null when steps is undefined', () => {
  assert.equal(funnelConversionRate(undefined), null);
});

test('funnelConversionRate: returns null when steps is null', () => {
  assert.equal(funnelConversionRate(null), null);
});

test('funnelConversionRate: returns null with fewer than 2 steps', () => {
  assert.equal(funnelConversionRate([]), null);
  assert.equal(funnelConversionRate([{ persons: 100 }]), null);
});

test('funnelConversionRate: returns null when the first step is 0 (no traffic)', () => {
  // Important: not 0/0 = NaN; explicit null so the RateDelta component
  // hides the badge cleanly instead of rendering "NaN pp".
  assert.equal(
    funnelConversionRate([{ persons: 0 }, { persons: 0 }]),
    null,
  );
});

test('funnelConversionRate: computes last/first ratio', () => {
  // 6-step funnel matching the real PostHog funnel definition.
  const steps = [
    { persons: 1000 },  // plp_view
    { persons: 500 },   // pdp_view
    { persons: 250 },   // add_to_cart
    { persons: 200 },   // cart_view
    { persons: 100 },   // checkout_started
    { persons: 25 },    // order_completed
  ];
  // 25 / 1000 = 0.025 = 2.5% end-to-end
  assert.equal(funnelConversionRate(steps), 0.025);
});

test('funnelConversionRate: works for a 2-step funnel', () => {
  assert.equal(funnelConversionRate([{ persons: 200 }, { persons: 50 }]), 0.25);
});

/* --- computeAbandonment -------------------------------------------------- */

test('computeAbandonment: returns zeros when funnel events are missing', () => {
  // Empty input — defensive default rather than null/throw, so the
  // dashboard card renders "0.0%" rows instead of crashing.
  const a = computeAbandonment([]);
  assert.equal(a.cartViewers, 0);
  assert.equal(a.checkoutStarters, 0);
  assert.equal(a.orders, 0);
  assert.equal(a.cartAbandonment, 0);
  assert.equal(a.checkoutAbandonment, 0);
});

test('computeAbandonment: typical 10% cart drop, 60% checkout drop', () => {
  const a = computeAbandonment([
    { event: 'cart_view', persons: 100 },
    { event: 'checkout_started', persons: 90 },
    { event: 'order_completed', persons: 36 },
  ]);
  assert.equal(a.cartViewers, 100);
  assert.equal(a.checkoutStarters, 90);
  assert.equal(a.orders, 36);
  // 1 - 90/100 = 0.10
  assert.equal(a.cartAbandonment.toFixed(4), '0.1000');
  // 1 - 36/90 = 0.60
  assert.equal(a.checkoutAbandonment.toFixed(4), '0.6000');
});

test('computeAbandonment: zero cart viewers does not divide by zero', () => {
  // Edge case: cart_view = 0. The Map.get returns 0 (from the ??
  // fallback), so the if-guard in computeAbandonment keeps the result
  // at 0 instead of producing Infinity / NaN.
  const a = computeAbandonment([
    { event: 'cart_view', persons: 0 },
    { event: 'checkout_started', persons: 0 },
    { event: 'order_completed', persons: 0 },
  ]);
  assert.equal(a.cartAbandonment, 0);
  assert.equal(a.checkoutAbandonment, 0);
});

test('computeAbandonment: ignores extra/unknown events in the input', () => {
  // The funnel has 6 events but computeAbandonment only cares about
  // cart_view / checkout_started / order_completed. Extra events
  // should be silently ignored.
  const a = computeAbandonment([
    { event: 'plp_view', persons: 9999 },
    { event: 'cart_view', persons: 200 },
    { event: 'checkout_started', persons: 150 },
    { event: 'order_completed', persons: 100 },
    { event: 'unknown_event', persons: 1 },
  ]);
  assert.equal(a.cartViewers, 200);
  assert.equal(a.checkoutStarters, 150);
  assert.equal(a.orders, 100);
  // 1 - 150/200 = 0.25 cart drop
  assert.equal(a.cartAbandonment, 0.25);
});

test('computeAbandonment: 100% drop when nobody continues past cart', () => {
  const a = computeAbandonment([
    { event: 'cart_view', persons: 50 },
    { event: 'checkout_started', persons: 0 },
    { event: 'order_completed', persons: 0 },
  ]);
  assert.equal(a.cartAbandonment, 1);
  // No checkout starters → no abandonment metric meaningful, returns 0
  // (rather than NaN from 0/0).
  assert.equal(a.checkoutAbandonment, 0);
});
