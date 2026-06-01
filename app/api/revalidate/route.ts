/**
 * Shopify webhook receiver — triggers on-demand ISR revalidation.
 *
 * Pairs with the `next: { revalidate: 600, tags: [...] }` calls in
 * lib/shopify/queries/*. When Shopify fires a webhook (e.g. products/update),
 * we look up the affected handle and call revalidateTag(`product:${handle}`),
 * which expires the Next.js route cache for any page that fetched with that
 * tag — without waiting for the 10-minute TTL.
 *
 * Setup (one-time):
 *   1. Generate a webhook secret. Anything random; keep it long.
 *   2. Add `SHOPIFY_WEBHOOK_SECRET=<that secret>` to Vercel project env vars.
 *   3. In Shopify Admin → Settings → Notifications → Webhooks, register
 *      these topics, all pointing to https://YOURDOMAIN/api/revalidate :
 *        products/create, products/update, products/delete
 *        collections/create, collections/update, collections/delete
 *        articles/create, articles/update, articles/delete
 *        pages/update
 *        metaobjects/create, metaobjects/update, metaobjects/delete  (Phase 269)
 *        shop/update                                                 (Phase 269)
 *      Use Format: JSON, API version 2024-10, and paste the same secret.
 *
 * The Shopify Admin UI auto-includes an `X-Shopify-Hmac-Sha256` header on every
 * webhook; we verify it before doing anything.
 *
 * Phase 269 added the metaobject + shop topics so Phase 266 (announcement
 * bar), Phase 267 (hero slides), and Phase 268 (shop.brand) cache tags
 * (`metaobject:announcement_bar`, `metaobject:hero_slide`, `shop:brand`)
 * busting on merchant edits instead of waiting for the 5-min / 1-hour
 * revalidate window.
 */
import { revalidateTag, revalidatePath } from 'next/cache';
import crypto from 'node:crypto';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function timingSafeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

function verifyHmac(rawBody: string, hmacHeader: string | null, secret: string): boolean {
  if (!hmacHeader) return false;
  const computed = crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('base64');
  return timingSafeEqual(hmacHeader, computed);
}

function tagsFor(
  topic: string,
  payload: { handle?: string; type?: string; blog?: { handle?: string } },
): string[] {
  const handle = payload.handle;
  const blogHandle = payload.blog?.handle;
  switch (true) {
    case topic.startsWith('products/'):
      return handle ? [`product:${handle}`] : [];
    case topic.startsWith('collections/'):
      return handle ? [`collection:${handle}`] : [];
    case topic.startsWith('pages/'):
      return handle ? [`page:${handle}`] : [];
    case topic.startsWith('articles/'):
      return handle && blogHandle ? [`article:${blogHandle}/${handle}`, `blog:${blogHandle}`] : [];
    case topic.startsWith('metaobjects/'):
      // Phase 269: Shopify metaobject CRUD. Payload's `type` field maps
      // to the cache tag pattern `metaobject:<type>` used by
      // lib/shopify/queries/announcement.ts and hero-slides.ts.
      return payload.type ? [`metaobject:${payload.type}`] : [];
    case topic === 'shop/update':
      // Phase 269: shop name / description / brand assets edited in
      // Settings → Store details. Phase 268's getShopBrand() tags
      // `shop:brand`, which feeds the layout metadata + Organization
      // JSON-LD logo.
      return ['shop:brand'];
    default:
      return [];
  }
}

export async function POST(req: Request) {
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ ok: false, error: 'webhook secret not configured' }, { status: 503 });
  }

  // Read the raw body once for HMAC; then parse JSON from the same string so
  // signature and parsed payload are guaranteed to match.
  const rawBody = await req.text();
  const hmac = req.headers.get('x-shopify-hmac-sha256');
  if (!verifyHmac(rawBody, hmac, secret)) {
    return NextResponse.json({ ok: false, error: 'invalid signature' }, { status: 401 });
  }

  const topic = req.headers.get('x-shopify-topic') ?? '';
  let payload: { handle?: string; type?: string; blog?: { handle?: string } } = {};
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid json' }, { status: 400 });
  }

  const tags = tagsFor(topic, payload);
  for (const tag of tags) revalidateTag(tag);

  // The homepage composes several sections from Shopify content — hero
  // slides / why-us / featured-guide / announcement metaobjects, the
  // shop brand, the brand strip + category tiles (derived from
  // collections), and the reviews rail. Its page-level ISR is hourly, but
  // bust it immediately when any of those upstreams change so edits show
  // right away instead of waiting out the window.
  const homepageTopics =
    topic.startsWith('collections/') ||
    topic.startsWith('metaobjects/') ||
    topic.startsWith('products/') ||
    topic === 'shop/update';
  if (homepageTopics) revalidatePath('/');

  // Sitemap is generated from inventory.json, which webhooks don't refresh.
  // The data layer expires when its tag is busted; the sitemap stays stale
  // until the next pull-articles-via-storefront.mjs run. Still, revalidate
  // /sitemap.xml so any structural changes (e.g. a removed product) at least
  // re-emit promptly when handles flow back through.
  revalidatePath('/sitemap.xml');

  return NextResponse.json({ ok: true, topic, revalidated: tags });
}

export function GET() {
  return NextResponse.json({ ok: true, route: '/api/revalidate', method: 'POST' });
}
