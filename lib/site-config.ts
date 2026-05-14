/**
 * Canonical site-wide config — store contact, social, brand identity.
 *
 * Anything that used to be a hardcoded constant strewn across components,
 * JSON-LD builders, and not-found pages should reference this module so a
 * single edit propagates everywhere.
 *
 * If we ever migrate this to Shopify-native (shop metafields), the public
 * shape stays the same and only the import source changes.
 */

const PHONE_DIGITS = '8002183578';

/** RFC 3966 (`tel:+18002183578`) for `<a href={tel}>`. */
export const SITE_PHONE_TEL = `+1${PHONE_DIGITS}`;

/** Display-formatted (`(800) 218-3578`) for visible UI. */
export const SITE_PHONE_DISPLAY = `(${PHONE_DIGITS.slice(0, 3)}) ${PHONE_DIGITS.slice(3, 6)}-${PHONE_DIGITS.slice(6)}`;

/** Schema.org `telephone` format (`+1-800-218-3578`) for JSON-LD. */
export const SITE_PHONE_SCHEMA = `+1-${PHONE_DIGITS.slice(0, 3)}-${PHONE_DIGITS.slice(3, 6)}-${PHONE_DIGITS.slice(6)}`;

/** Customer-facing email. */
export const SITE_EMAIL = 'orders.lamattress@gmail.com';

/** Brand display name. */
export const SITE_BRAND = 'LA Mattress Store';

/** Public site URL (matches NEXT_PUBLIC_SITE_URL when set). */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.mattressstoreslosangeles.com';

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
  // 'https://www.facebook.com/lamattressstores',
  // 'https://www.instagram.com/lamattress',
  // 'https://www.youtube.com/@lamattress',
  // 'https://www.yelp.com/biz/la-mattress-store-los-angeles',
  // 'https://www.linkedin.com/company/la-mattress-store',
  // 'https://twitter.com/lamattress',
] as const;
