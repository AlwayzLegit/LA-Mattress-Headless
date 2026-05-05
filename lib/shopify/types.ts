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
  reviews: ProductReviews | null;
};

export type ProductSummary = {
  id: string;
  handle: string;
  title: string;
  vendor: string;
  featuredImage: Image | null;
  priceRange: { minVariantPrice: Money; maxVariantPrice: Money };
  compareAtPriceRange: { minVariantPrice: Money; maxVariantPrice: Money };
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
  | { variantOption: { name: string; value: string } };

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

export type CartLine = {
  id: string;
  quantity: number;
  cost: { totalAmount: Money; subtotalAmount: Money };
  merchandise: ProductVariant & { product: { handle: string; title: string; featuredImage: Image | null } };
};

export type Cart = {
  id: string;
  checkoutUrl: string;
  totalQuantity: number;
  cost: {
    subtotalAmount: Money;
    totalAmount: Money;
    totalTaxAmount: Money | null;
    totalDutyAmount: Money | null;
  };
  lines: { nodes: CartLine[] };
  buyerIdentity: {
    email: string | null;
    phone: string | null;
    countryCode: string | null;
  };
};
