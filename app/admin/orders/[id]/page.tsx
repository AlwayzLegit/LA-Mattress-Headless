import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ADMIN_CONFIGURED, getOrderDetail } from '@/lib/shopify/admin';
import { badgeColor, humanize } from '@/lib/dashboard/order-status';

/**
 * Internal order drill-down at /admin/orders/[id].
 *
 * Linked from the Recent orders table on /admin/dashboard. Renders
 * everything a merchant needs to triage an individual order without
 * leaving the admin: line items + refund state, customer + lifetime
 * order count, shipping address, payment + fulfillment status,
 * tracking info, refund history, tags + internal note. Deep-links
 * out to Shopify Admin for write actions (issue refund, update
 * fulfillment, edit customer).
 *
 * Auth: middleware.ts gates the whole /admin/* tree with HTTP Basic
 * Auth. defense-in-depth: noindex metadata + X-Robots-Tag header.
 *
 * Route param: numeric Shopify order ID (NOT the order name like "#4045").
 * The dashboard's Recent orders link uses numericIdFromGid() so the
 * URL is /admin/orders/12345 → which becomes the Shopify GID
 * gid://shopify/Order/12345 in the data fetcher.
 *
 * Dynamic — never cached at the route level. Order state (fulfillment,
 * refund) needs to be live when a merchant opens the page.
 */

export const metadata: Metadata = {
  title: 'Order — LA Mattress Internal',
  robots: { index: false, follow: false, nocache: true, noimageindex: true },
};

// Order data should always be fresh — no ISR on the detail page.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const SHOPIFY_ADMIN_BASE = process.env.SHOPIFY_STORE_DOMAIN
  ? `https://admin.shopify.com/store/${process.env.SHOPIFY_STORE_DOMAIN.replace(/\.myshopify\.com$/, '')}`
  : 'https://admin.shopify.com';

