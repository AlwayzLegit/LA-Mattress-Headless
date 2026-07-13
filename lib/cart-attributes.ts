// Shared cart-attribute keys. Kept in a plain module (NOT the
// 'use server' action file, which may only export async functions)
// so both the server action and the cart page can import it.
//
// Surfaces on the Shopify order as a note attribute, visible to the
// fulfilment team in Admin → Orders. Keep the key human-readable.
export const DELIVERY_DATE_KEY = 'Requested delivery date';

// PostHog browser distinct_id, stamped on the cart so the order-paid
// webhook can attribute `order_completed` to the shopper's browser
// person instead of a disconnected `shopify:customer:<id>` (which made
// every funnel/attribution panel on /admin read zero). The leading
// underscore is Shopify's convention for note attributes hidden from
// the customer-facing checkout and order-status pages — staff still see
// it in Admin and webhooks receive it.
export const POSTHOG_DISTINCT_ID_KEY = '_posthog_distinct_id';
