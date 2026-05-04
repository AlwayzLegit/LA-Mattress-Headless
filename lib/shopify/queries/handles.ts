/**
 * Bulk-handle queries used by sitemap and generateStaticParams.
 *
 * The committed snapshots in data/url-inventory/ are the build-time source
 * of truth (no API call on `next build`). These functions are the runtime
 * fallback / refresh path.
 */

import { shopifyFetch } from '../client';

const GET_ALL_PRODUCT_HANDLES = /* GraphQL */ `
  query GetAllProductHandles($first: Int!, $after: String) {
    products(first: $first, after: $after, sortKey: ID) {
      nodes { handle updatedAt }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

const GET_ALL_COLLECTION_HANDLES = /* GraphQL */ `
  query GetAllCollectionHandles($first: Int!, $after: String) {
    collections(first: $first, after: $after, sortKey: ID) {
      nodes { handle updatedAt }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

const GET_ALL_PAGE_HANDLES = /* GraphQL */ `
  query GetAllPageHandles($first: Int!, $after: String) {
    pages(first: $first, after: $after) {
      nodes { handle updatedAt }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

export type HandleNode = { handle: string; updatedAt: string };
type Conn = { nodes: HandleNode[]; pageInfo: { hasNextPage: boolean; endCursor: string | null } };

async function paginate(query: string, key: string): Promise<HandleNode[]> {
  const all: HandleNode[] = [];
  let after: string | null = null;
  let safety = 50; // 50 pages * 50 = 2500 cap
  while (safety-- > 0) {
    const data: Record<string, Conn> = await shopifyFetch<Record<string, Conn>>(
      query,
      { first: 50, after },
      { next: { revalidate: 3600 } },
    );
    const conn: Conn = data[key];
    if (!conn) break;
    all.push(...conn.nodes);
    if (!conn.pageInfo.hasNextPage) break;
    after = conn.pageInfo.endCursor;
  }
  return all;
}

export const getAllProductHandles    = () => paginate(GET_ALL_PRODUCT_HANDLES,    'products');
export const getAllCollectionHandles = () => paginate(GET_ALL_COLLECTION_HANDLES, 'collections');
export const getAllPageHandles       = () => paginate(GET_ALL_PAGE_HANDLES,       'pages');
