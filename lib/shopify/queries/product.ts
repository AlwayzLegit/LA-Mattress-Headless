import { shopifyFetch } from '../client';
import type { Product } from '../types';
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

type Raw = {
  product:
    | (Omit<Product, 'images' | 'variants'> & {
        images: { nodes: Product['images'] };
        variants: { nodes: Product['variants'] };
      })
    | null;
};

export async function getProductByHandle(handle: string): Promise<Product | null> {
  const data = await shopifyFetch<Raw, { handle: string }>(
    GET_PRODUCT_BY_HANDLE,
    { handle },
    { tags: [`product:${handle}`] },
  );
  if (!data.product) return null;
  return {
    ...data.product,
    images: data.product.images.nodes,
    variants: data.product.variants.nodes,
  };
}
