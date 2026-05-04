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

export async function getPageByHandle(handle: string): Promise<Page | null> {
  const data = await shopifyFetch<Raw, { handle: string }>(
    GET_PAGE_BY_HANDLE,
    { handle },
    { tags: [`page:${handle}`] },
  );
  return data.page ?? null;
}
