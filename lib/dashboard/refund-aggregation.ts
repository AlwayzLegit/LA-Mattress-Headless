/**
 * Pure aggregator for Shopify Order refunds → per-line-item dollar
 * totals.
 *
 * Powers the per-line `(N refunded, $X)` vs `(N restocked, no refund)`
 * annotation on /admin/orders/[id]. Extracted from getOrderDetail in
 * lib/shopify/admin.ts so the unit-test suite can exercise the
 * aggregation logic without dragging in `server-only` or the GraphQL
 * fetcher (cowork 20260521 follow-up).
 *
 * Shape:
 *   - Input: the `refunds` array as returned by the Shopify Admin
 *     query, each carrying an inner `refundLineItems.nodes` list with
 *     `{ quantity, restockType, lineItem.id, subtotalSet.shopMoney.amount }`.
 *   - Output: Map<lineItemId, totalSubtotalRefunded>.
 *
 * The renderer decides "restocked vs refunded" from the output: a line
 * with quantityRefunded > 0 (from li.refundableQuantity elsewhere) but
 * amountRefunded === 0 was a restock-only refund (returned to inventory
 * without releasing payment).
 *
 * Robust to weird input: same line item appearing in multiple refund
 * records is summed correctly; restock-only refunds (subtotal === 0) add
 * nothing to the total; an empty refunds array produces an empty Map.
 */

export type RefundLineItemRow = {
  quantity: number;
  restockType?: string | null;
  lineItem: { id: string };
  subtotalSet: { shopMoney: { amount: string; currencyCode: string } };
};

export type RefundRecord = {
  id: string;
  refundLineItems: { nodes: RefundLineItemRow[] };
};

export function aggregateRefundsByLineItem(
  refunds: ReadonlyArray<RefundRecord>,
): Map<string, number> {
  const out = new Map<string, number>();
  for (const r of refunds) {
    for (const rli of r.refundLineItems.nodes) {
      const id = rli.lineItem.id;
      // Defensive parse — Shopify returns money as a string-typed scalar.
      // Number.parseFloat('') is NaN, so coalesce to 0 for absent values.
      const raw = rli.subtotalSet?.shopMoney?.amount ?? '0';
      const subtotal = Number.parseFloat(raw || '0') || 0;
      out.set(id, (out.get(id) ?? 0) + subtotal);
    }
  }
  return out;
}
