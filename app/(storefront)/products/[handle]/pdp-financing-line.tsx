'use client';

import { formatMoney } from '@/lib/format';
import type { Money } from '@/lib/shopify';

type Props = {
  /** Variant-specific price when a variant is matched, otherwise the
   * collection min price — same logic the price row uses, so the two stay
   * in sync as the user changes variants. */
  price: Money | null;
};

/**
 * "From $X/mo · Or 4 payments of $Y" line shown directly below the price.
 *
 * Why: the analytics dashboard showed a 94% drop from PDP view to
 * add-to-cart on a catalog where mattresses run $1K-$5K+. With no
 * financing/sticker-shock relief next to the price, shoppers freeze. This
 * line gives both Affirm (12-month) and Shop Pay Installments (4
 * interest-free) framing without loading any third-party widget script
 * (script-free is cheaper for LCP and removes a load-failure path).
 *
 * Math:
 *   - Affirm: typical promotional APR varies, but the "as low as $X/mo"
 *     framing is 12 monthly payments at 0% — common for $1500+
 *     mattress-financing offers. Conservative + truthful for our price
 *     bands; the real plan + APR is shown at Affirm checkout.
 *   - Shop Pay: their installments product is 4 interest-free payments
 *     when the order total is $50-$1499 (the 0% bi-weekly product).
 *     For totals above that, Shop Pay routes to Affirm-powered monthly
 *     plans, so we suppress the 4-pay line on >$1500 orders to avoid
 *     promising a payment plan that won't actually be 4 equal payments.
 *
 * Hidden when price is null or below the minimum financing threshold
 * ($50, the Shop Pay floor and Affirm typical floor).
 */
export function PdpFinancingLine({ price }: Props) {
  if (!price) return null;
  const amount = Number.parseFloat(price.amount);
  if (!Number.isFinite(amount) || amount < 50) return null;

  const monthly = amount / 12;
  // Shop Pay Installments 4-equal-pay product caps at $1,499.99 — above
  // that, the financing routes to monthly plans (no 4-pay framing).
  const fourPayEligible = amount <= 1499.99;
  const splitFour = amount / 4;

  const fmt = (n: number) =>
    formatMoney({
      amount: n.toFixed(2),
      currencyCode: price.currencyCode,
    });

  return (
    <p className="pdp-financing" aria-label="Financing options">
      <span>
        From <strong>{fmt(monthly)}/mo</strong> with Affirm
      </span>
      {fourPayEligible ? (
        <span className="pdp-financing-sep" aria-hidden="true">·</span>
      ) : null}
      {fourPayEligible ? (
        <span>
          Or 4 interest-free payments of <strong>{fmt(splitFour)}</strong> with Shop Pay
        </span>
      ) : null}
    </p>
  );
}
