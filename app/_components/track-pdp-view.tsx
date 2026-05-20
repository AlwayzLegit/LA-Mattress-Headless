'use client';

import { useEffect } from 'react';
import { track } from '@/lib/analytics';

/**
 * Fires a `pdp_view` event once on mount for the product page.
 *
 * Client component because the analytics SDK is browser-only. The
 * server PDP page passes in the props it already has (handle, title,
 * vendor, type, min price + currency, in-stock flag), so no extra
 * fetch.
 *
 * Powers the PLP → PDP funnel chart in PostHog (combined with the
 * `plp_view` event fired by TrackPlpView).
 */
export function TrackPdpView({
  handle,
  title,
  vendor,
  productType,
  price,
  currency,
  inStock,
}: {
  handle: string;
  title?: string;
  vendor?: string;
  productType?: string;
  price?: number;
  currency?: string;
  inStock?: boolean;
}) {
  useEffect(() => {
    track('pdp_view', {
      handle,
      title,
      vendor,
      product_type: productType,
      price,
      currency,
      in_stock: inStock,
    });
  }, [handle, title, vendor, productType, price, currency, inStock]);

  return null;
}
