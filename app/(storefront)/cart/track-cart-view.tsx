'use client';

import { useEffect } from 'react';
import { track } from '@/lib/analytics';

/**
 * Fires `cart_view` once on mount when /cart loads. Distinct from
 * add_to_cart so PostHog funnels can measure cart abandonment (visited
 * cart, didn't checkout).
 */
export function TrackCartView({
  itemCount,
  cartValue,
  currency,
}: {
  itemCount: number;
  cartValue: number;
  currency: string;
}) {
  useEffect(() => {
    track('cart_view', {
      item_count: itemCount,
      cart_value: cartValue,
      currency,
    });
  }, [itemCount, cartValue, currency]);

  return null;
}
