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
    | (Omit<CollectionWithProducts, 'products' | 'introShort'> & {
        introShort?: { value: string } | null;
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
  const { introShort: rawIntro, ...rest } = data.collection;
  return {
    ...rest,
    introShort: rawIntro?.value?.trim() || null,
    products: {
      ...data.collection.products,
      nodes: data.collection.products.nodes.map(liftSummarySpecs),
    },
  };
}
