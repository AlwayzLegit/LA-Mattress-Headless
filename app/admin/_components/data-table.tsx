'use client';

import { useDeferredValue, useMemo, useState, type ReactNode } from 'react';

/**
 * Generic admin-dashboard data table with a built-in search input and
 * CSV export button.
 *
 * Why client-only: the search input + CSV-as-Blob both need hooks
 * (useState + a one-shot Blob URL). The parent page stays a server
 * component for the data fetch; the table just renders the resolved
 * rows.
 *
 * Cell rendering supports two shapes:
 *   - `value`: the raw cell value (used by search + CSV export).
 *   - `render?`: optional JSX renderer for display (a Link, a badge, etc.).
 *
 * When `render` is omitted the table falls back to formatting the value
 * with the column's `format?` function, then String(value) — so a
 * minimal column definition is just `{ key, label, get }`.
 *
 * Search:
 *   - Case-insensitive substring match across every column's stringified
 *     value (the same value CSV exports), so the merchant can search by
 *     anything visible in the table.
 *   - Wrapped in useDeferredValue so typing on a 250-row table stays
 *     snappy — React batches the filter pass at the back of the queue.
 *
 * CSV export:
 *   - Generated client-side from the CURRENT (filtered) rows so the
 *     download matches what the merchant sees.
 *   - File name comes from `csvFilename` prop, with a timestamp suffix
 *     so multiple downloads of the same table don't collide.
 *   - Field values are CSV-escaped per RFC 4180 (double quotes around
 *     fields containing commas / quotes / newlines; embedded quotes
 *     doubled).
 */

export type AdminTableColumn<Row> = {
  /** Header label rendered in the <thead>. */
  label: string;
  /** Right-align numeric columns. */
  align?: 'left' | 'right';
  /** Read the cell's raw value out of a row — drives search + CSV. */
  get: (row: Row) => string | number | null | undefined;
  /** Optional display renderer; falls back to the formatted value. */
  render?: (row: Row) => ReactNode;
  /** Optional value formatter applied when `render` is absent (e.g. currency). */
  format?: (raw: string | number | null | undefined) => string;
  /** Optional tooltip on the column header. */
  title?: string;
};

export function AdminDataTable<Row>({
  rows,
  columns,
  csvFilename,
  searchPlaceholder = 'Search…',
  emptyLabel = 'No rows match.',
  rowKey,
}: {
  rows: ReadonlyArray<Row>;
  columns: ReadonlyArray<AdminTableColumn<Row>>;
  csvFilename: string;
  searchPlaceholder?: string;
  emptyLabel?: string;
  /** Stable React key — used to keep DOM updates incremental on filter. */
  rowKey: (row: Row, index: number) => string;
}) {
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);

  const filtered = useMemo(() => {
    if (!deferredQuery.trim()) return rows;
    const needle = deferredQuery.trim().toLowerCase();
    return rows.filter((row) =>
      columns.some((col) => {
        const raw = col.get(row);
        if (raw === null || raw === undefined) return false;
        return String(raw).toLowerCase().includes(needle);
      }),
    );
  }, [rows, columns, deferredQuery]);

  function downloadCsv() {
    const lines = [columns.map((c) => csvEscape(c.label)).join(',')];
    for (const row of filtered) {
      lines.push(
        columns
          .map((c) => {
            const raw = c.get(row);
            return csvEscape(raw == null ? '' : String(raw));
          })
          .join(','),
      );
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
    link.href = url;
    link.download = `${csvFilename}-${stamp}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="dash-datatable">
      <div className="dash-datatable-tools">
        <input
          type="search"
          className="dash-datatable-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={searchPlaceholder}
          aria-label="Filter rows"
        />
        <span className="dash-datatable-count muted tnum">
          {filtered.length} of {rows.length}
        </span>
        <button
          type="button"
          className="dash-datatable-export"
          onClick={downloadCsv}
          disabled={filtered.length === 0}
          title="Download filtered rows as CSV"
        >
          ↓ CSV
        </button>
      </div>
      {filtered.length === 0 ? (
        <p className="muted" style={{ marginTop: 0 }}>{emptyLabel}</p>
      ) : (
        <table className="dash-table">
          <thead>
            <tr>
              {columns.map((c) => (
                <th
                  key={c.label}
                  title={c.title}
                  style={c.align === 'right' ? { textAlign: 'right' } : undefined}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((row, i) => (
              <tr key={rowKey(row, i)}>
                {columns.map((c) => (
                  <td
                    key={c.label}
                    className={c.align === 'right' ? 'tnum' : undefined}
                    style={c.align === 'right' ? { textAlign: 'right' } : undefined}
                  >
                    {c.render ? c.render(row) : c.format ? c.format(c.get(row)) : String(c.get(row) ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

/**
 * RFC 4180 CSV escaping — wrap in double quotes if the value contains
 * a comma, quote, or newline; double any embedded quotes.
 */
function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
