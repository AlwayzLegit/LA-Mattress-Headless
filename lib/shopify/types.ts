/**
 * Hand-written TypeScript types for the Storefront API responses we use.
 *
 * These mirror the shape of the GraphQL queries in `lib/shopify/queries/*.ts`
 * — they are NOT auto-generated. When a query changes, update the type here.
 *
 * If/when we adopt graphql-codegen (per brief §5), this file gets replaced
 * by the generated `types.generated.ts` and queries pull types from there.
 */

export type Money = {
  amount: string;        // string-encoded decimal, e.g. "3499.00"
  currencyCode: string;  // ISO 4217, e.g. "USD"
};

export type Image = {
  url: string;
  altText: string | null;
  width: number | null;
  height: number | null;
};

export type Seo = {
  title: string | null;
  description: string | null;
};

export type SelectedOption = { name: string; value: string };

export type ProductVariant = {
  id: string;
  title: string;
  availableForSale: boolean;
  selectedOptions: SelectedOption[];
  price: Money;
  compareAtPrice: Money | null;
  sku: string | null;
  /**
   * Shopify-stored barcode (UPC / EAN / GTIN-13/14). Null when the
   * variant doesn't have one. Surfaced via Storefront API
   * `ProductVariant.barcode` and emitted as `gtin` in Product JSON-LD
   * Offer items — the strongest product-identification signal Google's
   * Shopping rich results spec looks for.
   */
  barcode: string | null;
  image: Image | null;
};

export type ProductOption = {
  id: string;
  name: string;
  values: string[];
};

/**
 * Aggregated review data from Judge.me (or any Storefront-exposed metafield
 * pair under namespace "reviews"). Null until the metafield definitions are
 * created in Shopify Admin and a vendor populates them.
 */
export type ProductReviews = {
  rating: number;          // average, e.g. 4.8 (out of 5)
  count: number;           // total review count
};

/**
 * Mattress spec data parsed from `custom.*` metafields (Phase 52). Each
 * field is independently optional — partial population is fine, the
 * compare table just omits missing rows.
 */
export type ProductSpecs = {
  firmness: string | null;        // "Soft" / "Medium" / "Firm" / etc.
  heightInches: number | null;    // e.g. 12, 14.5
  materialType: string | null;    // "Memory Foam" / "Hybrid" / etc.
  warrantyYears: number | null;
  trialNights: number | null;
};

export type ProductHighlight = {
  icon: 'sparkle' | 'shield' | 'truck' | 'check' | 'card' | string;
  title: string;
  body: string;
};

export type SleepPositionFit = 'great' | 'good' | 'poor';

export type ProductLayer = {
  name: string;
  desc: string;
};

/**
 * PDP editorial data parsed from `custom.*` metafields (Phase 94). All
 * fields independently optional — each section renders only when its data
 * is populated, so partial onboarding is fine.
 *
 * tagline / lede / firmnessScore / positionFit / layers / highlights are
 * defined under `custom.*` with storefront PUBLIC_READ access.
 */
export type ProductEditorial = {
  tagline: string | null;
  lede: string | null;
  bestFor: string[];
  notIdealFor: string[];
  highlights: ProductHighlight[];
  firmnessScore: number | null;          // 1-10
  positionFit: { back?: SleepPositionFit; side?: SleepPositionFit; stomach?: SleepPositionFit } | null;
  layers: ProductLayer[];
};

/** Slim collection summary attached to a Product — handle + title only. */
export type ProductCollectionRef = { handle: string; title: string };

export type Product = {
  id: string;
  handle: string;
  title: string;
  vendor: string;
  productType: string;
  description: string;
  descriptionHtml: string;
  availableForSale: boolean;
  tags: string[];
  updatedAt: string;
  publishedAt: string;
  featuredImage: Image | null;
  images: Image[];
  options: ProductOption[];
  variants: ProductVariant[];
  priceRange: { minVariantPrice: Money; maxVariantPrice: Money };
  compareAtPriceRange: { minVariantPrice: Money; maxVariantPrice: Money };
  seo: Seo;
  /**
   * Up to 5 collections this product belongs to (Phase 297). Used by
   * the PDP breadcrumb + Product JSON-LD to pick a "primary" parent
   * category instead of hardcoding "Mattresses".
   */
  collections: ProductCollectionRef[];
  reviews: ProductReviews | null;
  specs: ProductSpecs;
  editorial: ProductEditorial;
};

export type ProductSummary = {
  id: string;
  handle: string;
  title: string;
  vendor: string;
  featuredImage: Image | null;
  priceRange: { minVariantPrice: Money; maxVariantPrice: Money };
  compareAtPriceRange: { minVariantPrice: Money; maxVariantPrice: Money };
  /** Subset of ProductSpecs surfaced in ProductSummary fragment for PLP cards. */
  specs?: { firmness: string | null; heightInches: number | null; materialType: string | null };
  /**
   * Aggregate review rating + count for card-level star badge. Phase 242.
   * Populated via the same fallback chain as the full Product type
   * (reviews.rating + reviews.rating_count, OR judgeme.badge HTML).
   */
  reviews: ProductReviews | null;
};

