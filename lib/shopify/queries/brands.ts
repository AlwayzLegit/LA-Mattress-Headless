/**
 * Phase 297 — brands shown on the storefront are now DERIVED from the
 * live catalog instead of three hand-maintained arrays (homepage
 * BrandStrip, the nav "Brands" mega menu, the PLP brand sub-nav).
 *
 * The merchant adds brands by adding products (a new `vendor`) and a
 * matching brand collection — e.g. onboarding Sleep & Beyond. With this
 * source the new brand appears everywhere automatically on the next ISR
 * revalidation, no code change.
 *
 * How a brand qualifies:
 *   1. It is a distinct `vendor` on a product published to the
 *      storefront (so we only ever show brands we actually stock), AND
 *   2. its brand collection exists and is non-empty.
 *
 * The collection handle follows the store's convention
 * `slugify(vendor)-mattresses` (tempur-pedic-mattresses,
 * stearns-foster-mattresses, …). VENDOR_OVERRIDES covers the two
 * vendors whose collection handle / display name don't match that
 * convention. Rule 2 is what auto-excludes house / accessory vendors
 * (LA Mattress Store, Malouf, Rize, …) — they have no brand-mattress
 * collection, so they silently drop out with no denylist to maintain.
 *
 * Every consumer keeps a hardcoded fallback, so an unconfigured or
 * unreachable Storefront API never renders an empty brand row.
 */

import { shopifyFetch } from '../client';

export type Brand = { name: string; handle: string; href: string };

/**
 * Vendors whose brand collection handle or display label doesn't follow
 * the `slugify(vendor)-mattresses` convention. Keep this tiny — it only
 * exists for legacy collections; new brands should follow the
 * convention and need no entry here.
 */
const VENDOR_OVERRIDES: Record<string, { name: string; handle: string }> = {
  'Helix Sleep': { name: 'Helix', handle: 'helix-mattresses' },
  'Harvest Green': { name: 'Harvest Green', handle: 'harvest-mattresses' },
};

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const VENDORS_QUERY = /* GraphQL */ `
  query ProductVendors($after: String) {
    products(first: 250, after: $after) {
      pageInfo { hasNextPage endCursor }
      edges { node { vendor } }
    }
  }
`;

type VendorsResponse = {
  products: {
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
    edges: { node: { vendor: string | null } }[];
  };
};

async function distinctVendors(): Promise<string[]> {
  const seen = new Set<string>();
  let after: string | null = null;
  // 4-page (×250) cap bounds the cost; the catalog is well under 1000
  // storefront products. The whole call is ISR-cached for an hour.
  for (let page = 0; page < 4; page++) {
    const data: VendorsResponse = await shopifyFetch<VendorsResponse>(
      VENDORS_QUERY,
      { after },
      { next: { revalidate: 3600, tags: ['brands'] } },
    );
    for (const e of data.products.edges) {
      const v = e.node.vendor?.trim();
      if (v) seen.add(v);
    }
    if (!data.products.pageInfo.hasNextPage || !data.products.pageInfo.endCursor) break;
    after = data.products.pageInfo.endCursor;
  }
  return [...seen];
}

function candidateFor(vendor: string): { name: string; handle: string } {
  return VENDOR_OVERRIDES[vendor] ?? { name: vendor, handle: `${slugify(vendor)}-mattresses` };
}

type VerifyNode = { handle: string; products: { nodes: { id: string }[] } } | null;

/**
 * One batched query: alias-look-up every candidate collection and keep
 * only the ones that exist AND have at least one product. Handles are
 * slugified (`[a-z0-9-]` only) or come from the constant override map,
 * so inlining them as GraphQL string literals is injection-safe.
 */
async function verifyCollections(handles: string[]): Promise<Set<string>> {
  if (handles.length === 0) return new Set();
  const body = handles
    .map(
      (h, i) =>
        `b${i}: collection(handle: ${JSON.stringify(h)}) { handle products(first: 1) { nodes { id } } }`,
    )
    .join('\n');
  const query = `query VerifyBrandCollections {\n${body}\n}`;
  const data = await shopifyFetch<Record<string, VerifyNode>>(query, {}, {
    next: { revalidate: 3600, tags: ['brands'] },
  });
  const ok = new Set<string>();
  for (let i = 0; i < handles.length; i++) {
    const node = data[`b${i}`];
    if (node && node.products.nodes.length > 0) ok.add(node.handle);
  }
  return ok;
}

/**
 * Live, ISR-cached list of brand collections the store actually stocks,
 * sorted alphabetically. Returns [] on any failure so callers fall back
 * to their static list rather than render an empty brand row.
 */
export async function getBrands(): Promise<Brand[]> {
  try {
    const vendors = await distinctVendors();
    if (vendors.length === 0) return [];
    const byHandle = new Map<string, { name: string; handle: string }>();
    for (const v of vendors) {
      const c = candidateFor(v);
      if (!byHandle.has(c.handle)) byHandle.set(c.handle, c);
    }
    const candidates = [...byHandle.values()];
    const live = await verifyCollections(candidates.map((c) => c.handle));
    return candidates
      .filter((c) => live.has(c.handle))
      .map((c) => ({ name: c.name, handle: c.handle, href: `/collections/${c.handle}` }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}
