'use client';

import Link from 'next/link';
import { AdminDataTable } from './data-table';
import { numericIdFromGid } from '@/lib/shopify/gid';

/**
 * Client wrapper around AdminDataTable for the "Recent orders" card on
 * /admin (Overview section).
 *
 * Why this wrapper exists: AdminDataTable's column definitions carry
 * `get` + `render` FUNCTIONS, and Next.js cannot serialize functions
 * across the server→client component boundary. Defining the columns
 * inside this 'use client' module keeps both the rows (serializable
 * row data) AND the column functions on the client side, so the
 * server `/admin` page only has to pass serializable props
 * (`rows`, `rangeQuery`) down here.
 *
 * Fix for the production crash documented in Sentry
 * LA-MATTRESS-HEADLESS-1J — 91 events in 14h before the hotfix.
 */

export type RecentOrderRow = {
  id: string;
  name: string;
  createdAt: string;
  total: number;
  currency: string;
  customer: string | null;
  fulfillmentStatus: string | null;
  financialStatus: string | null;
};

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

export function RecentOrdersTable({
  rows,
  rangeQuery,
}: {
  rows: ReadonlyArray<RecentOrderRow>;
  /** Pre-built query string to round-trip the active range onto
   *  the /admin/orders/[id] back-link target. */
  rangeQuery: string;
}) {
  return (
    <AdminDataTable
      rows={rows}
      rowKey={(o) => o.id}
      csvFilename="recent-orders"
      searchPlaceholder="Search by order # or customer…"
      emptyLabel="No orders match."
      columns={[
        {
          label: 'Order',
          get: (o) => o.name,
          render: (o) => (
            <strong>
              <Link
                href={`/admin/orders/${numericIdFromGid(o.id)}${rangeQuery ? `?${rangeQuery}` : ''}`}
                prefetch={false}
              >
                {o.name}
              </Link>
            </strong>
          ),
        },
        {
          label: 'Customer',
          get: (o) => o.customer ?? '',
          render: (o) => <>{o.customer ?? '—'}</>,
        },
        {
          label: 'Total',
          align: 'right',
          get: (o) => o.total,
          render: (o) => fmtMoney(o.total, o.currency),
        },
        {
          label: 'Fulfillment',
          get: (o) => o.fulfillmentStatus ?? '',
          render: (o) => <>{o.fulfillmentStatus ?? '—'}</>,
        },
        {
          label: 'When',
          get: (o) => o.createdAt,
          render: (o) => (
            <span className="muted" style={{ fontSize: 12 }}>{relativeTime(o.createdAt)}</span>
          ),
        },
      ]}
    />
  );
}
