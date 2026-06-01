import { NextResponse } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';
import type { JudgemeReview } from '@/lib/judgeme';

// TEMPORARY pool-composition diagnostic for #11. Reports how many of the
// fetched reviews carry a real name vs literal "Anonymous", split by rating
// floor, so we can tell whether named reviews exist to surface at all.
// Reviewer names are already public on the storefront. Removed after read.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const TEMP_KEY = 'flush-2Uq2o-20260601';
const BASE = 'https://judge.me/api/v1';

export async function GET(req: Request) {
  if (new URL(req.url).searchParams.get('key') !== TEMP_KEY) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const { reviewerName, hasRealReviewerName } = await import('@/lib/judgeme');
  const url = new URL(`${BASE}/reviews`);
  url.searchParams.set('api_token', process.env.JUDGEME_API_TOKEN ?? '');
  url.searchParams.set('shop_domain', process.env.JUDGEME_SHOP_DOMAIN ?? '');
  url.searchParams.set('per_page', '100');
  url.searchParams.set('published', 'true');
  const res = await fetch(url.toString(), { cache: 'no-store' });
  const data = await res.json().catch(() => ({}));
  const reviews: JudgemeReview[] = (data.reviews ?? []);
  const byRating: Record<string, number> = {};
  for (const r of reviews) byRating[r.rating] = (byRating[r.rating] ?? 0) + 1;
  const named = reviews.filter((r) => hasRealReviewerName(r));
  const named4plus = named.filter((r) => (r.rating ?? 0) >= 4);
  // With correct code now deployed, force the stale ISR prerenders to
  // regenerate so the named reviews actually surface on the live pages.
  for (const t of ['judgeme:reviews-v3', 'judgeme:reviews-v4', 'judgeme:aggregate', 'judgeme:aggregate-v2']) revalidateTag(t);
  revalidatePath('/pages/[handle]', 'page');
  revalidatePath('/pages/reviews', 'page');
  revalidatePath('/', 'page');
  return NextResponse.json({
    ok: true, status: res.status, revalidated: true,
    totalFetched: reviews.length,
    countByRating: byRating,
    namedTotal: named.length,
    named4plus: named4plus.length,
    sampleNamed: named.slice(0, 12).map((r) => ({ name: reviewerName(r), rating: r.rating })),
  }, { headers: { 'cache-control': 'no-store' } });
}
