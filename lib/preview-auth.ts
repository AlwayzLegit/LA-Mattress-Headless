/**
 * Pure token-verification helper for the sale-page preview gate.
 *
 * Lives in its own file (separate from the next/headers-bound
 * isPreviewEnabled cookie reader in lib/preview-auth-cookie.ts) so it
 * can be imported by unit tests under Node 22's experimental-strip-types
 * without dragging in the Next.js request-context runtime.
 *
 * Comparison is constant-time via crypto.timingSafeEqual to match the
 * webhook receiver pattern (api/revalidate/route.ts:39). A naive `===`
 * leaks per-character timing, letting an attacker recover the token
 * byte-by-byte under enough request samples. Length still leaks
 * (timingSafeEqual requires equal-length buffers), but that's
 * acceptable for a fixed-format secret.
 *
 * Preview disabled by default: when SALE_PAGE_PREVIEW_TOKEN is not
 * set in env, verifyPreviewToken always returns false — no preview
 * can be activated at all.
 */
import crypto from 'node:crypto';

export function verifyPreviewToken(candidate: string | null | undefined): boolean {
  const expected = process.env.SALE_PAGE_PREVIEW_TOKEN;
  if (!expected) return false;
  if (!candidate) return false;
  const a = Buffer.from(candidate);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
