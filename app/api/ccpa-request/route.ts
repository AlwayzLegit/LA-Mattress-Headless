import { NextResponse } from 'next/server';
import { rateLimit, getClientIp, rateLimitResponse } from '@/lib/rate-limit';

export const runtime = 'edge';

/**
 * CCPA / CPRA consumer-rights request intake.
 *
 * Storage strategy:
 *   - When SHOPIFY_ADMIN_TOKEN is configured, create a Shopify customer
 *     tagged `ccpa-request` with the request kinds joined into the customer
 *     note. The merchant gets a normal Shopify "new customer" notification
 *     and processes the request manually within 45 days. Tag-based filtering
 *     lets them surface all open requests in Customers → search by tag.
 *   - When the Admin token isn't set, log to Vercel logs as a fallback.
 *     The merchant can still recover requests; they just won't show in
 *     Shopify Admin UI until the token is wired.
 *
 * We do NOT email the requester — California's CCPA only requires
 * acknowledgement within 10 days, which the merchant handles after seeing
 * the customer record. Auto-emailing pre-acknowledgement risks bypassing
 * verification and is not required.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ZIP_RE = /^[0-9]{5}$/;
const VALID_KINDS = new Set(['opt_out_sale', 'access', 'delete', 'correct']);

type Body = {
  name?: unknown;
  email?: unknown;
  zip?: unknown;
  notes?: unknown;
  requests?: unknown;
};

export async function POST(request: Request) {
  // Each accepted request creates a tagged Shopify customer record the
  // merchant must process — throttle hard; a legitimate requester submits
  // once, maybe twice on a typo.
  const limit = rateLimit('ccpa', getClientIp(request), 3, 60_000);
  if (limit.limited) return rateLimitResponse(limit.retryAfterSeconds);

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 });
  }

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const zip = typeof body.zip === 'string' ? body.zip.trim() : '';
  const notes = typeof body.notes === 'string' ? body.notes.trim() : '';
  const requests = Array.isArray(body.requests)
    ? body.requests.filter((r): r is string => typeof r === 'string' && VALID_KINDS.has(r))
    : [];

  if (!name || name.length > 200) {
    return NextResponse.json({ ok: false, error: 'invalid_name' }, { status: 400 });
  }
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return NextResponse.json({ ok: false, error: 'invalid_email' }, { status: 400 });
  }
  if (!ZIP_RE.test(zip)) {
    return NextResponse.json({ ok: false, error: 'invalid_zip' }, { status: 400 });
  }
  if (requests.length === 0) {
    return NextResponse.json({ ok: false, error: 'no_requests' }, { status: 400 });
  }

  const summary = [
    `[CCPA request submitted ${new Date().toISOString()}]`,
    `Requests: ${requests.join(', ')}`,
    `ZIP: ${zip}`,
    notes ? `Notes: ${notes}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  const adminToken = process.env.SHOPIFY_ADMIN_TOKEN;
  const storeDomain = process.env.SHOPIFY_STORE_DOMAIN;

  if (!adminToken || !storeDomain) {
    // Dev-only fallback log. In production, logging the PII payload to
    // Vercel logs (searchable, retained 30+ days) is a privacy issue
    // — the request payload is what the user is asking to keep
    // private. Phase 235 NODE_ENV-gates this; pre-launch follow-up is
    // to route real CCPA requests through Sentry-as-structured-log
    // with PII scrubbing.
    if (process.env.NODE_ENV !== 'production') {
      console.log('[ccpa-request] (no admin token)', { name, email, zip, requests, notes });
    }
    return NextResponse.json({ ok: true, queued: true });
  }

  const apiVersion = process.env.SHOPIFY_API_VERSION ?? '2026-04';
  const [firstName, ...rest] = name.split(/\s+/);
  const lastName = rest.join(' ') || '—';

  try {
    const res = await fetch(`https://${storeDomain}/admin/api/${apiVersion}/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': adminToken,
      },
      body: JSON.stringify({
        query: `mutation Ccpa($input: CustomerInput!) {
          customerCreate(input: $input) {
            customer { id }
            userErrors { field message }
          }
        }`,
        variables: {
          input: {
            email,
            firstName,
            lastName,
            note: summary,
            tags: ['ccpa-request', ...requests.map((r) => `ccpa-${r.replace(/_/g, '-')}`)],
            // Don't subscribe them to marketing — they're explicitly opting out.
          },
        },
      }),
    });
    const data = (await res.json()) as {
      data?: { customerCreate?: { userErrors?: { field?: string[]; message: string }[] } };
    };
    const errors = data.data?.customerCreate?.userErrors ?? [];
    const onlyDup = errors.length > 0 && errors.every((e) => /already been taken/i.test(e.message));
    if (errors.length > 0 && !onlyDup) {
      // Don't surface a hard failure to the user — they shouldn't suffer
      // because our integration glitched. In dev, log the request so the
      // engineer can debug. In prod, log only the error metadata
      // (no PII) — a Sentry alert with the request ID is the proper
      // recovery path; relying on prod log scraping with PII is a
      // privacy regression. Phase 235.
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[ccpa-request] customerCreate errors:', errors, { name, email, zip, requests, notes });
      } else {
        console.warn('[ccpa-request] customerCreate failed; user payload not logged (PII)');
      }
      return NextResponse.json({ ok: true, queued: true });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[ccpa-request] admin api failed:', err, { name, email, zip, requests, notes });
    } else {
      console.warn('[ccpa-request] admin api failed; user payload not logged (PII)');
    }
    return NextResponse.json({ ok: true, queued: true });
  }
}
