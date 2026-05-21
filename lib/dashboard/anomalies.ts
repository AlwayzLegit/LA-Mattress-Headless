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
  /** Average order value in the current window. Used by the AOV-shift detector. */
  avgOrderValue: number;
  currency: string;
  /**
   * Previous-period totals. avgOrderValue carried alongside so the
   * AOV-shift detector can compare windows apples-to-apples.
   */
  prev: { totalOrders: number; totalRevenue: number; avgOrderValue: number } | null;
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
  /**
   * Previous-period customer split. Set when the dashboard fetched the
   * vs-previous data; null otherwise. Used by the new-customer-share-down
   * detector to compare windows.
   */
  prev: {
    totalCustomers: number;
    newCustomers: number;
    returningCustomers: number;
  } | null;
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
  /**
   * Raw cart-viewer counts in each window. Used by the cart-abandonment
   * detector to suppress callouts on tiny samples — a "50pp jump" on
   * 2 cart views vs 0 is mathematically true but statistically noise
   * (QA round 2 B2).
   */
  cartViewersNow: number | null;
  cartViewersPrev: number | null;
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
  //
  // QA round 2 B2: requires at least 5 cart viewers in the CURRENT
  // window. Without this, the detector would fire critical on 2 carts
  // viewed + 1 checkout started ("50pp jump from 0%") which is
  // mathematically true but statistically meaningless. Same pattern as
  // the refund-rate detector's totalOrders >= 5 guard.
  if (
    input.cartAbandonmentNow !== null &&
    input.cartAbandonmentPrev !== null &&
    (input.cartViewersNow ?? 0) >= 5
  ) {
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

  // 7. Revenue SPIKE up — the positive sibling of detector #1. Cuts
  // both ways: a 50% jump might mean a viral product, a big enterprise
  // order, or a data-pipeline bug double-counting. Worth surfacing as
  // info so the merchant can confirm before celebrating.
  //
  // Severity caps at warn (not critical) because a positive surprise
  // doesn't require the same urgency as a negative one. Tier:
  //   >= 50% spike → warn (probably a real signal worth confirming)
  //   >= 30% spike → info (could be normal variance; nudge to look)
  if (input.orderSummary?.prev && input.orderSummary.prev.totalRevenue > 0) {
    const cur = input.orderSummary.totalRevenue;
    const prev = input.orderSummary.prev.totalRevenue;
    const deltaPct = ((cur - prev) / prev) * 100;
    if (deltaPct >= 30) {
      out.push({
        id: 'revenue-up',
        severity: deltaPct >= 50 ? 'warn' : 'info',
        headline: `Revenue up ${deltaPct.toFixed(0)}% vs prior ${input.rangeLabel.toLowerCase()}`,
        detail: `${fmtUsd(cur)} this window vs ${fmtUsd(prev)} previous. Confirm channel / product mix before extrapolating.`,
        href: '#section-acquisition',
      });
    }
  }

  // 8. AOV shifted significantly.
  //
  // ±15% AOV move is the threshold — small enough to catch a real
  // signal (a discount campaign that's hurting margins, or a mix
  // shift toward premium products) but large enough to ignore normal
  // single-large-order skew. Sample-size guarded: skip when either
  // window has fewer than 5 orders.
  //
  // Reported relative (not pp) because AOV is a money value, not a rate.
  if (
    input.orderSummary?.prev &&
    input.orderSummary.prev.avgOrderValue > 0 &&
    input.orderSummary.totalOrders >= 5 &&
    input.orderSummary.prev.totalOrders >= 5
  ) {
    const cur = input.orderSummary.avgOrderValue;
    const prev = input.orderSummary.prev.avgOrderValue;
    const deltaPct = ((cur - prev) / prev) * 100;
    if (Math.abs(deltaPct) >= 15) {
      const direction = deltaPct > 0 ? 'up' : 'down';
      out.push({
        id: 'aov-shift',
        // Either direction is "warn" — a sudden drop signals discount
        // over-application; a sudden jump signals mix-shift you may
        // not have planned for. Both deserve a look.
        severity: 'warn',
        headline: `AOV ${direction} ${Math.abs(deltaPct).toFixed(0)}% vs prior ${input.rangeLabel.toLowerCase()}`,
        detail: `Now ${fmtUsd(cur)}, was ${fmtUsd(prev)}. Check Top products + Revenue by source for mix changes.`,
        href: '#section-revenue',
      });
    }
  }

  // 9. New-customer share collapsed.
  //
  // Acquisition health metric — if "new customers / total customers"
  // dropped sharply window-over-window, paid acquisition is probably
  // off (channel paused, budget capped, campaign turned off). Reported
  // in percentage points because shares are already a rate.
  //
  // Threshold: drop ≥ 15pp. Sample-size guard: skip when either
  // window has fewer than 5 customers (small samples make share %
  // unstable).
  if (input.customerInsights?.prev) {
    const cur = input.customerInsights;
    const prev = cur.prev!;
    const curTotal = cur.newCustomers + cur.returningCustomers;
    const prevTotal = prev.newCustomers + prev.returningCustomers;
    if (curTotal >= 5 && prevTotal >= 5) {
      const curShare = curTotal > 0 ? (cur.newCustomers / curTotal) * 100 : 0;
      const prevShare = prevTotal > 0 ? (prev.newCustomers / prevTotal) * 100 : 0;
      const ppDelta = curShare - prevShare;
      if (ppDelta <= -15) {
        out.push({
          id: 'new-customer-share-down',
          severity: ppDelta <= -25 ? 'critical' : 'warn',
          headline: `New-customer share down ${Math.abs(ppDelta).toFixed(0)}pp vs prior ${input.rangeLabel.toLowerCase()}`,
          detail: `Now ${curShare.toFixed(0)}% new, was ${prevShare.toFixed(0)}%. Paid acquisition may have stalled — check Traffic sources.`,
          href: '#section-acquisition',
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