export type Collection = {
  id: string;
  handle: string;
  title: string;
  description: string;
  descriptionHtml: string;
  image: Image | null;
  updatedAt: string;
  seo: Seo;
  /**
   * PLP v2.1: short SEO-rich intro shown above the product grid on the
   * collection page (`custom.intro_short` metafield). When null/empty,
   * the storefront falls back to categoryIntroFor() in lib/plp-content.ts.
   */
  introShort: string | null;
  /**
   * PLP v2.1 Phase B: long-form rich-text SEO content rendered below
   * the product grid (`custom.seo_content` metafield, Shopify rich_text
   * JSON AST as a string). Serialized to HTML at render time via
   * lib/shopify/rich-text.ts → richTextJsonToHtml(). When null/empty,
   * the storefront falls back to descriptionHtml.
   */
  seoContentJson: string | null;
  /**
   * Custom on-page H1 (`custom.seo_h1` metafield), merchant-editable in
   * Admin. When null/empty the PLP renders the bare `title`. Shopify is
   * the source of truth for this — Phase 2 of the SEO-ownership migration
   * retired the old lib/collection-seo-overrides.ts code layer.
   */
  seoH1: string | null;
};

export type AvailableFilterValue = {
  id: string;
  label: string;
  count: number;
  input: string; // JSON-encoded ProductFilter — passable straight back to Shopify
};

export type AvailableFilter = {
  id: string;       // e.g. "filter.v.option.size", "filter.p.vendor", "filter.v.price"
  label: string;    // human-readable, e.g. "Size", "Brand", "Price"
  values: AvailableFilterValue[];
};

// Subset of the Storefront `ProductFilter` input we use.
export type ProductFilter =
  | { productVendor: string }
  | { productType: string }
  | { available: boolean }
  | { price: { min?: number; max?: number } }
  | { variantOption: { name: string; value: string } }
  | { productMetafield: { namespace: string; key: string; value: string } };

export type CollectionWithProducts = Collection & {
  products: {
    nodes: ProductSummary[];
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
    filters: AvailableFilter[];
  };
};

export type Page = {
  id: string;
  handle: string;
  title: string;
  body: string;        // sanitized HTML — render via DOMPurify before injecting
  bodySummary: string;
  updatedAt: string;
  createdAt: string;
  seo: Seo;
  // ISO datetime when the page should become visible to shoppers; sourced
  // from the `custom.available_at` page metafield. Null when unset. The
  // SalePage dispatch in app/(storefront)/pages/[handle]/page.tsx uses
  // this to hide scheduled sale pages until 7 days before the event.
  availableAt: string | null;
  // Sale event window — `custom.sale_starts_at` / `custom.sale_ends_at`.
  // Used to populate SaleEvent JSON-LD startDate/endDate and to render
  // the "sale has ended" banner once endsAt has passed. Both are null
  // on non-sale pages (and may be null on sale pages that don't carry
  // the metafields, in which case the SaleEvent LD is omitted).
  saleStartsAt: string | null;
  saleEndsAt: string | null;
  /**
   * Custom on-page H1 (`custom.seo_h1` metafield), merchant-editable in
   * Admin. When null/empty the DefaultPage template renders the
   * case-normalized page title. Shopify source of truth (Phase 2 of the
   * SEO-ownership migration; retired lib/page-seo-overrides.ts).
   */
  seoH1: string | null;
  /**
   * Optional hero background image (`custom.cover_image` file_reference
   * metafield, resolved to its MediaImage). When set, the SalePage hero
   * renders it full-bleed behind a dark legibility scrim instead of the
   * flat navy gradient. Null when unset — the template falls back to the
   * gradient, so this is purely additive.
   */
  coverImage: { url: string; altText: string | null } | null;
};

export type ArticleAuthor = { name: string; bio: string | null };

export type ArticleSummary = {
  id: string;
  handle: string;
  title: string;
  excerpt: string | null;
  publishedAt: string;
  image: Image | null;
  author: ArticleAuthor | null;
};

export type Article = ArticleSummary & {
  contentHtml: string;
  content: string;
  tags: string[];
  blog: { handle: string; title: string };
  seo: Seo;
};

export type Blog = {
  id: string;
  handle: string;
  title: string;
  seo: Seo;
};

export type BlogWithArticles = Blog & {
  articles: {
    nodes: ArticleSummary[];
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
  };
};

export type MenuItem = {
  id: string;
  title: string;
  url: string;
  type: string;
  items: MenuItem[];
};

export type Menu = {
  id: string;
  handle: string;
  title: string;
  items: MenuItem[];
};

export type CartDiscountAllocation = { discountedAmount: Money };

export type CartLine = {
  id: string;
  quantity: number;
  cost: { totalAmount: Money; subtotalAmount: Money };
  discountAllocations: CartDiscountAllocation[];
  merchandise: ProductVariant & {
    product: { id: string; handle: string; title: string; vendor: string; featuredImage: Image | null };
  };
};

export type Cart = {
  id: string;
  checkoutUrl: string;
  totalQuantity: number;
  note: string | null;
  cost: {
    subtotalAmount: Money;
    totalAmount: Money;
    totalTaxAmount: Money | null;
    totalDutyAmount: Money | null;
  };
  discountCodes: { code: string; applicable: boolean }[];
  discountAllocations: CartDiscountAllocation[];
  lines: { nodes: CartLine[] };
  buyerIdentity: {
    email: string | null;
    phone: string | null;
    countryCode: string | null;
  };
  attributes: { key: string; value: string }[];
};
