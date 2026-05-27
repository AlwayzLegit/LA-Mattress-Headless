import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  ADMIN_CONFIGURED,
  getBlogSeoGaps,
  getCatalogHealth,
  getCustomerInsights,
  getCustomerLifetime,
  getLowStock,
  getOrderClassification,
  getOrderSummaryWithTrends,
  getRefundHealth,
  getRepeatBuyerGap,
  getSeoGaps,
  getTopProducts,
  numericIdFromGid,
  type DashboardDailyPoint,
  type DashboardHourPoint,
} from '@/lib/shopify/admin';
import {
  POSTHOG_CONFIGURED,
  postHogConfig,
} from '@/lib/posthog-query';
import {
  getConversionFunnel,
  getConversionFunnelPrev,
  getDeviceBreakdown,
  getQuizFunnel,
  getQuizFunnelPrev,
  getQuizStepDropoff,
  getRevenueBySource,
  getSearchConversion,
  getShowroomTraffic,
  getWebVitals,
  getTopConvertingArticles,
  getTopEntryPages,
  getTopSearches,
  getTopTrafficSources,
} from '@/lib/posthog-dashboard';
import { computeAbandonment, funnelConversionRate } from '@/lib/dashboard/funnel-math';
import { detectAnomalies } from '@/lib/dashboard/anomalies';
import { formatRateDelta, formatRelativeDelta } from '@/lib/dashboard/delta';
import { parseDateRange, parseCompareFlag, rangeToSearchParams, DATE_RANGE_PRESETS, type DateRange } from '@/lib/dashboard/date-range';
import { SHOWROOMS } from '@/lib/showrooms';
// DateRangePicker + RefreshButton now imported by
// app/admin/_components/admin-toolbar.tsx, which the shared
// admin layout renders sticky at the top of every section.

// Shopify Admin product editor URL — built from the store domain so
// the deep-link routes to the right store. Falls back to the generic
// admin.shopify.com home if the env var isn't set (dev / preview).
const SHOPIFY_ADMIN_BASE = process.env.SHOPIFY_STORE_DOMAIN
  ? `https://admin.shopify.com/store/${process.env.SHOPIFY_STORE_DOMAIN.replace(/\.myshopify\.com$/, '')}`
  : 'https://admin.shopify.com';

/**
 * Internal admin dashboard at /admin.
 *
 * Aggregates first-party metrics from Shopify Admin (orders, revenue,
 * catalog health, SEO gaps) PLUS live PostHog data (conversion funnel,
 * top entry pages with bounce %, top searches with zero-result rate,
 * top traffic sources, quiz funnel, revenue by acquisition source).
 *
 * Auth: HTTP Basic Auth at the edge (see middleware.ts) gated on
 * ADMIN_USER + ADMIN_PASSWORD env vars. When either is unset,
 * /admin/* returns 503. Defense-in-depth: noindex via metadata,
 * X-Robots-Tag noindex on every response (middleware), and
 * `/admin/` disallow in robots.txt.
 */

export const metadata: Metadata = {
  title: 'Dashboard — LA Mattress Internal',
  robots: { index: false, follow: false, nocache: true, noimageindex: true },
};

