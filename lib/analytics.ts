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
      // Sleep-quiz interaction — fires on every answered question
      // (one per option-select). The funnel is:
      //   quiz_step(step=0) → quiz_step(step=1) … → quiz_completed.
      // `total_steps` is included so the funnel chart can compute the
      // drop-off rate per step without hard-coding the question count.
      name: 'quiz_step';
      props: {
        step: number;
        question_id: string;
        choice: string;
        total_steps: number;
      };
    }
  | {
      // Quiz-completion terminal event. Fired when the user reaches
      // the recommendation page — whether by answering every question
      // or by clicking Skip-to-Results. `completion_path` distinguishes
      // the two so the funnel can split "engaged completion" vs "skip".
      name: 'quiz_completed';
      props: {
        completion_path: 'answered_all' | 'skipped';
        answered_count: number;
        total_steps: number;
        recommended_type: string;
        recommended_handle: string;
        recommended_product_handle?: string;
      };
    }
  | {
      // Click on a recommendation from the quiz result page. `target`
      // distinguishes the primary CTA / product hero / alternate
      // collection links so we can measure which surface drives the
      // quiz-to-PDP conversion. Combined with `pdp_view` downstream
      // this closes the quiz-attribution funnel.
      name: 'quiz_recommendation_clicked';
      props: {
        target: 'primary_cta' | 'product_hero' | 'alternate' | 'showroom';
        recommended_type: string;
        destination_handle: string;
      };
    }
  | {
      // MCP chat widget opened. Fires when the shopper taps the
      // chat bubble. Pathname tells us which surface drove the open
      // so we can correlate chat engagement with the funnel stage
      // the shopper was in (PLP intent vs. PDP comparison vs. cart
      // doubt).
      name: 'chat_opened';
      props: {
        pathname: string;
      };
    }
  | {
      // MCP chat widget dismissed. `source` distinguishes deliberate
      // closure (close button) from incidental (backdrop tap, Escape
      // key, route change) so we can read whether the panel was
      // engaging enough vs. dismissed in error.
      name: 'chat_dismissed';
      props: {
        source: 'button' | 'backdrop' | 'escape' | 'route_change';
        pathname: string;
      };
    }
  | {
      // Click on a product card the MCP chat assistant surfaced inside
      // a message bubble. The chat counterpart of
      // quiz_recommendation_clicked: without it the admin dashboard can
      // count conversations but can't say whether the assistant's
      // recommendations get acted on.
      name: 'chat_product_clicked';
      props: {
        product_url: string;
        vendor?: string;
      };
    }
  | {
      // Newsletter (Klaviyo / Shopify customers list) signup success.
      // Fires from the inline newsletter-form post-/api/newsletter
      // 200 response. `source` distinguishes the placement so we can
      // measure footer vs popup vs cart-page lift independently.
      name: 'newsletter_signup';
      props: {
        source: 'footer' | 'popup' | 'cart' | 'unknown';
      };
    }
  | {
      // Judge.me review-widget interaction. `action` distinguishes
      // engagement levels: just opening the form, submitting a review,
      // or clicking through review pagination. Helps surface PDPs
      // with high review intent vs PDPs with engaged review readers.
      name: 'review_widget_interaction';
      props: {
        product_id: string;
        action: 'write_form_opened' | 'review_submitted' | 'pagination_clicked' | 'photo_opened';
      };
    }
  | {
      // Sale-page impression — fires once per /pages/<event>-sale-<year>
      // view. Lets us measure the lift each seasonal hero slide drives
      // into the corresponding sale page, vs. organic SEO landings.
      // `handle` is the page handle (e.g. `independence-day-sale-2026`);
      // `is_pre_launch` marks views during the 7-day pre-launch window
      // (page live but slide hidden — these come from direct links,
      // search, or email). `is_preview` marks merchant QA views via
      // draftMode so they can be excluded from production funnels.
      name: 'sale_page_view';
      props: {
        handle: string;
        sale_starts_at?: string;
        sale_ends_at?: string;
        is_pre_launch: boolean;
        is_post_sale: boolean;
        is_preview: boolean;
        featured_product_count: number;
      };
    }
  | {
      // CTA click on a sale page — the "Shop the Sale" / "Find a
      // showroom" / "Take the quiz" buttons in the hero + footer
      // sections. `cta` identifies which button; `position` separates
      // hero CTAs (top, above the fold) from footer CTAs (bottom,
      // after the scroll). Drives conversion-rate funnels per CTA.
      name: 'sale_page_cta_click';
      props: {
        handle: string;
        cta: 'shop_the_sale' | 'find_a_showroom' | 'sleep_quiz' | 'see_every_mattress';
        position: 'hero' | 'footer' | 'grid';
      };
    }
  | {
      // Server-side event — fires from app/api/webhooks/shopify/
      // order-paid via the Shopify orders/paid webhook → posthog-node.
      // Closes the revenue funnel (cart_view → checkout_started →
      // order_completed). Never fired client-side; the type lives
      // here so the taxonomy stays the single source of truth.
      name: 'order_completed';
      props: {
        order_id: string;
        order_number?: number;
        value: number;
        currency?: string;
        item_count: number;
        items?: Array<{
          product_id?: number;
          variant_id?: number;
          sku?: string;
          title?: string;
          quantity?: number;
          price: number;
        }>;
        discount_codes?: string[];
        first_purchase?: boolean;
        source_name?: string;
        referring_site?: string;
        landing_site?: string;
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

  // GA4 mirror for the funnel events. Lets Google Search Console
  // surface keyword-level attribution + populates GA4's "Ecommerce
  // purchases" / "Items purchased" reports that Shopping Ads &
  // Performance Max key off of. Schema follows Google's GA4 Enhanced
  // Ecommerce spec (developers.google.com/analytics/devguides/collection/ga4/ecommerce)
  // — event names + payload shape match what Google's reports expect,
  // so the user doesn't need custom dimensions.
  //
  // The AnalyticsGa4 component initializes window.gtag with
  // strategy="afterInteractive", but TrackPdpView's useEffect can run
  // BEFORE that init script — so window.gtag is sometimes undefined
  // when track() fires for the first page view. The fix is to push
  // events directly into window.dataLayer (Google's documented queueing
  // pattern); gtag.js processes any queued entries when it finally
  // loads. This is the same trick the official snippet uses.
  if (process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID) {
    try {
      const w = window as unknown as {
        dataLayer?: unknown[];
        gtag?: (...args: unknown[]) => void;
      };
      // Ensure dataLayer exists — gtag.js will pick this same array up
      // when it loads and replay any entries we queued before it ran.
      w.dataLayer = w.dataLayer || [];
      // Stub gtag if the init script hasn't replaced it yet. Matches
      // the shape of the official snippet:
      //   function gtag(){ dataLayer.push(arguments); }
      if (typeof w.gtag !== 'function') {
        w.gtag = function (...args: unknown[]) {
          (w.dataLayer as unknown[]).push(args);
        };
      }
      const ga = toGa4Event(name, props);
      if (ga) w.gtag('event', ga.event, ga.params);
    } catch {
      /* silent */
    }
  }

  // Sentry breadcrumbs for funnel-critical events (drop-off triage)
  if (
    name === 'add_to_cart' ||
    name === 'checkout_started' ||
    name === 'quiz_completed' ||
    name === 'quiz_recommendation_clicked'
  ) {
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

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

/**
 * Map our PostHog event taxonomy to GA4's standard ecommerce events.
 * Returns `null` for non-ecommerce events (quiz steps, newsletter signup,
 * review widget) — those don't have a canonical GA4 mirror and would
 * just pollute the Reports section.
 *
 * Items array follows GA4's structure: `item_id` (Shopify variant gid
 * truncated to the numeric tail), `item_name`, `price`, `quantity`.
 * Single-product events emit a 1-item array; cart/checkout events emit
 * the cart's item list when available. Purchase is mirrored server-side
 * from the order-paid webhook (lib/ga4-server.ts).
 */
function toGa4Event(
  name: AnalyticsEvent['name'],
  props: Record<string, unknown>,
): { event: string; params: Record<string, unknown> } | null {
  switch (name) {
    case 'plp_view':
      return {
        event: 'view_item_list',
        params: {
          item_list_id: props.handle,
          item_list_name: props.title ?? props.handle,
        },
      };
    case 'pdp_view':
      return {
        event: 'view_item',
        params: {
          currency: props.currency ?? 'USD',
          value: typeof props.price === 'number' ? props.price : undefined,
          items: [
            {
              item_id: props.handle,
              item_name: props.title ?? props.handle,
              item_brand: props.vendor,
              item_category: props.product_type,
              price: props.price,
              quantity: 1,
            },
          ],
        },
      };
    case 'add_to_cart':
      return {
        event: 'add_to_cart',
        params: {
          currency: props.currency,
          value: (props.price as number) * (props.quantity as number),
          items: [
            {
              item_id: props.product_handle,
              item_name: props.product_title ?? props.product_handle,
              item_variant: props.variant_id,
              price: props.price,
              quantity: props.quantity,
            },
          ],
        },
      };
    case 'cart_view':
      return {
        event: 'view_cart',
        params: { currency: props.currency, value: props.cart_value },
      };
    case 'checkout_started':
      return {
        event: 'begin_checkout',
        params: { currency: props.currency, value: props.cart_value },
      };
    case 'search':
      return { event: 'search', params: { search_term: props.query } };
    default:
      return null;
  }
}

/* ------------------------------------------------------------------------ *
 * Attribution super-properties
 *
 * registerAttribution() merges utm_*, gclid, fbclid, and the initial
 * document.referrer onto the PostHog super-properties so every event
 * (and the person row, when identified) carries acquisition source
 * without the call site having to thread it through. Called once at
 * provider init.
 *
 * Two flavors of properties are set:
 *   - `posthog.register(...)` — super-properties: merged onto EVERY
 *     subsequent event in this session. Use for session-scoped
 *     attribution (the utm on THIS session's landing URL).
 *   - `posthog.people.set_once(...)` — person-properties set the FIRST
 *     time only. Use for "what got this user here originally", which
 *     should never overwrite on a second visit.
 *
 * No-op when PostHog isn't loaded or when we're not in a browser.
 * ------------------------------------------------------------------------ */

const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const;
const CLICK_ID_KEYS = ['gclid', 'fbclid', 'msclkid', 'ttclid'] as const;

export function registerAttribution(): void {
  if (typeof window === 'undefined') return;
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;
  try {
    const sp = new URLSearchParams(window.location.search);
    const session: Record<string, string> = {};
    const initial: Record<string, string> = {};
    for (const k of UTM_KEYS) {
      const v = sp.get(k);
      if (v) {
        session[k] = v;
        initial[`initial_${k}`] = v;
      }
    }
    for (const k of CLICK_ID_KEYS) {
      const v = sp.get(k);
      if (v) {
        session[k] = v;
        initial[`initial_${k}`] = v;
      }
    }
    // Referrer host (full URL retained by PostHog's $initial_referrer
    // automatically — we add the host separately for easier filtering).
    const ref = document.referrer;
    if (ref) {
      try {
        const refHost = new URL(ref).hostname;
        // Don't count ourselves as a referrer (same-origin nav before
        // this provider mounted on a deep link).
        if (refHost && refHost !== window.location.hostname) {
          session.session_referrer_host = refHost;
          initial.initial_referrer_host = refHost;
          initial.initial_referrer_url = ref;
        }
      } catch {
        /* malformed referrer URL — skip */
      }
    }
    // Landing path (first URL pathname of the session). Useful for
    // "what entry pages drive the most signups" without joining
    // against the $pageview events table.
    initial.initial_landing_path = window.location.pathname;

    if (Object.keys(session).length > 0) {
      posthog.register(session);
    }
    if (Object.keys(initial).length > 0) {
      // set_once: only the FIRST session's values stick on the person
      // row. Subsequent visits update the session-scoped super-props
      // above but leave the initial attribution intact.
      posthog.people.set_once(initial);
    }
  } catch {
    /* silent — never let analytics break the page */
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
