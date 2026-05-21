/**
 * Unit tests for lib/dashboard/refund-aggregation.ts — the pure
 * aggregator behind the order detail page's per-line refund-dollar
 * annotation. Closes cowork 20260521's "B4 latent risk" follow-up.
 *
 * Cowork called out 4 fixture cases that the previous round of QA
 * couldn't exercise (the order-detail page was 401'd from a separate
 * token-scope incident). Each is covered below as a dedicated test:
 *   1. One line item across two refund records (each quantity:1) —
 *      money sums independently per refund row
 *   2. Restock-only + cash mix on the same line — distinguish (caller
 *      reads `amount === 0` as restock-only)
 *   3. All refund records carry subtotal:0 — line has quantityRefunded
 *      from elsewhere but amountRefunded is 0
 *   4. Empty refunds array — empty Map (no crash)
 *
 * Plus a handful of structural edge cases (multiple line items,
 * malformed subtotal strings, multiple refund records collapsing to
 * one map entry).
 */
import test from 'node:test';
import assert from 'node:assert/strict';

const { aggregateRefundsByLineItem } = await import('../../lib/dashboard/refund-aggregation.ts');

/** Helper: build a single refundLineItem row with sane defaults. */
function rli({ lineItemId = 'gid://shopify/LineItem/1', quantity = 1, subtotal = '0.00', restockType = null } = {}) {
  return {
    quantity,
    restockType,
    lineItem: { id: lineItemId },
    subtotalSet: { shopMoney: { amount: subtotal, currencyCode: 'USD' } },
  };
}

/** Helper: build a Refund record with the given refundLineItems. */
function refund(refundLineItems, id = 'gid://shopify/Refund/x') {
  return { id, refundLineItems: { nodes: refundLineItems } };
}

/* --- Cowork's 4 specific fixture cases --- */

test('case 1: one line item across two refund records — money sums per refund row', () => {
  // Same line refunded once for $315 and once for $315 across two
  // separate refund records. Total = $630.
  const out = aggregateRefundsByLineItem([
    refund([rli({ lineItemId: 'gid://shopify/LineItem/A', subtotal: '315.00' })], 'gid://shopify/Refund/1'),
    refund([rli({ lineItemId: 'gid://shopify/LineItem/A', subtotal: '315.00' })], 'gid://shopify/Refund/2'),
  ]);
  assert.equal(out.get('gid://shopify/LineItem/A'), 630);
});

test('case 2: restock-only + cash mix on the same line — sums correctly, caller reads 0=restock-only', () => {
  // Same line: one refund record refunded $610 (cash back), another
  // restock-only ($0 returned). Aggregator sums to $610 — the caller
  // (renderer) sees amountRefunded > 0 so picks the "refunded" label
  // even though one of the refunds was restock-only. This matches
  // the intended UI behavior: ANY cash refund on the line → show $.
  const out = aggregateRefundsByLineItem([
    refund([rli({ lineItemId: 'A', subtotal: '0.00', restockType: 'RETURN' })], 'r1'),
    refund([rli({ lineItemId: 'A', subtotal: '610.00', restockType: 'NO_RESTOCK' })], 'r2'),
  ]);
  assert.equal(out.get('A'), 610);
});

test('case 3: all refunds on a line are restock-only — total is 0 (restock-only signal preserved)', () => {
  // Two restock-only refund records on the same line. Aggregator
  // produces a Map entry with value 0. The order-detail renderer reads
  // this as "(N restocked, no refund)" (assuming quantityRefunded > 0
  // from li.refundableQuantity elsewhere).
  const out = aggregateRefundsByLineItem([
    refund([rli({ lineItemId: 'A', subtotal: '0.00', restockType: 'RETURN' })], 'r1'),
    refund([rli({ lineItemId: 'A', subtotal: '0.00', restockType: 'LEGACY_RESTOCK' })], 'r2'),
  ]);
  assert.equal(out.get('A'), 0);
  assert.ok(out.has('A'), 'line still appears in the map (zero is intentional, not absence)');
});

test('case 4: empty refunds array produces an empty Map (no crash)', () => {
  const out = aggregateRefundsByLineItem([]);
  assert.equal(out.size, 0);
});

/* --- Structural edge cases --- */

test('multiple line items in a single refund record — each gets its own map entry', () => {
  const out = aggregateRefundsByLineItem([
    refund([
      rli({ lineItemId: 'A', subtotal: '100.00' }),
      rli({ lineItemId: 'B', subtotal: '250.00' }),
      rli({ lineItemId: 'C', subtotal: '50.00' }),
    ]),
  ]);
  assert.equal(out.size, 3);
  assert.equal(out.get('A'), 100);
  assert.equal(out.get('B'), 250);
  assert.equal(out.get('C'), 50);
});

test('a refund record with an empty refundLineItems array contributes nothing', () => {
  // A "refund" with no line items attached (e.g. shipping-only refund).
  const out = aggregateRefundsByLineItem([refund([])]);
  assert.equal(out.size, 0);
});

test('malformed subtotal string coalesces to 0 instead of NaN', () => {
  // Defensive: Shopify shouldn't return invalid money strings, but if
  // it does we don't want NaN propagating into the renderer (would
  // display as "$NaN" or crash Intl.NumberFormat).
  const out = aggregateRefundsByLineItem([
    refund([
      rli({ lineItemId: 'A', subtotal: 'not-a-number' }),
      rli({ lineItemId: 'A', subtotal: '100.00' }),
    ]),
  ]);
  assert.equal(out.get('A'), 100);
});

test('missing subtotalSet coalesces to 0 (defensive — should never happen but)', () => {
  // If Shopify ever omits subtotalSet entirely on a refund line, we
  // still want a Map entry (the quantity is still useful) with 0
  // dollars. The helper uses optional chaining + ?? '0' for this.
  const out = aggregateRefundsByLineItem([
    refund([
      {
        quantity: 1,
        restockType: null,
        lineItem: { id: 'A' },
        // subtotalSet entirely absent
      },
    ]),
  ]);
  assert.equal(out.get('A'), 0);
  assert.ok(out.has('A'));
});

test('three refunds on the same line accumulate cleanly', () => {
  // Floating-point gotcha check — three $33.33 refunds should sum to
  // $99.99 (not $99.99000000001 due to JS Number precision).
  const out = aggregateRefundsByLineItem([
    refund([rli({ lineItemId: 'A', subtotal: '33.33' })], 'r1'),
    refund([rli({ lineItemId: 'A', subtotal: '33.33' })], 'r2'),
    refund([rli({ lineItemId: 'A', subtotal: '33.33' })], 'r3'),
  ]);
  // Tolerate a tiny float epsilon — the renderer will Intl-format to
  // 2dp anyway, so the visible string is "$99.99" either way.
  assert.ok(Math.abs(out.get('A') - 99.99) < 1e-9);
});
