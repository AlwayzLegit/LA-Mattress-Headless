/**
 * Anomaly detector for /admin/dashboard.
 *
 * Takes the data shapes the page already fetches and returns a list of
 * actionable callouts. Surfaced at the top of the dashboard above the
 * section nav, so a merchant scanning the page sees "refund rate spiked,
 * cart abandonment up 12pp, 3 variants oversold" before they scroll
 * past a wall of cards.
 *
 * Each detector is a small pure function that examines the data it
 * needs and pushes an Anomaly into the output array if it fires. No
 * thresholds are computed from rolling averages or seasonality — this
 * is intentionally crude. The point is "is this number unusual against
 * its own previous period or against a static safety threshold?", not
 * a full statistical anomaly detector. Crude beats absent.
 *
 * Inputs use module-local types (rather than importing from
 * lib/shopify/admin.ts or lib/posthog-dashboard.ts) so the unit test
 * suite can exercise this module without dragging in `server-only`,
 * Sentry, or the GraphQL fetchers.
 */

export type AnomalySeverity = 'critical' | 'warn' | 'info';

export type Anomaly = {
  /** Stable ID for dedupe / aria-labelling. */
  id: string;
  severity: AnomalySeverity;
  /** Short headline rendered as the card's strong text. */
  headline: string;
  /** Explanatory sentence rendered below the headline. */
  detail: string;
  /** Optional in-page anchor (e.g. '#section-revenue') or external URL. */
  href?: string;
};

/* --- Input shape adapters ----------------------------------------------- */

export type AnomalyOrderSummary = {
  totalOrders: number;
  totalRevenue: number;
  currency: string;
  prev: { totalOrders: number; totalRevenue: number } | null;
};

export type AnomalyRefundHealth = {
  totalOrders: number;
  refundRatePct: number;
  cancellationRatePct: number;
};

export type AnomalyCustomerInsights = {
  totalCustomers: number;
  newCustomers: number;
  returningCustomers: number;
  repeatRatePct: number;
};

export type AnomalyLowStockVariant = {
  productHandle: string;
  productTitle: string;
  variantTitle: string;
  quantity: number;
  productId: string;
};

export type AnomalySearchQuery = {
  query: string;
  searches: number;
  zeroResult: number;
  zeroPct: number;
};

export type AnomalyInput = {
  orderSummary: AnomalyOrderSummary | null;
  refundHealth: AnomalyRefundHealth | null;
  customerInsights: AnomalyCustomerInsights | null;
  lowStock: AnomalyLowStockVariant[] | null;
  searches: AnomalySearchQuery[] | null;
  /** Overall funnel rate (last step / first step) as a fraction. */
  funnelConvNow: number | null;
  funnelConvPrev: number | null;
  /** Cart→checkout abandonment as a fraction. */
  cartAbandonmentNow: number | null;
  cartAbandonmentPrev: number | null;
  /** Used in callout copy ("vs prior 30 days"). */
  rangeLabel: string;
};

/* --- Detector ----------------------------------------------------------- */

