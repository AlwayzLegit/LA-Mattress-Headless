'use client';

import { formatMoney } from '@/lib/format';
import { FINANCING_MIN_PRICE, monthlyPaymentFromPrice } from '@/lib/financing-calc';
import type { Money } from '@/lib/shopify';

type Props = {
  /** Variant-specific price when a variant is matched, otherwise the
   * collection min price — same logic the price row uses, so the two stay
   * in sync as the user changes variants. */
  price: Money | null;
};

/**
 * Financing line shown directly below the price.
 *
 * Why: the analytics dashboard showed a 94% drop from PDP view to
 * add-to-cart on a catalog where mattresses run $1K-$5K+. With no
 * financing/sticker-shock relief next to the price, shoppers freeze.
 * Script-free (no third-party widget) so it costs nothing at LCP.
 *
 * Math — ONE canonical monthly figure across the site (audit ux-plp-03:
 * this line previously showed price/12 "with Affirm" while the PLP card
 * showed the Synchrony price/24 figure, so the monthly number DOUBLED
 * between browse and decision on the same product):
 *   - >= $1,500: `monthlyPaymentFromPrice` from lib/financing-calc.ts —
 *     the same 24-month 0% APR Synchrony figure PlpCard renders, with
 *     the provider named. Both surfaces now share one helper.
 *   - $50–$1,499.99: Shop Pay Installments 4-equal-payment framing (its
 *     0% bi-weekly product caps at $1,499.99; the PLP card shows no
 *     monthly figure below $1,500, so there is nothing to contradict).
 *
 * Hidden when price is null or below $50 (the Shop Pay floor).
 */
export function PdpFinancingLine({ price }: Props) {
  if (!price) return null;
  const amount = Number.parseFloat(price.amount);
  if (!Number.isFinite(amount) || amount < 50) return null;

  const fmt = (n: number) =>
    formatMoney({
      amount: n.toFixed(2),
      currencyCode: price.currencyCode,
    });

  const monthly = monthlyPaymentFromPrice(amount);
  if (amount >= FINANCING_MIN_PRICE && monthly != null) {
    return (
      <p className="pdp-financing" aria-label="Financing options">
        <span>
          From <strong>${monthly}/mo</strong> · 0% APR for 24 months with Synchrony
        </span>
      </p>
    );
  }

  const splitFour = amount / 4;
  return (
    <p className="pdp-financing" aria-label="Financing options">
      <span>
        4 interest-free payments of <strong>{fmt(splitFour)}</strong> with Shop Pay
      </span>
    </p>
  );
}
