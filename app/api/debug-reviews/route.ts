import { revalidateTag, revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';

// TEMPORARY one-shot cache flush for #11. The reviewer-name fix + correct
// JUDGEME_API_TOKEN are confirmed live (the prod runtime fetch returns
// reviewer.name), but the full-route ISR cache for the review-bearing pages
// was rendered BEFORE the token swap and persists across deploys, so it
// still serves "Anonymous". Bumping the fetch tag (v2→v3) orphaned the old
// render's invalidation key, so we explicitly bust BOTH tags here to force
// regeneration with current data. Guarded by a temp key; deleted right after.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const TEMP_KEY = 'flush-2Uq2o-20260601';

export async function GET(req: Request) {
  const key = new URL(req.url).searchParams.get('key');
  if (key !== TEMP_KEY) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const tags = [
    'judgeme:reviews-v2',
    'judgeme:reviews-v3',
    'judgeme:aggregate',
    'judgeme:aggregate-v2',
  ];
  for (const t of tags) revalidateTag(t);
  // Belt-and-suspenders: also bust the specific routes that render reviews.
  const paths = ['/', '/pages/reviews'];
  for (const p of paths) revalidatePath(p);
  return NextResponse.json(
    { ok: true, revalidatedTags: tags, revalidatedPaths: paths },
    { headers: { 'cache-control': 'no-store' } },
  );
}
