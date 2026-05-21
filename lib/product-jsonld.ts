/**
 * Product-page JSON-LD, rendered by app/products/[handle]/layout.tsx —
 * OUTSIDE the in-page <Suspense fallback={ProductSkeleton}> fast-path
 * in page.tsx. When the id-bearing <script>s lived inside that
 * suspended subtree, React's hidden streaming-source node (#S:0) was
 * left in the DOM on hard load, duplicating Product + BreadcrumbList
 * (cowork QA). Same fix class as lib/page-jsonld.ts (#166).
 *
 * Schema emitted:
 *   - Product (with @id, breadcrumb @id link, AggregateOffer + per-variant
 *     Offers, AggregateRating, MerchantReturnPolicy, OfferShippingDetails,
 *     additionalProperty[] for mattress specs, material, dateModified)
 *   - BreadcrumbList (with matching @id)
 *
 * Both link to the sitewide #organization / #website nodes emitted in
 * app/layout.tsx so the structured-data graph reads as one connected
 * entity tree per page rather than disjoint blocks.
 */
import type { getProductByHandle } from '@/lib/shopify';

type Product = NonNullable<Awaited<ReturnType<typeof getProductByHandle>>>;
export type ProductLd = { key: string; data: unknown };

const SITE = 'https://www.mattressstoreslosangeles.com';

/**
 * Sitewide MerchantReturnPolicy — the 120-night Love Your Bed Guarantee.
 * Embedded inline on every product offer because Google's Shopping rich
 * results require it on each Offer (not on the parent Product). Same
 * policy applies to every mattress we sell, so the inline object is
 * identical across products — Google deduplicates these on the back end
 * based on the policy values.
 */
const MERCHANT_RETURN_POLICY = {
  '@type': 'MerchantReturnPolicy',
  applicableCountry: 'US',
  returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
  merchantReturnDays: 120,
  returnMethod: 'https://schema.org/ReturnByMail',
  returnFees: 'https://schema.org/FreeReturn',
  returnShippingFeesAmount: {
    '@type': 'MonetaryAmount',
    value: 0,
    currency: 'USD',
  },
} as const;

/**
 * Sitewide OfferShippingDetails — free white-glove delivery in LA on
 * orders over $499, typically same-day for orders placed by 4 PM.
 * Embedded on each Offer (Google's requirement). Models the "free LA
 * delivery threshold" + "ships same-day in LA County" promise.
 *
 * shippingDestination is set to US-CA (state-level) which is the most
 * specific Google currently accepts for an in-state delivery promise.
 * Customers outside CA see standard shipping rules; we'd add a second
 * shippingDetails block if the merchant ever exposed nationwide shipping
 * rates.
 */
const SHIPPING_DETAILS_FREE = {
  '@type': 'OfferShippingDetails',
  shippingRate: {
    '@type': 'MonetaryAmount',
    value: 0,
    currency: 'USD',
  },
  shippingDestination: {
    '@type': 'DefinedRegion',
    addressCountry: 'US',
    addressRegion: 'CA',
  },
  deliveryTime: {
    '@type': 'ShippingDeliveryTime',
    handlingTime: {
      '@type': 'QuantitativeValue',
      minValue: 0,
      maxValue: 1,
      unitCode: 'DAY',
    },
    transitTime: {
      '@type': 'QuantitativeValue',
      minValue: 0,
      maxValue: 1,
      unitCode: 'DAY',
    },
  },
} as const;

/**
 * Build the additionalProperty[] array from custom.* metafields. Each
 * entry is a PropertyValue. Skip nulls/empties so we never emit
 * { name: 'Firmness', value: null } — which validates but is noise.
 *
 * Mattress-specific properties Google's Product structured-data spec
 * accepts via additionalProperty (no first-class fields exist for these):
 *   - Firmness ("Medium", "Firm", etc.)
 *   - Height ("12 inches")
 *   - Material type (also surfaced via Product.material)
 *   - Warranty length ("10 years")
 *   - Trial period ("120 nights")
 *   - Sleep position fit (back/side/stomach — only when populated)
 *   - Firmness score (1-10 numeric scale, when populated)
 */
