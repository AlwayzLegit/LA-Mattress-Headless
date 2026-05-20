/**
 * Typed analytics taxonomy + dispatcher.
 *
 * Single source of truth for every custom event the storefront fires.
 * Currently routes to PostHog (and Sentry breadcrumbs for the
 * commercially-meaningful events so error reports include the journey
 * that led up to the failure).
 *
 * Why centralize:
 *   - Forces every callsite through a typed API → no event-name typos,
 *     no payload drift across pages.
 *   - One place to add new sinks later (Segment, GTM, etc.) without
 *     touching every callsite.
 *   - One place to gate per-environment sampling, PII scrubbing, etc.
 *
 * Usage example, from a server component is fine too — track() is a
 * no-op on the server (PostHog SDK is client-only) but typechecks the
 * payload. Prefer firing from server components when the data is
 * already there; fall back to client-side useEffect when not.
 *
 *   import { track } from '@/lib/analytics';
 *   track('plp_view', { handle: 'queen-size-mattresses', layout: 'v2' });
 *
 * The `track()` function is intentionally narrow — adding a new event
 * type means adding it to the AnalyticsEvent union below + handling
 * the new key in track(). That's the friction we want; events should
 * not multiply ad-hoc.
 */

import posthog from 'posthog-js';
import * as Sentry from '@sentry/nextjs';

/* ------------------------------------------------------------------------ *
 * Event taxonomy
 *
 * Order matters — events near the top are upper-funnel; events near
 * the bottom are revenue-bearing. Funnels in PostHog chain these in
 * order. Whenever an event name changes, update the dashboard chart
 * filters too (docs/design/observability-dashboard-spec.md).
 * ------------------------------------------------------------------------ */

export type AnalyticsEvent =
  | {
      // PLP impression — fires once per /collections/[handle] view.
      // Used by the v1 vs v2.1 layout-impact funnel in §8.1 of the
      // PLP RFC. Payload `layout` lets us split conversion by which
      // layout the visitor saw (post-cutover this is always 'v2').
      name: 'plp_view';
      props: {
        handle: string;
        title?: string;
        layout: 'v1' | 'v2';
        intro_source: 'metafield' | 'fallback';
        long_content_source: 'seo_content' | 'description_html' | 'none';
        product_count?: number;
      };
    }
  | {
      // PDP impression — fires once per /products/[handle] view.
      // Source props let us attribute which PLP or other surface
      // referred the user (the search results, a blog article, etc.).
      name: 'pdp_view';
      props: {
        handle: string;
        title?: string;
        vendor?: string;
        product_type?: string;
        price?: number;
        currency?: string;
        in_stock?: boolean;
      };
    }
  | {
      // Search action — fires when the user submits a /search query.
      // Drives zero-result-rate insight + the most-searched terms list
      // for content gap analysis.
      name: 'search';
      props: {
        query: string;
        result_count: number;
      };
    }
  | {
      // Add-to-cart action. Fires from the cart-mutation client island.
      // Numeric value supports PostHog's revenue-attribution charts.
      name: 'add_to_cart';
      props: {
        product_handle: string;
        variant_id: string;
        product_title?: string;
        quantity: number;
        price: number;
        currency: string;
      };
    }
  | {
      // Cart view — user opened the cart drawer or navigated to /cart.
      // Distinct from add_to_cart so we can measure cart abandonment
      // (cart_view without checkout_started).
      name: 'cart_view';
      props: {
        item_count: number;
        cart_value: number;
        currency: string;
      };
    }
  | {
      // Checkout initiation — user clicked the "Checkout" CTA. Last
      // first-party event we control before handing off to Shopify's
      // hosted checkout. Combined with order_completed (driven from a
      // Shopify webhook → posthog-node), forms the full revenue funnel.
      name: 'checkout_started';
      props: {
        item_count: number;
        cart_value: number;
        currency: string;
      };
    }
  | {
      // Sleep-quiz interaction — fires when a quiz step is completed
      // OR a recommendation is shown. Used to measure quiz completion
      // rate + the conversion lift of quiz users vs non-quiz visitors.
      name: 'quiz_step';
      props: {
        step: number;
        choice?: string;
        is_final?: boolean;
        recommended_handle?: string;
      };
    };

/* ------------------------------------------------------------------------ *
 * track() — the single dispatcher
 * ------------------------------------------------------------------------ */

/**
 * Fire an analytics event. No-op on the server (PostHog SDK is
 * client-only) and when the SDK isn't initialized. Always safe to call.
 *
 * Sentry breadcrumbs are added for the commercially-meaningful events
 * (add_to_cart, checkout_started, order_completed) so any error report
 * captures the funnel position. Plain views (plp_view, pdp_view) skip
 * the breadcrumb because they'd flood the trail.
 */
export function track<E extends AnalyticsEvent>(name: E['name'], props: E['props']): void {
  if (typeof window === 'undefined') return;
  try {
    if (process.env.NEXT_PUBLIC_POSTHOG_KEY) {
      posthog.capture(name, props as Record<string, unknown>);
    }
  } catch {
    // Never let analytics break the page. Swallow silently.
  }

  // Sentry breadcrumbs for funnel-critical events (drop-off triage)
  if (name === 'add_to_cart' || name === 'checkout_started') {
    try {
      Sentry.addBreadcrumb({
        category: 'analytics',
        level: 'info',
        message: name,
        data: props as Record<string, unknown>,
      });
    } catch {
      // Sentry not initialized — fine.
    }
  }
}

/**
 * Associate the current PostHog distinct_id with a user identifier
 * (email, Shopify customer id, etc.). Call after a successful login;
 * use sparingly — `person_profiles: 'identified_only'` in the provider
 * means anonymous visitors don't create person rows, but identifying
 * them does.
 */
export function identify(distinctId: string, properties?: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;
  try {
    posthog.identify(distinctId, properties);
  } catch {
    /* silent */
  }
}

/**
 * Reset PostHog's identity (call on logout). Continues to track
 * subsequent activity under a fresh anonymous distinct_id.
 */
export function resetIdentity(): void {
  if (typeof window === 'undefined') return;
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;
  try {
    posthog.reset();
  } catch {
    /* silent */
  }
}
