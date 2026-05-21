import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  ADMIN_CONFIGURED,
  getCatalogHealth,
  getCustomerInsights,
  getCustomerLifetime,
  getLowStock,
  getOrderSummaryWithTrends,
  getRefundHealth,
  getSeoGaps,
  getTopProducts,
  numericIdFromGid,
  type DashboardDailyPoint,
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
  getRevenueBySource,
  getShowroomTraffic,
  getTopEntryPages,
  getTopSearches,
  getTopTrafficSources,
} from '@/lib/posthog-dashboard';
import { refreshDashboard } from './actions';
import { computeAbandonment, funnelConversionRate } from '@/lib/dashboard/funnel-math';
import { detectAnomalies } from '@/lib/dashboard/anomalies';
import { formatRateDelta, formatRelativeDelta } from '@/lib/dashboard/delta';
import { SHOWROOMS } from '@/lib/showrooms';

// Shopify Admin product editor URL — built from the store domain so
// the deep-link routes to the right store. Falls back to the generic
// admin.shopify.com home if the env var isn't set (dev / preview).
const SHOPIFY_ADMIN_BASE = process.env.SHOPIFY_STORE_DOMAIN
  ? `https://admin.shopify.com/store/${process.env.SHOPIFY_STORE_DOMAIN.replace(/\.myshopify\.com$/, '')}`
  : 'https://admin.shopify.com';

