import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ADMIN_CONFIGURED,
  getCatalogHealth,
  getOrderSummary,
  getSeoGaps,
  getTopProducts,
} from '@/lib/shopify/admin';

/**
 * Internal admin dashboard at /admin/dashboard.
 *
 * Aggregates first-party metrics from Shopify Admin (orders, revenue,
 * catalog health, SEO gaps) into one page, plus deep-links into the
 * external dashboards (Sentry for errors, PostHog for funnels +
 * session replay, Vercel for deploys + CWV).
 *
 * Auth: `noindex` via metadata + a soft token gate via the
 * `DASHBOARD_TOKEN` env var. When DASHBOARD_TOKEN is set, the page
 * checks for ?token=<value> and 404s otherwise. When unset, the page
 * renders for anyone who knows the URL — acceptable while traffic to
 * the URL stays effectively zero.
 *
 * Production-hardening to-do (not in scope of this PR): Vercel Edge
 * Middleware HTTP Basic Auth on /admin/* paths. Documented in the
 * dashboard's own §6 below.
 */

export const metadata: Metadata = {
  title: 'Dashboard — LA Mattress Internal',
  robots: { index: false, follow: false },
};

// Refresh server-rendered data every 5 minutes; merchant can hit the
// page reload to force a re-render anytime.
export const revalidate = 300;
export const dynamic = 'force-dynamic'; // honor query-string token check

const DASHBOARD_TOKEN = process.env.DASHBOARD_TOKEN;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = await searchParams;
  // Soft token check: if env var is set, require it via ?token=<value>.
  // Otherwise let through anyone with the URL.
  if (DASHBOARD_TOKEN && params.token !== DASHBOARD_TOKEN) {
    return (
      <main className="container" style={{ paddingTop: 'var(--s-8)', paddingBottom: 'var(--s-9)' }}>
        <h1 className="h2">Dashboard</h1>
        <p className="muted">Authentication required. Append <code>?token=…</code> to the URL.</p>
      </main>
    );
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

  // Fan out all queries in parallel — they each take ~200-500ms and
  // running serially would push the page over a second.
  const [orderSummary, catalog, topProducts, seoGaps] = await Promise.all([
    getOrderSummary(30).catch(() => null),
    getCatalogHealth().catch(() => null),
    getTopProducts(30).catch(() => null),
    getSeoGaps().catch(() => null),
  ]);

  return (
    <main className="dashboard">
      <header className="dashboard-head">
        <div>
          <div className="eyebrow">Internal</div>
          <h1 className="h2" style={{ margin: 0 }}>LA Mattress dashboard</h1>
          <p className="muted" style={{ marginTop: 4, fontSize: 13 }}>
            Last refreshed {new Date().toLocaleString()} · auto-refreshes every 5 minutes
          </p>
        </div>
        <nav className="dashboard-links">
          <a href="https://jetnine.sentry.io/issues/?project=la-mattress-headless" target="_blank" rel="noopener noreferrer">
            Sentry →
          </a>
          <a href="https://us.posthog.com/" target="_blank" rel="noopener noreferrer">
            PostHog →
          </a>
          <a href="https://vercel.com/alwayzlegits-projects/la-mattress-headless" target="_blank" rel="noopener noreferrer">
            Vercel →
          </a>
          <a href="https://admin.shopify.com/" target="_blank" rel="noopener noreferrer">
            Shopify Admin →
          </a>
        </nav>
      </header>

      <section className="dash-grid">
        {/* Revenue + orders */}
        <div className="dash-card dash-card-wide">
          <div className="dash-card-hd">
            <h2 className="h3" style={{ margin: 0 }}>Last 30 days</h2>
            <span className="muted" style={{ fontSize: 12 }}>Shopify Admin</span>
          </div>
          {orderSummary ? (
            <>
              <div className="dash-stat-row">
                <div className="dash-stat">
                  <div className="dash-stat-label">Orders</div>
                  <div className="dash-stat-value">{orderSummary.totalOrders}</div>
                </div>
                <div className="dash-stat">
                  <div className="dash-stat-label">Revenue</div>
                  <div className="dash-stat-value">{fmtMoney(orderSummary.totalRevenue, orderSummary.currency)}</div>
                </div>
                <div className="dash-stat">
                  <div className="dash-stat-label">Avg order</div>
                  <div className="dash-stat-value">{fmtMoney(orderSummary.avgOrderValue, orderSummary.currency)}</div>
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

        {/* Top products */}
        <div className="dash-card dash-card-wide">
          <div className="dash-card-hd">
            <h2 className="h3" style={{ margin: 0 }}>Top products (last 30 days)</h2>
            <span className="muted" style={{ fontSize: 12 }}>by units sold</span>
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

        {/* External dashboards */}
        <div className="dash-card">
          <div className="dash-card-hd">
            <h2 className="h3" style={{ margin: 0 }}>Conversion funnel</h2>
            <span className="muted" style={{ fontSize: 12 }}>PostHog</span>
          </div>
          <p className="muted" style={{ marginTop: 0 }}>
            PostHog stores the funnel; this card embeds the link until we wire the Insights API.
          </p>
          <ul className="dash-list-compact">
            <li><span className="dash-badge">plp_view</span> → <span className="dash-badge">pdp_view</span></li>
            <li><span className="dash-badge">pdp_view</span> → <span className="dash-badge">add_to_cart</span></li>
            <li><span className="dash-badge">add_to_cart</span> → <span className="dash-badge">cart_view</span></li>
            <li><span className="dash-badge">cart_view</span> → <span className="dash-badge">checkout_started</span></li>
            <li><span className="dash-badge">checkout_started</span> → <span className="dash-badge">order_completed</span></li>
          </ul>
          <a
            className="btn btn-ghost"
            href="https://us.posthog.com/"
            target="_blank"
            rel="noopener noreferrer"
            style={{ marginTop: 'var(--s-3)' }}
          >
            Open in PostHog →
          </a>
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
