/**
 * Pure helpers for the dashboard's Customer Lifetime Value (LTV) +
 * lifecycle distribution cards.
 *
 * Extracted from lib/shopify/admin.ts so the unit-test suite can
 * exercise the aggregation + bucketing without dragging in
 * `server-only` or the GraphQL fetcher.
 *
 * The data layer fetches a top-N sample of customers from Shopify
 * (sorted by lifetime spend), then this module:
 *   - bucketts the sample into ordersCount tiers (1, 2, 3, 4-9, 10+)
 *   - computes simple averages (mean LTV, median LTV)
 *   - picks the top 10 by lifetime spend for the leaderboard
 *
 * The "Top 250 sample" approach is biased toward big spenders by
 * construction, so the bucketing tells you the SHAPE of the top of
 * the curve rather than a population-wide distribution. Useful for
 * "which buyers drive most revenue" framing; not useful for
 * "what % of customers are one-time vs repeat" (the existing
 * getCustomerInsights window-scoped card answers that better).
 */

export type CustomerLifetimeRaw = {
  /** Numeric ID for admin.shopify.com deep-links. */
  id: string;
  displayName: string;
  email: string | null;
  ordersCount: number;
  amountSpent: number;
  currency: string;
};

export type LifecycleBucket = {
  /** Display label: "1 order", "2 orders", "3 orders", "4-9 orders", "10+ orders". */
  label: string;
  /** Lower bound of the bucket (inclusive). */
  minOrders: number;
  /** Upper bound (inclusive). Number.POSITIVE_INFINITY for the open-ended top tier. */
  maxOrders: number;
  customers: number;
  /** Sum of lifetime spend across customers in this bucket. */
  revenue: number;
};

export type CustomerLifetimeSummary = {
  sampleSize: number;
  /** Mean lifetime spend across the sample. */
  averageLtv: number;
  /** Median lifetime spend across the sample. */
  medianLtv: number;
  currency: string;
  topByLtv: CustomerLifetimeRaw[];
  buckets: LifecycleBucket[];
};

const BUCKET_DEFS: ReadonlyArray<Pick<LifecycleBucket, 'label' | 'minOrders' | 'maxOrders'>> = [
  { label: '1 order',     minOrders: 1,  maxOrders: 1 },
  { label: '2 orders',    minOrders: 2,  maxOrders: 2 },
  { label: '3 orders',    minOrders: 3,  maxOrders: 3 },
  { label: '4–9 orders',  minOrders: 4,  maxOrders: 9 },
  { label: '10+ orders',  minOrders: 10, maxOrders: Number.POSITIVE_INFINITY },
];

/**
 * Aggregate a raw customer sample into the LTV summary the dashboard
 * card consumes. Pure — input → output, no I/O, no dates, no globals.
 */
export function summarizeCustomerLifetime(
  customers: ReadonlyArray<CustomerLifetimeRaw>,
  topN = 10,
): CustomerLifetimeSummary {
  const sampleSize = customers.length;
  if (sampleSize === 0) {
    return {
      sampleSize: 0,
      averageLtv: 0,
      medianLtv: 0,
      currency: 'USD',
      topByLtv: [],
      buckets: BUCKET_DEFS.map((b) => ({ ...b, customers: 0, revenue: 0 })),
    };
  }

  const currency = customers[0]?.currency || 'USD';

  // Top by LTV — caller sorts the input typically, but we sort here
  // defensively so the function works regardless of input order.
  const topByLtv = [...customers]
    .sort((a, b) => b.amountSpent - a.amountSpent)
    .slice(0, topN);

  // Mean: simple arithmetic mean.
  const total = customers.reduce((s, c) => s + c.amountSpent, 0);
  const averageLtv = total / sampleSize;

  // Median: middle value (or average of two middle values for even-sized samples).
  const sorted = [...customers].map((c) => c.amountSpent).sort((a, b) => a - b);
  const medianLtv = sampleSize % 2 === 1
    ? sorted[(sampleSize - 1) / 2]
    : (sorted[sampleSize / 2 - 1] + sorted[sampleSize / 2]) / 2;

  // Bucket pass. Each customer lands in exactly one tier based on their
  // ordersCount. Customers with 0 orders (which shouldn't happen since
  // numberOfOrders is the lifetime count, not the in-window count, but
  // defensive) are silently excluded — they don't belong in any bucket.
  const buckets: LifecycleBucket[] = BUCKET_DEFS.map((b) => ({ ...b, customers: 0, revenue: 0 }));
  for (const c of customers) {
    const tier = buckets.find((b) => c.ordersCount >= b.minOrders && c.ordersCount <= b.maxOrders);
    if (tier) {
      tier.customers += 1;
      tier.revenue += c.amountSpent;
    }
  }

  return { sampleSize, averageLtv, medianLtv, currency, topByLtv, buckets };
}
