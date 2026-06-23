import { cache } from 'react';
import { shopifyFetch } from '../client';
import type { Page } from '../types';
import { SEO_FRAGMENT } from './fragments';
import { isSalePage } from '@/lib/sale-handles';

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
      availableAt:  metafield(namespace: "custom", key: "available_at")  { value }
      saleStartsAt: metafield(namespace: "custom", key: "sale_starts_at") { value }
      saleEndsAt:   metafield(namespace: "custom", key: "sale_ends_at")   { value }
      seoH1:        metafield(namespace: "custom", key: "seo_h1")         { value }
      coverImage:   metafield(namespace: "custom", key: "cover_image") {
        reference {
          ... on MediaImage { image { url altText } }
        }
      }
    }
  }
`;

type RawPage = Omit<Page, 'availableAt' | 'saleStartsAt' | 'saleEndsAt' | 'seoH1' | 'coverImage'> & {
  availableAt:  { value: string | null } | null;
  saleStartsAt: { value: string | null } | null;
  saleEndsAt:   { value: string | null } | null;
  seoH1:        { value: string | null } | null;
  coverImage:   { reference: { image: { url: string; altText: string | null } | null } | null } | null;
};
type Raw = { page: RawPage | null };

// Memoized so the /pages/[handle] segment layout (JSON-LD) and the
// page itself share a single Storefront request per render.
//
// Cache window: sale pages get 5 min, everything else gets the default
// 10 min (with the segment cap at 6h). The route-segment `revalidate`
// in app/(storefront)/pages/[handle]/page.tsx is the *maximum* — fetch
// revalidate narrows it. Tight revalidate on sale pages is what
// bounds the lag at sale-start / sale-end transitions (page goes
// 404→live or live→sale-ended within ~5 min of `available_at` /
// `sale_ends_at` instead of waiting for the 6h segment expiry).
export const getPageByHandle = cache(async (handle: string): Promise<Page | null> => {
  const revalidate = isSalePage(handle) ? 300 : 600;
  const data = await shopifyFetch<Raw, { handle: string }>(
    GET_PAGE_BY_HANDLE,
    { handle },
    { next: { revalidate, tags: [`page:${handle}`] } },
  );
  const p = data.page;
  if (!p) return null;
  return {
    ...p,
    availableAt:  p.availableAt?.value  ?? null,
    saleStartsAt: p.saleStartsAt?.value ?? null,
    saleEndsAt:   p.saleEndsAt?.value   ?? null,
    seoH1:        p.seoH1?.value?.trim() || null,
    coverImage:   p.coverImage?.reference?.image
      ? { url: p.coverImage.reference.image.url, altText: p.coverImage.reference.image.altText }
      : null,
  };
});
