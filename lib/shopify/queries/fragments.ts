/**
 * Reusable GraphQL fragments. Co-located here so we can share field selections
 * between queries without duplicating field lists (and accidentally diverging).
 */

export const IMAGE_FRAGMENT = /* GraphQL */ `
  fragment ImageFields on Image {
    url
    altText
    width
    height
  }
`;

export const MONEY_FRAGMENT = /* GraphQL */ `
  fragment MoneyFields on MoneyV2 {
    amount
    currencyCode
  }
`;

export const SEO_FRAGMENT = /* GraphQL */ `
  fragment SeoFields on SEO {
    title
    description
  }
`;

// Note: `quantityAvailable` is intentionally NOT selected — that field requires
// the `unauthenticated_read_product_inventory` Storefront API access scope, which
// the LA Mattress Headless channel token doesn't currently grant. We don't render
// stock counts in the UI, so this is a pure storage savings. If you ever want
// "Only N left" badges, enable the scope in Shopify Admin → Headless → Storefront
// API access scopes, and add `quantityAvailable` back below + in types.ts.
export const VARIANT_FRAGMENT = /* GraphQL */ `
  fragment VariantFields on ProductVariant {
    id
    title
    availableForSale
    sku
    selectedOptions { name value }
    price { ...MoneyFields }
    compareAtPrice { ...MoneyFields }
    image { ...ImageFields }
  }
`;

export const PRODUCT_SUMMARY_FRAGMENT = /* GraphQL */ `
  fragment ProductSummaryFields on Product {
    id
    handle
    title
    vendor
    featuredImage { ...ImageFields }
    priceRange {
      minVariantPrice { ...MoneyFields }
      maxVariantPrice { ...MoneyFields }
    }
    compareAtPriceRange {
      minVariantPrice { ...MoneyFields }
      maxVariantPrice { ...MoneyFields }
    }
  }
`;

export const PRODUCT_FRAGMENT = /* GraphQL */ `
  fragment ProductFields on Product {
    id
    handle
    title
    vendor
    productType
    description
    descriptionHtml
    availableForSale
    tags
    updatedAt
    publishedAt
    featuredImage { ...ImageFields }
    images(first: 20) { nodes { ...ImageFields } }
    options { id name values }
    variants(first: 50) { nodes { ...VariantFields } }
    priceRange {
      minVariantPrice { ...MoneyFields }
      maxVariantPrice { ...MoneyFields }
    }
    compareAtPriceRange {
      minVariantPrice { ...MoneyFields }
      maxVariantPrice { ...MoneyFields }
    }
    seo { ...SeoFields }
  }
`;
