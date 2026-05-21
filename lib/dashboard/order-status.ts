/**
 * Pure helpers for the order-detail page (/admin/orders/[id]).
 *
 * Lives in lib/dashboard/ alongside the other pure modules so the
 * unit-test suite can import without dragging in `server-only`. The
 * detail page imports these and uses them for status-badge colors +
 * human-readable enum labels.
 */

export type BadgeColor = 'green' | 'warn' | 'critical' | 'neutral';

/**
 * Map a Shopify financial / fulfillment status enum to a design-system
 * color bucket. Unknown values fall through to "neutral" so a future
 * Shopify status doesn't render an unstyled badge — better to show a
 * gray pill than nothing at all.
 */
export function badgeColor(status: string): BadgeColor {
  const s = status.toUpperCase();
  if (s === 'PAID' || s === 'FULFILLED' || s === 'AUTHORIZED') return 'green';
  if (
    s === 'PENDING' ||
    s === 'IN_PROGRESS' ||
    s === 'PARTIALLY_FULFILLED' ||
    s === 'PARTIALLY_PAID'
  ) {
    return 'warn';
  }
  if (s === 'REFUNDED' || s === 'PARTIALLY_REFUNDED' || s === 'VOIDED' || s === 'UNFULFILLED') {
    return 'critical';
  }
  return 'neutral';
}

/**
 * "PARTIALLY_REFUNDED" → "Partially refunded".
 *
 * Used on status badges, cancel reasons, and anywhere a Shopify enum
 * surfaces in the UI. Splits on underscore, lowercases, and
 * sentence-cases the first word only — matches the design's "single
 * sentence" feel rather than title-casing every word.
 */
export function humanize(enumish: string): string {
  return enumish
    .toLowerCase()
    .split('_')
    .filter(Boolean)
    .map((w, i) => (i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(' ');
}
