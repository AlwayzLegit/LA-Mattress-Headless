/**
 * Homepage SEO — title, meta description, and social-sharing image pulled
 * from a single-entry `homepage_seo` Shopify metaobject so the merchant
 * owns homepage search/social metadata in Admin (Content → Metaobjects →
 * Homepage SEO), with no code edit or redeploy.
 *
 * Why a metaobject and not Shopify's Online Store → Preferences: in a
 * headless build the Storefront/Admin APIs expose `shop.description` (the
 * Preferences meta description) but NOT the Preferences homepage *title*
 * or social image — there's no `shop.seo` object. Shopify's own Hydrogen
 * SEO guidance is to source homepage SEO from the route (hardcode or "query
 * them from a custom metaobject"); this is the metaobject path, which keeps
 * Shopify Admin as the single source of truth (the project's SEO policy —
 * see docs). `app/(storefront)/page.tsx` reads this; the in-code constants
 * there are now last-resort fallbacks only.
 *
 * Shopify Admin setup (done once via API):
 *   Settings → Custom data → Metaobjects → Homepage SEO (type: homepage_seo)
 *     Storefronts: ON (PUBLIC_READ)
 *     Fields: title (single line), description (multi line),
 *             og_image (file reference, optional)
 *   Content → Metaobjects → Homepage SEO → the single entry.
 *
 * Caching: 1-hour revalidate (matches the homepage ISR window), tagged
 * `metaobject:homepage_seo` so an /api/revalidate-tag webhook can drop
 * edit-to-live lag to seconds later.
 */

import { shopifyFetch } from '../client';

export type HomepageSeo = {
  title: string | null;
  description: string | null;
  ogImage: string | null;
};

type Field = { key: string; value: string | null; reference?: { image?: { url: string } | null } | null };

const QUERY = /* GraphQL */ `
  query HomepageSeo {
    metaobjects(type: "homepage_seo", first: 1) {
      edges {
        node {
          fields {
            key
            value
            reference {
              ... on MediaImage { image { url } }
            }
          }
        }
      }
    }
  }
`;

type Raw = {
  metaobjects: { edges: { node: { fields: Field[] } }[] };
};

/**
 * Fetch the homepage SEO overrides. Returns null on any error or when the
 * metaobject hasn't been created — the caller then falls back to its
 * in-code constants, so the homepage never renders empty metadata.
 */
export async function getHomepageSeo(): Promise<HomepageSeo | null> {
  let data: Raw;
  try {
    data = await shopifyFetch<Raw>(QUERY, {}, {
      next: { revalidate: 3600, tags: ['metaobject:homepage_seo'] },
    });
  } catch {
    return null;
  }

  const node = data.metaobjects.edges[0]?.node;
  if (!node) return null;

  let title: string | null = null;
  let description: string | null = null;
  let ogImage: string | null = null;
  for (const f of node.fields) {
    if (f.key === 'title') title = f.value?.trim() || null;
    else if (f.key === 'description') description = f.value?.trim() || null;
    else if (f.key === 'og_image') ogImage = f.reference?.image?.url ?? null;
  }

  if (!title && !description && !ogImage) return null;
  return { title, description, ogImage };
}
