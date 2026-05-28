'use client';

import Link from 'next/link';
import { AdminDataTable } from './data-table';

/**
 * Client wrapper around AdminDataTable for the "Top searches" card on
 * /admin. Same reasoning as recent-orders-table.tsx — column
 * definitions carry functions, which Next.js can't serialize across
 * the server→client boundary, so they must live in a 'use client'
 * module that accepts only serializable rows from its server parent.
 *
 * Part of the LA-MATTRESS-HEADLESS-1J hotfix.
 */

export type TopSearchRow = {
  query: string;
  searches: number;
  zeroResult: number;
  zeroPct: number;
};

export function TopSearchesTable({ rows }: { rows: ReadonlyArray<TopSearchRow> }) {
  return (
    <AdminDataTable
      rows={rows}
      rowKey={(s) => s.query}
      csvFilename="top-searches"
      searchPlaceholder="Filter queries…"
      columns={[
        {
          label: 'Query',
          get: (s) => s.query,
          render: (s) => (
            <Link
              href={`/search?q=${encodeURIComponent(s.query)}`}
              prefetch={false}
              target="_blank"
              rel="noopener noreferrer"
            >
              {s.query}
            </Link>
          ),
        },
        { label: 'Count', align: 'right', get: (s) => s.searches },
        {
          label: 'Zero-result',
          align: 'right',
          get: (s) => (s.zeroResult > 0 ? `${s.zeroResult} (${s.zeroPct.toFixed(0)}%)` : '0'),
          render: (s) => (
            <span className={s.zeroPct > 25 ? 'dash-warn' : ''}>
              {s.zeroResult > 0 ? `${s.zeroResult} (${s.zeroPct.toFixed(0)}%)` : '0'}
            </span>
          ),
        },
      ]}
    />
  );
}
