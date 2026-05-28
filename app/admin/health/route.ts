import { NextResponse } from 'next/server';
import { getAdminHealth } from '@/lib/shopify/admin';

/**
 * Shopify Admin connection health probe.
 *
 * GET /admin/health → JSON
 *   { ok, status, cause, message, detail? }
 *
 * Gated by the same Basic Auth middleware that protects the rest of
 * /admin/* (see middleware.ts; /api/* is auth-excluded, /admin/* isn't,
 * so this route lives under /admin/ to inherit auth). Useful for:
 *
 *   - Eyeball-checking the token quickly: curl -u user:pass <site>/admin/health
 *   - Monitoring: an external uptime check can curl + assert ok=true.
 *   - Debugging the dashboard banner when it fires — the banner text
 *     already describes the most likely cause, but a precise HTTP
 *     status + Shopify body excerpt is one request away.
 *
 * Response codes:
 *   - 200 when ok=true (Shopify accepts the token + returns shop data)
 *   - 503 when ok=false (banner-worthy failure)
 *
 * The 503 lets external monitors page on it without parsing JSON.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  const health = await getAdminHealth();
  return NextResponse.json(health, {
    status: health.ok ? 200 : 503,
    headers: {
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}
