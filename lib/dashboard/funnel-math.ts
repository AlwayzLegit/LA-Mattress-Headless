/**
 * Pure funnel-math helpers used by /admin/dashboard.
 *
 * Extracted from app/admin/dashboard/page.tsx into a standalone file so
 * the unit-test suite can exercise them without rendering the page or
 * importing `server-only`. Zero dependencies on Next.js, Sentry, or any
 * data fetcher — every function is a pure transform.
 */

export type FunnelStepLike = { event: string; persons: number };

/**
 * Overall funnel conversion rate: last step's unique persons divided by
 * the first step's unique persons. Returns null when either end is
 * missing or when the first step is zero (would divide by zero).
 *
 * Used to render the funnel-card header's "X% end-to-end" callout and
 * the vs-previous-period delta. Same definition is reused for both
 * current + previous windows so the delta is apples-to-apples.
 */
export function funnelConversionRate(
  steps: ReadonlyArray<{ persons: number }> | undefined | null,
): number | null {
  if (!steps || steps.length < 2) return null;
  const first = steps[0].persons;
  const last = steps[steps.length - 1].persons;
  if (first === 0) return null;
  return last / first;
}

export type AbandonmentSummary = {
  cartViewers: number;
  checkoutStarters: number;
  orders: number;
  cartAbandonment: number;
  checkoutAbandonment: number;
};

/**
 * Cart + checkout abandonment derived from the conversion funnel.
 *
 *   cartAbandonment     = 1 - (checkout_started / cart_view)
 *   checkoutAbandonment = 1 - (order_completed   / checkout_started)
 *
 * Returns 0 for an abandonment metric when its denominator is 0 — the
 * dashboard renders "0.0%" in that case, which reads as "no traffic
 * at that step" rather than the misleading "perfect 100% drop".
 */
export function computeAbandonment(
  steps: ReadonlyArray<FunnelStepLike>,
): AbandonmentSummary {
  const byEvent = new Map(steps.map((s) => [s.event, s.persons]));
  const cartViewers = byEvent.get('cart_view') ?? 0;
  const checkoutStarters = byEvent.get('checkout_started') ?? 0;
  const orders = byEvent.get('order_completed') ?? 0;
  return {
    cartViewers,
    checkoutStarters,
    orders,
    cartAbandonment: cartViewers > 0 ? 1 - checkoutStarters / cartViewers : 0,
    checkoutAbandonment: checkoutStarters > 0 ? 1 - orders / checkoutStarters : 0,
  };
}
