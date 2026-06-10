import { NextResponse } from 'next/server';
import { rateLimit, getClientIp, rateLimitResponse } from '@/lib/rate-limit';

export const runtime = 'edge';

/**
 * Newsletter signup endpoint.
 *
 * Behavior:
 *   - When SHOPIFY_ADMIN_TOKEN is set, creates the customer via the Admin
 *     API with email_marketing_consent.state = "subscribed". This is the
 *     correct way to add a marketing subscriber on Shopify per their
 *     2024+ guidelines (acceptsMarketing was deprecated).
 *   - When the token isn't set, accepts the email and logs it. The merchant
 *     can recover signups from Vercel logs and import to their ESP, or set
 *     the token to flip on automatic creation.
 *   - Idempotent: re-submitting an existing customer's email is treated
 *     as success (no duplicate-email error surfaced to the visitor).
 *
 * Returns 200 with { ok: true } on success, 400 on invalid email,
 * 200 with { ok: true, queued: true } when the token isn't configured.
 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  // Each accepted submission creates a Shopify customer record — throttle
  // so a spam loop can't flood the merchant's customer list. 5/min per IP
  // is generous for a human (signup is a one-shot action).
  const limit = rateLimit('newsletter', getClientIp(request), 5, 60_000);
  if (limit.limited) return rateLimitResponse(limit.retryAfterSeconds);

  let email: string | null = null;
  try {
    const ct = request.headers.get('content-type') ?? '';
    if (ct.includes('application/json')) {
      const body = (await request.json()) as { email?: unknown };
      email = typeof body.email === 'string' ? body.email.trim() : null;
    } else {
      const fd = await request.formData();
      const v = fd.get('email');
      email = typeof v === 'string' ? v.trim() : null;
    }
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 });
  }

  if (!email || !EMAIL_RE.test(email) || email.length > 254) {
    return NextResponse.json({ ok: false, error: 'invalid_email' }, { status: 400 });
  }

  const adminToken = process.env.SHOPIFY_ADMIN_TOKEN;
  const storeDomain = process.env.SHOPIFY_STORE_DOMAIN;

  if (!adminToken || !storeDomain) {
    // Capture in non-prod logs only. Logging customer emails to prod
    // log aggregators (Vercel logs are searchable, retained 30+ days)
    // is a privacy issue. Once we hit production traffic the merchant
    // must have either the admin token configured or an external ESP
    // wired up — relying on log scraping in prod is not a recovery
    // strategy. Phase 235.
    if (process.env.NODE_ENV !== 'production') {
      console.log('[newsletter] queued email (no admin token configured):', email);
    }
    return NextResponse.json({ ok: true, queued: true });
  }

  try {
    const apiVersion = process.env.SHOPIFY_API_VERSION ?? '2025-01';
    const res = await fetch(`https://${storeDomain}/admin/api/${apiVersion}/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': adminToken,
      },
      body: JSON.stringify({
        query: `mutation Subscribe($input: CustomerInput!) {
          customerCreate(input: $input) {
            customer { id }
            userErrors { field message }
          }
        }`,
        variables: {
          input: {
            email,
            tags: ['newsletter', 'storefront-signup'],
            emailMarketingConsent: {
              marketingState: 'SUBSCRIBED',
              marketingOptInLevel: 'SINGLE_OPT_IN',
            },
          },
        },
      }),
    });
    const data = (await res.json()) as {
      data?: { customerCreate?: { userErrors?: { field?: string[]; message: string }[] } };
    };
    const errors = data.data?.customerCreate?.userErrors ?? [];
    // "Email has already been taken" → already a customer; treat as success.
    const onlyDup = errors.length > 0 && errors.every((e) => /already been taken/i.test(e.message));
    if (errors.length > 0 && !onlyDup) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[newsletter] customerCreate errors:', errors);
      }
      return NextResponse.json({ ok: false, error: 'create_failed' }, { status: 502 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[newsletter] admin api failed:', err);
    }
    return NextResponse.json({ ok: false, error: 'admin_api_failed' }, { status: 502 });
  }
}
