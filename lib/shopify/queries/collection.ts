import { shopifyFetch } from '../client';
import type { CollectionWithProducts, ProductSummary } from '../types';
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
    $reverse: Boolean
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
      products(first: $first, after: $after, sortKey: $sortKey, reverse: $reverse) {
        nodes { ...ProductSummaryFields }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
`;

type Raw = {
  collection:
    | (Omit<CollectionWithProducts, 'products'> & {
        products: {
          nodes: ProductSummary[];
          pageInfo: { hasNextPage: boolean; endCursor: string | null };
        };
      })
    | null;
};

export type GetCollectionArgs = {
  handle: string;
  first?: number;
  after?: string | null;
  sortKey?: CollectionSort;
  reverse?: boolean;
};

export async function getCollectionByHandle({
  handle, first = 24, after, sortKey = 'COLLECTION_DEFAULT', reverse = false,
}: GetCollectionArgs): Promise<CollectionWithProducts | null> {
  const data = await shopifyFetch<Raw, GetCollectionArgs>(
    GET_COLLECTION,
    { handle, first, after, sortKey, reverse },
    { tags: [`collection:${handle}`] },
  );
  return data.collection ?? null;
}
