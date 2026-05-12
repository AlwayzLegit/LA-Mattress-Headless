import { NextResponse } from 'next/server';
import { createReview } from '@/lib/judgeme';

/**
 * POST /api/reviews — accept a Write-a-Review form submission and forward
 * to Judge.me's public reviews API. Keeps the JUDGEME_API_TOKEN secret on
 * the server (the client never sees it). Phase 238.
 *
 * Expects JSON body: { productId, rating, body, title?, name, email, hp? }
 *
 * `hp` is a honeypot field. Real users leave it empty; bots fill it. If
 * non-empty, we silently return success without forwarding to Judge.me —
 * spam absorbed.
 *
 * Reviews land in Judge.me's moderation queue by default. The merchant
 * approves them in Judge.me Admin before they appear on the storefront.
 * Success response message reflects this so users know to wait.
 */

const MAX_BODY = 2000;
const MAX_TITLE = 120;
const MAX_NAME = 80;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  // Honeypot — silently swallow bot submissions.
  if (typeof body.hp === 'string' && body.hp.trim().length > 0) {
    return NextResponse.json({ ok: true, queued: true });
  }

  const productId = typeof body.productId === 'string' ? body.productId : null;
  const rating = typeof body.rating === 'number' ? body.rating : Number.parseInt(String(body.rating), 10);
  const reviewBody = typeof body.body === 'string' ? body.body.trim() : '';
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';

  // Validation. Return 400 with a stable error code so the client can map
  // to a field-level message; never echo the user's payload back.
  if (!productId) return NextResponse.json({ ok: false, error: 'missing_product' }, { status: 400 });
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ ok: false, error: 'invalid_rating' }, { status: 400 });
  }
  if (reviewBody.length < 10 || reviewBody.length > MAX_BODY) {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 });
  }
  if (title.length > MAX_TITLE) {
    return NextResponse.json({ ok: false, error: 'invalid_title' }, { status: 400 });
  }
  if (name.length < 1 || name.length > MAX_NAME) {
    return NextResponse.json({ ok: false, error: 'invalid_name' }, { status: 400 });
  }
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ ok: false, error: 'invalid_email' }, { status: 400 });
  }

  const ipAddr =
    req.headers.get('x-real-ip') ??
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    undefined;

  const result = await createReview({
    productExternalId: productId,
    rating,
    body: reviewBody,
    title: title || undefined,
    name,
    email,
    ipAddr,
  });

  if (!result.ok) {
    // Don't surface upstream-failure details to the user. They get a soft
    // success-ish message + we silently keep the request for the merchant
    // to recover via Sentry/log aggregation (Phase 235c).
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[api/reviews] createReview failed:', result.error);
    }
    return NextResponse.json({ ok: false, error: 'submit_failed' }, { status: 502 });
  }

  return NextResponse.json({ ok: true, queued: true });
}
