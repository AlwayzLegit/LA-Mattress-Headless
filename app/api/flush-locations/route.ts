import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';

// TEMPORARY one-shot ISR flush for the locations + contact pages so the
// new interactive map (#5) replaces the stale 6h-TTL prerender without
// waiting it out. Key-guarded; removed right after a single use.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const TEMP_KEY = 'flush-2Uq2o-20260601';

export async function GET(req: Request) {
  if (new URL(req.url).searchParams.get('key') !== TEMP_KEY) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  revalidatePath('/pages/mattress-store-locations');
  revalidatePath('/pages/mattress-store-contact');
  revalidatePath('/pages/[handle]', 'page');
  return NextResponse.json(
    { ok: true, revalidated: ['/pages/mattress-store-locations', '/pages/mattress-store-contact'] },
    { headers: { 'cache-control': 'no-store' } },
  );
}
