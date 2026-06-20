'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import {
  AnalyticsEventName,
  AnalyticsPageType,
  ShopifySalesChannel,
  getClientBrowserParameters,
  sendShopifyAnalytics,
  useShopifyCookies,
} from '@shopify/hydrogen-react';
import type { ShopifyAnalyticsProduct } from '@shopify/hydrogen-react';

/**
 * Shopify-native storefront analytics for the headless build.
 *
 * Why this exists: Shopify Admin's "Online store sessions" reports
 * (Sessions over time / by traffic source / by landing page, Online store
 * conversion rate, Live View) are fed by the trekkie / ShopifyAnalytics
 * beacon that the Liquid Online Store injects into every themed page. A
 * headless storefront is served by Next.js — that beacon never loads, so
 * Shopify records zero sessions (orders still show because checkout stays
 * on Shopify). This component re-emits the storefront page-view event to
 * Shopify's analytics service so those Admin reports populate again.
 *
 * How: hydrogen-react's framework-agnostic helpers —
 *   - useShopifyCookies(): maintains the `_shopify_y` (visitor) and
 *     `_shopify_s` (session) cookies Shopify keys analytics on.
 *   - getClientBrowserParameters(): reads url/referrer/title + those
 *     cookie tokens (must run inside an effect/handler).
 *   - sendShopifyAnalytics(): POSTs the PAGE_VIEW event to Shopify's
 *     monorail endpoint with our shopId.
 *
 * Scope: PAGE_VIEW only — that is what drives sessions and the
 * acquisition/landing/conversion reports. Product / collection / cart
 * events can be layered on later by calling sendShopifyAnalytics() from
 * the existing PostHog event call sites (lib/analytics.ts) where the
 * resource ids are already in hand.
 *
 * Gating:
 *   - Real storefront only. Never fires from Vercel preview deploys
 *     (*.vercel.app) or localhost, so Shopify's session data isn't
 *     polluted with non-customer traffic. The production storefront is
 *     served on BOTH the apex (mattressstoreslosangeles.com) and www
 *     hosts, so we allow any non-preview/non-local host rather than a
 *     single literal — otherwise apex visitors are silently dropped.
 *   - Skips /admin/* — same rationale as the other analytics components
 *     (internal staff traffic shouldn't land in the storefront funnel).
 *
 * Consent: hasUserConsent is true — this is a US/CCPA store and the prior
 * Liquid theme tracked all visitors, so this restores parity. If EU
 * traffic / a consent banner is added later, wire hasUserConsent to the
 * real consent state (Shopify drops the event when it is false).
 */

// gid://shopify/Shop/6841759 — public, stable shop identifier.
const SHOP_ID = 'gid://shopify/Shop/6841759';
const CURRENCY = 'USD';

/** True for Vercel preview deploys and local dev — the only hosts we must
 * NOT emit from. Any other host is a real production storefront domain
 * (apex or www), so the beacon fires there. Keeping this an exclusion list
 * (rather than a single allowed host) means apex visitors aren't dropped
 * and future domain changes don't silently break tracking. */
function isPreviewOrLocalHost(host: string): boolean {
  return host.endsWith('.vercel.app') || host === 'localhost' || host === '127.0.0.1';
}

/** Maps a storefront path to the Shopify analytics page type so the Admin
 * reports can break sessions down by page kind. Unknown routes fall back
 * to `page`. */
function pageTypeFor(pathname: string): string {
  if (pathname === '/') return AnalyticsPageType.home;
  if (pathname === '/collections') return AnalyticsPageType.listCollections;
  if (pathname.startsWith('/products/')) return AnalyticsPageType.product;
  if (pathname.startsWith('/collections/')) return AnalyticsPageType.collection;
  if (pathname.startsWith('/blogs/')) {
    // /blogs/<blog> is the blog index; /blogs/<blog>/<article> is an article.
    const segments = pathname.split('/').filter(Boolean);
    return segments.length >= 3 ? AnalyticsPageType.article : AnalyticsPageType.blog;
  }
  if (pathname.startsWith('/pages/')) return AnalyticsPageType.page;
  if (pathname.startsWith('/search')) return AnalyticsPageType.search;
  if (pathname.startsWith('/cart')) return AnalyticsPageType.cart;
  return AnalyticsPageType.page;
}

/**
 * Mounts once in the storefront layout. Renders nothing — pure
 * side-effect component that fires a Shopify PAGE_VIEW on every route
 * change (production storefront only).
 */
export function AnalyticsShopify() {
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith('/admin') ?? false;

  // Keep the _shopify_y / _shopify_s cookies fresh. Called unconditionally
  // (hook rules); harmless on preview/admin since no event is sent there.
  useShopifyCookies({ hasUserConsent: true });

  useEffect(() => {
    if (isAdmin) return;
    if (typeof window === 'undefined' || isPreviewOrLocalHost(window.location.hostname)) return;

    sendShopifyAnalytics({
      eventName: AnalyticsEventName.PAGE_VIEW,
      payload: {
        ...getClientBrowserParameters(),
        hasUserConsent: true,
        shopifySalesChannel: ShopifySalesChannel.headless,
        shopId: SHOP_ID,
        currency: CURRENCY,
        pageType: pageTypeFor(pathname ?? '/'),
      },
    });
  }, [pathname, isAdmin]);

  return null;
}

/**
 * Imperative companion to the PAGE_VIEW beacon: re-emits Shopify's
 * ADD_TO_CART analytics event from the headless storefront.
 *
 * Why: the PAGE_VIEW beacon restores Shopify Admin's "Online store
 * sessions" reports (sessions, traffic sources, landing pages — the
 * denominator of the conversion funnel). But Admin's "Online store
 * conversion rate" funnel also breaks out an "Added to cart" stage, which
 * is fed by a separate trekkie event the Liquid theme used to fire. On a
 * headless build that event never loads, so the "Added to cart" stage
 * reads zero even when sessions populate. Firing it here closes that gap.
 *
 * Called from the cart context's successful-add path (where the post-add
 * cart line already carries the product/variant ids, price and the cart
 * gid Shopify keys this event on), NOT from a route effect — so it guards
 * the window/host checks itself rather than relying on the component's
 * render gate. Same preview/local exclusion as the page-view beacon so we
 * don't pollute Shopify's funnel with non-customer traffic.
 *
 * Safe to call unconditionally: bails silently on the server, on
 * preview/local hosts, and on any SDK error (never blocks the add-to-cart
 * UX).
 */
export function sendShopifyAddToCart(input: {
  /** Cart gid: `gid://shopify/Cart/<id>`. */
  cartId: string;
  /** Value of the line(s) added (price × quantity). */
  totalValue: number;
  product: ShopifyAnalyticsProduct;
}): void {
  if (typeof window === 'undefined' || isPreviewOrLocalHost(window.location.hostname)) return;
  try {
    sendShopifyAnalytics({
      eventName: AnalyticsEventName.ADD_TO_CART,
      payload: {
        ...getClientBrowserParameters(),
        hasUserConsent: true,
        shopifySalesChannel: ShopifySalesChannel.headless,
        shopId: SHOP_ID,
        currency: CURRENCY,
        cartId: input.cartId,
        totalValue: input.totalValue,
        products: [input.product],
      },
    });
  } catch {
    // Analytics must never break the cart. Swallow silently.
  }
}
