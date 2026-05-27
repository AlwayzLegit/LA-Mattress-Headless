/**
 * Cookie-based preview-mode check for the SalePage handler.
 *
 * Reads Next.js's draftMode() cookie (set by /api/preview/enable after
 * a successful token verify). When the cookie is present, the
 * `available_at` storefront date gate in
 * app/(storefront)/pages/[handle]/page.tsx is bypassed.
 *
 * Separated from lib/preview-auth.ts so unit tests can exercise the
 * pure token verifier without dragging in next/headers (which only
 * resolves inside a Next.js request context).
 */
import { draftMode } from 'next/headers';

export async function isPreviewEnabled(): Promise<boolean> {
  // draftMode() is per-request and reads the __prerender_bypass cookie
  // set by `draftMode().enable()` in the /api/preview/enable handler.
  const dm = await draftMode();
  return dm.isEnabled;
}
