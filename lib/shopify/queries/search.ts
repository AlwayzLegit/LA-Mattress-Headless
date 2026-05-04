import { shopifyFetch } from '../client';
import type { AvailableFilter, ProductFilter, ProductSummary } from '../types';
import { IMAGE_FRAGMENT, MONEY_FRAGMENT, PRODUCT_SUMMARY_FRAGMENT } from './fragments';

const SEARCH_PRODUCTS = /* GraphQL */ `
  ${IMAGE_FRAGMENT}
  ${MONEY_FRAGMENT}
  ${PRODUCT_SUMMARY_FRAGMENT}
  query SearchProducts(
    $query: String!,
    $first: Int!,
    $after: String,
    $productFilters: [ProductFilter!]
  ) {
    search(
      query: $query,
      first: $first,
      after: $after,
      types: [PRODUCT],
      productFilters: $productFilters
    ) {
      totalCount
      edges {
        node {
          ... on Product { ...ProductSummaryFields }
        }
      }
      pageInfo { hasNextPage endCursor }
      productFilters {
        id
        label
        values { id label count input }
      }
    }
  }
`;

export type SearchResult = {
  totalCount: number;
  products: ProductSummary[];
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
  filters: AvailableFilter[];
};

type Raw = {
  search: {
    totalCount: number;
    edges: { node: ProductSummary }[];
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
    productFilters: AvailableFilter[];
  };
};

export async function searchProducts(
  query: string,
  opts: { first?: number; after?: string | null; filters?: ProductFilter[] } = {},
): Promise<SearchResult> {
  const data = await shopifyFetch<Raw>(SEARCH_PRODUCTS, {
    query,
    first: opts.first ?? 24,
    after: opts.after ?? null,
    productFilters: opts.filters ?? [],
  });
  return {
    totalCount: data.search.totalCount,
    products: data.search.edges.map((e) => e.node),
    pageInfo: data.search.pageInfo,
    filters: data.search.productFilters ?? [],
  };
}

const PREDICTIVE_SEARCH = /* GraphQL */ `
  ${IMAGE_FRAGMENT}
  ${MONEY_FRAGMENT}
  ${PRODUCT_SUMMARY_FRAGMENT}
  query PredictiveSearch($query: String!) {
    predictiveSearch(query: $query, limit: 8, types: [PRODUCT, COLLECTION, PAGE], unavailableProducts: HIDE) {
      products { ...ProductSummaryFields }
      collections { handle title }
      pages { handle title }
      queries { text }
    }
  }
`;

export type Predictive = {
  products: ProductSummary[];
  collections: { handle: string; title: string }[];
  pages: { handle: string; title: string }[];
  queries: { text: string }[];
};

export async function predictiveSearch(query: string): Promise<Predictive> {
  const data = await shopifyFetch<{ predictiveSearch: Predictive }>(PREDICTIVE_SEARCH, { query });
  return data.predictiveSearch;
}
