import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';

// TEMPORARY one-shot ISR flush for the homepage so the brand-logo strip
// (#13) replaces the stale prerender. Key-guarded; removed right after use.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const TEMP_KEY = 'flush-2Uq2o-20260601';

export async function GET(req: Request) {
  if (new URL(req.url).searchParams.get('key') !== TEMP_KEY) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  revalidatePath('/');
  return NextResponse.json({ ok: true, revalidated: ['/'] }, { headers: { 'cache-control': 'no-store' } });
}
