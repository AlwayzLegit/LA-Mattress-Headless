import { cache } from 'react';
import { shopifyFetch } from '../client';

/**
 * Live feeds for two homepage sections — "Why LA Mattress" value
 * tiles and "Read before you buy" featured-guide wordmarks. Both
 * pull from Shopify metaobjects (`why_us_item` and `featured_guide`
 * types) so merchants can rewrite, reorder, or expand the lists in
 * Shopify Admin without a code change.
 *
 * Each query is `cache()`-memoized so the homepage's two sections
 * share one Storefront request per render and ISR-cached for 1h with
 * the `metaobject:<type>` tag pattern the existing /api/revalidate
 * webhook handler already invalidates on `metaobjects/*` topics.
 *
 * Returns [] on any failure — callers fall back to the in-code
 * defaults so the homepage never renders empty sections.
 */

export type WhyUsItem = {
  displayOrder: number;
  eyebrow: string;
  title: string;
  body: string;
};

export type FeaturedGuide = {
  displayOrder: number;
  label: string;
  href: string;
};

export type TrustItem = {
  displayOrder: number;
  /** Maps to IconName in app/_components/icon.tsx. */
  icon: string;
  label: string;
  href: string;
};

export type CategoryTile = {
  displayOrder: number;
  name: string;
  href: string;
  /** Collection handle whose product count drives the tile subtitle. */
  countCollectionHandle: string | null;
  /** phImg key for the placeholder. Empty → no image rendered. */
  imgKey: string | null;
};

type RawField = { key: string; value: string | null };
type RawMetaobjectNode = { id: string; handle: string; fields: RawField[] };
type RawListResponse = { metaobjects: { nodes: RawMetaobjectNode[] } };

const WHY_US_QUERY = /* GraphQL */ `
  query LiveWhyUs {
    metaobjects(type: "why_us_item", first: 12, sortKey: "display_order") {
      nodes { id handle fields { key value } }
    }
  }
`;

const FEATURED_GUIDES_QUERY = /* GraphQL */ `
  query LiveFeaturedGuides {
    metaobjects(type: "featured_guide", first: 12, sortKey: "display_order") {
      nodes { id handle fields { key value } }
    }
  }
`;

function fieldMap(node: RawMetaobjectNode): Map<string, RawField> {
  return new Map(node.fields.map((f) => [f.key, f]));
}

function str(fields: Map<string, RawField>, key: string): string | undefined {
  const f = fields.get(key);
  return typeof f?.value === 'string' && f.value.length > 0 ? f.value : undefined;
}

function num(fields: Map<string, RawField>, key: string): number {
  const v = str(fields, key);
  if (!v) return 0;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Drop duplicate entries by a stable identity key. Preserves the
 * first occurrence — relies on the caller having already sorted by
 * `displayOrder` (Shopify's `sortKey: "display_order"`), so the
 * lowest-numbered entry wins. Industry-standard defense against
 * accidental duplicate metaobjects (re-runs of a seed script,
 * merchant copy-paste, race-condition creates) — without this, two
 * trust items with the same label would render twice in the
 * top-of-page strip. The Shopify Admin metaobject API has no native
 * uniqueness constraint on field values, so the query layer has to
 * enforce it.
 */
function dedupeBy<T>(items: T[], keyFn: (item: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    const key = keyFn(item).trim().toLowerCase();
    if (key.length === 0 || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

export const getWhyUsItems = cache(async (): Promise<WhyUsItem[]> => {
  try {
    const data = await shopifyFetch<RawListResponse>(
      WHY_US_QUERY,
      {},
      { next: { revalidate: 3600, tags: ['metaobject:why_us_item'] } },
    );
    const items = data.metaobjects.nodes
      .map((node): WhyUsItem | null => {
        const fields = fieldMap(node);
        const title = str(fields, 'title');
        const body = str(fields, 'body');
        if (!title || !body) return null;
        return {
          displayOrder: num(fields, 'display_order'),
          eyebrow: str(fields, 'eyebrow') ?? '',
          title,
          body,
        };
      })
      .filter((x): x is WhyUsItem => x !== null);
    return dedupeBy(items, (it) => it.title);
  } catch {
    return [];
  }
});

export const getFeaturedGuides = cache(async (): Promise<FeaturedGuide[]> => {
  try {
    const data = await shopifyFetch<RawListResponse>(
      FEATURED_GUIDES_QUERY,
      {},
      { next: { revalidate: 3600, tags: ['metaobject:featured_guide'] } },
    );
    const items = data.metaobjects.nodes
      .map((node): FeaturedGuide | null => {
        const fields = fieldMap(node);
        const label = str(fields, 'label');
        const href = str(fields, 'href');
        // Internal-only safety — defense-in-depth even though the
        // metaobject definition's description says internal paths only.
        if (!label || !href || !href.startsWith('/')) return null;
        return {
          displayOrder: num(fields, 'display_order'),
          label,
          href,
        };
      })
      .filter((x): x is FeaturedGuide => x !== null);
    return dedupeBy(items, (it) => it.href);
  } catch {
    return [];
  }
});

const TRUST_ITEMS_QUERY = /* GraphQL */ `
  query LiveTrustItems {
    metaobjects(type: "trust_item", first: 12, sortKey: "display_order") {
      nodes { id handle fields { key value } }
    }
  }
`;

const CATEGORY_TILES_QUERY = /* GraphQL */ `
  query LiveCategoryTiles {
    metaobjects(type: "shop_by_category_tile", first: 24, sortKey: "display_order") {
      nodes { id handle fields { key value } }
    }
  }
`;

export const getTrustItems = cache(async (): Promise<TrustItem[]> => {
  try {
    const data = await shopifyFetch<RawListResponse>(
      TRUST_ITEMS_QUERY,
      {},
      { next: { revalidate: 3600, tags: ['metaobject:trust_item'] } },
    );
    const items = data.metaobjects.nodes
      .map((node): TrustItem | null => {
        const fields = fieldMap(node);
        const icon = str(fields, 'icon');
        const label = str(fields, 'label');
        const href = str(fields, 'href');
        if (!icon || !label || !href || !href.startsWith('/')) return null;
        return {
          displayOrder: num(fields, 'display_order'),
          icon,
          label,
          href,
        };
      })
      .filter((x): x is TrustItem => x !== null);
    return dedupeBy(items, (it) => it.label);
  } catch {
    return [];
  }
});

export const getCategoryTiles = cache(async (): Promise<CategoryTile[]> => {
  try {
    const data = await shopifyFetch<RawListResponse>(
      CATEGORY_TILES_QUERY,
      {},
      { next: { revalidate: 3600, tags: ['metaobject:shop_by_category_tile'] } },
    );
    const items = data.metaobjects.nodes
      .map((node): CategoryTile | null => {
        const fields = fieldMap(node);
        const name = str(fields, 'name');
        const href = str(fields, 'href');
        if (!name || !href || !href.startsWith('/')) return null;
        return {
          displayOrder: num(fields, 'display_order'),
          name,
          href,
          countCollectionHandle: str(fields, 'count_collection_handle') ?? null,
          imgKey: str(fields, 'img_key') ?? null,
        };
      })
      .filter((x): x is CategoryTile => x !== null);
    return dedupeBy(items, (it) => it.href);
  } catch {
    return [];
  }
});
