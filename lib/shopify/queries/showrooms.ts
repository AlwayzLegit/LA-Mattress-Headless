import { cache } from 'react';
import { shopifyFetch } from '../client';
import type { Showroom } from '@/lib/showrooms';

/**
 * Live showrooms feed from the `showroom` Shopify metaobject type
 * (definition seeded in Shopify Admin — see also the dynamic-storefront
 * migration PR).
 *
 * Field key convention matches the metaobject definition:
 *   name, page_handle, area, street, city, region, postal_code, phone,
 *   hours (JSON array), geo_latitude/longitude, map_url, gbp_url,
 *   image (file reference → resolved as Image), cross_street,
 *   nearby_areas (list.single_line_text_field), display_order.
 *
 * The query is `cache()`'d so the storefront layout's call shares a
 * single Storefront request with the homepage Showrooms section, the
 * footer "Visit Us" column, the sitewide LocalBusiness LD, and any
 * showroom-detail / locations-index page that mounts later in the
 * render. ISR-cached for an hour and tagged so a metaobject webhook
 * can invalidate via revalidateTag('showrooms').
 *
 * Returns [] on failure — callers fall back to FALLBACK_SHOWROOMS in
 * lib/showrooms.ts.
 */

const SHOWROOMS_QUERY = /* GraphQL */ `
  query LiveShowrooms {
    metaobjects(type: "showroom", first: 25, sortKey: "display_order") {
      nodes {
        id
        handle
        fields {
          key
          value
          reference {
            __typename
            ... on MediaImage {
              image { url altText width height }
            }
          }
        }
      }
    }
  }
`;

type RawMetaobjectField = {
  key: string;
  value: string | null;
  reference: {
    __typename: string;
    image?: { url: string; altText: string | null };
  } | null;
};

type RawMetaobjectNode = {
  id: string;
  handle: string;
  fields: RawMetaobjectField[];
};

type RawResponse = {
  metaobjects: {
    nodes: RawMetaobjectNode[];
  };
};

function fieldMap(fields: RawMetaobjectField[]): Map<string, RawMetaobjectField> {
  return new Map(fields.map((f) => [f.key, f]));
}

function str(f: RawMetaobjectField | undefined): string | undefined {
  return typeof f?.value === 'string' && f.value.length > 0 ? f.value : undefined;
}

function num(f: RawMetaobjectField | undefined): number | undefined {
  const v = str(f);
  if (!v) return undefined;
  const n = Number.parseFloat(v);
  return Number.isFinite(n) ? n : undefined;
}

function jsonArray<T>(f: RawMetaobjectField | undefined, guard: (x: unknown) => x is T): T[] {
  const v = str(f);
  if (!v) return [];
  try {
    const parsed = JSON.parse(v) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(guard);
  } catch {
    return [];
  }
}

function isHoursEntry(x: unknown): x is { day: string; open: string; close: string } {
  if (typeof x !== 'object' || x === null) return false;
  const v = x as Record<string, unknown>;
  return (
    typeof v.day === 'string' &&
    typeof v.open === 'string' &&
    typeof v.close === 'string'
  );
}

function isString(x: unknown): x is string {
  return typeof x === 'string';
}

function toShowroom(node: RawMetaobjectNode): Showroom | null {
  const f = fieldMap(node.fields);
  const name = str(f.get('name'));
  const pageHandle = str(f.get('page_handle'));
  const area = str(f.get('area'));
  const street = str(f.get('street'));
  const city = str(f.get('city'));
  const region = str(f.get('region'));
  const postalCode = str(f.get('postal_code'));
  const phone = str(f.get('phone'));
  // Required fields — if any are missing, skip the entry rather than
  // ship a half-populated card to the storefront.
  if (!name || !pageHandle || !area || !street || !city || !region || !postalCode || !phone) {
    return null;
  }
  const hours = jsonArray(f.get('hours'), isHoursEntry);
  if (hours.length === 0) return null;

  const lat = num(f.get('geo_latitude'));
  const lon = num(f.get('geo_longitude'));
  const image = f.get('image')?.reference?.image ?? null;

  return {
    handle: pageHandle,
    name,
    area,
    street,
    city,
    region,
    postalCode,
    phone,
    hours,
    ...(lat != null && lon != null ? { geo: { latitude: lat, longitude: lon } } : {}),
    mapUrl: str(f.get('map_url')) ?? `https://maps.google.com/?q=${encodeURIComponent(`${name} ${street} ${city}`)}`,
    ...(image ? { imageUrl: image.url } : {}),
    ...(str(f.get('gbp_url')) ? { gbpUrl: str(f.get('gbp_url')) } : {}),
    ...(str(f.get('cross_street')) ? { crossStreet: str(f.get('cross_street')) } : {}),
    nearbyAreas: jsonArray(f.get('nearby_areas'), isString),
  };
}

/**
 * Fetch the live showroom list from Shopify metaobjects. Returns [] on
 * any failure; callers fall back to FALLBACK_SHOWROOMS. Memoized via
 * React.cache so concurrent renders share one fetch.
 */
export const getShowrooms = cache(async (): Promise<Showroom[]> => {
  try {
    const data = await shopifyFetch<RawResponse>(
      SHOWROOMS_QUERY,
      {},
      // Tag matches the `metaobject:<type>` pattern that
       // app/api/revalidate/route.ts emits for every `metaobjects/*`
       // webhook — a merchant edit in Shopify Admin auto-invalidates
       // this cache within seconds, no extra wiring required.
      { next: { revalidate: 3600, tags: ['metaobject:showroom'] } },
    );
    const showrooms = data.metaobjects.nodes
      .map(toShowroom)
      .filter((s): s is Showroom => s !== null);
    return showrooms;
  } catch {
    return [];
  }
});