/**
 * Internal admin dashboard at /admin/dashboard.
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

// Refresh server-rendered data every 5 minutes; merchant can hit the
// page reload to force a re-render anytime.
export const revalidate = 300;

// Phase 300: time-range picker drives every fetcher's `days` parameter.
// Three sensible windows (7-day / 30-day / 90-day). Anything outside
// this whitelist gets clamped to the default to keep the URL surface
// tight — accepting arbitrary day counts would invite cache-poisoning
// the revalidate tag with hundreds of variants.
type RangeKey = '7d' | '30d' | '90d';
const RANGE_OPTIONS: Record<RangeKey, { days: number; label: string }> = {
  '7d':  { days: 7,  label: 'Last 7 days' },
  '30d': { days: 30, label: 'Last 30 days' },
  '90d': { days: 90, label: 'Last 90 days' },
};
const DEFAULT_RANGE: RangeKey = '30d';

function parseRange(raw: string | string[] | undefined): RangeKey {
  if (typeof raw !== 'string') return DEFAULT_RANGE;
  return raw in RANGE_OPTIONS ? (raw as RangeKey) : DEFAULT_RANGE;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const rangeKey = parseRange(params.range);
  const { days, label: rangeLabel } = RANGE_OPTIONS[rangeKey];
  const justRefreshed = params.refreshed === '1';

  // QA #224 B4: cache key fragments by full URL, so /admin/dashboard?x=1
  // and /admin/dashboard?x=2 allocate separate Next.js Data Cache entries
  // for the same parsed-range render. Solve by canonicalizing: if the
  // URL has any param outside the allow-list, or `range` is a value the
  // whitelist clamps, redirect to the canonical clean URL so subsequent
  // hits share one cache entry.
  //
  // Allow-list:
  //   range=7d|30d|90d  — the picker
  //   refreshed=1       — set by the refresh server action's redirect
  //
  // Anything else (typos, share-tracker UTM params, random ?x=1) gets
  // stripped. Bookmarks with stripped params still work — they redirect
  // once to the clean URL, the second hit comes from cache.
  const ALLOWED_PARAMS = new Set(['range', 'refreshed']);
  const canonicalRange = rangeKey;
  const canonicalRefreshed = justRefreshed;
  const incoming = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (typeof v === 'string') incoming.set(k, v);
    else if (Array.isArray(v) && v.length > 0) incoming.set(k, v[v.length - 1] ?? '');
  }
  const canonical = new URLSearchParams();
  // Only include `range` in the canonical URL if it was explicitly
  // requested — leaving it off matches the default-page shape ('/')
  // and avoids redirect loops on /admin/dashboard (no params).
  if (typeof params.range === 'string') canonical.set('range', canonicalRange);
  if (canonicalRefreshed) canonical.set('refreshed', '1');
  const hasUnknown = Object.keys(params).some((k) => !ALLOWED_PARAMS.has(k));
  const rangeIsClamped = typeof params.range === 'string' && params.range !== canonicalRange;
  if (hasUnknown || rangeIsClamped) {
    const qs = canonical.toString();
    redirect(qs ? `/admin/dashboard?${qs}` : '/admin/dashboard');
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

  // PostHog project URL for deep-linking. When the env vars aren't
  // set we still render the dashboard; PostHog widgets show
  // "data unavailable" with a config hint.
  const phCfg = postHogConfig();
  const phProjectUrl = phCfg
    ? `${phCfg.apiHost.replace(/^https:\/\/us\.posthog\.com$/, 'https://us.posthog.com')}/project/${phCfg.projectId}`
    : 'https://us.posthog.com';

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
    lowStock,
    customerInsights,
    customerLifetime,
    refundHealth,
    funnel,
    funnelPrev,
    entryPages,
    searches,
    sources,
    quizFunnel,
    quizFunnelPrev,
    revenueBySource,
    deviceBreakdown,
    showroomTraffic,
  ] = await Promise.all([
    getOrderSummaryWithTrends(days).catch(() => null),
    getCatalogHealth().catch(() => null),
    getTopProducts(days).catch(() => null),
    getSeoGaps().catch(() => null),
    getLowStock(3).catch(() => null),
    getCustomerInsights(days).catch(() => null),
    getCustomerLifetime(250).catch(() => null),
    getRefundHealth(days).catch(() => null),
    POSTHOG_CONFIGURED ? getConversionFunnel(days).catch(() => null) : Promise.resolve(null),
    POSTHOG_CONFIGURED ? getConversionFunnelPrev(days).catch(() => null) : Promise.resolve(null),
    POSTHOG_CONFIGURED ? getTopEntryPages(7, 10).catch(() => null) : Promise.resolve(null),
    POSTHOG_CONFIGURED ? getTopSearches(days, 15).catch(() => null) : Promise.resolve(null),
    POSTHOG_CONFIGURED ? getTopTrafficSources(days, 10).catch(() => null) : Promise.resolve(null),
    POSTHOG_CONFIGURED ? getQuizFunnel(days).catch(() => null) : Promise.resolve(null),
    POSTHOG_CONFIGURED ? getQuizFunnelPrev(days).catch(() => null) : Promise.resolve(null),
    POSTHOG_CONFIGURED ? getRevenueBySource(days, 8).catch(() => null) : Promise.resolve(null),
    POSTHOG_CONFIGURED ? getDeviceBreakdown(days).catch(() => null) : Promise.resolve(null),
    POSTHOG_CONFIGURED
      ? getShowroomTraffic(days, SHOWROOMS.map((s) => ({ handle: s.handle, name: s.name }))).catch(() => null)
      : Promise.resolve(null),
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
    <main className="dashboard">
      <header className="dashboard-head">
        <div>
          <div className="eyebrow">Internal</div>
          <h1 className="h2" style={{ margin: 0 }}>LA Mattress dashboard</h1>
          <p className="muted" style={{ marginTop: 4, fontSize: 13 }}>
            Rendered {renderedAt.toLocaleString()} · auto-refresh every 5 minutes
            {justRefreshed ? <span className="dash-refreshed-pill"> · just refreshed</span> : null}
            {!POSTHOG_CONFIGURED ? ' · PostHog widgets disabled (env vars missing)' : null}
          </p>
        </div>
        <div className="dashboard-head-actions">
          <RangePicker active={rangeKey} />
          <RefreshButton rangeKey={rangeKey} />
          <nav className="dashboard-links">
            <a href="https://jetnine.sentry.io/issues/?project=la-mattress-headless" target="_blank" rel="noopener noreferrer">
              Sentry →
            </a>
            <a href={phProjectUrl} target="_blank" rel="noopener noreferrer">
              PostHog →
            </a>
            <a href="https://vercel.com/alwayzlegits-projects/la-mattress-headless" target="_blank" rel="noopener noreferrer">
              Vercel →
            </a>
            <a href={`${SHOPIFY_ADMIN_BASE}/`} target="_blank" rel="noopener noreferrer">
              Shopify Admin →
            </a>
          </nav>
        </div>
      </header>

      {/* Anomaly callouts — only render the strip when something fires.
          Otherwise the dashboard reads "all clear" by absence, which is
          the right default (the section nav becomes the first thing
          below the header). */}
      {anomalies.length > 0 ? <AnomalyStrip anomalies={anomalies} /> : null}

      {/* QA #224: section nav so the 18 cards aren't a wall of tiles.
          Anchor links jump to each section; scroll-margin-top in CSS
          keeps the heading from disappearing behind sticky headers. */}
      <nav className="dashboard-section-nav" aria-label="Dashboard sections">
        <a href="#section-revenue">Revenue</a>
        <a href="#section-customers">Customers</a>
        <a href="#section-funnel">Funnel</a>
        <a href="#section-acquisition">Acquisition</a>
        <a href="#section-catalog">Catalog &amp; search</a>
        <a href="#section-health">System</a>
      </nav>

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
                                href={`/admin/orders/${numericIdFromGid(o.id)}?range=${rangeKey}`}
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
              <h2 className="h3" style={{ margin: 0 }}>Orders by weekday · {rangeKey}</h2>
              <span className="muted" style={{ fontSize: 12 }}>Shopify · order count</span>
            </div>
            {orderSummary && orderSummary.daily.length >= 7 ? (
              <DayOfWeekHeatmap points={orderSummary.daily} />
            ) : (
              <p className="muted">Need at least 7 days of order data.</p>
            )}
          </div>

          {/* Refund + cancellation health */}
          <div className="dash-card">
            <div className="dash-card-hd">
              <h2 className="h3" style={{ margin: 0 }}>Refunds &amp; cancels · {rangeKey}</h2>
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
              <h2 className="h3" style={{ margin: 0 }}>Customers · {rangeKey}</h2>
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
              <h2 className="h3" style={{ margin: 0 }}>Cart abandonment · {rangeKey}</h2>
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
              <h2 className="h3" style={{ margin: 0 }}>Quiz funnel · {rangeKey}</h2>
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

          {/* Sessions by device — QA found the Conv% column was 0%
              across the board because server-fired order_completed
              webhooks lack $session_id and $device_type, so the orders
              numerator was always zero. Dropped the broken column and
              renamed; share-of-traffic % takes its place. */}
          <div className="dash-card">
            <div className="dash-card-hd">
              <h2 className="h3" style={{ margin: 0 }}>Sessions by device · {rangeKey}</h2>
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
              <h2 className="h3" style={{ margin: 0 }}>Traffic sources · {rangeKey}</h2>
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
              <h2 className="h3" style={{ margin: 0 }}>Revenue by source · {rangeKey}</h2>
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
              <h2 className="h3" style={{ margin: 0 }}>Showroom traffic · {rangeKey}</h2>
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
              <h2 className="h3" style={{ margin: 0 }}>Top searches · {rangeKey}</h2>
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

          {/* Site Speed */}
          <div className="dash-card">
            <div className="dash-card-hd">
              <h2 className="h3" style={{ margin: 0 }}>Site speed</h2>
              <span className="muted" style={{ fontSize: 12 }}>Vercel Speed Insights</span>
            </div>
            <p className="muted" style={{ marginTop: 0 }}>
              Core Web Vitals per route (LCP / INP / CLS). Live in Vercel&rsquo;s Insights tab.
            </p>
            <a
              className="btn btn-ghost"
              href="https://vercel.com/alwayzlegits-projects/la-mattress-headless/insights"
              target="_blank"
              rel="noopener noreferrer"
              style={{ marginTop: 'var(--s-3)' }}
            >
              Open in Vercel →
            </a>
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

