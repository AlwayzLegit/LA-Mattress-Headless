/**
 * Shopify webhook handler for the `orders/paid` topic. Forwards an
 * `order_completed` event to PostHog, closing the revenue funnel that
 * the client-side events (plp_view → pdp_view → add_to_cart →
 * cart_view → checkout_started) opened.
 *
 * Security: HMAC-SHA256 signature verification using the shared secret
 * Shopify gives you when you register the webhook
 * (Shopify Admin → Settings → Notifications → Webhooks). Without that
 * env var set, every request is rejected with 401 — even from Shopify.
 *
 * Idempotency: Shopify retries failed webhooks with exponential backoff
 * for up to ~24h. We pass the `x-shopify-webhook-id` header as PostHog's
 * `$insert_id` property — PostHog dedupes on it, so a retried delivery
 * produces a single `order_completed` event.
 *
 * Runtime: explicitly `nodejs` (not edge) because the HMAC verification
 * uses node:crypto and posthog-node ships node-only APIs.
 *
 * Required Vercel env vars:
 *   SHOPIFY_WEBHOOK_SECRET    — the per-webhook shared secret Shopify
 *                               displays on webhook creation. Required.
 *   POSTHOG_PROJECT_API_KEY   — same as NEXT_PUBLIC_POSTHOG_KEY. Falls
 *                               back to the public key if unset.
 *   POSTHOG_HOST              — defaults to https://us.i.posthog.com.
 *
 * Webhook configuration (one-time, post-merge):
 *   Shopify Admin → Settings → Notifications → Webhooks → Create webhook
 *     Event:    Order payment (orders/paid)
 *     Format:   JSON
 *     URL:      https://www.mattressstoreslosangeles.com/api/webhooks/shopify/order-paid
 *     Version:  2024-10 (or current stable)
 *   Copy the displayed secret, set as SHOPIFY_WEBHOOK_SECRET in Vercel.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { PostHog } from 'posthog-node';
import { sendGa4Purchase } from '@/lib/ga4-server';

export const runtime = 'nodejs';
// Webhooks are POSTed live — never cache, always re-evaluate signatures.
export const dynamic = 'force-dynamic';

const WEBHOOK_SECRET = process.env.SHOPIFY_WEBHOOK_SECRET;
const POSTHOG_KEY = process.env.POSTHOG_PROJECT_API_KEY ?? process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST =
  process.env.POSTHOG_HOST ?? process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com';

let posthogClient: PostHog | null = null;
function getPostHog(): PostHog | null {
  if (posthogClient) return posthogClient;
  if (!POSTHOG_KEY) return null;
  posthogClient = new PostHog(POSTHOG_KEY, {
    host: POSTHOG_HOST,
    // Server-side events fire from a serverless function with a finite
    // lifetime — flush quickly so the event lands before the function
    // tears down. flushAt:1 means every capture immediately enqueues a
    // network request; shutdown() at the end waits for completion.
    flushAt: 1,
    flushInterval: 0,
  });
  return posthogClient;
}

function verifyHmac(rawBody: string, hmacHeader: string | null): boolean {
  if (!WEBHOOK_SECRET || !hmacHeader) return false;
  const computed = createHmac('sha256', WEBHOOK_SECRET).update(rawBody, 'utf8').digest('base64');
  const a = Buffer.from(computed);
  const b = Buffer.from(hmacHeader);
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

type ShopifyLineItem = {
  product_id?: number;
  variant_id?: number;
  title?: string;
  quantity?: number;
  price?: string;
  sku?: string;
};

type ShopifyOrderPaid = {
  id: number;
  order_number?: number;
  total_price?: string;
  currency?: string;
  customer?: {
    id?: number;
    email?: string;
    first_name?: string;
    last_name?: string;
    orders_count?: number;
  } | null;
  line_items?: ShopifyLineItem[];
  discount_codes?: { code: string; amount: string }[];
  source_name?: string;
  referring_site?: string;
  landing_site?: string;
};

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const hmacHeader = req.headers.get('x-shopify-hmac-sha256');

  if (!verifyHmac(rawBody, hmacHeader)) {
    // Always 401 on signature mismatch — never reveal whether the
    // secret was set or the signature was simply wrong.
    return NextResponse.json({ error: 'invalid signature' }, { status: 401 });
  }

  const topic = req.headers.get('x-shopify-topic');
  if (topic !== 'orders/paid') {
    return NextResponse.json({ error: 'unsupported topic' }, { status: 400 });
  }

  let order: ShopifyOrderPaid;
  try {
    order = JSON.parse(rawBody) as ShopifyOrderPaid;
  } catch {
    return NextResponse.json({ error: 'malformed json' }, { status: 400 });
  }

  const client = getPostHog();
  if (!client) {
    // Verified Shopify webhook but PostHog isn't configured — accept
    // (200) so Shopify doesn't retry, but no event is dispatched.
    return NextResponse.json({ ok: true, note: 'posthog not configured' });
  }

  const webhookId = req.headers.get('x-shopify-webhook-id');
  const customer = order.customer ?? null;
  // Use the Shopify customer ID when available so a returning customer's
  // events stitch under one PostHog person. Otherwise fall back to an
  // order-scoped identifier (still ties cart + order events for guest
  // checkouts, just not across multiple guest orders).
  const distinctId = customer?.id ? `shopify:customer:${customer.id}` : `shopify:order:${order.id}`;

  // identify() the customer so PostHog person profiles carry email,
  // name, repeat-purchase status — useful for cohort retention charts.
  // Customers with `orders_count > 1` are returning buyers.
  if (customer?.email) {
    client.identify({
      distinctId,
      properties: {
        email: customer.email,
        first_name: customer.first_name,
        last_name: customer.last_name,
        orders_count: customer.orders_count,
      },
    });
  }

  client.capture({
    distinctId,
    event: 'order_completed',
    properties: {
      // PostHog dedupe key — survives Shopify webhook retries.
      $insert_id: webhookId ?? `shopify:order:${order.id}`,
      order_id: String(order.id),
      order_number: order.order_number,
      value: Number.parseFloat(order.total_price ?? '0') || 0,
      currency: order.currency,
      item_count: order.line_items?.length ?? 0,
      items: (order.line_items ?? []).map((li) => ({
        product_id: li.product_id,
        variant_id: li.variant_id,
        sku: li.sku,
        title: li.title,
        quantity: li.quantity,
        price: Number.parseFloat(li.price ?? '0') || 0,
      })),
      discount_codes: (order.discount_codes ?? []).map((d) => d.code),
      // First-time buyer flag — PostHog cohort split for repeat vs new.
      first_purchase: !customer?.orders_count || customer.orders_count === 1,
      source_name: order.source_name,
      referring_site: order.referring_site,
      landing_site: order.landing_site,
    },
  });

  // Wait for the HTTP POST to PostHog to complete before the serverless
  // function returns — otherwise the function may tear down with the
  // request still in flight.
  await client.shutdown();
  // Allow a fresh client on the next invocation (serverless functions
  // sometimes reuse the module between requests).
  posthogClient = null;

  // Mirror to GA4 via Measurement Protocol — needed because Shopify's
  // hosted checkout means the client-side `purchase` gtag event never
  // fires from our domain. Without this server-side mirror, GA4's
  // revenue + items-purchased reports stay empty and Shopping Ads /
  // Performance Max attribution breaks. No-op when GA4 env vars unset.
  await sendGa4Purchase({
    clientId: distinctId,
    transactionId: String(order.id),
    value: Number.parseFloat(order.total_price ?? '0') || 0,
    currency: order.currency,
    couponCodes: (order.discount_codes ?? []).map((d) => d.code),
    items: (order.line_items ?? []).map((li) => ({
      item_id: li.variant_id ? String(li.variant_id) : String(li.product_id ?? ''),
      item_name: li.title,
      item_variant: li.sku,
      price: Number.parseFloat(li.price ?? '0') || 0,
      quantity: li.quantity,
    })),
  });

  return NextResponse.json({ ok: true });
}

// Reject any non-POST traffic — webhooks are POST-only.
export async function GET() {
  return NextResponse.json({ error: 'method not allowed' }, { status: 405 });
}
