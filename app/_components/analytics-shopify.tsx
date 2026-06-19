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
 *   - Production host only. Never fires from Vercel preview deploys or
 *     localhost, so Shopify's session data isn't polluted with
 *     non-customer traffic. (The PostHog/GA4 components gate on env vars;
 *     a host check is the equivalent here and needs no new env var.)
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

// Hardcoded production storefront host: guarantees events only ever fire
// from real customer traffic regardless of how NEXT_PUBLIC_* envs are set
// per Vercel environment. (Apex redirects to www, so www is the only host
// customers land on.)
const PROD_HOST = 'www.mattressstoreslosangeles.com';

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
    if (typeof window === 'undefined' || window.location.hostname !== PROD_HOST) return;

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