function buildAdditionalProperties(product: Product): unknown[] {
  const out: unknown[] = [];
  const { specs, editorial } = product;
  if (specs.firmness) {
    out.push({ '@type': 'PropertyValue', name: 'Firmness', value: specs.firmness });
  }
  if (specs.heightInches !== null) {
    out.push({
      '@type': 'PropertyValue',
      name: 'Height',
      value: `${specs.heightInches} inches`,
      unitCode: 'INH',
      unitText: 'inch',
    });
  }
  if (specs.materialType) {
    out.push({ '@type': 'PropertyValue', name: 'Material', value: specs.materialType });
  }
  if (specs.warrantyYears !== null) {
    out.push({
      '@type': 'PropertyValue',
      name: 'Warranty',
      value: `${specs.warrantyYears} years`,
      unitCode: 'ANN',
      unitText: 'year',
    });
  }
  if (specs.trialNights !== null) {
    out.push({
      '@type': 'PropertyValue',
      name: 'Trial period',
      value: `${specs.trialNights} nights`,
    });
  }
  if (editorial.firmnessScore !== null) {
    out.push({
      '@type': 'PropertyValue',
      name: 'Firmness score',
      value: editorial.firmnessScore,
      minValue: 1,
      maxValue: 10,
    });
  }
  if (editorial.positionFit) {
    const positions = ['back', 'side', 'stomach'] as const;
    for (const p of positions) {
      const fit = editorial.positionFit[p];
      if (fit) {
        out.push({
          '@type': 'PropertyValue',
          name: `${p[0].toUpperCase() + p.slice(1)} sleeper fit`,
          value: fit,
        });
      }
    }
  }
  return out;
}

/**
 * Derive a human-readable size label from a variant's selectedOptions.
 * Mattress variants commonly have option "Size" with values like
 * "Twin", "Queen", "King", "Cal King". Returns null when no Size option
 * exists (e.g. a one-size product).
 */
function getVariantSize(variant: Product['variants'][number]): string | null {
  const sizeOpt = variant.selectedOptions.find(
    (o) => o.name.toLowerCase() === 'size' || o.name.toLowerCase() === 'mattress size',
  );
  return sizeOpt?.value ?? null;
}

/**
 * Meta-collections that aren't useful as a breadcrumb parent. These are
 * cross-cutting groupings ("on-sale", "featured") rather than category
 * hierarchies. When a product is in a meta-collection AND a real
 * category collection, prefer the real category for the breadcrumb.
 */
const META_COLLECTION_HANDLES = new Set([
  'all', 'all-products', 'frontpage', 'featured', 'on-sale',
  'new-arrivals', 'best-sellers', 'best-selling', 'sale',
  'clearance', 'mattresses', // 'mattresses' is the root category — we
                              // surface it as position 2 in every PDP
                              // breadcrumb already; using it again as
                              // position 3 would duplicate the path.
]);

/**
 * Pick the most-specific category collection for a product's breadcrumb.
 * Returns null when the product is only in meta-collections or has no
 * collections at all — caller falls back to the 2-level breadcrumb
 * (Home → Mattresses → Product).
 *
 * Exported so the visible PDP breadcrumb in app/products/[handle]/page.tsx
 * uses the same primary-collection logic as the JSON-LD breadcrumb. The
 * two must agree per Google's structured-data spec — a JSON-LD path
 * that doesn't match the visible page is flagged as a mismatch in
 * Search Console and can suppress the rich result.
 */
export function pickPrimaryCollection(collections: Product['collections']): Product['collections'][number] | null {
  for (const c of collections) {
    if (!META_COLLECTION_HANDLES.has(c.handle)) return c;
  }
  return null;
}

