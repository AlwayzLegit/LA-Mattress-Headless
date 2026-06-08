/**
 * Static fallback for sitewide config — phone, email, brand identity,
 * social profiles. The live source of truth is `getSiteConfig()` from
 * lib/shopify/queries/site-config.ts (Shopify `site_config` metaobject,
 * singleton handle `default`).
 *
 * Existing sync consumers continue importing the formatted constants
 * below (SITE_PHONE_TEL, SITE_EMAIL, etc.) — they fall back to the
 * static values when the live fetch hasn't been wired into that
 * surface yet. Surfaces that have been migrated (footer signature,
 * Organization JSON-LD, etc.) read live values via `getSiteConfig()`
 * and use the formatter helpers below to derive the display shapes.
 */

import type { LiveSiteConfig } from './shopify/queries/site-config';

const PHONE_DIGITS = '8002183578';

/** RFC 3966 (`tel:+18002183578`) for `<a href={tel}>`. */
export const SITE_PHONE_TEL = `+1${PHONE_DIGITS}`;

/** Display-formatted (`(800) 218-3578`) for visible UI. */
export const SITE_PHONE_DISPLAY = `(${PHONE_DIGITS.slice(0, 3)}) ${PHONE_DIGITS.slice(3, 6)}-${PHONE_DIGITS.slice(6)}`;

/** Schema.org `telephone` format (`+1-800-218-3578`) for JSON-LD. */
export const SITE_PHONE_SCHEMA = `+1-${PHONE_DIGITS.slice(0, 3)}-${PHONE_DIGITS.slice(3, 6)}-${PHONE_DIGITS.slice(6)}`;

/** Customer-facing email. */
export const SITE_EMAIL = 'lamattressplus@gmail.com';

/** Brand display name. */
export const SITE_BRAND = 'LA Mattress Store';

/**
 * Order subtotal (USD, pre-tax) at/above which white-glove delivery is
 * free. "$499" was previously repeated as prose in ~15 content files;
 * this is the single numeric source the cart free-shipping bar reads.
 * Copy files are intentionally left alone (out of scope).
 */
export const FREE_DELIVERY_THRESHOLD = 499;
/** Pre-formatted threshold for UI copy. */
export const FREE_DELIVERY_THRESHOLD_DISPLAY = '$499';

/**
 * Public site URL (matches NEXT_PUBLIC_SITE_URL when set).
 *
 * The canonical host is the `www.` subdomain — the apex
 * (`mattressstoreslosangeles.com`) 308-redirects to it at the edge.
 * Vercel's `NEXT_PUBLIC_SITE_URL` env var has historically been set to
 * the bare apex, which leaked into sitemap.xml + robots.txt and made
 * every crawler hit a 308 hop (SEMrush "Temporary redirects" baseline).
 * `canonicalizeSiteUrl` force-upgrades the apex to `www.` so a
 * misconfigured env var can never re-introduce that regression — the
 * sitemap/robots/canonical surfaces always emit the redirect target,
 * not its source.
 */
function canonicalizeSiteUrl(raw: string | undefined): string {
  const fallback = 'https://www.mattressstoreslosangeles.com';
  if (!raw) return fallback;
  try {
    const u = new URL(raw.trim());
    u.protocol = 'https:';
    if (u.hostname === 'mattressstoreslosangeles.com') {
      u.hostname = 'www.mattressstoreslosangeles.com';
    }
    return u.origin;
  } catch {
    return fallback;
  }
}

export const SITE_URL = canonicalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL);

/**
 * Phase 277b: official social/external profiles for Schema.org `sameAs`.
 *
 * Surfaces the brand's social presence to Google's Knowledge Graph so the
 * Organization entity in our JSON-LD links to authoritative external pages
 * (Facebook, Instagram, YouTube, Yelp, GBP, etc.). Google uses sameAs to
 * disambiguate Organization entities and to populate the social-icons row
 * in the brand knowledge panel.
 *
 * Add URLs as they're confirmed. Empty array = no sameAs emitted (no
 * empty/dummy URLs ever — that's worse than nothing). Each entry should be
 * the canonical, owned profile URL (not a UTM-tagged or geo-redirect one).
 *
 * Update process: replace this constant when marketing confirms the
 * canonical URL for each surface. The Organization JSON-LD builder picks
 * it up automatically on the next deploy.
 */
export const SOCIAL_PROFILES: readonly string[] = [
  // Phase 293: confirmed owned profiles (merchant-verified 2026-05-15).
  // Now also lives in the Shopify `site_config` metaobject — merchant
  // can add the 5 showroom Google Business Profile URLs there once
  // they're confirmed, no code change needed.
  'https://www.facebook.com/lamattressstore',
  'https://www.instagram.com/lamattressstores',
  'https://www.yelp.com/biz/los-angeles-mattress-stores-los-angeles',
] as const;

/* ────────────────────────────────────────────────────────────────────
   Formatter helpers — derive the same display shapes the static
   constants expose from a live LiveSiteConfig (or any { phoneDigits }
   object). Callers that fetch via getSiteConfig() use these to render
   the same way the static fallback does — single source of formatting
   truth across static + dynamic paths.
   ──────────────────────────────────────────────────────────────────── */

/** `+18002183578` — RFC 3966 for `<a href={tel}>`. */
export function phoneTelFrom(digits: string): string {
  return `+1${digits}`;
}

/** `(800) 218-3578` — visible UI form. */
export function phoneDisplayFrom(digits: string): string {
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

/** `+1-800-218-3578` — Schema.org JSON-LD `telephone`. */
export function phoneSchemaFrom(digits: string): string {
  return `+1-${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
}

/**
 * Resolve a live LiveSiteConfig (from `getSiteConfig()`) — or `null`
 * if Shopify is unreachable / mis-seeded — into the formatted bundle
 * the storefront chrome consumes. Mirrors the SITE_* constants 1:1.
 * Use this in server components that have already awaited the live
 * fetch; client components keep using the static constants.
 */
export function resolveSiteConfig(live: LiveSiteConfig | null): {
  brand: string;
  phoneTel: string;
  phoneDisplay: string;
  phoneSchema: string;
  email: string;
  freeDeliveryThreshold: number;
  freeDeliveryThresholdDisplay: string;
  socialProfiles: readonly string[];
} {
  const phoneDigits = live?.phoneDigits ?? PHONE_DIGITS;
  const threshold = live?.freeDeliveryThreshold ?? FREE_DELIVERY_THRESHOLD;
  return {
    brand: live?.brandName ?? SITE_BRAND,
    phoneTel: phoneTelFrom(phoneDigits),
    phoneDisplay: phoneDisplayFrom(phoneDigits),
    phoneSchema: phoneSchemaFrom(phoneDigits),
    email: live?.email ?? SITE_EMAIL,
    freeDeliveryThreshold: threshold,
    freeDeliveryThresholdDisplay: `$${threshold.toLocaleString('en-US')}`,
    socialProfiles:
      live?.socialProfiles && live.socialProfiles.length > 0
        ? live.socialProfiles
        : SOCIAL_PROFILES,
  };
}
