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
    }
  }
`;

type Raw = { page: Page | null };

// Memoized so the /pages/[handle] segment layout (JSON-LD) and the
// page itself share a single Storefront request per render.
export const getPageByHandle = cache(async (handle: string): Promise<Page | null> => {
  const data = await shopifyFetch<Raw, { handle: string }>(
    GET_PAGE_BY_HANDLE,
    { handle },
    { tags: [`page:${handle}`] },
  );
  return data.page ?? null;
});
