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
    firmnessMetafield: metafield(namespace: "custom", key: "firmness")        { value }
    heightMetafield:   metafield(namespace: "custom", key: "height_inches")   { value }
    materialMetafield: metafield(namespace: "custom", key: "material_type")   { value }
    # Phase 242: review aggregates surface in ProductSummary so PLP /
    # related-rail / recently-viewed / popular-products cards can render
    # the star + count badge. Same fallback chain as the PDP path
    # (structured first, judgeme.badge HTML second).
    ratingMetafield:        metafield(namespace: "reviews",  key: "rating")        { value type }
    ratingCountMetafield:   metafield(namespace: "reviews",  key: "rating_count")  { value type }
    judgemeBadgeMetafield:  metafield(namespace: "judgeme",  key: "badge")         { value type }
  }
`;

/**
 * Judge.me review aggregates — pulled from two possible metafield shapes,
 * in priority order:
 *
 *   1. Structured (preferred):
 *        reviews.rating        → JSON `{"value":"4.8","scale_min":"1.0","scale_max":"5.0"}`
 *        reviews.rating_count  → integer string
 *      Only available on Judge.me's paid plans that expose the "Reviews
 *      metafields for Storefront API" toggle. This is the cleaner path —
 *      structured types, no HTML parsing, validates cleanly.
 *
 *   2. HTML-blob fallback (Phase 241):
 *        judgeme.badge → HTML string with `data-average-rating="…"` and
 *                        `data-number-of-reviews="…"` attributes on the
 *                        outer .jdgm-prev-badge div.
 *      Available on all Judge.me plans by default — this is the metafield
 *      the Judge.me Shopify app writes for its Liquid theme widget. We
 *      parse the data-* attrs out so the headless can render aggregate
 *      stars without needing the paid metafield exposure.
 *
 * Both are queried; parseReviewsMetafields picks whichever is populated.
 *
 * Storefront access for these metafields needs to be enabled in Shopify
 * Admin → Settings → Custom data → Products → corresponding definition
 * → Storefront access toggle. For `judgeme.badge` this is usually already
 * ON because the Liquid theme reads it; for `reviews.*` it requires the
 * Judge.me toggle that's plan-gated.
 */
export const REVIEWS_METAFIELDS = /* GraphQL */ `
  ratingMetafield: metafield(namespace: "reviews", key: "rating") { value type }
  ratingCountMetafield: metafield(namespace: "reviews", key: "rating_count") { value type }
  judgemeBadgeMetafield: metafield(namespace: "judgeme", key: "badge") { value type }
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

/**
 * PDP editorial metafields (Phase 94). All under `custom` namespace with
 * storefront PUBLIC_READ. Each renders a section on the PDP only when its
 * metafield is populated — graceful no-op until the merchant fills in via
 * Shopify Admin → Products → [product] → Custom data.
 *
 *   custom.tagline          single_line_text — one-sentence positioning
 *   custom.lede             multi_line_text  — 2-3 sentence overview lead
 *   custom.best_for         list.single_line_text — sleeper profile bullets
 *   custom.not_ideal_for    list.single_line_text — counter-list bullets
 *   custom.highlights       json — [{icon, title, body}] up to 4 cards
 *   custom.firmness_score   number_integer (1-10) — for the firmness scale viz
 *   custom.position_fit     json — {back, side, stomach: "great"|"good"|"poor"}
 *   custom.layers           json — [{name, desc}] construction layers
 */
export const EDITORIAL_METAFIELDS = /* GraphQL */ `
  taglineMetafield:        metafield(namespace: "custom", key: "tagline")         { value type }
  ledeMetafield:           metafield(namespace: "custom", key: "lede")            { value type }
  bestForMetafield:        metafield(namespace: "custom", key: "best_for")        { value type }
  notIdealForMetafield:    metafield(namespace: "custom", key: "not_ideal_for")   { value type }
  highlightsMetafield:     metafield(namespace: "custom", key: "highlights")      { value type }
  firmnessScoreMetafield:  metafield(namespace: "custom", key: "firmness_score")  { value type }
  positionFitMetafield:    metafield(namespace: "custom", key: "position_fit")    { value type }
  layersMetafield:         metafield(namespace: "custom", key: "layers")          { value type }
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
    ${EDITORIAL_METAFIELDS}
  }
`;
