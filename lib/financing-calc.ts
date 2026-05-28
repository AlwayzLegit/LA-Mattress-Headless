/**
 * 0% APR financing math for the PDP "From $X/mo" callout.
 *
 * Our standard Synchrony promo on premium mattresses ($1,500+) is 24
 * months at 0% APR. Acima's lease-to-own runs longer terms (36–48
 * months) but at a higher effective rate, so we anchor on Synchrony
 * for the per-month display — that's the cleanest comparison vs the
 * cash price and is what mattress shoppers see on Tempur-Pedic /
 * Saatva / Casper PDPs.
 *
 * For products under the $1,500 minimum threshold most lenders
 * require, return null so the callout doesn't render — saves the
 * shopper from believing they can finance a $200 pillow.
 */

export const FINANCING_DEFAULT_MONTHS = 24;
export const FINANCING_MIN_PRICE = 1500;

export function monthlyPaymentFromPrice(
  priceAmount: string | number,
  months: number = FINANCING_DEFAULT_MONTHS,
): number | null {
  const price = typeof priceAmount === 'string' ? Number.parseFloat(priceAmount) : priceAmount;
  if (!Number.isFinite(price) || price < FINANCING_MIN_PRICE) return null;
  if (months <= 0) return null;
  // 0% APR → flat division, no interest math. Round to nearest dollar
  // so the displayed number matches what the Synchrony portal quotes.
  return Math.round(price / months);
}

export function formatMonthlyPayment(price: string | number, months?: number): string | null {
  const monthly = monthlyPaymentFromPrice(price, months);
  if (monthly == null) return null;
  return `$${monthly}/mo`;
}
