import { shopifyFetch } from '../client';
import type { AvailableFilter, ArticleSummary, ProductFilter, ProductSummary } from '../types';
import { IMAGE_FRAGMENT, MONEY_FRAGMENT, PRODUCT_SUMMARY_FRAGMENT } from './fragments';
import { parseReviewsMetafields } from './product';

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

type Raw = {
  search: {
    totalCount: number;
    edges: { node: RawSummary }[];
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
    products: data.search.edges.map((e) => liftSummarySpecs(e.node)),
    pageInfo: data.search.pageInfo,
    filters: data.search.productFilters ?? [],
  };
}

const PREDICTIVE_SEARCH = /* GraphQL */ `
  ${IMAGE_FRAGMENT}
  ${MONEY_FRAGMENT}
  ${PRODUCT_SUMMARY_FRAGMENT}
  query PredictiveSearch($query: String!) {
    predictiveSearch(query: $query, limit: 8, types: [PRODUCT, COLLECTION, PAGE, ARTICLE], unavailableProducts: HIDE) {
      products { ...ProductSummaryFields }
      collections { handle title }
      pages { handle title }
      articles {
        id
        handle
        title
        excerpt
        publishedAt
        image { ...ImageFields }
        blog { handle title }
      }
      queries { text }
    }
  }
`;

/**
 * Subset of ArticleSummary the predictive search returns. Adds `blog`
 * (which we need to build the /blogs/{blog}/{article} URL) and drops
 * the author field (predictive doesn't return it). Kept separate from
 * ArticleSummary so the strict shape is documented at the call site.
 */
export type PredictiveArticle = {
  id: string;
  handle: string;
  title: string;
  excerpt: string | null;
  publishedAt: string;
  image: ArticleSummary['image'];
  blog: { handle: string; title: string };
};

export type Predictive = {
  products: ProductSummary[];
  collections: { handle: string; title: string }[];
  pages: { handle: string; title: string }[];
  articles: PredictiveArticle[];
  queries: { text: string }[];
};

type PredictiveRaw = Omit<Predictive, 'products'> & { products: RawSummary[] };

export async function predictiveSearch(query: string): Promise<Predictive> {
  const data = await shopifyFetch<{ predictiveSearch: PredictiveRaw }>(PREDICTIVE_SEARCH, { query });
  return {
    ...data.predictiveSearch,
    products: data.predictiveSearch.products.map(liftSummarySpecs),
    // Defensive default — the field is non-optional in the type so we
    // never blow up downstream consumers if Shopify returns null.
    articles: data.predictiveSearch.articles ?? [],
  };
}

/**
 * Full search for articles (the "Articles" tab on /search?q=&tab=articles).
 *
 * Storefront's `search()` query supports types: [ARTICLE], so we run a
 * separate request from the products tab and paginate independently.
 * Article search doesn't support productFilters, so the URL filter
 * params from the products tab are ignored here.
 */
const SEARCH_ARTICLES = /* GraphQL */ `
  ${IMAGE_FRAGMENT}
  query SearchArticles(
    $query: String!,
    $first: Int!,
    $after: String,
  ) {
    search(
      query: $query,
      first: $first,
      after: $after,
      types: [ARTICLE]
    ) {
      totalCount
      edges {
        node {
          ... on Article {
            id
            handle
            title
            excerpt
            publishedAt
            image { ...ImageFields }
            blog { handle title }
          }
        }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

export type ArticleSearchResult = {
  totalCount: number;
  articles: PredictiveArticle[];
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
};

type RawArticleSearch = {
  search: {
    totalCount: number;
    edges: { node: PredictiveArticle }[];
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
  };
};

export async function searchArticles(
  query: string,
  opts: { first?: number; after?: string | null } = {},
): Promise<ArticleSearchResult> {
  const data = await shopifyFetch<RawArticleSearch>(SEARCH_ARTICLES, {
    query,
    first: opts.first ?? 24,
    after: opts.after ?? null,
  });
  return {
    totalCount: data.search.totalCount,
    articles: data.search.edges.map((e) => e.node),
    pageInfo: data.search.pageInfo,
  };
}
