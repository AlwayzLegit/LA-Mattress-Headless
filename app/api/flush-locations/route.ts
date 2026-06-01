import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';

// TEMPORARY one-shot ISR flush for product pages (24h TTL) + the sleep
// quiz so the #12 PDP-reviews change and the quiz async fix serve fresh
// without waiting out the cache. Key-guarded; removed right after use.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const TEMP_KEY = 'flush-2Uq2o-20260601';

export async function GET(req: Request) {
  if (new URL(req.url).searchParams.get('key') !== TEMP_KEY) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  revalidatePath('/products/[handle]', 'page');
  revalidatePath('/sleep-quiz');
  return NextResponse.json(
    { ok: true, revalidated: ['/products/[handle]', '/sleep-quiz'] },
    { headers: { 'cache-control': 'no-store' } },
  );
}
