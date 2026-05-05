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

type RawSummary = ProductSummary & {
  firmnessMetafield?: { value: string } | null;
  heightMetafield?:   { value: string } | null;
  materialMetafield?: { value: string } | null;
};

type Raw = {
  collection:
    | (Omit<CollectionWithProducts, 'products'> & {
        products: {
          nodes: RawSummary[];
          pageInfo: { hasNextPage: boolean; endCursor: string | null };
          filters: AvailableFilter[];
        };
      })
    | null;
};

/** Lifts the three summary spec metafields off a raw node into a clean
 * ProductSummary.specs object. */
function liftSummarySpecs(n: RawSummary): ProductSummary {
  const { firmnessMetafield, heightMetafield, materialMetafield, ...rest } = n;
  const heightStr = heightMetafield?.value;
  const heightNum = heightStr ? Number.parseFloat(heightStr) : NaN;
  return {
    ...rest,
    specs: {
      firmness: firmnessMetafield?.value || null,
      heightInches: Number.isFinite(heightNum) ? heightNum : null,
      materialType: materialMetafield?.value || null,
    },
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
  return {
    ...data.collection,
    products: {
      ...data.collection.products,
      nodes: data.collection.products.nodes.map(liftSummarySpecs),
    },
  };
}
