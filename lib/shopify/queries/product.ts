import { shopifyFetch } from '../client';
import type { Product, ProductReviews } from '../types';
import {
  IMAGE_FRAGMENT, MONEY_FRAGMENT, SEO_FRAGMENT,
  VARIANT_FRAGMENT, PRODUCT_FRAGMENT,
} from './fragments';

const GET_PRODUCT_BY_HANDLE = /* GraphQL */ `
  ${IMAGE_FRAGMENT}
  ${MONEY_FRAGMENT}
  ${SEO_FRAGMENT}
  ${VARIANT_FRAGMENT}
  ${PRODUCT_FRAGMENT}
  query GetProductByHandle($handle: String!) {
    product(handle: $handle) {
      ...ProductFields
    }
  }
`;

type RawMetafield = { value: string; type: string } | null;

type Raw = {
  product:
    | (Omit<Product, 'images' | 'variants' | 'reviews'> & {
        images: { nodes: Product['images'] };
        variants: { nodes: Product['variants'] };
        ratingMetafield?: RawMetafield;
        ratingCountMetafield?: RawMetafield;
      })
    | null;
};

/**
 * Parse Judge.me's reviews.rating + reviews.rating_count metafield pair into
 * a ProductReviews object. Both metafields must be present and the count
 * must be > 0 for the result to be non-null. Returns null when:
 *  - the merchant hasn't installed Judge.me yet
 *  - the product has no reviews
 *  - the storefront access toggle isn't on for the metafield definitions
 *
 * The `reviews.rating` metafield type is `rating`, encoded as JSON like:
 *   {"value":"4.8","scale_min":"1.0","scale_max":"5.0"}
 */
export function parseReviewsMetafields(
  ratingMetafield?: RawMetafield,
  ratingCountMetafield?: RawMetafield,
): ProductReviews | null {
  if (!ratingMetafield?.value || !ratingCountMetafield?.value) return null;
  const count = Number.parseInt(ratingCountMetafield.value, 10);
  if (!Number.isFinite(count) || count <= 0) return null;
  let rating: number;
  try {
    const parsed = JSON.parse(ratingMetafield.value) as { value?: string };
    rating = parsed.value ? Number.parseFloat(parsed.value) : Number.NaN;
  } catch {
    // Some implementations store rating as a plain number string.
    rating = Number.parseFloat(ratingMetafield.value);
  }
  if (!Number.isFinite(rating) || rating < 0) return null;
  return { rating, count };
}

export async function getProductByHandle(handle: string): Promise<Product | null> {
  const data = await shopifyFetch<Raw, { handle: string }>(
    GET_PRODUCT_BY_HANDLE,
    { handle },
    { tags: [`product:${handle}`] },
  );
  if (!data.product) return null;
  const { ratingMetafield, ratingCountMetafield, ...rest } = data.product;
  return {
    ...rest,
    images: data.product.images.nodes,
    variants: data.product.variants.nodes,
    reviews: parseReviewsMetafields(ratingMetafield, ratingCountMetafield),
  };
}