export function getProductJsonLd(product: Product): ProductLd[] {
  const min = product.priceRange.minVariantPrice;
  const max = product.priceRange.maxVariantPrice;
  const firstSku = product.variants.find((v) => v.sku && v.sku.trim().length > 0)?.sku;
  const productUrl = `${SITE}/products/${product.handle}`;

  // Per-variant Offer items inside the AggregateOffer. Google prefers
  // individual Offers per variant (with their own SKUs, prices, and
  // sizes) over a bare AggregateOffer — surfaces variant-level pricing
  // in Shopping rich results and helps the crawler understand the SKU
  // structure. Each Offer carries the sitewide merchant return policy
  // and shipping details so Google's Shopping eligibility flags
  // (returns + shipping) pass per-variant.
  const variantOffers = product.variants.map((v) => {
    const sizeLabel = getVariantSize(v);
    const offer: Record<string, unknown> = {
      '@type': 'Offer',
      url: productUrl,
      priceCurrency: v.price.currencyCode,
      price: v.price.amount,
      availability: v.availableForSale
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
      itemCondition: 'https://schema.org/NewCondition',
      hasMerchantReturnPolicy: MERCHANT_RETURN_POLICY,
      shippingDetails: SHIPPING_DETAILS_FREE,
    };
    if (v.sku && v.sku.trim().length > 0) {
      offer.sku = v.sku;
      // mpn fallback to SKU — Google accepts SKU as MPN when the actual
      // manufacturer part number isn't available (almost always true for
      // mattress variants — manufacturers don't ship MPNs to retailers).
      offer.mpn = v.sku;
    }
    if (v.barcode && v.barcode.trim().length > 0) {
      // gtin is the strongest product-identification signal in Google's
      // Shopping rich results spec — it ties the listing to the global
      // product database. Mattresses with UPC/EAN/GTIN barcodes in
      // Shopify get matched to manufacturer catalogs automatically.
      offer.gtin = v.barcode;
    }
    if (v.compareAtPrice && Number.parseFloat(v.compareAtPrice.amount) > Number.parseFloat(v.price.amount)) {
      // Strikethrough / list pricing per Google's Sale price rich-results
      // recipe. The Offer.price stays at the SALE price; priceSpecification
      // carries the ORIGINAL price tagged with priceType=ListPrice so
      // Shopping surfaces the "X% off" annotation.
      //
      // SEMrush 20260521 fix: the previous shape used a nonexistent
      // `referencePrice` property which fired one schema-validation error
      // per discounted variant — about half of the 2,752 sitewide
      // structured-data errors were this single property. Replaced with
      // the canonical ListPrice + UnitPriceSpecification pattern.
      offer.priceSpecification = {
        '@type': 'UnitPriceSpecification',
        price: v.compareAtPrice.amount,
        priceCurrency: v.compareAtPrice.currencyCode,
        priceType: 'https://schema.org/ListPrice',
      };
    }
    // Intentionally NOT emitting Offer.itemOffered on per-variant offers.
    // Previously rendered a nested Product { name, size } that was
    // schema-incomplete (no image, no offers, no sku) and tripped Semrush
    // validators on every discounted variant. Google reads the AggregateOffer
    // sibling + the variant URL (?variant=...) + the variant SKU for size
    // disambiguation in Shopping; the inner Product wasn't adding signal.
    return offer;
  });

  const additionalProperty = buildAdditionalProperties(product);

  // Image list is built defensively — schema validators reject an
  // empty image: [] array (the field is supposed to be either omitted
  // or non-empty). Fall back to featuredImage, then omit entirely if
  // the product has no images at all. SEMrush 20260521 fix.
  const imageUrls = product.images.length
    ? product.images.map((i) => i.url)
    : product.featuredImage
      ? [product.featuredImage.url]
      : [];

  // Brand name needs to be non-empty. product.vendor is a free-text
  // Shopify field — when a merchant hasn't set a vendor it's an empty
  // string, which renders as { name: '' } and fires a validator error.
  // SEMrush 20260521 fix: omit the brand block when vendor is blank.
  const vendorTrimmed = product.vendor?.trim() ?? '';

  // Description — Shopify returns this as a string but can be empty
  // for products where the merchant hasn't filled out the body. Emitting
  // `description: ""` is invalid per Google's Product spec (and
  // SEMrush validators), so omit the field when empty. Same guard
  // pattern as the brand + image fields below. SEMrush 20260521_1
  // follow-up — each of the 335 flagged PDPs had this single error.
  const descriptionTrimmed = product.description?.slice(0, 5000).trim() ?? '';

  const productLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    '@id': `${productUrl}#product`,
    url: productUrl,
    // breadcrumb @id ties this Product to the BreadcrumbList emitted
    // alongside it (same layout.tsx render). Google's structured-data
    // graph parses the two as connected entities for a single page
    // instead of two disjoint nodes.
    breadcrumb: { '@id': `${productUrl}#breadcrumb` },
    name: product.title,
    ...(descriptionTrimmed ? { description: descriptionTrimmed } : {}),
    ...(firstSku ? { sku: firstSku, mpn: firstSku } : {}),
    ...(vendorTrimmed ? { brand: { '@type': 'Brand', name: vendorTrimmed } } : {}),
    ...(product.productType ? { category: product.productType } : {}),
    ...(product.specs.materialType ? { material: product.specs.materialType } : {}),
    ...(imageUrls.length > 0 ? { image: imageUrls } : {}),
    // dateModified signals content freshness to Google. Shopify's
    // Storefront API exposes updatedAt on every Product (it bumps on
    // any merchant edit — price, copy, image, variant change). Helps
    // Rich Results show "Updated 2 days ago" on competitive queries.
    ...(product.updatedAt ? { dateModified: product.updatedAt } : {}),
    ...(additionalProperty.length > 0 ? { additionalProperty } : {}),
    offers: {
      '@type': 'AggregateOffer',
      priceCurrency: min.currencyCode,
      lowPrice: min.amount,
      highPrice: max.amount,
      offerCount: product.variants.length,
      availability: product.availableForSale ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      itemCondition: 'https://schema.org/NewCondition',
      // Individual per-variant Offers — Google reads these for variant-
      // level pricing in Shopping rich results. Each carries its own
      // SKU/MPN, size label, return policy, and shipping details.
      offers: variantOffers,
    },
    ...(product.reviews
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: product.reviews.rating.toFixed(1),
            reviewCount: product.reviews.count,
            bestRating: '5',
            worstRating: '1',
          },
        }
      : {}),
  };

  // Primary-collection-aware breadcrumb. When the product is in a real
  // category collection (memory-foam-mattresses, hybrid-mattresses,
  // tempur-pedic-mattresses, etc.), insert it as position 3. Falls back
  // to the 2-level (Home → Mattresses → Product) path when the product
  // has no real category — meta-only or uncategorized.
  // Must match the visible PDP breadcrumb (app/products/[handle]/page.tsx)
  // exactly; Google flags JSON-LD breadcrumbs that diverge from the
  // visible page in Search Console as a structured-data mismatch.
  const primaryCollection = pickPrimaryCollection(product.collections);
  const breadcrumbItems: unknown[] = [
    { '@type': 'ListItem', position: 1, name: 'Home',       item: `${SITE}/` },
    { '@type': 'ListItem', position: 2, name: 'Mattresses', item: `${SITE}/collections/mattresses` },
  ];
  if (primaryCollection) {
    breadcrumbItems.push({
      '@type': 'ListItem',
      position: breadcrumbItems.length + 1,
      name: primaryCollection.title,
      item: `${SITE}/collections/${primaryCollection.handle}`,
    });
  }
  breadcrumbItems.push({
    '@type': 'ListItem',
    position: breadcrumbItems.length + 1,
    name: product.title,
    item: productUrl,
  });
  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    '@id': `${productUrl}#breadcrumb`,
    itemListElement: breadcrumbItems,
  };

  return [
    { key: 'ld-product', data: productLd },
    { key: 'ld-breadcrumb-product', data: breadcrumbLd },
  ];
}
