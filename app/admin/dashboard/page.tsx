import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ADMIN_CONFIGURED,
  getCatalogHealth,
  getOrderSummaryWithTrends,
  getSeoGaps,
  getTopProducts,
  type DashboardDailyPoint,
} from '@/lib/shopify/admin';
import {
  POSTHOG_CONFIGURED,
  postHogConfig,
} from '@/lib/posthog-query';
import {
  getConversionFunnel,
  getConversionFunnelPrev,
  getQuizFunnel,
  getQuizFunnelPrev,
  getRevenueBySource,
  getTopEntryPages,
  getTopSearches,
  getTopTrafficSources,
} from '@/lib/posthog-dashboard';

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
  searchParams: Promise<{ range?: string | string[] }>;
}) {
  const params = await searchParams;
  const rangeKey = parseRange(params.range);
  const { days, label: rangeLabel } = RANGE_OPTIONS[rangeKey];

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
    funnel,
    funnelPrev,
    entryPages,
    searches,
    sources,
    quizFunnel,
    quizFunnelPrev,
    revenueBySource,
  ] = await Promise.all([
    getOrderSummaryWithTrends(days).catch(() => null),
    getCatalogHealth().catch(() => null),
    getTopProducts(days).catch(() => null),
    getSeoGaps().catch(() => null),
    POSTHOG_CONFIGURED ? getConversionFunnel(days).catch(() => null) : Promise.resolve(null),
    POSTHOG_CONFIGURED ? getConversionFunnelPrev(days).catch(() => null) : Promise.resolve(null),
    POSTHOG_CONFIGURED ? getTopEntryPages(7, 10).catch(() => null) : Promise.resolve(null),
    POSTHOG_CONFIGURED ? getTopSearches(days, 15).catch(() => null) : Promise.resolve(null),
    POSTHOG_CONFIGURED ? getTopTrafficSources(days, 10).catch(() => null) : Promise.resolve(null),
    POSTHOG_CONFIGURED ? getQuizFunnel(days).catch(() => null) : Promise.resolve(null),
    POSTHOG_CONFIGURED ? getQuizFunnelPrev(days).catch(() => null) : Promise.resolve(null),
    POSTHOG_CONFIGURED ? getRevenueBySource(days, 8).catch(() => null) : Promise.resolve(null),
  ]);

  // Funnel conversion rate (overall: last step / first step) for the
  // current and previous windows. Used to render a vs-previous delta
  // badge in the funnel-card header.
  const funnelConvNow = funnelConversionRate(funnel?.steps);
  const funnelConvPrev = funnelConversionRate(funnelPrev?.steps);
  const quizCompletionNow = quizFunnel && quizFunnel.started > 0 ? quizFunnel.completed / quizFunnel.started : null;
  const quizCompletionPrev = quizFunnelPrev && quizFunnelPrev.started > 0 ? quizFunnelPrev.completed / quizFunnelPrev.started : null;

  return (
    <main className="dashboard">
      <header className="dashboard-head">
        <div>
          <div className="eyebrow">Internal</div>
          <h1 className="h2" style={{ margin: 0 }}>LA Mattress dashboard</h1>
          <p className="muted" style={{ marginTop: 4, fontSize: 13 }}>
            Last refreshed {new Date().toLocaleString()} · auto-refreshes every 5 minutes
            {!POSTHOG_CONFIGURED ? ' · PostHog widgets disabled (env vars missing)' : null}
          </p>
        </div>
        <div className="dashboard-head-actions">
          <RangePicker active={rangeKey} />
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
            <a href="https://admin.shopify.com/" target="_blank" rel="noopener noreferrer">
              Shopify Admin →
            </a>
          </nav>
        </div>
      </header>

      <section className="dash-grid">
        {/* Revenue + orders */}
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
                        <td><strong>{o.name}</strong></td>
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
                <span>Published</span>
                <strong>{catalog.publishedProducts}</strong>
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

        {/* Top traffic sources */}
        <div className="dash-card">
          <div className="dash-card-hd">
            <h2 className="h3" style={{ margin: 0 }}>Traffic sources · {rangeKey}</h2>
            <span className="muted" style={{ fontSize: 12 }}>PostHog</span>
          </div>
          {sources ? (
            sources.length === 0 ? (
              <p className="muted">No traffic data yet.</p>
            ) : (
              <table className="dash-table">
                <thead>
                  <tr>
                    <th>Source</th>
                    <th>Visitors</th>
                    <th>Sessions</th>
                  </tr>
                </thead>
                <tbody>
                  {sources.map((s) => (
                    <tr key={s.source}>
                      <td>{s.source}</td>
                      <td className="tnum">{s.visitors}</td>
                      <td className="tnum">{s.sessions}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          ) : POSTHOG_CONFIGURED ? (
            <p className="muted">Traffic-source data unavailable.</p>
          ) : (
            <PostHogConfigHint />
          )}
        </div>

        {/* Revenue by source */}
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
                  </tr>
                </thead>
                <tbody>
                  {revenueBySource.map((r) => (
                    <tr key={r.source}>
                      <td>{r.source}</td>
                      <td className="tnum">{r.orders}</td>
                      <td className="tnum">{fmtMoney(r.revenue, 'USD')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          ) : POSTHOG_CONFIGURED ? (
            <p className="muted">Revenue-by-source unavailable.</p>
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
                        <span className="muted"> · gap: {p.gap}</span>
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
 * Phase 300: vs-previous delta on an absolute count or revenue value.
 * Renders as a small inline badge under the big KPI number. Hides the
 * delta entirely when prev is null/undefined (no comparable data) —
 * better than rendering "+∞%" or "—" noise.
 *
 * Threshold: ±0.5% rounds to "flat" since rounding noise on small
 * counts (single-order swings) shouldn't read as a meaningful trend.
 */
function DeltaBadge({ current, prev }: { current: number; prev: number | undefined | null }) {
  if (prev === undefined || prev === null) return null;
  if (prev === 0 && current === 0) {
    return <span className="dash-stat-delta dash-stat-delta-flat">no change</span>;
  }
  if (prev === 0) {
    return <span className="dash-stat-delta dash-stat-delta-up">new</span>;
  }
  const deltaPct = ((current - prev) / prev) * 100;
  const cls = Math.abs(deltaPct) < 0.5
    ? 'dash-stat-delta-flat'
    : deltaPct > 0 ? 'dash-stat-delta-up' : 'dash-stat-delta-down';
  const sign = deltaPct > 0 ? '+' : '';
  return (
    <span className={`dash-stat-delta ${cls}`} title="vs previous period">
      {sign}{deltaPct.toFixed(1)}%
    </span>
  );
}

/**
 * Same delta logic as DeltaBadge but for rates (already-fractional
 * inputs). Renders in the card header next to a percentage callout.
 * The delta is shown in PERCENTAGE POINTS, not relative percent —
 * "conversion went from 2.1% to 2.6%" is clearer as "+0.5 pp" than
 * "+23.8%" when the absolute numbers are tiny.
 */
function RateDelta({ current, prev }: { current: number | null; prev: number | null }) {
  if (current === null || prev === null) return null;
  const pp = (current - prev) * 100;
  const cls = Math.abs(pp) < 0.05
    ? 'dash-stat-delta-flat'
    : pp > 0 ? 'dash-stat-delta-up' : 'dash-stat-delta-down';
  const sign = pp > 0 ? '+' : '';
  return (
    <span className={`dash-stat-delta-inline ${cls}`} title="vs previous period (percentage points)">
      {sign}{pp.toFixed(2)} pp
    </span>
  );
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
 * Compute the overall funnel conversion rate (last step persons / first
 * step persons). Returns null when there's no data for either end.
 * Lives at module scope so both the current and previous-period
 * funnels reuse the same definition — keeps the "vs previous"
 * comparison apples-to-apples.
 */
function funnelConversionRate(steps: Array<{ persons: number }> | undefined | null): number | null {
  if (!steps || steps.length < 2) return null;
  const first = steps[0].persons;
  const last = steps[steps.length - 1].persons;
  if (first === 0) return null;
  return last / first;
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
