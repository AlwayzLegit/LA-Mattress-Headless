/**
 * GA4 Measurement Protocol — server-side event forwarder.
 *
 * Mirrors revenue-bearing events (currently just `purchase`, from the
 * Shopify order-paid webhook) into GA4 from the server. Why:
 *
 *   - Shopify hosts its own checkout, so the client-side `purchase`
 *     gtag event our storefront would fire never gets to run — by the
 *     time the order completes, the browser is on Shopify's domain,
 *     not ours.
 *   - Without a server-side mirror, GA4's "Total revenue" / "Items
 *     purchased" reports stay at zero and downstream attribution
 *     (Google Ads ROAS, Shopping conversion value) breaks.
 *   - GA4's Measurement Protocol v2 is the documented mechanism for
 *     exactly this scenario. Free to use, no Google Cloud setup.
 *
 * Configuration:
 *   GA4_MEASUREMENT_ID         — same as NEXT_PUBLIC_GA_MEASUREMENT_ID
 *                                (kept on server so it works without
 *                                NEXT_PUBLIC prefix). Falls back to
 *                                NEXT_PUBLIC_GA_MEASUREMENT_ID when unset.
 *   GA4_MEASUREMENT_API_SECRET — created in GA4 Admin → Data Streams
 *                                → [stream] → Measurement Protocol API
 *                                secrets → Create. Required for server
 *                                events.
 *
 * When either env var is unset, this is a silent no-op so we don't
 * fail webhook ingestion just because GA4 isn't configured.
 */

const MEASUREMENT_ID =
  process.env.GA4_MEASUREMENT_ID ?? process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
const API_SECRET = process.env.GA4_MEASUREMENT_API_SECRET;

type Ga4Item = {
  item_id: string;
  item_name?: string;
  item_brand?: string;
  item_variant?: string;
  price?: number;
  quantity?: number;
};

type Ga4Event = {
  name: string;
  params: Record<string, unknown>;
};

/**
 * Send one or more GA4 events for a given client_id. Returns true if
 * the call completed (200 from Google or no-op when unconfigured) and
 * false if the request failed — but ALWAYS resolves; callers never
 * need to wrap in try/catch.
 *
 * `clientId` should be stable per user to consolidate the GA4 user
 * profile. For server-fired events from the order-paid webhook we use
 * `shopify:customer:<id>` (returning customers) or `shopify:order:<id>`
 * (guest checkouts) — same pattern as our PostHog distinct_id.
 */
export async function sendGa4Events(clientId: string, events: Ga4Event[]): Promise<boolean> {
  if (!MEASUREMENT_ID || !API_SECRET || events.length === 0) return true;

  const url = `https://www.google-analytics.com/mp/collect?measurement_id=${encodeURIComponent(
    MEASUREMENT_ID,
  )}&api_secret=${encodeURIComponent(API_SECRET)}`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        // non_personalized_ads:false lets Google Ads use this data for
        // remarketing + bidding optimization. Set to true if the merchant
        // ever decides to disable Ads personalization.
        non_personalized_ads: false,
        events,
      }),
    });
    // GA4 MP returns 204 No Content on success. Any 2xx is fine.
    return res.ok;
  } catch {
    // Never let analytics failures break a webhook. Swallow.
    return false;
  }
}

/**
 * Convenience wrapper for the `purchase` event. Builds the items array
 * from Shopify line items and fires it. Returns the underlying boolean.
 */
export async function sendGa4Purchase(args: {
  clientId: string;
  transactionId: string;
  value: number;
  currency?: string;
  couponCodes?: string[];
  items: Ga4Item[];
}): Promise<boolean> {
  const params: Record<string, unknown> = {
    transaction_id: args.transactionId,
    value: args.value,
    currency: args.currency ?? 'USD',
    items: args.items,
  };
  if (args.couponCodes && args.couponCodes.length > 0) {
    // GA4 expects a single coupon string at the event level; concatenate
    // multiple codes with " ; " for visibility in reports.
    params.coupon = args.couponCodes.join(' ; ');
  }
  return sendGa4Events(args.clientId, [{ name: 'purchase', params }]);
}
