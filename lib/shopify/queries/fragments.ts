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

/**
 * Judge.me writes review aggregates to product metafields. Both fields
 * silently return null until Judge.me is installed and writing data, at
 * which point the storefront picks them up automatically — no code changes
 * needed.
 *
 *   reviews.rating       → JSON `{"value":"4.8","scale_min":"1.0","scale_max":"5.0"}`
 *   reviews.rating_count → integer string
 *
 * Storefront access for these metafields needs to be enabled in Shopify
 * Admin → Settings → Custom data → Products → "reviews.rating" definition
 * → Storefront access toggle. Judge.me typically does this automatically
 * on install.
 */
export const REVIEWS_METAFIELDS = /* GraphQL */ `
  ratingMetafield: metafield(namespace: "reviews", key: "rating") { value type }
  ratingCountMetafield: metafield(namespace: "reviews", key: "rating_count") { value type }
`;

/**
 * Custom mattress spec metafields. All five live in the `custom` namespace
 * with storefront access set to PUBLIC_READ. Defined and bulk-populated
 * in Phase 52. Each value is a string we parse downstream.
 *
 *   custom.firmness         single_line_text — "Soft" / "Medium" / "Firm" / "Extra Firm" / "Plush" / "Medium-Plush" / "Medium-Firm"
 *   custom.height_inches    number_decimal
 *   custom.material_type    single_line_text — "Memory Foam" / "Hybrid" / "Innerspring" / "Latex" / "Gel Foam"
 *   custom.warranty_years   number_integer
 *   custom.trial_nights     number_integer (LA Mattress universal = 120)
 */
export const SPEC_METAFIELDS = /* GraphQL */ `
  firmnessMetafield: metafield(namespace: "custom", key: "firmness")        { value type }
  heightMetafield:   metafield(namespace: "custom", key: "height_inches")   { value type }
  materialMetafield: metafield(namespace: "custom", key: "material_type")   { value type }
  warrantyMetafield: metafield(namespace: "custom", key: "warranty_years")  { value type }
  trialMetafield:    metafield(namespace: "custom", key: "trial_nights")    { value type }
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
    ${REVIEWS_METAFIELDS}
    ${SPEC_METAFIELDS}
  }
`;
