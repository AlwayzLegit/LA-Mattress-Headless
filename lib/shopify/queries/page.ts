import { cache } from 'react';
import { shopifyFetch } from '../client';
import type { Page } from '../types';
import { SEO_FRAGMENT } from './fragments';

const GET_PAGE_BY_HANDLE = /* GraphQL */ `
  ${SEO_FRAGMENT}
  query GetPageByHandle($handle: String!) {
    page(handle: $handle) {
      id
      handle
      title
      body
      bodySummary
      updatedAt
      createdAt
      seo { ...SeoFields }
      availableAt: metafield(namespace: "custom", key: "available_at") { value }
    }
  }
`;

type RawPage = Omit<Page, 'availableAt'> & {
  availableAt: { value: string | null } | null;
};
type Raw = { page: RawPage | null };

// Memoized so the /pages/[handle] segment layout (JSON-LD) and the
// page itself share a single Storefront request per render.
export const getPageByHandle = cache(async (handle: string): Promise<Page | null> => {
  const data = await shopifyFetch<Raw, { handle: string }>(
    GET_PAGE_BY_HANDLE,
    { handle },
    { tags: [`page:${handle}`] },
  );
  const p = data.page;
  if (!p) return null;
  return { ...p, availableAt: p.availableAt?.value ?? null };
});