// Fully dynamic — the dashboard's date-range picker drives every
// fetcher and the page must re-render per request to honour the
// active window. The prior `revalidate = 300` caused stale data to
// leak across range changes (Vercel edge can cache the route by URL
// without distinguishing search params), which manifested as "the
// time filter doesn't work" reports. Combined with the cache: 'no-store'
// on adminGql / hogQL the dashboard is now always fresh.
export const dynamic = 'force-dynamic';

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const range = parseDateRange(params);
  const compare = parseCompareFlag(params);
  const { days, label: rangeLabel } = range;
  // Short label rendered in card headers ("7d" / "30d" / "MTD" / "Custom").
  const rangeShort =
    range.isPreset && range.preset
      ? DATE_RANGE_PRESETS.find((p) => p.key === range.preset)?.short ?? range.label
      : 'Custom';
  // Pre-built query string for any deep-link that needs to round-trip
  // the active range (e.g. /admin/orders/[id]?{range query}).
  const rangeQuery = rangeToSearchParams(range, { compare }).toString();
  const justRefreshed = params.refreshed === '1';

  // Canonicalize the URL to a tight allow-list so bookmarked links
  // strip noisy UTM / share-tracker params. The previous version
  // accepted only `range`; now `from`/`to`/`compare` are valid too.
  const ALLOWED_PARAMS = new Set(['range', 'from', 'to', 'compare', 'refreshed']);
  const canonical = rangeToSearchParams(range, { compare });
  if (justRefreshed) canonical.set('refreshed', '1');
  const hasUnknown = Object.keys(params).some((k) => !ALLOWED_PARAMS.has(k));
  // Detect range params that parsed to a different canonical (e.g. a
  // misspelled preset that fell back to the default) and 302 the user
  // to the cleaned URL.
  const requestedRange = typeof params.range === 'string' ? params.range : null;
  const requestedFrom = typeof params.from === 'string' ? params.from : null;
  const requestedTo = typeof params.to === 'string' ? params.to : null;
  const isClamped =
    (requestedRange !== null && range.isPreset && range.preset !== requestedRange) ||
    (requestedFrom !== null && requestedTo !== null && range.isPreset);
  if (hasUnknown || isClamped) {
    const qs = canonical.toString();
    redirect(qs ? `/admin?${qs}` : '/admin');
  }

  if (!ADMIN_CONFIGURED) {
    return (
      <main className="container" style={{ paddingTop: 'var(--s-8)', paddingBottom: 'var(--s-9)' }}>
        <h1 className="h2">Dashboard</h1>
        <p className="muted">
          <code>SHOPIFY_ADMIN_TOKEN</code> + <code>SHOPIFY_STORE_DOMAIN</code> must be set on this
          environment to load metrics.
        </p>
      </main>
    );
  }

  // PostHog deep-link now lives in the shared admin toolbar
  // (app/admin/_components/admin-toolbar.tsx), which builds the link
  // from NEXT_PUBLIC_POSTHOG_PROJECT_URL so it's available to client
  // components too. The toolbar shows the link as a constant external
  // tool nav next to the refresh button.

  // Fan out all queries in parallel — each ~200-500ms; serial would
  // push the page over a second. Phase 300: orderSummary now carries
  // its previous-period totals + a daily series, and the two funnels
  // each fire a parallel "prev" query so the dashboard can render
  // vs-previous deltas.
  //
  // Entry-pages window stays at 7 days (the table is most useful when
  // fresh) — the global range picker only drives metrics where a
  // longer/shorter window is meaningfully different.
  const [
    orderSummary,
    catalog,
    topProducts,
    seoGaps,
    blogSeoGaps,
    lowStock,
    customerInsights,
    customerLifetime,
    repeatBuyerGap,
    orderClassification,
    refundHealth,
    funnel,
    funnelPrev,
    entryPages,
    searches,
    searchConversion,
    sources,
    quizFunnel,
    quizFunnelPrev,
    quizStepDropoff,
    revenueBySource,
    deviceBreakdown,
    showroomTraffic,
    convertingArticles,
    webVitals,
  ] = await Promise.all([
    getOrderSummaryWithTrends(days).catch(() => null),
    getCatalogHealth().catch(() => null),
    getTopProducts(days).catch(() => null),
    getSeoGaps().catch(() => null),
    getBlogSeoGaps(250).catch(() => null),
    getLowStock(3).catch(() => null),
    getCustomerInsights(days).catch(() => null),
    getCustomerLifetime(250).catch(() => null),
    getRepeatBuyerGap(250).catch(() => null),
    getOrderClassification(days).catch(() => null),
    getRefundHealth(days).catch(() => null),
    POSTHOG_CONFIGURED ? getConversionFunnel(days).catch(() => null) : Promise.resolve(null),
    POSTHOG_CONFIGURED ? getConversionFunnelPrev(days).catch(() => null) : Promise.resolve(null),
    POSTHOG_CONFIGURED ? getTopEntryPages(7, 10).catch(() => null) : Promise.resolve(null),
    POSTHOG_CONFIGURED ? getTopSearches(days, 15).catch(() => null) : Promise.resolve(null),
    POSTHOG_CONFIGURED ? getSearchConversion(days, 10).catch(() => null) : Promise.resolve(null),
    POSTHOG_CONFIGURED ? getTopTrafficSources(days, 10).catch(() => null) : Promise.resolve(null),
    POSTHOG_CONFIGURED ? getQuizFunnel(days).catch(() => null) : Promise.resolve(null),
    POSTHOG_CONFIGURED ? getQuizFunnelPrev(days).catch(() => null) : Promise.resolve(null),
    POSTHOG_CONFIGURED ? getQuizStepDropoff(days).catch(() => null) : Promise.resolve(null),
    POSTHOG_CONFIGURED ? getRevenueBySource(days, 8).catch(() => null) : Promise.resolve(null),
    POSTHOG_CONFIGURED ? getDeviceBreakdown(days).catch(() => null) : Promise.resolve(null),
    POSTHOG_CONFIGURED
      ? getShowroomTraffic(days, SHOWROOMS.map((s) => ({ handle: s.handle, name: s.name }))).catch(() => null)
      : Promise.resolve(null),
    POSTHOG_CONFIGURED ? getTopConvertingArticles(days, 10).catch(() => null) : Promise.resolve(null),
    POSTHOG_CONFIGURED ? getWebVitals(days).catch(() => null) : Promise.resolve(null),
  ]);

  // Cart + checkout abandonment derived from the conversion funnel.
  // No additional query — these are framings of the same data the
  // funnel card already has. Useful to call out because shoppers
  // typically know cart abandonment is the leakiest part of the
  // funnel, and a dedicated card with the right framing surfaces it
  // more clearly than a row inside the funnel visualization.
  const abandonment = funnel ? computeAbandonment(funnel.steps) : null;
  const abandonmentPrev = funnelPrev ? computeAbandonment(funnelPrev.steps) : null;

  // Funnel conversion rate (overall: last step / first step) for the
  // current and previous windows. Used to render a vs-previous delta
  // badge in the funnel-card header.
  const funnelConvNow = funnelConversionRate(funnel?.steps);
  const funnelConvPrev = funnelConversionRate(funnelPrev?.steps);
  const quizCompletionNow = quizFunnel && quizFunnel.started > 0 ? quizFunnel.completed / quizFunnel.started : null;
  const quizCompletionPrev = quizFunnelPrev && quizFunnelPrev.started > 0 ? quizFunnelPrev.completed / quizFunnelPrev.started : null;

  // Anomaly detection runs over the already-fetched data — no additional
  // queries. Returns an actionable list (revenue spikes, refund-rate
  // climbs, oversold inventory, conversion drops, etc.) rendered as a
  // callout strip at the top of the page so the merchant sees "things
  // worth looking at" before they have to scan 18 cards.
  const anomalies = detectAnomalies({
    orderSummary,
    refundHealth,
    customerInsights,
    lowStock,
    searches,
    funnelConvNow,
    funnelConvPrev,
    cartAbandonmentNow: abandonment?.cartAbandonment ?? null,
    cartAbandonmentPrev: abandonmentPrev?.cartAbandonment ?? null,
    cartViewersNow: abandonment?.cartViewers ?? null,
    cartViewersPrev: abandonmentPrev?.cartViewers ?? null,
    rangeLabel,
  });

  const renderedAt = new Date();

  return (
    <main className="dashboard dashboard-in-shell">
      <header className="dashboard-head">
        <div>
          <div className="eyebrow">Internal</div>
          <h1 className="h2" style={{ margin: 0 }}>LA Mattress dashboard</h1>
          <p className="muted" style={{ marginTop: 4, fontSize: 13 }}>
            Rendered {renderedAt.toLocaleString()} · {rangeLabel}
            {justRefreshed ? <span className="dash-refreshed-pill"> · just refreshed</span> : null}
            {!POSTHOG_CONFIGURED ? ' · PostHog widgets disabled (env vars missing)' : null}
          </p>
        </div>
        {/* DateRangePicker + RefreshButton + external-tool links now
            live in app/admin/_components/admin-toolbar.tsx, rendered by
            the shared admin layout sticky at the top of every section.
            phProjectUrl + SHOPIFY_ADMIN_BASE are still computed below
            for the layout's link hrefs via NEXT_PUBLIC_* env vars. */}
      </header>

      {/* QA 2026-05-22: count Shopify-Admin-backed cards whose fetch
          returned null. When the count crosses the threshold (3+) it's
          almost always a token / scope incident, not 9 unrelated
          failures — surface a single actionable banner instead of
          letting the merchant infer it from 9 "data unavailable"
          fallbacks scattered across the page. The threshold of 3 is
          generous on purpose (1-2 nulls can be transient; 3+ is a
          pattern). */}
      {(() => {
        const adminQueries = [
          orderSummary, catalog, topProducts, seoGaps, blogSeoGaps, lowStock,
          customerInsights, customerLifetime, orderClassification, repeatBuyerGap,
          refundHealth,
        ];
        const failedCount = adminQueries.filter((q) => q === null).length;
        if (failedCount < 3) return null;
        return (
          <div role="alert" className="dash-incident-banner">
            <div>
              <strong>Shopify Admin connection degraded.</strong>
              {' '}
              {failedCount} of {adminQueries.length} admin queries returned no data.
              Most likely a token rotation or scope change.
            </div>
            <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
              Check <code>SHOPIFY_ADMIN_TOKEN</code> in Vercel env vars; confirm
              <code>read_orders / read_customers / read_products / read_collections / read_inventory</code>
              {' '}scopes are granted in Shopify Partners → app → API access.
              {' '}<a
                href="https://jetnine.sentry.io/issues/?project=la-mattress-headless&query=is%3Aunresolved+admin.ts"
                target="_blank"
                rel="noopener noreferrer"
              >Recent admin errors in Sentry →</a>
            </div>
          </div>
        );
      })()}

      {/* Anomaly callouts — only render the strip when something fires.
          Otherwise the dashboard reads "all clear" by absence, which is
          the right default (the section nav becomes the first thing
          below the header). */}
      {anomalies.length > 0 ? <AnomalyStrip anomalies={anomalies} /> : null}

      {/* In-page section nav was replaced by the persistent left-rail
          sidebar (app/admin/_components/sidebar.tsx, rendered by the
          shared admin layout). Each sidebar link points to the same
          `#section-X` anchors the in-page nav used, so the
          scroll-margin-top CSS that keeps headings below sticky
          headers still applies. */}

      {/* SECTION: Revenue & orders --- */}
      <section id="section-revenue" className="dash-section">
        <h2 className="dash-section-hd">Revenue &amp; orders</h2>
        <div className="dash-grid">
          {/* Revenue + orders (KPIs + chart + recent orders) */}
          <div className="dash-card dash-card-wide">
            <div className="dash-card-hd">
              <h2 className="h3" style={{ margin: 0 }}>{rangeLabel}</h2>
              <span className="muted" style={{ fontSize: 12 }}>Shopify Admin</span>
            </div>
            {orderSummary ? (
              <>
                <div className="dash-stat-row">
                  <div className="dash-stat">
                    <div className="dash-stat-label">Orders</div>
                    <div className="dash-stat-value">{orderSummary.totalOrders}</div>
                    <DeltaBadge current={orderSummary.totalOrders} prev={orderSummary.prev?.totalOrders} />
                    <Sparkline points={orderSummary.daily} field="orders" />
                  </div>
                  <div className="dash-stat">
                    <div className="dash-stat-label">Revenue</div>
                    <div className="dash-stat-value">{fmtMoney(orderSummary.totalRevenue, orderSummary.currency)}</div>
                    <DeltaBadge current={orderSummary.totalRevenue} prev={orderSummary.prev?.totalRevenue} />
                    <Sparkline points={orderSummary.daily} field="revenue" />
                  </div>
                  <div className="dash-stat">
                    <div className="dash-stat-label">Avg order</div>
                    <div className="dash-stat-value">{fmtMoney(orderSummary.avgOrderValue, orderSummary.currency)}</div>
                    <DeltaBadge current={orderSummary.avgOrderValue} prev={orderSummary.prev?.avgOrderValue} />
                  </div>
                </div>
                {orderSummary.daily.length >= 2 ? (
                  <>
                    <h3 className="eyebrow" style={{ marginTop: 'var(--s-5)' }}>Revenue trend</h3>
                    <RevenueLineChart points={orderSummary.daily} currency={orderSummary.currency} />
                  </>
                ) : null}
                <h3 className="eyebrow" style={{ marginTop: 'var(--s-5)' }}>Recent orders</h3>
                <table className="dash-table">
                  <thead>
                    <tr>
                      <th>Order</th>
                      <th>Customer</th>
                      <th>Total</th>
                      <th>Fulfillment</th>
                      <th>When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orderSummary.recentOrders.length === 0 ? (
                      <tr><td colSpan={5} className="muted">No orders in this window.</td></tr>
                    ) : (
                      orderSummary.recentOrders.map((o) => (
                        <tr key={o.id}>
                          <td>
                            <strong>
                              <Link
                                href={`/admin/orders/${numericIdFromGid(o.id)}${rangeQuery ? `?${rangeQuery}` : ''}`}
                                prefetch={false}
                              >
                                {o.name}
                              </Link>
                            </strong>
                          </td>
                          <td>{o.customer ?? '—'}</td>
                          <td className="tnum">{fmtMoney(o.total, o.currency)}</td>
                          <td>{o.fulfillmentStatus ?? '—'}</td>
                          <td className="muted" style={{ fontSize: 12 }}>{relativeTime(o.createdAt)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </>
            ) : (
              <p className="muted">Order data unavailable. Check Vercel function logs.</p>
            )}
          </div>

          {/* Top products */}
          <div className="dash-card dash-card-wide">
            <div className="dash-card-hd">
              <h2 className="h3" style={{ margin: 0 }}>Top products · {rangeLabel.toLowerCase()}</h2>
              <span className="muted" style={{ fontSize: 12 }}>by units sold · Shopify</span>
            </div>
            {topProducts ? (
              topProducts.topByQuantity.length === 0 ? (
                <p className="muted">No sales recorded in this window.</p>
              ) : (
                <table className="dash-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Units</th>
                      <th>Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topProducts.topByQuantity.map((p) => (
                      <tr key={p.productId}>
                        <td>
                          <Link href={`/products/${p.productHandle}`} prefetch={false}>
                            {p.productTitle}
                          </Link>
                        </td>
                        <td className="tnum">{p.quantity}</td>
                        <td className="tnum">{fmtMoney(p.revenue, p.currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            ) : (
              <p className="muted">Top-products data unavailable.</p>
            )}
          </div>

          {/* Day-of-week order heatmap */}
          <div className="dash-card">
            <div className="dash-card-hd">
              <h2 className="h3" style={{ margin: 0 }}>Orders by weekday · {rangeShort}</h2>
              <span className="muted" style={{ fontSize: 12 }}>Shopify · order count</span>
            </div>
            {orderSummary && orderSummary.daily.length >= 7 ? (
              <DayOfWeekHeatmap points={orderSummary.daily} />
            ) : (
              <p className="muted">Need at least 7 days of order data.</p>
            )}
          </div>

          {/* Hour-of-day order heatmap */}
          <div className="dash-card">
            <div className="dash-card-hd">
              <h2 className="h3" style={{ margin: 0 }}>Orders by hour · {rangeShort}</h2>
              <span className="muted" style={{ fontSize: 12 }}>Shopify · Pacific · order count</span>
            </div>
            {orderSummary ? (
              <HourOfDayHeatmap points={orderSummary.hourly} />
            ) : (
              <p className="muted">Order data unavailable.</p>
            )}
          </div>

          {/* Refund + cancellation health */}
          <div className="dash-card">
            <div className="dash-card-hd">
              <h2 className="h3" style={{ margin: 0 }}>Refunds &amp; cancels · {rangeShort}</h2>
              <span className="muted" style={{ fontSize: 12 }}>Shopify · share of orders</span>
            </div>
            {refundHealth ? (
              refundHealth.totalOrders === 0 ? (
                <p className="muted">No orders in this window.</p>
              ) : (
                <>
                  <ul className="dash-list">
                    <li className={refundHealth.refundRatePct > 5 ? 'dash-warn' : ''}>
                      <span>Refund rate</span>
                      <strong>
                        {refundHealth.refundRatePct.toFixed(1)}%
                        <span className="muted" style={{ fontWeight: 400, marginLeft: 6 }}>
                          ({refundHealth.refundedOrders + refundHealth.partiallyRefundedOrders} of {refundHealth.totalOrders})
                        </span>
                      </strong>
                    </li>
                    <li>
                      <span>· full refunds</span>
                      <strong>{refundHealth.refundedOrders}</strong>
                    </li>
                    <li>
                      <span>· partial refunds</span>
                      <strong>{refundHealth.partiallyRefundedOrders}</strong>
                    </li>
                    <li className={refundHealth.cancellationRatePct > 3 ? 'dash-warn' : ''}>
                      <span>Cancellation rate</span>
                      <strong>
                        {refundHealth.cancellationRatePct.toFixed(1)}%
                        <span className="muted" style={{ fontWeight: 400, marginLeft: 6 }}>
                          ({refundHealth.cancelledOrders} of {refundHealth.totalOrders})
                        </span>
                      </strong>
                    </li>
                    <li>
                      <span>Refunded $</span>
                      <strong>{fmtMoney(refundHealth.refundedRevenue, refundHealth.currency)}</strong>
                    </li>
                  </ul>
                  {refundHealth.cancelReasonBuckets.length > 0 ? (
                    <>
                      <h3 className="eyebrow" style={{ marginTop: 'var(--s-4)' }}>Cancel reasons</h3>
                      <ul className="dash-list-compact">
                        {refundHealth.cancelReasonBuckets.map((b) => (
                          <li key={b.reason}>
                            <span>{b.reason.toLowerCase()}</span>
                            <span className="muted">{' · '}<strong style={{ fontVariantNumeric: 'tabular-nums' }}>{b.count}</strong></span>
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : null}
                </>
              )
            ) : (
              <p className="muted">Refund data unavailable.</p>
            )}
          </div>
        </div>
      </section>

      {/* SECTION: Customers --- */}
      <section id="section-customers" className="dash-section">
        <h2 className="dash-section-hd">Customers</h2>
        <div className="dash-grid">
          {/* Customer insights */}
          <div className="dash-card">
            <div className="dash-card-hd">
              <h2 className="h3" style={{ margin: 0 }}>Customers · {rangeShort}</h2>
              <span className="muted" style={{ fontSize: 12 }}>Shopify · new vs repeat</span>
            </div>
            {customerInsights ? (
              customerInsights.totalCustomers === 0 ? (
                <p className="muted">No customer orders in this window.</p>
              ) : (
                <>
                  <ul className="dash-list">
                    <li>
                      <span>Unique customers</span>
                      <strong>{customerInsights.totalCustomers}</strong>
                    </li>
                    <li>
                      <span>New customers</span>
                      <strong>
                        {customerInsights.newCustomers}
                        <span className="muted" style={{ fontWeight: 400, marginLeft: 6 }}>
                          ({pct(customerInsights.newCustomers, customerInsights.newCustomers + customerInsights.returningCustomers)})
                        </span>
                      </strong>
                    </li>
                    <li>
                      <span>Returning customers</span>
                      <strong>
                        {customerInsights.returningCustomers}
                        <span className="muted" style={{ fontWeight: 400, marginLeft: 6 }}>
                          ({pct(customerInsights.returningCustomers, customerInsights.newCustomers + customerInsights.returningCustomers)})
                        </span>
                      </strong>
                    </li>
                    <li className={customerInsights.repeatRatePct < 5 ? '' : 'dash-warn'}>
                      <span>Repeat in window</span>
                      <strong>
                        {customerInsights.repeatInWindow}
                        <span className="muted" style={{ fontWeight: 400, marginLeft: 6 }}>
                          ({customerInsights.repeatRatePct.toFixed(1)}%)
                        </span>
                      </strong>
                    </li>
                  </ul>
                  {customerInsights.topRepeaters.length > 0 ? (
                    <>
                      <h3 className="eyebrow" style={{ marginTop: 'var(--s-4)' }}>Top repeat buyers (in window)</h3>
                      <ul className="dash-list-compact">
                        {customerInsights.topRepeaters.map((c) => (
                          <li key={c.customerId}>
                            <a
                              href={`${SHOPIFY_ADMIN_BASE}/customers/${c.customerId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {c.displayName}
                            </a>
                            <span className="muted">
                              {' · '}
                              <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{c.ordersInWindow}</strong>{' orders · '}
                              <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtMoney(c.revenueInWindow, c.currency)}</strong>
                            </span>
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : null}
                </>
              )
            ) : (
              <p className="muted">Customer data unavailable.</p>
            )}
          </div>

          {/* Customer LTV — top spenders all-time */}
          <div className="dash-card">
            <div className="dash-card-hd">
              <h2 className="h3" style={{ margin: 0 }}>Customer LTV</h2>
              <span className="muted" style={{ fontSize: 12 }}>
                Shopify · top {customerLifetime?.sampleSize ?? 250} by lifetime spend
              </span>
            </div>
            {customerLifetime && customerLifetime.sampleSize > 0 ? (
              <>
                <ul className="dash-list">
                  <li>
                    <span>Mean LTV</span>
                    <strong>{fmtMoney(customerLifetime.averageLtv, customerLifetime.currency)}</strong>
                  </li>
                  <li>
                    <span>Median LTV</span>
                    <strong>{fmtMoney(customerLifetime.medianLtv, customerLifetime.currency)}</strong>
                  </li>
                </ul>
                {customerLifetime.topByLtv.length > 0 ? (
                  <>
                    <h3 className="eyebrow" style={{ marginTop: 'var(--s-4)' }}>Top lifetime spenders</h3>
                    <ul className="dash-list-compact">
                      {customerLifetime.topByLtv.map((c) => (
                        <li key={c.id}>
                          <a
                            href={`${SHOPIFY_ADMIN_BASE}/customers/${c.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {c.displayName}
                          </a>
                          <span className="muted">
                            {' · '}
                            <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{c.ordersCount}</strong>{' orders · '}
                            <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtMoney(c.amountSpent, c.currency)}</strong>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : null}
              </>
            ) : (
              <p className="muted">No customer LTV data available.</p>
            )}
          </div>

          {/* Customer lifecycle distribution */}
          <div className="dash-card">
            <div className="dash-card-hd">
              <h2 className="h3" style={{ margin: 0 }}>Lifecycle distribution</h2>
              <span className="muted" style={{ fontSize: 12 }}>
                Shopify · top {customerLifetime?.sampleSize ?? 250} · skewed toward big spenders
              </span>
            </div>
            {customerLifetime && customerLifetime.sampleSize > 0 ? (
              <table className="dash-table">
                <thead>
                  <tr>
                    <th>Lifetime orders</th>
                    <th>Customers</th>
                    <th>Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {customerLifetime.buckets.map((b) => (
                    <tr key={b.label}>
                      <td>{b.label}</td>
                      <td className="tnum">
                        {b.customers}
                        {customerLifetime.sampleSize > 0 ? (
                          <span className="muted" style={{ fontWeight: 400, marginLeft: 4 }}>
                            ({((b.customers / customerLifetime.sampleSize) * 100).toFixed(0)}%)
                          </span>
                        ) : null}
                      </td>
                      <td className="tnum">{fmtMoney(b.revenue, customerLifetime.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="muted">No lifecycle data available.</p>
            )}
          </div>

          {/* Order classification — new vs repeat for the current window.
              Different lens than Lifecycle distribution (which is a sample
              of top spenders all-time): this is per-order, current-window,
              answering "are we acquiring or servicing this period?" */}
          <div className="dash-card dash-card-wide">
            <div className="dash-card-hd">
              <h2 className="h3" style={{ margin: 0 }}>New vs repeat buyers · {rangeShort}</h2>
              <span className="muted" style={{ fontSize: 12 }}>
                Shopify · orders bucketed by customer lifetime-order count
              </span>
            </div>
            {orderClassification && orderClassification.totalOrders > 0 ? (
              <table className="dash-table">
                <thead>
                  <tr>
                    <th>Tier</th>
                    <th>Orders</th>
                    <th>Share</th>
                    <th>Revenue</th>
                    <th>AOV</th>
                  </tr>
                </thead>
                <tbody>
                  {(
                    [
                      ['First order (new customer)', orderClassification.first],
                      ['Second order (first repeat)', orderClassification.second],
                      ['Loyal (3+ lifetime orders)', orderClassification.loyal],
                      ['Guest checkout (no account)', orderClassification.guest],
                    ] as const
                  ).map(([label, tier]) => (
                    <tr key={label}>
                      <td>{label}</td>
                      <td className="tnum">{tier.count}</td>
                      <td className="tnum">
                        {pct(tier.count, orderClassification.totalOrders)}
                      </td>
                      <td className="tnum">
                        {fmtMoney(tier.revenue, orderClassification.currency)}
                      </td>
                      <td className="tnum">
                        {tier.count > 0 ? fmtMoney(tier.avgOrderValue, orderClassification.currency) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td><strong>Total</strong></td>
                    <td className="tnum"><strong>{orderClassification.totalOrders}</strong></td>
                    <td className="tnum">—</td>
                    <td className="tnum">
                      <strong>{fmtMoney(orderClassification.totalRevenue, orderClassification.currency)}</strong>
                    </td>
                    <td className="tnum">
                      <strong>
                        {orderClassification.totalOrders > 0
                          ? fmtMoney(
                              orderClassification.totalRevenue / orderClassification.totalOrders,
                              orderClassification.currency,
                            )
                          : '—'}
                      </strong>
                    </td>
                  </tr>
                </tfoot>
              </table>
            ) : (
              <p className="muted">No orders in this window.</p>
            )}
          </div>

          {/* Repeat-buyer gap — for mattress retail where the primary
              product has a 7-10y replacement cycle, "true" cohort
              retention is near-zero. The actionable signal is HOW
              repeat buyers come back: same-day add-ons, planned
              follow-ups, or replacement cycle. Each bucket tells a
              different merchandising story. */}
          <div className="dash-card dash-card-wide">
            <div className="dash-card-hd">
              <h2 className="h3" style={{ margin: 0 }}>Repeat-buyer gap distribution</h2>
              <span className="muted" style={{ fontSize: 12 }}>
                Shopify · 250 most-recent customers with ≥ 2 orders
              </span>
            </div>
            {repeatBuyerGap && repeatBuyerGap.repeatCustomers > 0 ? (
              <>
                <ul className="dash-list">
                  <li>
                    <span>Sampled repeat customers</span>
                    <strong>{repeatBuyerGap.repeatCustomers}</strong>
                  </li>
                  <li>
                    <span>Median gap (days)</span>
                    <strong>{repeatBuyerGap.medianGapDays.toFixed(0)}</strong>
                  </li>
                  <li>
                    <span>25th / 75th percentile</span>
                    <strong>
                      {repeatBuyerGap.p25GapDays.toFixed(0)} / {repeatBuyerGap.p75GapDays.toFixed(0)} days
                    </strong>
                  </li>
                </ul>
                <table className="dash-table" style={{ marginTop: 'var(--s-4)' }}>
                  <thead>
                    <tr>
                      <th>Gap from first order</th>
                      <th>Customers</th>
                      <th>Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {repeatBuyerGap.buckets.map((b) => (
                      <tr key={b.label}>
                        <td>{b.label}</td>
                        <td className="tnum">{b.customers}</td>
                        <td className="tnum">
                          {pct(b.customers, repeatBuyerGap.repeatCustomers)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="muted" style={{ fontSize: 12, marginTop: 'var(--s-3)' }}>
                  Gap uses customer-record creation date as the proxy for first-order date
                  (accurate within hours for storefront-acquired customers). Shopify Admin
                  restricts `Customer.orders` historical access without the `read_all_orders`
                  scope; this is the documented workaround.
                </p>
              </>
            ) : (
              <p className="muted">No repeat-buyer data available yet.</p>
            )}
          </div>
        </div>
      </section>

      {/* SECTION: Funnel & conversion --- */}
      <section id="section-funnel" className="dash-section">
        <h2 className="dash-section-hd">Funnel &amp; conversion</h2>
        <div className="dash-grid">
          {/* Conversion funnel — LIVE */}
          <div className="dash-card dash-card-wide">
            <div className="dash-card-hd">
              <h2 className="h3" style={{ margin: 0 }}>Conversion funnel · {rangeLabel.toLowerCase()}</h2>
              <span className="muted" style={{ fontSize: 12 }}>
                PostHog · unique persons
                {funnelConvNow !== null ? (
                  <>
                    {' · '}
                    <strong style={{ color: 'var(--text-1)' }}>{(funnelConvNow * 100).toFixed(2)}%</strong>
                    {' end-to-end '}
                    <RateDelta current={funnelConvNow} prev={funnelConvPrev} />
                  </>
                ) : null}
              </span>
            </div>
            {funnel ? (
              <FunnelViz steps={funnel.steps} />
            ) : POSTHOG_CONFIGURED ? (
              <p className="muted">Funnel data unavailable. Check Sentry for the failing PostHog query.</p>
            ) : (
              <PostHogConfigHint />
            )}
          </div>

          {/* Cart + checkout abandonment */}
          <div className="dash-card">
            <div className="dash-card-hd">
              <h2 className="h3" style={{ margin: 0 }}>Cart abandonment · {rangeShort}</h2>
              <span className="muted" style={{ fontSize: 12 }}>PostHog · derived from funnel</span>
            </div>
            {abandonment ? (
              <ul className="dash-list">
                <li className={abandonment.cartAbandonment > 0.7 ? 'dash-warn' : ''}>
                  <span>Cart → checkout drop</span>
                  <strong>
                    {(abandonment.cartAbandonment * 100).toFixed(1)}%
                    <RateDelta current={abandonment.cartAbandonment} prev={abandonmentPrev?.cartAbandonment ?? null} />
                  </strong>
                </li>
                <li className={abandonment.checkoutAbandonment > 0.5 ? 'dash-warn' : ''}>
                  <span>Checkout → order drop</span>
                  <strong>
                    {(abandonment.checkoutAbandonment * 100).toFixed(1)}%
                    <RateDelta current={abandonment.checkoutAbandonment} prev={abandonmentPrev?.checkoutAbandonment ?? null} />
                  </strong>
                </li>
                <li>
                  <span>Cart viewers</span>
                  <strong>{abandonment.cartViewers.toLocaleString()}</strong>
                </li>
                <li>
                  <span>Checkout starters</span>
                  <strong>{abandonment.checkoutStarters.toLocaleString()}</strong>
                </li>
                <li>
                  <span>Orders</span>
                  <strong>{abandonment.orders.toLocaleString()}</strong>
                </li>
              </ul>
            ) : POSTHOG_CONFIGURED ? (
              <p className="muted">No funnel data yet.</p>
            ) : (
              <PostHogConfigHint />
            )}
          </div>

          {/* Quiz funnel */}
          <div className="dash-card">
            <div className="dash-card-hd">
              <h2 className="h3" style={{ margin: 0 }}>Quiz funnel · {rangeShort}</h2>
              <span className="muted" style={{ fontSize: 12 }}>
                PostHog
                {quizCompletionNow !== null ? (
                  <>{' · completion '}<RateDelta current={quizCompletionNow} prev={quizCompletionPrev} /></>
                ) : null}
              </span>
            </div>
            {quizFunnel ? (
              <ul className="dash-list">
                <li>
                  <span>Started</span>
                  <strong>{quizFunnel.started}</strong>
                </li>
                <li>
                  <span>Completed</span>
                  <strong>
                    {quizFunnel.completed}
                    {quizFunnel.started > 0 ? (
                      <span className="muted" style={{ fontWeight: 400, marginLeft: 6 }}>
                        ({pct(quizFunnel.completed, quizFunnel.started)})
                      </span>
                    ) : null}
                  </strong>
                </li>
                <li>
                  <span>Clicked recommendation</span>
                  <strong>
                    {quizFunnel.clicked}
                    {quizFunnel.completed > 0 ? (
                      <span className="muted" style={{ fontWeight: 400, marginLeft: 6 }}>
                        ({pct(quizFunnel.clicked, quizFunnel.completed)})
                      </span>
                    ) : null}
                  </strong>
                </li>
              </ul>
            ) : POSTHOG_CONFIGURED ? (
              <p className="muted">No quiz data yet — events ship in PostHog Phase 1.</p>
            ) : (
              <PostHogConfigHint />
            )}
          </div>

          {/* Quiz step drop-off — per-question participation. Answers
              the "which question is the bail-out point" question that
              the 3-row Quiz funnel above can't. */}
          <div className="dash-card dash-card-wide">
            <div className="dash-card-hd">
              <h2 className="h3" style={{ margin: 0 }}>Quiz step drop-off · {rangeShort}</h2>
              <span className="muted" style={{ fontSize: 12 }}>
                PostHog · unique persons per quiz_step event
              </span>
            </div>
            {quizStepDropoff && quizStepDropoff.steps.length > 0 ? (
              <>
                <table className="dash-table">
                  <thead>
                    <tr>
                      <th>Step</th>
                      <th>Question</th>
                      <th>Reached</th>
                      <th>Drop from prior</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quizStepDropoff.steps.map((s) => (
                      <tr
                        key={`${s.step}-${s.questionId}`}
                        className={s.dropoffFromPrev > 0.25 ? 'dash-warn' : ''}
                      >
                        <td className="tnum">{s.step}</td>
                        <td><code style={{ fontSize: 13 }}>{s.questionId || '(unknown)'}</code></td>
                        <td className="tnum">{s.persons}</td>
                        <td className="tnum">
                          {s.dropoffFromPrev > 0
                            ? `−${(s.dropoffFromPrev * 100).toFixed(1)}%`
                            : '—'}
                        </td>
                      </tr>
                    ))}
                    <tr>
                      <td colSpan={2}><strong>quiz_completed</strong></td>
                      <td className="tnum"><strong>{quizStepDropoff.completedPersons}</strong></td>
                      <td className="tnum">
                        {quizStepDropoff.steps.length > 0 && quizStepDropoff.steps[quizStepDropoff.steps.length - 1].persons > 0
                          ? `−${Math.max(0, (1 - quizStepDropoff.completedPersons / quizStepDropoff.steps[quizStepDropoff.steps.length - 1].persons) * 100).toFixed(1)}%`
                          : '—'}
                      </td>
                    </tr>
                  </tbody>
                </table>
                <p className="muted" style={{ fontSize: 12, marginTop: 'var(--s-3)' }}>
                  Steps with &gt; 25% drop are flagged. Drop-off &gt; 30% on any single step
                  is typically a sign of an unclear or too-personal question.
                </p>
              </>
            ) : POSTHOG_CONFIGURED ? (
              <p className="muted">No per-step data yet.</p>
            ) : (
              <PostHogConfigHint />
            )}
          </div>

          {/* Sessions by device — QA found the Conv% column was 0%
              across the board because server-fired order_completed
              webhooks lack $session_id and $device_type, so the orders
              numerator was always zero. Dropped the broken column and
              renamed; share-of-traffic % takes its place. */}
          <div className="dash-card">
            <div className="dash-card-hd">
              <h2 className="h3" style={{ margin: 0 }}>Sessions by device · {rangeShort}</h2>
              <span className="muted" style={{ fontSize: 12 }}>PostHog · share of sessions</span>
            </div>
            {deviceBreakdown ? (
              deviceBreakdown.length === 0 ? (
                <p className="muted">No session data yet.</p>
              ) : (
                <DeviceTable rows={deviceBreakdown} />
              )
            ) : POSTHOG_CONFIGURED ? (
              <p className="muted">Device data unavailable.</p>
            ) : (
              <PostHogConfigHint />
            )}
          </div>
        </div>
      </section>

      {/* SECTION: Acquisition --- */}
      <section id="section-acquisition" className="dash-section">
        <h2 className="dash-section-hd">Acquisition</h2>
        <div className="dash-grid">
          {/* Top traffic sources — with donut chart */}
          <div className="dash-card">
            <div className="dash-card-hd">
              <h2 className="h3" style={{ margin: 0 }}>Traffic sources · {rangeShort}</h2>
              <span className="muted" style={{ fontSize: 12 }}>PostHog</span>
            </div>
            {sources ? (
              sources.length === 0 ? (
                <p className="muted">No traffic data yet.</p>
              ) : (
                <div className="dash-donut-row">
                  <SourceDonut slices={sources.slice(0, 6).map((s) => ({ label: s.source, value: s.visitors }))} />
                  <table className="dash-table dash-table-tight">
                    <thead>
                      <tr>
                        <th>Source</th>
                        <th>Visitors</th>
                        <th>Sessions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sources.map((s, i) => (
                        <tr key={s.source}>
                          <td>
                            <span
                              className="dash-donut-swatch"
                              style={{ background: donutColor(i) }}
                              aria-hidden="true"
                            />
                            {s.source}
                          </td>
                          <td className="tnum">{s.visitors}</td>
                          <td className="tnum">{s.sessions}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            ) : POSTHOG_CONFIGURED ? (
              <p className="muted">Traffic-source data unavailable.</p>
            ) : (
              <PostHogConfigHint />
            )}
          </div>

          {/* Revenue + AOV by source */}
          <div className="dash-card">
            <div className="dash-card-hd">
              <h2 className="h3" style={{ margin: 0 }}>Revenue by source · {rangeShort}</h2>
              <span className="muted" style={{ fontSize: 12 }}>PostHog · initial UTM</span>
            </div>
            {revenueBySource ? (
              revenueBySource.length === 0 ? (
                <p className="muted">No order events tracked yet — webhook fires order_completed.</p>
              ) : (
                <table className="dash-table">
                  <thead>
                    <tr>
                      <th>Source</th>
                      <th>Orders</th>
                      <th>Revenue</th>
                      <th>AOV</th>
                    </tr>
                  </thead>
                  <tbody>
                    {revenueBySource.map((r) => {
                      const aov = r.orders > 0 ? r.revenue / r.orders : 0;
                      return (
                        <tr key={r.source}>
                          <td>{r.source}</td>
                          <td className="tnum">{r.orders}</td>
                          <td className="tnum">{fmtMoney(r.revenue, 'USD')}</td>
                          <td className="tnum">{r.orders > 0 ? fmtMoney(aov, 'USD') : '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )
            ) : POSTHOG_CONFIGURED ? (
              <p className="muted">Revenue-by-source unavailable.</p>
            ) : (
              <PostHogConfigHint />
            )}
          </div>

          {/* Top entry pages */}
          <div className="dash-card dash-card-wide">
            <div className="dash-card-hd">
              <h2 className="h3" style={{ margin: 0 }}>Top entry pages · 7d</h2>
              <span className="muted" style={{ fontSize: 12 }}>PostHog · with bounce %</span>
            </div>
            {entryPages ? (
              entryPages.length === 0 ? (
                <p className="muted">No session data yet.</p>
              ) : (
                <table className="dash-table">
                  <thead>
                    <tr>
                      <th>Path</th>
                      <th>Sessions</th>
                      <th>Bounces</th>
                      <th>Bounce %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entryPages.map((p) => (
                      <tr key={p.path}>
                        <td>
                          <Link href={p.path} prefetch={false} target="_blank" rel="noopener noreferrer">
                            {p.path}
                          </Link>
                        </td>
                        <td className="tnum">{p.sessions}</td>
                        <td className="tnum">{p.bounces}</td>
                        <td className={`tnum ${p.bouncePct > 70 ? 'dash-warn' : ''}`}>{p.bouncePct.toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            ) : POSTHOG_CONFIGURED ? (
              <p className="muted">Entry-page data unavailable.</p>
            ) : (
              <PostHogConfigHint />
            )}
          </div>

          {/* Showroom traffic — pageviews per LA location */}
          <div className="dash-card">
            <div className="dash-card-hd">
              <h2 className="h3" style={{ margin: 0 }}>Showroom traffic · {rangeShort}</h2>
              <span className="muted" style={{ fontSize: 12 }}>PostHog · pageviews per LA location</span>
            </div>
            {showroomTraffic ? (
              <ShowroomTrafficTable rows={showroomTraffic} />
            ) : POSTHOG_CONFIGURED ? (
              <p className="muted">Showroom traffic unavailable.</p>
            ) : (
              <PostHogConfigHint />
            )}
          </div>

          {/* Top-converting blog articles — content-to-revenue attribution */}
          <div className="dash-card dash-card-wide">
            <div className="dash-card-hd">
              <h2 className="h3" style={{ margin: 0 }}>Top-converting articles · {rangeShort}</h2>
              <span className="muted" style={{ fontSize: 12 }}>PostHog · same-session attribution</span>
            </div>
            {convertingArticles ? (
              convertingArticles.length === 0 ? (
                <p className="muted">No blog sessions with ≥5 visits in this window.</p>
              ) : (
                <table className="dash-table">
                  <thead>
                    <tr>
                      <th>Article</th>
                      <th>Sessions</th>
                      <th>Orders</th>
                      <th>Conversion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {convertingArticles.map((a) => (
                      <tr key={a.path}>
                        <td>
                          <Link href={a.path} prefetch={false} target="_blank" rel="noopener noreferrer">
                            {a.path.replace('/blogs/', '').replace('/', ' / ')}
                          </Link>
                        </td>
                        <td className="tnum">{a.sessions.toLocaleString()}</td>
                        <td className="tnum">{a.orders}</td>
                        <td className="tnum">{a.conversionPct.toFixed(2)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            ) : POSTHOG_CONFIGURED ? (
              <p className="muted">Article attribution unavailable.</p>
            ) : (
              <PostHogConfigHint />
            )}
          </div>
        </div>
      </section>

      {/* SECTION: Catalog & search --- */}
      <section id="section-catalog" className="dash-section">
        <h2 className="dash-section-hd">Catalog &amp; search</h2>
        <div className="dash-grid">
          {/* Catalog health */}
          <div className="dash-card">
            <div className="dash-card-hd">
              <h2 className="h3" style={{ margin: 0 }}>Catalog health</h2>
              <span className="muted" style={{ fontSize: 12 }}>Shopify</span>
            </div>
            {catalog ? (
              <ul className="dash-list">
                <li>
                  <span>Total products</span>
                  <strong>{catalog.totalProducts}</strong>
                </li>
                <li>
                  <span>On storefront</span>
                  <strong>{catalog.publishedProducts}</strong>
                </li>
                <li className={catalog.totalProducts - catalog.publishedProducts - catalog.draftProducts > 0 ? 'dash-warn' : ''}>
                  <span>
                    Active but hidden
                    {catalog.totalProducts - catalog.publishedProducts - catalog.draftProducts > 0 ? (
                      <>
                        {' '}
                        <a
                          href={`${SHOPIFY_ADMIN_BASE}/products?selectedView=all&status=active&published_status=unpublished`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ fontSize: 11 }}
                        >
                          (review →)
                        </a>
                      </>
                    ) : null}
                  </span>
                  <strong>{Math.max(catalog.totalProducts - catalog.publishedProducts - catalog.draftProducts, 0)}</strong>
                </li>
                <li className={catalog.draftProducts > 0 ? 'dash-warn' : ''}>
                  <span>Drafts</span>
                  <strong>{catalog.draftProducts}</strong>
                </li>
                <li>
                  <span>Collections</span>
                  <strong>{catalog.totalCollections}</strong>
                </li>
                <li>
                  <span>· with intro_short</span>
                  <strong>{catalog.collectionsWithIntroShort} / {catalog.totalCollections}</strong>
                </li>
                <li>
                  <span>· with seo_content</span>
                  <strong>{catalog.collectionsWithSeoContent} / {catalog.totalCollections}</strong>
                </li>
                <li>
                  <span>· with descriptionHtml</span>
                  <strong>{catalog.collectionsWithDescriptionHtml} / {catalog.totalCollections}</strong>
                </li>
              </ul>
            ) : (
              <p className="muted">Catalog data unavailable.</p>
            )}
          </div>

          {/* Low-stock alerts */}
          <div className="dash-card">
            <div className="dash-card-hd">
              <h2 className="h3" style={{ margin: 0 }}>Low stock alerts</h2>
              <span className="muted" style={{ fontSize: 12 }}>Shopify · ≤3 on hand</span>
            </div>
            {lowStock ? (
              lowStock.length === 0 ? (
                <p className="muted">No variants below threshold.</p>
              ) : (
                <ul className="dash-list-compact">
                  {lowStock.map((v) => (
                    <li key={v.productId + v.variantTitle} className={v.quantity <= 0 ? 'dash-warn' : ''}>
                      <a
                        href={`${SHOPIFY_ADMIN_BASE}/products/${v.productId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {v.productTitle}
                      </a>
                      {v.variantTitle && v.variantTitle !== 'Default Title' ? (
                        <span className="muted"> · {v.variantTitle}</span>
                      ) : null}
                      <span className="muted">
                        {' · '}
                        {v.sku ? <code style={{ fontSize: 11 }}>{v.sku}</code> : '(no SKU)'}
                        {' · '}
                        <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{v.quantity}</strong> on hand
                      </span>
                    </li>
                  ))}
                </ul>
              )
            ) : (
              <p className="muted">Inventory data unavailable.</p>
            )}
          </div>

          {/* Top searches */}
          <div className="dash-card">
            <div className="dash-card-hd">
              <h2 className="h3" style={{ margin: 0 }}>Top searches · {rangeShort}</h2>
              <span className="muted" style={{ fontSize: 12 }}>PostHog</span>
            </div>
            {searches ? (
              searches.length === 0 ? (
                <p className="muted">No search data yet — event ships in PostHog Phase 1.</p>
              ) : (
                <table className="dash-table">
                  <thead>
                    <tr>
                      <th>Query</th>
                      <th>Count</th>
                      <th>Zero-result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {searches.map((s) => (
                      <tr key={s.query}>
                        <td>
                          <Link href={`/search?q=${encodeURIComponent(s.query)}`} prefetch={false} target="_blank" rel="noopener noreferrer">
                            {s.query}
                          </Link>
                        </td>
                        <td className="tnum">{s.searches}</td>
                        <td className={`tnum ${s.zeroPct > 25 ? 'dash-warn' : ''}`}>
                          {s.zeroResult > 0 ? `${s.zeroResult} (${s.zeroPct.toFixed(0)}%)` : '0'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            ) : POSTHOG_CONFIGURED ? (
              <p className="muted">Search data unavailable.</p>
            ) : (
              <PostHogConfigHint />
            )}
          </div>

          {/* Search-query conversion — Top searches above answers "what
              are people searching for"; this answers "which of those
              searches DRIVE PURCHASES". Different question, different
              merchandising action (boost a converter; fix a non-
              converter; expand inventory for high-volume zero-result). */}
          <div className="dash-card">
            <div className="dash-card-hd">
              <h2 className="h3" style={{ margin: 0 }}>Search → purchase · {rangeShort}</h2>
              <span className="muted" style={{ fontSize: 12 }}>
                PostHog · per-session first search query (≥ 5 sessions)
              </span>
            </div>
            {searchConversion ? (
              searchConversion.length === 0 ? (
                <p className="muted">No qualifying search-to-purchase data yet (queries need ≥ 5 sessions).</p>
              ) : (
                <table className="dash-table">
                  <thead>
                    <tr>
                      <th>Query</th>
                      <th>Sessions</th>
                      <th>Orders</th>
                      <th>Conv %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {searchConversion.map((s) => (
                      <tr key={s.query}>
                        <td>
                          <Link
                            href={`/search?q=${encodeURIComponent(s.query)}`}
                            prefetch={false}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {s.query}
                          </Link>
                        </td>
                        <td className="tnum">{s.sessions}</td>
                        <td className="tnum">{s.orders}</td>
                        <td className={`tnum ${s.conversionPct >= 5 ? '' : ''}`}>
                          {s.conversionPct.toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            ) : POSTHOG_CONFIGURED ? (
              <p className="muted">Search-conversion data unavailable.</p>
            ) : (
              <PostHogConfigHint />
            )}
          </div>

          {/* SEO gaps */}
          <div className="dash-card">
            <div className="dash-card-hd">
              <h2 className="h3" style={{ margin: 0 }}>SEO gaps</h2>
              <span className="muted" style={{ fontSize: 12 }}>sample of 100 active products</span>
            </div>
            {seoGaps ? (
              <>
                <ul className="dash-list">
                  <li className={seoGaps.productsMissingSeoTitle > 5 ? 'dash-warn' : ''}>
                    <span>Missing seo.title</span>
                    <strong>{seoGaps.productsMissingSeoTitle}</strong>
                  </li>
                  <li className={seoGaps.productsMissingSeoDescription > 5 ? 'dash-warn' : ''}>
                    <span>Missing seo.description</span>
                    <strong>{seoGaps.productsMissingSeoDescription}</strong>
                  </li>
                  <li className={seoGaps.productsMissingSku > 5 ? 'dash-warn' : ''}>
                    <span>Missing SKU</span>
                    <strong>{seoGaps.productsMissingSku}</strong>
                  </li>
                  <li className={seoGaps.productsMissingImage > 0 ? 'dash-warn' : ''}>
                    <span>Missing featured image</span>
                    <strong>{seoGaps.productsMissingImage}</strong>
                  </li>
                </ul>
                {seoGaps.sampleProducts.length > 0 ? (
                  <>
                    <h3 className="eyebrow" style={{ marginTop: 'var(--s-4)' }}>Examples</h3>
                    <ul className="dash-list-compact">
                      {seoGaps.sampleProducts.map((p) => (
                        <li key={p.handle}>
                          <Link href={`/products/${p.handle}`} prefetch={false}>{p.title}</Link>
                          <span className="muted"> · gap: {p.gap} · </span>
                          <a
                            href={`${SHOPIFY_ADMIN_BASE}/products/${p.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ fontSize: 12 }}
                          >
                            fix in Shopify →
                          </a>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : null}
              </>
            ) : (
              <p className="muted">SEO-gap data unavailable.</p>
            )}
          </div>

          {/* Blog SEO gaps — article-level coverage. Each gap maps to a
              SEMrush flag we can fix in the JSON-LD layer but the merchant
              should also fix in source content (Shopify Admin article
              editor) so the page+schema agree end-to-end. */}
          <div className="dash-card dash-card-wide">
            <div className="dash-card-hd">
              <h2 className="h3" style={{ margin: 0 }}>Blog SEO health</h2>
              <span className="muted" style={{ fontSize: 12 }}>
                Shopify · {blogSeoGaps?.sampleSize ?? 250} most-recent published articles
              </span>
            </div>
            {blogSeoGaps && blogSeoGaps.sampleSize > 0 ? (
              <>
                <ul className="dash-list">
                  <li className={blogSeoGaps.articlesThinContent > blogSeoGaps.sampleSize * 0.1 ? 'dash-warn' : ''}>
                    <span>Thin content (&lt; 250 words)</span>
                    <strong>
                      {blogSeoGaps.articlesThinContent}
                      <span className="muted" style={{ fontWeight: 400, marginLeft: 4 }}>
                        ({pct(blogSeoGaps.articlesThinContent, blogSeoGaps.sampleSize)})
                      </span>
                    </strong>
                  </li>
                  <li className={blogSeoGaps.articlesMissingImage > blogSeoGaps.sampleSize * 0.2 ? 'dash-warn' : ''}>
                    <span>Missing featured image</span>
                    <strong>
                      {blogSeoGaps.articlesMissingImage}
                      <span className="muted" style={{ fontWeight: 400, marginLeft: 4 }}>
                        ({pct(blogSeoGaps.articlesMissingImage, blogSeoGaps.sampleSize)})
                      </span>
                    </strong>
                  </li>
                  <li className={blogSeoGaps.articlesMissingAuthor > blogSeoGaps.sampleSize * 0.2 ? 'dash-warn' : ''}>
                    <span>Missing author</span>
                    <strong>
                      {blogSeoGaps.articlesMissingAuthor}
                      <span className="muted" style={{ fontWeight: 400, marginLeft: 4 }}>
                        ({pct(blogSeoGaps.articlesMissingAuthor, blogSeoGaps.sampleSize)})
                      </span>
                    </strong>
                  </li>
                  <li>
                    <span>Missing seo.title</span>
                    <strong>
                      {blogSeoGaps.articlesMissingSeoTitle}
                      <span className="muted" style={{ fontWeight: 400, marginLeft: 4 }}>
                        ({pct(blogSeoGaps.articlesMissingSeoTitle, blogSeoGaps.sampleSize)})
                      </span>
                    </strong>
                  </li>
                  <li>
                    <span>Missing seo.description</span>
                    <strong>
                      {blogSeoGaps.articlesMissingSeoDescription}
                      <span className="muted" style={{ fontWeight: 400, marginLeft: 4 }}>
                        ({pct(blogSeoGaps.articlesMissingSeoDescription, blogSeoGaps.sampleSize)})
                      </span>
                    </strong>
                  </li>
                </ul>
                {blogSeoGaps.sampleArticles.length > 0 ? (
                  <>
                    <h3 className="eyebrow" style={{ marginTop: 'var(--s-4)' }}>Examples</h3>
                    <ul className="dash-list-compact">
                      {blogSeoGaps.sampleArticles.map((a) => (
                        <li key={a.id}>
                          <Link
                            href={`/blogs/${a.blogHandle}/${a.handle}`}
                            prefetch={false}
                          >
                            {a.title}
                          </Link>
                          <span className="muted"> · gap: {a.gap} · </span>
                          <a
                            href={`${SHOPIFY_ADMIN_BASE}/articles/${a.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ fontSize: 12 }}
                          >
                            fix in Shopify →
                          </a>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : null}
              </>
            ) : (
              <p className="muted">Blog SEO data unavailable.</p>
            )}
          </div>
        </div>
      </section>

      {/* SECTION: System health --- */}
      <section id="section-health" className="dash-section">
        <h2 className="dash-section-hd">System health</h2>
        <div className="dash-grid">
          {/* Errors */}
          <div className="dash-card">
            <div className="dash-card-hd">
              <h2 className="h3" style={{ margin: 0 }}>Errors</h2>
              <span className="muted" style={{ fontSize: 12 }}>Sentry</span>
            </div>
            <p className="muted" style={{ marginTop: 0 }}>
              Sentry hosts the issue list. The 5 noise issues (browser-extension + Google App webview)
              are ignored after PR #196. Real production errors will surface here going forward.
            </p>
            <a
              className="btn btn-ghost"
              href="https://jetnine.sentry.io/issues/?project=la-mattress-headless&query=is%3Aunresolved"
              target="_blank"
              rel="noopener noreferrer"
              style={{ marginTop: 'var(--s-3)' }}
            >
              Open in Sentry →
            </a>
          </div>

          {/* Core Web Vitals — Google's CWV report shape (good /
              needs-improvement / poor counts per metric), backed by
              client-side useReportWebVitals → PostHog. The Vercel
              Speed Insights link below is kept for the per-route
              drill-down view Vercel ships out of the box. */}
          <div className="dash-card dash-card-wide">
            <div className="dash-card-hd">
              <h2 className="h3" style={{ margin: 0 }}>Core Web Vitals · {rangeShort}</h2>
              <span className="muted" style={{ fontSize: 12 }}>
                PostHog · field data via web-vitals → useReportWebVitals
              </span>
            </div>
            {webVitals && webVitals.length > 0 ? (
              <>
                <table className="dash-table">
                  <thead>
                    <tr>
                      <th>Metric</th>
                      <th>Samples</th>
                      <th>Good</th>
                      <th>Needs improvement</th>
                      <th>Poor</th>
                      <th>Good %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {webVitals.map((v) => (
                      <tr
                        key={v.metric}
                        className={v.goodShare < 0.75 ? 'dash-warn' : ''}
                      >
                        <td><strong>{v.metric}</strong></td>
                        <td className="tnum">{v.total}</td>
                        <td className="tnum">{v.good}</td>
                        <td className="tnum">{v.needsImprovement}</td>
                        <td className="tnum">{v.poor}</td>
                        <td className="tnum">
                          {(v.goodShare * 100).toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="muted" style={{ fontSize: 12, marginTop: 'var(--s-3)' }}>
                  Google&rsquo;s CWV-pass criterion is ≥ 75% Good on each metric (LCP, INP, CLS).
                  Rows below 75% are flagged. Thresholds per web.dev/vitals.
                </p>
                <a
                  className="btn btn-ghost"
                  href="https://vercel.com/alwayzlegits-projects/la-mattress-headless/insights"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ marginTop: 'var(--s-3)' }}
                >
                  Per-route drill-down in Vercel →
                </a>
              </>
            ) : POSTHOG_CONFIGURED ? (
              <>
                <p className="muted">
                  No web_vital events yet. Events ship on the next storefront
                  pageview after the analytics-ga4 fix deploys.
                </p>
                <a
                  className="btn btn-ghost"
                  href="https://vercel.com/alwayzlegits-projects/la-mattress-headless/insights"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ marginTop: 'var(--s-3)' }}
                >
                  Open Vercel Speed Insights →
                </a>
              </>
            ) : (
              <PostHogConfigHint />
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

/* ------------------------------------------------------------------------ *
 * Sub-components
 * ------------------------------------------------------------------------ */

function FunnelViz({ steps }: { steps: Array<{ event: string; label: string; persons: number }> }) {
  const top = Math.max(...steps.map((s) => s.persons), 1);
  return (
    <ul className="dash-funnel">
      {steps.map((s, i) => {
        const widthPct = (s.persons / top) * 100;
        const prev = i > 0 ? steps[i - 1] : null;
        const dropPct = prev && prev.persons > 0 ? 100 - (s.persons / prev.persons) * 100 : null;
        return (
          <li key={s.event} className="dash-funnel-row">
            <div className="dash-funnel-meta">
              <span className="dash-funnel-label">{s.label}</span>
              <span className="dash-badge">{s.event}</span>
            </div>
            <div className="dash-funnel-bar">
              <div className="dash-funnel-fill" style={{ width: `${widthPct.toFixed(1)}%` }} />
              <span className="dash-funnel-value tnum">{s.persons.toLocaleString()}</span>
            </div>
            {dropPct !== null ? (
              <span className={`dash-funnel-drop tnum ${dropPct > 50 ? 'dash-warn' : ''}`}>
                {dropPct >= 0 ? '−' : '+'}{Math.abs(dropPct).toFixed(1)}%
              </span>
            ) : (
              <span className="dash-funnel-drop muted">—</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function PostHogConfigHint() {
  return (
    <p className="muted" style={{ marginTop: 0 }}>
      Set <code>POSTHOG_PERSONAL_API_KEY</code> + <code>POSTHOG_PROJECT_ID</code> in Vercel env
      to load PostHog data here. Personal API key needs <code>query:read</code> + <code>insight:read</code> scopes.
    </p>
  );
}

// RangePicker + RefreshButton now live in
// app/admin/_components/date-range-picker.tsx and
// app/admin/_components/refresh-button.tsx — extracted so the dashboard
// page can stay focused on data fetching + layout while the picker
// (which needs hooks for the custom-range popover + outside-click
// dismiss) compiles as a separate client-component island.

/**
 * Sessions-by-device table. Used to show Conv% but that column was
 * always 0% because order_completed events fire from a server webhook
 * without $session_id or $device_type (so the numerator was 0 across
 * the board). Now shows share-of-traffic per device, which is the
 * useful number for mobile-vs-desktop merchandising decisions anyway.
 *
 * Lives as a sub-component (vs inline IIFE) because it needs to compute
 * the total across rows for the share %, which inline JSX gets ugly.
 */
function DeviceTable({ rows }: { rows: Array<{ deviceType: string; sessions: number }> }) {
  const total = rows.reduce((s, d) => s + d.sessions, 0);
  return (
    <table className="dash-table">
      <thead>
        <tr>
          <th>Device</th>
          <th>Sessions</th>
          <th>Share</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((d) => (
          <tr key={d.deviceType}>
            <td>{d.deviceType}</td>
            <td className="tnum">{d.sessions.toLocaleString()}</td>
            <td className="tnum">{total > 0 ? `${((d.sessions / total) * 100).toFixed(1)}%` : '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * Showroom traffic table. One row per LA showroom (always renders all
 * 5, even when some have zero traffic in the window — easier to read
 * than a list that hides quiet branches). Pageviews + sessions per
 * showroom + share of total showroom traffic in the window. Showroom
 * names link to the corresponding /pages/<handle> on the storefront
 * (new tab) so the merchant can sanity-check the page they're
 * measuring.
 */
function ShowroomTrafficTable({
  rows,
}: {
  rows: ReadonlyArray<{
    handle: string;
    name: string;
    pagePath: string;
    pageviews: number;
    sessions: number;
  }>;
}) {
  const totalViews = rows.reduce((s, r) => s + r.pageviews, 0);
  return (
    <table className="dash-table">
      <thead>
        <tr>
          <th>Showroom</th>
          <th>Pageviews</th>
          <th>Sessions</th>
          <th>Share</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.handle} className={r.pageviews === 0 ? 'muted' : undefined}>
            <td>
              <Link href={r.pagePath} prefetch={false} target="_blank" rel="noopener noreferrer">
                {r.name}
              </Link>
            </td>
            <td className="tnum">{r.pageviews.toLocaleString()}</td>
            <td className="tnum">{r.sessions.toLocaleString()}</td>
            <td className="tnum">
              {totalViews > 0 ? `${((r.pageviews / totalViews) * 100).toFixed(1)}%` : '—'}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * Anomaly callout strip. Each item is a small card with severity color +
 * headline + detail + optional jump-to-section link. Server-rendered;
 * no client JS. Pure presentation — all detection logic lives in
 * lib/dashboard/anomalies.ts.
 *
 * Severity colors come from the same palette as the dash-warn / delta
 * badges so the dashboard reads as one design.
 */
function AnomalyStrip({
  anomalies,
}: {
  anomalies: ReadonlyArray<{
    id: string;
    severity: 'critical' | 'warn' | 'info';
    headline: string;
    detail: string;
    href?: string;
  }>;
}) {
  // Order: critical first, then warn, then info. Within a tier the
  // detector's natural order (revenue → refund → cart → conversion →
  // inventory → searches) is preserved by Array.sort being stable.
  const tier = { critical: 0, warn: 1, info: 2 };
  const ordered = [...anomalies].sort((a, b) => tier[a.severity] - tier[b.severity]);
  return (
    <section className="dash-anomaly-strip" aria-label="Things to look at">
      {ordered.map((a) => (
        <div key={a.id} className={`dash-anomaly dash-anomaly-${a.severity}`} role="status">
          <div className="dash-anomaly-headline">{a.headline}</div>
          <div className="dash-anomaly-detail">
            {a.detail}
            {a.href ? (
              <>
                {' '}
                <a href={a.href} className="dash-anomaly-link">
                  Jump to section →
                </a>
              </>
            ) : null}
          </div>
        </div>
      ))}
    </section>
  );
}

/**
 * Phase 300: vs-previous delta on an absolute count or revenue value.
 * Renders as a small inline badge under the big KPI number. Hides the
 * delta entirely when prev is null/undefined (no comparable data) —
 * better than rendering "+∞%" or "—" noise.
 *
 * Threshold: ±0.5% rounds to "flat" since rounding noise on small
 * counts (single-order swings) shouldn't read as a meaningful trend.
 */
function DeltaBadge({ current, prev }: { current: number; prev: number | undefined | null }) {
  const result = formatRelativeDelta(current, prev);
  switch (result.kind) {
    case 'hidden':
    case 'no-comparison':
      // For absolute KPIs, hide the badge when there's nothing to
      // compare to — the big number already implies "vs nothing prior".
      return null;
    case 'no-change':
      return <span className="dash-stat-delta dash-stat-delta-flat">no change</span>;
    case 'new':
      return <span className="dash-stat-delta dash-stat-delta-up">new</span>;
    case 'delta':
      return (
        <span className={`dash-stat-delta dash-stat-delta-${result.severity}`} title="vs previous period">
          {result.label}
        </span>
      );
  }
}

/**
 * Same delta logic as DeltaBadge but for rates (already-fractional
 * inputs). Renders in the card header next to a percentage callout.
 * The delta is shown in PERCENTAGE POINTS, not relative percent —
 * "conversion went from 2.1% to 2.6%" is clearer as "+0.5 pp" than
 * "+23.8%" when the absolute numbers are tiny.
 *
 * QA #224 fix: when prev is null but current is known, render a muted
 * "—" instead of hiding entirely. The original behavior left a
 * missing-badge that could be mistaken for a render bug; the explicit
 * "—" tells the reader "we tried, no prior data".
 */
function RateDelta({ current, prev }: { current: number | null; prev: number | null }) {
  const result = formatRateDelta(current, prev);
  switch (result.kind) {
    case 'hidden':
      return null;
    case 'no-comparison':
      return (
        <span
          className="dash-stat-delta-inline dash-stat-delta-flat"
          title="No previous-period data to compare against"
        >
          —
        </span>
      );
    case 'no-change':
      return (
        <span className="dash-stat-delta-inline dash-stat-delta-flat" title="vs previous period">
          no change
        </span>
      );
    case 'new':
      return (
        <span className="dash-stat-delta-inline dash-stat-delta-up" title="vs previous period">
          new
        </span>
      );
    case 'delta':
      return (
        <span
          className={`dash-stat-delta-inline dash-stat-delta-${result.severity}`}
          title="vs previous period (percentage points)"
        >
          {result.label}
        </span>
      );
  }
}

/**
 * Tiny inline sparkline rendered as an SVG polyline. No charting
 * library — just an array of {date, value} points scaled to a fixed
 * viewport. Hides itself when every value is zero (a flat line at
 * the bottom isn't informative, just visual clutter).
 *
 * field='orders' draws the orders-per-day series; field='revenue'
 * draws revenue. The two series have different magnitudes so each
 * gets its own scale max — they never share an axis.
 */
function Sparkline({ points, field }: { points: DashboardDailyPoint[]; field: 'orders' | 'revenue' }) {
  const values = points.map((p) => p[field]);
  const max = Math.max(...values, 0);
  if (max === 0 || points.length < 2) return null;

  const W = 120;
  const H = 28;
  // Reserve 1px top/bottom so peak/trough strokes don't clip on the viewBox edge.
  const stepX = points.length > 1 ? W / (points.length - 1) : W;
  const coords = values.map((v, i) => {
    const x = i * stepX;
    const y = H - 1 - ((v / max) * (H - 2));
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const path = coords.join(' ');
  const lastIdx = coords.length - 1;
  const lastPoint = coords[lastIdx].split(',');
  return (
    <svg
      className="dash-spark"
      viewBox={`0 0 ${W} ${H}`}
      width={W}
      height={H}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <polyline fill="none" stroke="currentColor" strokeWidth="1.2" points={path} />
      <circle cx={lastPoint[0]} cy={lastPoint[1]} r="1.6" fill="currentColor" />
    </svg>
  );
}

/**
 * funnelConversionRate + computeAbandonment moved to
 * lib/dashboard/funnel-math.ts so the unit-test suite can exercise the
 * math without rendering this page. Imported at the top of the file.
 */

/**
 * Phase 300b: full-width revenue trend chart for the selected range.
 * Same data source as the inline Sparkline but with axis labels +
 * grid lines + Y-axis tick at the max value, so it reads as a real
 * chart instead of a decoration.
 *
 * SVG only — no charting library. Renders inside the
 * "Last N days" card under the KPI row.
 */
function RevenueLineChart({ points, currency }: { points: DashboardDailyPoint[]; currency: string }) {
  const values = points.map((p) => p.revenue);
  const max = Math.max(...values, 0);
  if (max === 0) return <p className="muted" style={{ fontSize: 13 }}>No revenue in this window.</p>;
  const W = 600;
  const H = 120;
  const padL = 48;   // left padding for Y-axis label
  const padR = 8;
  const padT = 8;
  const padB = 20;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const stepX = points.length > 1 ? innerW / (points.length - 1) : innerW;
  const xy = points.map((p, i) => {
    const x = padL + i * stepX;
    const y = padT + innerH - (p.revenue / max) * innerH;
    return { x, y, p };
  });
  const path = xy.map(({ x, y }) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const areaPath = `${padL},${padT + innerH} ${path} ${(padL + innerW).toFixed(1)},${padT + innerH}`;
  const fmt = (v: number) => new Intl.NumberFormat('en-US', {
    style: 'currency', currency: currency || 'USD',
    maximumFractionDigits: 0, notation: max >= 10000 ? 'compact' : 'standard',
  }).format(v);
  // X-axis tick labels: first + middle + last day. With dense ranges
  // showing every day would crowd the axis.
  const firstLabel = points[0]?.date.slice(5);
  const lastLabel = points[points.length - 1]?.date.slice(5);
  const midIdx = Math.floor(points.length / 2);
  const midLabel = points[midIdx]?.date.slice(5);
  return (
    <svg
      className="dash-line-chart"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Revenue trend chart"
    >
      {/* Y-axis grid lines at 0/50%/100% of max */}
      <line x1={padL} y1={padT} x2={padL + innerW} y2={padT} stroke="var(--line)" strokeWidth="0.5" />
      <line x1={padL} y1={padT + innerH / 2} x2={padL + innerW} y2={padT + innerH / 2} stroke="var(--line)" strokeWidth="0.5" strokeDasharray="2 2" />
      <line x1={padL} y1={padT + innerH} x2={padL + innerW} y2={padT + innerH} stroke="var(--line)" strokeWidth="0.5" />
      {/* Y-axis labels */}
      <text x={padL - 6} y={padT + 4} fontSize="10" textAnchor="end" fill="var(--text-2)">{fmt(max)}</text>
      <text x={padL - 6} y={padT + innerH + 4} fontSize="10" textAnchor="end" fill="var(--text-2)">$0</text>
      {/* X-axis tick labels */}
      <text x={padL} y={H - 4} fontSize="10" textAnchor="start" fill="var(--text-2)">{firstLabel}</text>
      <text x={padL + innerW / 2} y={H - 4} fontSize="10" textAnchor="middle" fill="var(--text-2)">{midLabel}</text>
      <text x={padL + innerW} y={H - 4} fontSize="10" textAnchor="end" fill="var(--text-2)">{lastLabel}</text>
      {/* Filled area under the line */}
      <polygon points={areaPath} fill="currentColor" opacity="0.08" />
      {/* The line itself */}
      <polyline fill="none" stroke="currentColor" strokeWidth="1.5" points={path} />
    </svg>
  );
}

/**
 * Phase 300b: orders-by-weekday heatmap. Buckets the daily series into
 * the 7 weekdays, then renders 7 vertical bars colored by intensity.
 * Useful for showroom staffing decisions ("we close at 9 PM but
 * Sundays are dead from 4 onward") and delivery-route planning.
 */
function DayOfWeekHeatmap({ points }: { points: DashboardDailyPoint[] }) {
  const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const buckets = [0, 0, 0, 0, 0, 0, 0];
  let weekCount = 0;
  for (const p of points) {
    // p.date is YYYY-MM-DD in UTC. UTC interpretation is consistent
    // with the bucket logic in getOrderSummaryWithTrends.
    const dow = new Date(p.date + 'T00:00:00Z').getUTCDay();
    buckets[dow] += p.orders;
  }
  // Approximate full weeks in the range (range/7) — used to show
  // per-week averages so longer ranges aren't visually unfair to
  // shorter ones.
  weekCount = points.length / 7;
  const max = Math.max(...buckets, 1);
  return (
    <div className="dash-heatmap" role="table" aria-label="Orders by weekday">
      {buckets.map((n, dow) => {
        const intensity = n / max;
        const avgPerWeek = weekCount > 0 ? n / weekCount : n;
        return (
          <div key={dow} className="dash-heatmap-cell" role="row">
            <div className="dash-heatmap-label">{WEEKDAYS[dow]}</div>
            <div
              className="dash-heatmap-bar"
              style={{ background: `rgba(10, 122, 64, ${0.15 + intensity * 0.85})` }}
              title={`${n} ${n === 1 ? 'order' : 'orders'} total · ~${avgPerWeek.toFixed(1)} per week avg`}
            >
              <span className="dash-heatmap-value tnum">{n}</span>
            </div>
            <div className="dash-heatmap-sub muted tnum">{avgPerWeek.toFixed(1)}/wk</div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Hour-of-day heatmap. 24 columns (hour 0–23 in UTC), each column's
 * background intensity scaled to the busiest hour's count. Useful for
 * "when do orders come in" decisions — does the storefront need a
 * pre-8am push notification, or are most orders coming in at 11pm?
 *
 * UTC because the underlying bucketing in getOrderSummaryWithTrends is
 * UTC. A subtitle on the parent card spells out the offset note so
 * the merchant can mentally subtract 7-8h for Pacific. Adding a TZ
 * picker would be the right next step if this proves heavily-used.
 */
function HourOfDayHeatmap({ points }: { points: DashboardHourPoint[] }) {
  const max = Math.max(...points.map((p) => p.orders), 1);
  return (
    <div className="dash-hour-heatmap" role="table" aria-label="Orders by hour of day (Pacific)">
      {points.map((p) => {
        const intensity = p.orders / max;
        const label = p.hour.toString().padStart(2, '0');
        return (
          <div key={p.hour} className="dash-hour-cell" role="row">
            <div
              className="dash-hour-bar"
              style={{ background: `rgba(10, 122, 64, ${0.10 + intensity * 0.90})` }}
              title={`${label}:00 PT · ${p.orders} ${p.orders === 1 ? 'order' : 'orders'}`}
            >
              <span className="dash-hour-value tnum">{p.orders > 0 ? p.orders : ''}</span>
            </div>
            <div className="dash-hour-label muted tnum">{label}</div>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------------ *
 * Formatters
 * ------------------------------------------------------------------------ */

function fmtMoney(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'USD',
    maximumFractionDigits: 0,
  }).format(amount);
}

function relativeTime(iso: string): string {
  const t = new Date(iso).getTime();
  const diff = Date.now() - t;
  const sec = Math.round(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  return `${day}d ago`;
}

function pct(num: number, denom: number): string {
  if (denom <= 0) return '—';
  return `${((num / denom) * 100).toFixed(1)}%`;
}

/**
 * Phase 300c: 6-color rotation used by both the donut chart and the
 * legend swatches. Picked from the existing design tokens so the chart
 * doesn't introduce new colors — donut sits next to the existing
 * funnel viz and needs to read as part of the same dashboard.
 */
const DONUT_PALETTE = ['#0a7a40', '#1b6ec2', '#b35900', '#8a4baf', '#b3611c', '#5f6b76'];
function donutColor(i: number): string {
  return DONUT_PALETTE[i % DONUT_PALETTE.length];
}

/**
 * Phase 300c: SVG donut chart for traffic-source mix. Renders each slice
 * as a stroked arc on a single circle (using stroke-dasharray instead of
 * SVG path arcs — half the math, same visual result). Center hole reads
 * the top-source share so the chart works at a glance.
 *
 * SVG only — no charting library. Hides itself if total <= 0 (no data).
 */
function SourceDonut({ slices }: { slices: Array<{ label: string; value: number }> }) {
  const total = slices.reduce((s, x) => s + x.value, 0);
  if (total <= 0) return null;
  const r = 38;
  const circ = 2 * Math.PI * r;
  let cumulative = 0;
  // Sort slices descending for stable visual order — biggest first.
  const ordered = [...slices].sort((a, b) => b.value - a.value);
  const top = ordered[0];
  const topPct = (top.value / total) * 100;
  return (
    <svg
      className="dash-donut"
      viewBox="0 0 100 100"
      role="img"
      aria-label="Traffic source breakdown"
    >
      {/* Track ring — guards against gaps from rounding */}
      <circle cx="50" cy="50" r={r} fill="none" stroke="var(--line)" strokeWidth="14" />
      {ordered.map((s, i) => {
        const frac = s.value / total;
        const dash = circ * frac;
        const offset = circ * (1 - cumulative);
        cumulative += frac;
        return (
          <circle
            key={s.label}
            cx="50"
            cy="50"
            r={r}
            fill="none"
            stroke={donutColor(i)}
            strokeWidth="14"
            strokeDasharray={`${dash.toFixed(2)} ${(circ - dash).toFixed(2)}`}
            strokeDashoffset={offset.toFixed(2)}
            // Rotate so first slice starts at 12 o'clock instead of 3 o'clock.
            transform="rotate(-90 50 50)"
          >
            <title>{`${s.label}: ${s.value.toLocaleString()} (${(frac * 100).toFixed(1)}%)`}</title>
          </circle>
        );
      })}
      {/* Center hole text — top source share */}
      <text x="50" y="48" textAnchor="middle" fontSize="14" fontWeight="600" fill="var(--text-1)">
        {topPct.toFixed(0)}%
      </text>
      <text x="50" y="60" textAnchor="middle" fontSize="8" fill="var(--text-2)">
        {top.label.slice(0, 14)}
      </text>
    </svg>
  );
}
