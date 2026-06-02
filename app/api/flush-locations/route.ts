import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
// TEMPORARY one-shot ISR flush for the blog-article route so the
// editor-cruft strip (#409/#410) serves fresh. Key-guarded; removed after use.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
const TEMP_KEY = 'flush-2Uq2o-20260601';
export async function GET(req: Request) {
  if (new URL(req.url).searchParams.get('key') !== TEMP_KEY) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  revalidatePath('/blogs/[blog]/[article]', 'page');
  return NextResponse.json({ ok: true, revalidated: ['/blogs/[blog]/[article]'] }, { headers: { 'cache-control': 'no-store' } });
}
