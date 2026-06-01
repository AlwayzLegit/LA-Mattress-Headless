import { NextResponse } from 'next/server';
import { getStorefrontReviews } from '@/lib/judgeme';

// TEMPORARY diagnostic for #11 (reviewer "Anonymous"). Reports — without
// leaking any PII — what the runtime actually receives from Judge.me so we
// can tell whether the production env token returns reviewer names through
// the page's exact query. Remove after diagnosis.
export const dynamic = 'force-dynamic';

export async function GET() {
  const env = {
    vercelEnv: process.env.VERCEL_ENV ?? 'unknown',
    tokenSet: Boolean(process.env.JUDGEME_API_TOKEN),
    tokenLen: (process.env.JUDGEME_API_TOKEN ?? '').length,
    tokenLast4: (process.env.JUDGEME_API_TOKEN ?? '').slice(-4),
    shopDomain: process.env.JUDGEME_SHOP_DOMAIN ?? 'unset',
  };
  // Same call the /pages/reviews + homepage carousel make (dedupe off so we
  // see the raw API order). Report only name-presence booleans + the reviewer
  // object's KEYS — never the email/phone/ip values.
  const reviews = await getStorefrontReviews({ perPage: 5, minRating: 4, dedupe: false });
  const sample = reviews.map((r) => {
    const rv = (r.reviewer ?? {}) as Record<string, unknown>;
    return {
      reviewerKeys: Object.keys(rv),
      nameValuePresent: Boolean((rv.name as string)?.trim?.()),
      firstLastPresent: Boolean((rv.first_name as string) || (rv.last_name as string)),
      topReviewerNamePresent: Boolean((r as Record<string, unknown>).reviewer_name),
      rating: r.rating,
    };
  });
  return NextResponse.json({ env, count: reviews.length, sample }, {
    headers: { 'cache-control': 'no-store' },
  });
}