export default async function OrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ range?: string | string[] }>;
}) {
  const { id } = await params;
  const sp = await searchParams;

  // Validate the route segment is numeric. Without this guard a
  // malformed URL would still hit the Shopify Admin query (which would
  // return null, so no security issue — but a 404 here is a clearer
  // signal than a generic "couldn't load order" page).
  if (!/^\d+$/.test(id)) {
    notFound();
  }

  if (!ADMIN_CONFIGURED) {
    return (
      <main className="container" style={{ paddingTop: 'var(--s-8)', paddingBottom: 'var(--s-9)' }}>
        <h1 className="h2">Order</h1>
        <p className="muted">
          <code>SHOPIFY_ADMIN_TOKEN</code> + <code>SHOPIFY_STORE_DOMAIN</code> must be set to load this page.
        </p>
      </main>
    );
  }

  const order = await getOrderDetail(id).catch(() => null);

  // Preserve the dashboard's range filter on the back link so the
  // merchant returns to the same view they came from.
  const range = typeof sp.range === 'string' ? sp.range : undefined;
  const backHref = range ? `/admin/dashboard?range=${encodeURIComponent(range)}` : '/admin/dashboard';

  if (!order) {
    return (
      <main className="dashboard">
        <header className="dashboard-head">
          <div>
            <div className="eyebrow">Internal</div>
            <h1 className="h2" style={{ margin: 0 }}>Order #{id}</h1>
            <p className="muted" style={{ marginTop: 4, fontSize: 13 }}>
              <Link href={backHref}>← Back to dashboard</Link>
            </p>
          </div>
        </header>
        <p className="muted" style={{ marginTop: 'var(--s-5)' }}>
          Couldn&rsquo;t load order. The ID may be wrong, the order may have been deleted, or
          the Shopify Admin call failed. Check Vercel runtime logs or Sentry for the failing query.
        </p>
      </main>
    );
  }

  const fmtMoney = (amount: number, currency: string) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
    }).format(amount);

  const fmtDate = (iso: string) => new Date(iso).toLocaleString();

  return (
    <main className="dashboard">
      <header className="dashboard-head">
        <div>
          <div className="eyebrow">Internal · Order</div>
          <h1 className="h2" style={{ margin: 0 }}>
            {order.name}{' '}
            {order.cancelledAt ? (
              <span className="dash-anomaly-critical" style={{ fontSize: 13, padding: '2px 8px', borderRadius: 4, marginLeft: 8, borderLeft: '4px solid #c0392b' }}>
                Cancelled
              </span>
            ) : null}
          </h1>
          <p className="muted" style={{ marginTop: 4, fontSize: 13 }}>
            <Link href={backHref}>← Back to dashboard</Link>
            {' · placed '}
            {fmtDate(order.createdAt)}
            {' · '}
            <a
              href={`${SHOPIFY_ADMIN_BASE}/orders/${order.id}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open in Shopify Admin →
            </a>
          </p>
        </div>
        <div className="dashboard-head-actions">
          <div className="dash-order-badges">
            {order.displayFinancialStatus ? (
              <span className={`dash-order-badge dash-order-badge-${badgeColor(order.displayFinancialStatus)}`}>
                {humanize(order.displayFinancialStatus)}
              </span>
            ) : null}
            {order.displayFulfillmentStatus ? (
              <span className={`dash-order-badge dash-order-badge-${badgeColor(order.displayFulfillmentStatus)}`}>
                {humanize(order.displayFulfillmentStatus)}
              </span>
            ) : null}
          </div>
        </div>
      </header>

      <section className="dash-section">
        <h2 className="dash-section-hd">Totals</h2>
        <div className="dash-card">
          <table className="dash-table dash-table-tight">
            <tbody>
              <tr>
                <td>Subtotal</td>
                <td className="tnum" style={{ textAlign: 'right' }}>{fmtMoney(order.subtotal, order.currency)}</td>
              </tr>
              {order.totalShipping > 0 ? (
                <tr>
                  <td>Shipping</td>
                  <td className="tnum" style={{ textAlign: 'right' }}>{fmtMoney(order.totalShipping, order.currency)}</td>
                </tr>
              ) : null}
              {order.totalTax > 0 ? (
                <tr>
                  <td>Tax</td>
                  <td className="tnum" style={{ textAlign: 'right' }}>{fmtMoney(order.totalTax, order.currency)}</td>
                </tr>
              ) : null}
              {order.totalRefunded > 0 ? (
                // Partially-refunded path. Show the original charge first so
                // the reader sees "what the customer paid" before "what's
                // left after refunds". The dashboard's Recent orders table
                // shows the ORIGINAL total ($X) in its Total column — this
                // keeps the two views numerically consistent.
                <>
                  <tr style={{ fontWeight: 700, borderTop: '1px solid var(--line)' }}>
                    <td>Original total</td>
                    <td className="tnum" style={{ textAlign: 'right' }}>{fmtMoney(order.originalTotal, order.currency)}</td>
                  </tr>
                  <tr className="dash-warn">
                    <td>Refunded</td>
                    <td className="tnum" style={{ textAlign: 'right' }}>
                      −{fmtMoney(order.totalRefunded, order.currency)}
                    </td>
                  </tr>
                  <tr style={{ fontWeight: 700 }}>
                    <td>Net total</td>
                    <td className="tnum" style={{ textAlign: 'right' }}>{fmtMoney(order.total, order.currency)}</td>
                  </tr>
                </>
              ) : (
                <tr style={{ fontWeight: 700, borderTop: '1px solid var(--line)' }}>
                  <td>Total</td>
                  <td className="tnum" style={{ textAlign: 'right' }}>{fmtMoney(order.total, order.currency)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="dash-section">
        <h2 className="dash-section-hd">Line items</h2>
        <div className="dash-card">
          {order.lineItems.length === 0 ? (
            <p className="muted">No line items.</p>
          ) : (
            <table className="dash-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>SKU</th>
                  <th>Qty</th>
                  <th>Unit</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {order.lineItems.map((li) => (
                  <tr key={li.id} className={li.quantityRefunded > 0 ? 'dash-warn' : undefined}>
                    <td>
                      {li.productHandle ? (
                        <Link href={`/products/${li.productHandle}`} prefetch={false} target="_blank" rel="noopener noreferrer">
                          {li.title}
                        </Link>
                      ) : (
                        li.title
                      )}
                      {li.variantTitle && li.variantTitle !== 'Default Title' ? (
                        <span className="muted"> · {li.variantTitle}</span>
                      ) : null}
                    </td>
                    <td>{li.sku ? <code style={{ fontSize: 11 }}>{li.sku}</code> : <span className="muted">—</span>}</td>
                    <td className="tnum">
                      {li.quantity}
                      {li.quantityRefunded > 0 ? (
                        <span className="muted" style={{ fontWeight: 400, marginLeft: 4 }}>
                          ({li.quantityRefunded} refunded)
                        </span>
                      ) : null}
                    </td>
                    <td className="tnum">{fmtMoney(li.unitPrice, li.currency)}</td>
                    <td className="tnum">{fmtMoney(li.totalPrice, li.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <section className="dash-section">
        <h2 className="dash-section-hd">Customer &amp; shipping</h2>
        <div className="dash-grid">
          <div className="dash-card">
            <div className="dash-card-hd">
              <h2 className="h3" style={{ margin: 0 }}>Customer</h2>
              <span className="muted" style={{ fontSize: 12 }}>Shopify</span>
            </div>
            {order.customer ? (
              <ul className="dash-list">
                <li>
                  <span>Name</span>
                  <strong>
                    {order.customer.id ? (
                      <a
                        href={`${SHOPIFY_ADMIN_BASE}/customers/${order.customer.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {order.customer.displayName ?? '(no name)'}
                      </a>
                    ) : (
                      order.customer.displayName ?? '(no name)'
                    )}
                  </strong>
                </li>
                {order.customer.email ? (
                  <li>
                    <span>Email</span>
                    <strong>
                      <a href={`mailto:${order.customer.email}`}>{order.customer.email}</a>
                    </strong>
                  </li>
                ) : null}
                {order.customer.phone ? (
                  <li>
                    <span>Phone</span>
                    <strong>
                      <a href={`tel:${order.customer.phone}`}>{order.customer.phone}</a>
                    </strong>
                  </li>
                ) : null}
                {order.customer.numberOfOrders !== null ? (
                  <li>
                    <span>Lifetime orders</span>
                    <strong>{order.customer.numberOfOrders}</strong>
                  </li>
                ) : null}
              </ul>
            ) : (
              <p className="muted">Guest order — no customer account.</p>
            )}
          </div>

          <div className="dash-card">
            <div className="dash-card-hd">
              <h2 className="h3" style={{ margin: 0 }}>Shipping address</h2>
              <span className="muted" style={{ fontSize: 12 }}>Shopify</span>
            </div>
            {order.shippingAddress && order.shippingAddress.formatted.length > 0 ? (
              <address style={{ fontStyle: 'normal', fontSize: 14, lineHeight: 1.5 }}>
                {order.shippingAddress.formatted.map((line, i) => (
                  <div key={i}>{line}</div>
                ))}
              </address>
            ) : (
              <p className="muted">No shipping address on file.</p>
            )}
          </div>
        </div>
      </section>

      <section className="dash-section">
        <h2 className="dash-section-hd">Fulfillment &amp; refund history</h2>
        <div className="dash-grid">
          <div className="dash-card">
            <div className="dash-card-hd">
              <h2 className="h3" style={{ margin: 0 }}>Fulfillments</h2>
              <span className="muted" style={{ fontSize: 12 }}>{order.fulfillments.length} on record</span>
            </div>
            {order.fulfillments.length === 0 ? (
              <p className="muted">No fulfillments yet.</p>
            ) : (
              <ul className="dash-list-compact">
                {order.fulfillments.map((f) => (
                  <li key={f.id}>
                    <strong>{humanize(f.status)}</strong>
                    <span className="muted">{' · '}{fmtDate(f.createdAt)}</span>
                    {f.trackingInfo.length > 0 ? (
                      <div style={{ marginTop: 4, fontSize: 13 }}>
                        {f.trackingInfo.map((t, i) => (
                          <div key={i}>
                            {t.company ? <strong>{t.company}</strong> : <span className="muted">Carrier unknown</span>}
                            {' '}
                            {t.url && t.number ? (
                              <a href={t.url} target="_blank" rel="noopener noreferrer">
                                {t.number}
                              </a>
                            ) : t.number ? (
                              <code style={{ fontSize: 12 }}>{t.number}</code>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="dash-card">
            <div className="dash-card-hd">
              <h2 className="h3" style={{ margin: 0 }}>Refunds</h2>
              <span className="muted" style={{ fontSize: 12 }}>{order.refunds.length} on record</span>
            </div>
            {order.refunds.length === 0 ? (
              <p className="muted">No refunds.</p>
            ) : (
              <ul className="dash-list-compact">
                {order.refunds.map((r) => (
                  <li key={r.id}>
                    <strong className="tnum">{fmtMoney(r.totalRefunded, r.currency)}</strong>
                    <span className="muted">{' · '}{fmtDate(r.createdAt)}</span>
                    {r.note ? (
                      <div style={{ fontSize: 13, marginTop: 4 }}>
                        <span className="muted">Note:</span> {r.note}
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      {(order.tags.length > 0 || order.note || order.cancelledAt) ? (
        <section className="dash-section">
          <h2 className="dash-section-hd">Other</h2>
          <div className="dash-card">
            <ul className="dash-list">
              {order.cancelledAt ? (
                <li className="dash-warn">
                  <span>Cancelled</span>
                  <strong>
                    {fmtDate(order.cancelledAt)}
                    {order.cancelReason ? (
                      <span className="muted" style={{ fontWeight: 400, marginLeft: 6 }}>
                        ({humanize(order.cancelReason)})
                      </span>
                    ) : null}
                  </strong>
                </li>
              ) : null}
              {order.tags.length > 0 ? (
                <li>
                  <span>Tags</span>
                  <strong>{order.tags.join(', ')}</strong>
                </li>
              ) : null}
              {order.note ? (
                <li>
                  <span>Internal note</span>
                  <strong style={{ fontWeight: 400 }}>{order.note}</strong>
                </li>
              ) : null}
            </ul>
          </div>
        </section>
      ) : null}
    </main>
  );
}

// badgeColor + humanize moved to lib/dashboard/order-status.ts so the
// unit-test suite can exercise them.