/**
 * Phase 300: time-range picker. Pure server-side anchor-link navigation
 * — no JS, no client component. Clicking a range updates the URL
 * `?range=` param and the page server-renders with the new window.
 *
 * Anchored to the same path so the picker works whether the merchant
 * arrives at /admin/dashboard or /admin/dashboard?range=anything.
 */
function RangePicker({ active }: { active: RangeKey }) {
  return (
    <div className="dash-range-picker" role="group" aria-label="Date range">
      {(Object.keys(RANGE_OPTIONS) as RangeKey[]).map((k) => (
        <Link
          key={k}
          href={`/admin/dashboard?range=${k}`}
          className={`dash-range-btn${k === active ? ' dash-range-btn-active' : ''}`}
          aria-pressed={k === active}
          prefetch={false}
        >
          {k}
        </Link>
      ))}
    </div>
  );
}

/**
 * QA #224: a hard refresh button. Browser reload would only re-fetch
 * within the current 5-min revalidate window; this form posts to the
 * refreshDashboard server action which calls revalidateTag +
 * revalidatePath to bust the Data Cache + Full Route Cache before
 * re-rendering. Renders as a plain submit button next to the range
 * picker; no JS needed.
 */
function RefreshButton({ rangeKey }: { rangeKey: RangeKey }) {
  return (
    <form action={refreshDashboard} className="dash-refresh-form">
      <input type="hidden" name="range" value={rangeKey} />
      <button type="submit" className="dash-refresh-btn" title="Force refresh — bust cache and re-fetch">
        ↻ Refresh
      </button>
    </form>
  );
}

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
