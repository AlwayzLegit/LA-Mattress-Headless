/**
 * Shop-level identity data — name, description, brand assets.
 *
 * Phase 268: read these from Shopify's built-in Brand settings
 * (Settings → Store details → Brand) instead of hardcoding in code.
 * The merchant updates Brand assets in Shopify Admin and the homepage
 * metadata + Organization JSON-LD logo update on next ISR revalidation.
 *
 * What this powers:
 *   - homepage `<title>` and `<meta name="description">` (app/page.tsx)
 *   - default `og:image` (app/layout.tsx via shop.brand.coverImage)
 *   - Organization JSON-LD `logo` field (lib/structured-data.ts)
 *
 * Everything has a hardcoded fallback in code, so an unconfigured
 * Shopify store or empty Brand fields don't break rendering.
 */

import { shopifyFetch } from '../client';

export type ShopBrand = {
  name: string;
  description: string | null;
  brand: {
    slogan: string | null;
    shortDescription: string | null;
    logo: { url: string; altText: string | null; width: number; height: number } | null;
    coverImage: { url: string; altText: string | null; width: number; height: number } | null;
  } | null;
};

const SHOP_BRAND_QUERY = /* GraphQL */ `
  query ShopBrand {
    shop {
      name
      description
      brand {
        slogan
        shortDescription
        logo {
          image { url altText width height }
        }
        coverImage {
          image { url altText width height }
        }
      }
    }
  }
`;

type Raw = {
  shop: {
    name: string;
    description: string | null;
    brand: {
      slogan: string | null;
      shortDescription: string | null;
      logo: { image: { url: string; altText: string | null; width: number; height: number } | null } | null;
      coverImage: { image: { url: string; altText: string | null; width: number; height: number } | null } | null;
    } | null;
  };
};

export async function getShopBrand(): Promise<ShopBrand | null> {
  try {
    const data = await shopifyFetch<Raw>(SHOP_BRAND_QUERY, {}, {
      next: { revalidate: 3600, tags: ['shop:brand'] },
    });
    const s = data.shop;
    return {
      name: s.name,
      description: s.description,
      brand: s.brand
        ? {
            slogan: s.brand.slogan,
            shortDescription: s.brand.shortDescription,
            logo: s.brand.logo?.image ?? null,
            coverImage: s.brand.coverImage?.image ?? null,
          }
        : null,
    };
  } catch {
    return null;
  }
}
