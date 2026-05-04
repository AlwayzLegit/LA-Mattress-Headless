import type { Money } from './shopify';

export function formatMoney({ amount, currencyCode }: Money): string {
  const num = Number.parseFloat(amount);
  if (!Number.isFinite(num)) return amount;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currencyCode,
    maximumFractionDigits: num % 1 === 0 ? 0 : 2,
  }).format(num);
}

export function formatPriceRange(min: Money, max: Money): string {
  if (min.amount === max.amount) return formatMoney(min);
  return `${formatMoney(min)} – ${formatMoney(max)}`;
}
