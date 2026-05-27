/**
 * Sale-page preview disabler — clears Next.js's draftMode cookie so
 * the caller's browser stops bypassing the SalePage `available_at`
 * date gate. Useful when the merchant is done QAing a pre-launch page
 * and wants to see the public 404 experience.
 *
 * Open to GET (no auth needed — disabling preview is always safe;
 * it can only narrow what the caller sees, not widen it).
 */
import { NextResponse } from 'next/server';
import { draftMode } from 'next/headers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SAFE_REDIRECT = /^\/[a-zA-Z0-9/_-]*$/;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const rawRedirect = url.searchParams.get('redirect');
  const redirect = rawRedirect && SAFE_REDIRECT.test(rawRedirect) ? rawRedirect : '/';
  const dm = await draftMode();
  dm.disable();
  return NextResponse.redirect(new URL(redirect, url));
}
