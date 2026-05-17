/**
 * Product-page JSON-LD, rendered by app/products/[handle]/layout.tsx —
 * OUTSIDE the in-page <Suspense fallback={ProductSkeleton}> fast-path
 * in page.tsx. When the id-bearing <script>s lived inside that
 * suspended subtree, React's hidden streaming-source node (#S:0) was
 * left in the DOM on hard load, duplicating Product + BreadcrumbList
 * (cowork QA). Same fix class as lib/page-jsonld.ts (#166).
 *
 * Objects + derivations reproduced verbatim from the previous inline
 * construction in ProductView (page.tsx). Do not "improve" the shapes.
 */
import type { getProductByHandle } from '@/lib/shopify';

type Product = NonNullable<Awaited<ReturnType<typeof getProductByHandle>>>;
export type ProductLd = { key: string; data: unknown };

export function getProductJsonLd(product: Product): ProductLd[] {
  const min = product.priceRange.minVariantPrice;
  const max = product.priceRange.maxVariantPrice;
  const firstSku = product.variants.find((v) => v.sku && v.sku.trim().length > 0)?.sku;
  const productUrl = `https://www.mattressstoreslosangeles.com/products/${product.handle}`;

  const productLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    '@id': `${productUrl}#product`,
    url: productUrl,
    name: product.title,
    description: product.description.slice(0, 5000),
    ...(firstSku ? { sku: firstSku } : {}),
    brand: { '@type': 'Brand', name: product.vendor },
    ...(product.productType ? { category: product.productType } : {}),
    image: product.images.length ? product.images.map((i) => i.url) : (product.featuredImage ? [product.featuredImage.url] : []),
    offers: {
      '@type': 'AggregateOffer',
      priceCurrency: min.currencyCode,
      lowPrice: min.amount,
      highPrice: max.amount,
      offerCount: product.variants.length,
      availability: product.availableForSale ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      itemCondition: 'https://schema.org/NewCondition',
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

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home',       item: 'https://www.mattressstoreslosangeles.com/' },
      { '@type': 'ListItem', position: 2, name: 'Mattresses', item: 'https://www.mattressstoreslosangeles.com/collections/mattresses' },
      { '@type': 'ListItem', position: 3, name: product.title, item: productUrl },
    ],
  };

  return [
    { key: 'ld-product', data: productLd },
    { key: 'ld-breadcrumb-product', data: breadcrumbLd },
  ];
}
