import { shopifyFetch } from '../client';
import type { ProductSummary } from '../types';
import { IMAGE_FRAGMENT, MONEY_FRAGMENT, PRODUCT_SUMMARY_FRAGMENT } from './fragments';

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

type Raw = { productRecommendations: ProductSummary[] | null };

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

  return nodes.filter((p) => p.handle !== handle).slice(0, limit);
}
