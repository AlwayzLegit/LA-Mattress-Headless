'use client';

import type { ReactNode } from 'react';
import { track } from '@/lib/analytics';

/**
 * Client-side wrapper around the /cart page's "Checkout" CTA. Fires
 * `checkout_started` on click before the browser navigates to Shopify's
 * hosted checkout URL — the last first-party event we control in the
 * funnel.
 *
 * Server component callers pass `checkoutUrl`, `itemCount`,
 * `cartValue`, `currency`. The children render the visible label.
 */
export function CheckoutLink({
  checkoutUrl,
  itemCount,
  cartValue,
  currency,
  className,
  style,
  children,
}: {
  checkoutUrl: string;
  itemCount: number;
  cartValue: number;
  currency: string;
  className?: string;
  style?: React.CSSProperties;
  children: ReactNode;
}) {
  return (
    <a
      className={className}
      style={style}
      href={checkoutUrl}
      onClick={() => {
        track('checkout_started', {
          item_count: itemCount,
          cart_value: cartValue,
          currency,
        });
      }}
    >
      {children}
    </a>
  );
}
