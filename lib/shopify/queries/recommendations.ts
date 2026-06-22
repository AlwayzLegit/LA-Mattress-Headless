import { shopifyFetch } from '../client';
import type { ProductSummary } from '../types';
import { IMAGE_FRAGMENT, MONEY_FRAGMENT, PRODUCT_SUMMARY_FRAGMENT } from './fragments';
import { parseReviewsMetafields } from './product';
import { isRedirectedProductHandle } from '../../redirects-table';

const QUERY = /* GraphQL */ `
  ${IMAGE_FRAGMENT}
  ${MONEY_FRAGMENT}
  ${PRODUCT_SUMMARY_FRAGMENT}
  query GetProductRecommendations($handle: String!, $intent: ProductRecommendationIntent!) {
    productRecommendations(productHandle: $handle, intent: $intent) {
      ...ProductSummaryFields
    }
  }
`;

type RawSpecMetafield = { value: string } | null;
type RawReviewMetafield = { value: string; type: string } | null;

type RawSummary = Omit<ProductSummary, 'reviews' | 'specs'> & {
  firmnessMetafield?: RawSpecMetafield;
  heightMetafield?:   RawSpecMetafield;
  materialMetafield?: RawSpecMetafield;
  ratingMetafield?:        RawReviewMetafield;
  ratingCountMetafield?:   RawReviewMetafield;
  judgemeBadgeMetafield?:  RawReviewMetafield;
};

type Raw = { productRecommendations: RawSummary[] | null };

function liftSummary(n: RawSummary): ProductSummary {
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

/**
 * Fetches Shopify Storefront-API product recommendations for a PDP cross-sell
 * rail. Tries COMPLEMENTARY first (merchant-curated in Admin → Search &
 * Discovery → Recommendations) — these are the high-intent pairings we want
 * (mattress → foundation/protector/adjustable base). Falls back to RELATED
 * when no complementary set is curated, so the rail isn't empty on day one.
 *
 * Results filter out the source product (Shopify occasionally includes self
 * in RELATED) and cap at `limit`.
 */
export async function getProductRecommendations(
  handle: string,
  limit = 8,
): Promise<ProductSummary[]> {
  const complementary = await shopifyFetch<Raw, { handle: string; intent: string }>(
    QUERY,
    { handle, intent: 'COMPLEMENTARY' },
    { tags: [`product-recs:${handle}`] },
  ).catch(() => ({ productRecommendations: null }));

  let nodes = complementary.productRecommendations ?? [];

  if (nodes.length === 0) {
    const related = await shopifyFetch<Raw, { handle: string; intent: string }>(
      QUERY,
      { handle, intent: 'RELATED' },
      { tags: [`product-recs:${handle}`] },
    ).catch(() => ({ productRecommendations: null }));
    nodes = related.productRecommendations ?? [];
  }

  // Drop the source product (Shopify occasionally includes self in RELATED)
  // and any product whose canonical URL 301-redirects — Shopify still returns
  // discontinued/merged products here, and linking to a redirecting handle
  // trips SEMrush's "Permanent redirects" notice (214) on every PDP rail.
  return nodes
    .filter((p) => p.handle !== handle && !isRedirectedProductHandle(p.handle))
    .slice(0, limit)
    .map(liftSummary);
}