export function detectAnomalies(input: AnomalyInput): Anomaly[] {
  const out: Anomaly[] = [];

  // 1. Revenue down ≥25% vs previous window.
  //
  // Threshold tuned to avoid normal week-over-week noise (which can
  // swing ±15% even on a stable site) while catching real drops. Skip
  // when previous period has $0 — there's nothing to compare against.
  if (input.orderSummary?.prev && input.orderSummary.prev.totalRevenue > 0) {
    const cur = input.orderSummary.totalRevenue;
    const prev = input.orderSummary.prev.totalRevenue;
    const deltaPct = ((cur - prev) / prev) * 100;
    if (deltaPct <= -25) {
      out.push({
        id: 'revenue-down',
        severity: deltaPct <= -50 ? 'critical' : 'warn',
        headline: `Revenue down ${Math.abs(deltaPct).toFixed(0)}% vs prior ${input.rangeLabel.toLowerCase()}`,
        detail: `${fmtUsd(cur)} this window vs ${fmtUsd(prev)} previous. Investigate top channels in Acquisition.`,
        href: '#section-acquisition',
      });
    }
  }

  // 2. Refund rate elevated.
  //
  // Two tiers: > 10% = critical (process / quality / fraud issue),
  // > 5% = warn (worth a look). Anything under 5% is normal noise for
  // a mattress business with delivery returns.
  if (input.refundHealth && input.refundHealth.totalOrders >= 5) {
    const r = input.refundHealth.refundRatePct;
    if (r > 10) {
      out.push({
        id: 'refund-rate-high',
        severity: 'critical',
        headline: `Refund rate at ${r.toFixed(1)}%`,
        detail: `Above the 10% threshold. Check Refunds & cancels for cancel-reason breakdown.`,
        href: '#section-revenue',
      });
    } else if (r > 5) {
      out.push({
        id: 'refund-rate-elevated',
        severity: 'warn',
        headline: `Refund rate at ${r.toFixed(1)}%`,
        detail: `Above the 5% baseline. Check the Refunds card for the cancel-reason mix.`,
        href: '#section-revenue',
      });
    }
  }

  // 3. Cart abandonment jumped vs previous window.
  //
  // Reported in percentage points (pp) — a 10pp jump (e.g. 60% → 70%)
  // is meaningfully worse than a 10% relative jump. Catches "we shipped
  // a checkout regression yesterday and conversion fell off a cliff".
  if (input.cartAbandonmentNow !== null && input.cartAbandonmentPrev !== null) {
    const ppDelta = (input.cartAbandonmentNow - input.cartAbandonmentPrev) * 100;
    if (ppDelta >= 10) {
      out.push({
        id: 'cart-abandonment-up',
        severity: ppDelta >= 20 ? 'critical' : 'warn',
        headline: `Cart abandonment up ${ppDelta.toFixed(1)}pp vs prior ${input.rangeLabel.toLowerCase()}`,
        detail: `Now ${(input.cartAbandonmentNow * 100).toFixed(1)}%, was ${(input.cartAbandonmentPrev * 100).toFixed(1)}%. Sanity-check the cart + checkout pages.`,
        href: '#section-funnel',
      });
    }
  }

  // 4. End-to-end conversion dropped ≥1 pp.
  //
  // 1 pp is a big move on the absolute conversion rate (storefront
  // rates are typically 1–3%, so 1pp is doubling or halving). Only
  // fires when both windows have measurable conversion.
  if (input.funnelConvNow !== null && input.funnelConvPrev !== null && input.funnelConvPrev > 0) {
    const ppDelta = (input.funnelConvNow - input.funnelConvPrev) * 100;
    if (ppDelta <= -1) {
      out.push({
        id: 'conversion-down',
        severity: ppDelta <= -2 ? 'critical' : 'warn',
        headline: `Conversion down ${Math.abs(ppDelta).toFixed(2)}pp vs prior ${input.rangeLabel.toLowerCase()}`,
        detail: `End-to-end is now ${(input.funnelConvNow * 100).toFixed(2)}%, was ${(input.funnelConvPrev * 100).toFixed(2)}%. Drill into the funnel for the leakiest step.`,
        href: '#section-funnel',
      });
    }
  }

  // 5. Oversold inventory — any variant with quantity <= 0 on the
  // low-stock list is shipping promises we can't keep. Always critical.
  if (input.lowStock && input.lowStock.length > 0) {
    const oversold = input.lowStock.filter((v) => v.quantity <= 0);
    if (oversold.length > 0) {
      const example = oversold[0];
      const detail = oversold.length === 1
        ? `${example.productTitle} (${example.variantTitle === 'Default Title' ? 'default variant' : example.variantTitle}) at ${example.quantity} on hand.`
        : `${oversold.length} variants below zero, starting with ${example.productTitle}.`;
      out.push({
        id: 'oversold-inventory',
        severity: 'critical',
        headline: oversold.length === 1 ? `1 variant oversold` : `${oversold.length} variants oversold`,
        detail,
        href: '#section-catalog',
      });
    }
  }

  // 6. Zero-result searches dominate. > 25% of searches returning
  // nothing means the catalog has visible gaps — usually a brand or
  // size shoppers expect that the storefront can't surface.
  if (input.searches && input.searches.length >= 3) {
    const totalSearches = input.searches.reduce((s, q) => s + q.searches, 0);
    const totalZero = input.searches.reduce((s, q) => s + q.zeroResult, 0);
    if (totalSearches >= 20) {
      const zeroPct = (totalZero / totalSearches) * 100;
      if (zeroPct >= 25) {
        // Surface the top zero-result query as the concrete example.
        const topZero = [...input.searches]
          .filter((q) => q.zeroResult > 0)
          .sort((a, b) => b.zeroResult - a.zeroResult)[0];
        out.push({
          id: 'zero-result-searches-high',
          severity: 'warn',
          headline: `${zeroPct.toFixed(0)}% of searches return no results`,
          detail: topZero
            ? `Top empty query: "${topZero.query}" (${topZero.zeroResult} searches). Consider adding matching products or a redirect.`
            : `Consider expanding the catalog or adding redirects for common terms.`,
          href: '#section-catalog',
        });
      }
    }
  }

  return out;
}

function fmtUsd(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount);
}
