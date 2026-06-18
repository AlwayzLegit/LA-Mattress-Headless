import { shopifyFetch } from '../client';
import type {
  AvailableFilter,
  CollectionWithProducts,
  ProductFilter,
  ProductSummary,
} from '../types';
import {
  IMAGE_FRAGMENT, MONEY_FRAGMENT, SEO_FRAGMENT, PRODUCT_SUMMARY_FRAGMENT,
} from './fragments';
import { parseReviewsMetafields } from './product';

export type CollectionSort =
  | 'MANUAL'
  | 'BEST_SELLING'
  | 'CREATED'
  | 'PRICE'
  | 'COLLECTION_DEFAULT'
  | 'TITLE';

const GET_COLLECTION = /* GraphQL */ `
  ${IMAGE_FRAGMENT}
  ${MONEY_FRAGMENT}
  ${SEO_FRAGMENT}
  ${PRODUCT_SUMMARY_FRAGMENT}
  query GetCollection(
    $handle: String!,
    $first: Int!,
    $after: String,
    $sortKey: ProductCollectionSortKeys,
    $reverse: Boolean,
    $filters: [ProductFilter!]
  ) {
    collection(handle: $handle) {
      id
      handle
      title
      description
      descriptionHtml
      updatedAt
      image { ...ImageFields }
      seo { ...SeoFields }
      # PLP v2.1: short SEO-rich intro shown above the product grid.
      # Falls back to categoryIntroFor() in lib/plp-content.ts when empty.
      introShort: metafield(namespace: "custom", key: "intro_short") { value }
      # PLP v2.1 Phase B: long-form rich-text SEO content rendered below
      # the product grid. Stored as Shopify rich_text JSON; lib/shopify/
      # rich-text.ts serializes it to HTML at render time. When empty,
      # the storefront falls back to collection.descriptionHtml (the
      # legacy built-in field still populated on ~25 collections).
      seoContent: metafield(namespace: "custom", key: "seo_content") { value }
      # Custom on-page H1 (Phase 2 SEO-ownership migration). Replaces the
      # retired lib/collection-seo-overrides.ts h1 layer.
      seoH1: metafield(namespace: "custom", key: "seo_h1") { value }
      products(first: $first, after: $after, sortKey: $sortKey, reverse: $reverse, filters: $filters) {
        nodes { ...ProductSummaryFields }
        pageInfo { hasNextPage endCursor }
        filters {
          id
          label
          values { id label count input }
        }
      }
    }
  }
`;

type RawSpecMetafield = { value: string } | null;
type RawReviewMetafield = { value: string; type: string } | null;

type RawSummary = Omit<ProductSummary, 'reviews'> & {
  firmnessMetafield?: RawSpecMetafield;
  heightMetafield?:   RawSpecMetafield;
  materialMetafield?: RawSpecMetafield;
  ratingMetafield?:        RawReviewMetafield;
  ratingCountMetafield?:   RawReviewMetafield;
  judgemeBadgeMetafield?:  RawReviewMetafield;
};

type Raw = {
  collection:
    | (Omit<CollectionWithProducts, 'products' | 'introShort' | 'seoContentJson' | 'seoH1'> & {
        introShort?: { value: string } | null;
        seoContent?: { value: string } | null;
        seoH1?: { value: string } | null;
        products: {
          nodes: RawSummary[];
          pageInfo: { hasNextPage: boolean; endCursor: string | null };
          filters: AvailableFilter[];
        };
      })
    | null;
};

/** Lifts the summary spec + review metafields off a raw node into clean
 * ProductSummary.specs + ProductSummary.reviews objects. Phase 242
 * extended this to populate reviews alongside specs. */
function liftSummarySpecs(n: RawSummary): ProductSummary {
  const {
    firmnessMetafield, heightMetafield, materialMetafield,
    ratingMetafield, ratingCountMetafield, judgemeBadgeMetafield,
    ...rest
  } = n;
  const heightStr = heightMetafield?.value;
  const heightNum = heightStr ? Number.parseFloat(heightStr) : NaN;
  return {
    ...rest,
    specs: {
      firmness: firmnessMetafield?.value || null,
      heightInches: Number.isFinite(heightNum) ? heightNum : null,
      materialType: materialMetafield?.value || null,
    },
    reviews: parseReviewsMetafields(ratingMetafield, ratingCountMetafield, judgemeBadgeMetafield),
  };
}

export type GetCollectionArgs = {
  handle: string;
  first?: number;
  after?: string | null;
  sortKey?: CollectionSort;
  reverse?: boolean;
  filters?: ProductFilter[];
};

export async function getCollectionByHandle({
  handle,
  first = 24,
  after,
  sortKey = 'COLLECTION_DEFAULT',
  reverse = false,
  filters,
}: GetCollectionArgs): Promise<CollectionWithProducts | null> {
  const data = await shopifyFetch<Raw, GetCollectionArgs>(
    GET_COLLECTION,
    { handle, first, after, sortKey, reverse, filters: filters ?? [] },
    { tags: [`collection:${handle}`] },
  );
  if (!data.collection) return null;
  const { introShort: rawIntro, seoContent: rawSeo, seoH1: rawH1, ...rest } = data.collection;
  return {
    ...rest,
    introShort: rawIntro?.value?.trim() || null,
    seoContentJson: rawSeo?.value?.trim() || null,
    seoH1: rawH1?.value?.trim() || null,
    products: {
      ...data.collection.products,
      nodes: data.collection.products.nodes.map(liftSummarySpecs),
    },
  };
}
