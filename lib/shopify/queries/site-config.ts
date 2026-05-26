import { cache } from 'react';
import { shopifyFetch } from '../client';

/**
 * Live site-config feed from the `site_config` Shopify metaobject
 * (singleton — handle: 'default'). Drives the footer signature line,
 * sitewide Organization JSON-LD (sameAs), customer-facing phone /
 * email, and the free-delivery threshold copy.
 *
 * Field key convention matches the metaobject definition:
 *   brand_name, phone_digits, email, free_delivery_threshold,
 *   social_profiles (list.url).
 *
 * `cache()`-memoized so the storefront layout's call, the homepage's
 * call (for buildLocalBusinessLd), and the footer's call all share a
 * single Storefront request per render. ISR-cached for an hour and
 * tagged so the merchant edit → `metaobjects/update` webhook →
 * `/api/revalidate` → `revalidateTag('metaobject:site_config')`
 * pipeline invalidates automatically.
 *
 * Returns null on any failure — callers fall back to the static
 * constants in lib/site-config.ts.
 */

export type LiveSiteConfig = {
  brandName: string;
  phoneDigits: string;
  email: string;
  freeDeliveryThreshold: number | null;
  socialProfiles: string[];
};

const SITE_CONFIG_QUERY = /* GraphQL */ `
  query LiveSiteConfig {
    metaobject(handle: { type: "site_config", handle: "default" }) {
      id
      handle
      fields { key value }
    }
  }
`;

type RawField = { key: string; value: string | null };
type RawResponse = {
  metaobject: { id: string; handle: string; fields: RawField[] } | null;
};

function str(fields: Map<string, RawField>, key: string): string | undefined {
  const f = fields.get(key);
  return typeof f?.value === 'string' && f.value.length > 0 ? f.value : undefined;
}

function num(fields: Map<string, RawField>, key: string): number | null {
  const v = str(fields, key);
  if (!v) return null;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

function strList(fields: Map<string, RawField>, key: string): string[] {
  const v = str(fields, key);
  if (!v) return [];
  try {
    const parsed = JSON.parse(v) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === 'string' && x.length > 0);
  } catch {
    return [];
  }
}

export const getSiteConfig = cache(async (): Promise<LiveSiteConfig | null> => {
  try {
    const data = await shopifyFetch<RawResponse>(
      SITE_CONFIG_QUERY,
      {},
      // Same tag pattern as the rest of our metaobject queries — the
      // existing /api/revalidate webhook handler emits
      // `metaobject:<type>` on every `metaobjects/*` Shopify topic, so
      // merchant edits invalidate without extra wiring.
      { next: { revalidate: 3600, tags: ['metaobject:site_config'] } },
    );
    if (!data.metaobject) return null;
    const fields = new Map(data.metaobject.fields.map((f) => [f.key, f]));
    const brandName = str(fields, 'brand_name');
    const phoneDigits = str(fields, 'phone_digits');
    const email = str(fields, 'email');
    // Required fields — if any are missing the metaobject is mis-seeded;
    // signal to the caller via null so it falls back to constants.
    if (!brandName || !phoneDigits || !email) return null;
    return {
      brandName,
      // Strip non-digits defensively — merchants may type the
      // formatted version into Shopify Admin.
      phoneDigits: phoneDigits.replace(/[^\d]/g, ''),
      email,
      freeDeliveryThreshold: num(fields, 'free_delivery_threshold'),
      socialProfiles: strList(fields, 'social_profiles'),
    };
  } catch {
    return null;
  }
});
