/**
 * Shopify Admin API client — server-only.
 *
 * Used by the `/admin/dashboard` route to surface metrics the Storefront
 * API can't reach (orders, revenue, inventory, customer counts). Reads
 * `SHOPIFY_ADMIN_TOKEN` from the env, which is the same secret the
 * scripts/seo-*.mjs backfills use.
 *
 * No-throws — returns null on failure so the dashboard widget renders a
 * "data unavailable" state instead of crashing the page. Logs failures
 * to console.error for Vercel function logs.
 */

import 'server-only';

const STORE = process.env.SHOPIFY_STORE_DOMAIN;
const TOKEN = process.env.SHOPIFY_ADMIN_TOKEN;
const VERSION = process.env.SHOPIFY_API_VERSION ?? '2024-10';

export const ADMIN_CONFIGURED = Boolean(STORE && TOKEN);

export async function adminGql<T>(query: string, variables: Record<string, unknown> = {}): Promise<T | null> {
  if (!ADMIN_CONFIGURED) return null;
  try {
    const res = await fetch(`https://${STORE}/admin/api/${VERSION}/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': TOKEN!,
      },
      body: JSON.stringify({ query, variables }),
      // Dashboard data is fresh-ish — cache for 5 minutes to avoid
      // hammering Admin API on every refresh.
      next: { revalidate: 300, tags: ['admin-dashboard'] },
    });
    if (!res.ok) {
      console.error(`[admin.ts] GraphQL HTTP ${res.status}: ${await res.text()}`);
      return null;
    }
    const json = await res.json();
    if (json.errors) {
      console.error(`[admin.ts] GraphQL errors: ${JSON.stringify(json.errors)}`);
      return null;
    }
    return json.data as T;
  } catch (err) {
    console.error(`[admin.ts] fetch failed: ${err instanceof Error ? err.message : err}`);
    return null;
  }
}

/* ------------------------------------------------------------------------ *
 * Dashboard data fetchers
 * ------------------------------------------------------------------------ */

export type DashboardOrderSummary = {
  totalOrders: number;
  totalRevenue: number;
  currency: string;
  avgOrderValue: number;
  recentOrders: Array<{
    id: string;
    name: string;
    createdAt: string;
    total: number;
    currency: string;
    customer: string | null;
    fulfillmentStatus: string | null;
    financialStatus: string | null;
  }>;
};

export async function getOrderSummary(days = 30): Promise<DashboardOrderSummary | null> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const data = await adminGql<{
    orders: {
      nodes: Array<{
        id: string;
        name: string;
        createdAt: string;
        totalPriceSet: { shopMoney: { amount: string; currencyCode: string } };
        customer: { displayName: string | null } | null;
        displayFulfillmentStatus: string | null;
        displayFinancialStatus: string | null;
      }>;
    };
  }>(
    `query OrderSummary($q: String!) {
      orders(first: 50, query: $q, sortKey: CREATED_AT, reverse: true) {
        nodes {
          id name createdAt
          totalPriceSet { shopMoney { amount currencyCode } }
          customer { displayName }
          displayFulfillmentStatus
          displayFinancialStatus
        }
      }
    }`,
    { q: `created_at:>=${since}` },
  );
  if (!data) return null;
  const orders = data.orders.nodes;
  const totalRevenue = orders.reduce(
    (sum, o) => sum + Number.parseFloat(o.totalPriceSet.shopMoney.amount || '0'),
    0,
  );
  const currency = orders[0]?.totalPriceSet.shopMoney.currencyCode ?? 'USD';
  return {
    totalOrders: orders.length,
    totalRevenue,
    currency,
    avgOrderValue: orders.length ? totalRevenue / orders.length : 0,
    recentOrders: orders.slice(0, 10).map((o) => ({
      id: o.id,
      name: o.name,
      createdAt: o.createdAt,
      total: Number.parseFloat(o.totalPriceSet.shopMoney.amount || '0'),
      currency: o.totalPriceSet.shopMoney.currencyCode,
      customer: o.customer?.displayName ?? null,
      fulfillmentStatus: o.displayFulfillmentStatus,
      financialStatus: o.displayFinancialStatus,
    })),
  };
}

export type DashboardCatalogHealth = {
  totalProducts: number;
  publishedProducts: number;
  draftProducts: number;
  missingSeoTitle: number;
  missingSeoDescription: number;
  missingImages: number;
  outOfStock: number;
  totalCollections: number;
  collectionsWithIntroShort: number;
  collectionsWithSeoContent: number;
  collectionsWithDescriptionHtml: number;
};

export async function getCatalogHealth(): Promise<DashboardCatalogHealth | null> {
  const data = await adminGql<{
    publishedProducts: { count: number };
    draftProducts: { count: number };
    productsCount: { count: number };
    collections: {
      nodes: Array<{
        descriptionHtml: string | null;
        introShort: { value: string } | null;
        seoContent: { value: string } | null;
      }>;
    };
  }>(
    `query CatalogHealth {
      productsCount(query: "status:active OR status:draft") { count }
      publishedProducts: productsCount(query: "status:active AND published_status:online_store_channel") { count }
      draftProducts: productsCount(query: "status:draft") { count }
      collections(first: 100, sortKey: ID) {
        nodes {
          descriptionHtml
          introShort: metafield(namespace: "custom", key: "intro_short") { value }
          seoContent: metafield(namespace: "custom", key: "seo_content") { value }
        }
      }
    }`,
  );
  if (!data) return null;
  // For the missing-seo + image counts we need to iterate the products
  // separately; cheaper to fetch from the storefront-side data we
  // already have. Returning the cheap counts here; the storefront
  // counts get layered in by the page when it has both.
  const colls = data.collections.nodes;
  const totalProducts = data.productsCount?.count ?? 0;
  const publishedProducts = data.publishedProducts?.count ?? 0;
  const draftProducts = data.draftProducts?.count ?? 0;
  return {
    totalProducts,
    publishedProducts,
    draftProducts,
    missingSeoTitle: 0, // populated by page-level join
    missingSeoDescription: 0,
    missingImages: 0,
    outOfStock: 0,
    totalCollections: colls.length,
    collectionsWithIntroShort: colls.filter((c) => c.introShort?.value?.trim()).length,
    collectionsWithSeoContent: colls.filter((c) => c.seoContent?.value?.trim()).length,
    collectionsWithDescriptionHtml: colls.filter((c) => c.descriptionHtml?.trim()).length,
  };
}

export type DashboardTopProducts = {
  topByQuantity: Array<{
    productId: string;
    productTitle: string;
    productHandle: string;
    quantity: number;
    revenue: number;
    currency: string;
  }>;
};

export async function getTopProducts(days = 30): Promise<DashboardTopProducts | null> {
  // Aggregating sales requires iterating order line_items. For a
  // dashboard summary we pull the recent orders and aggregate
  // client-side in this function.
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const data = await adminGql<{
    orders: {
      nodes: Array<{
        lineItems: {
          nodes: Array<{
            quantity: number;
            originalTotalSet: { shopMoney: { amount: string; currencyCode: string } };
            product: { id: string; title: string; handle: string } | null;
          }>;
        };
      }>;
    };
  }>(
    `query TopProducts($q: String!) {
      orders(first: 100, query: $q, sortKey: CREATED_AT, reverse: true) {
        nodes {
          lineItems(first: 25) {
            nodes {
              quantity
              originalTotalSet { shopMoney { amount currencyCode } }
              product { id title handle }
            }
          }
        }
      }
    }`,
    { q: `created_at:>=${since}` },
  );
  if (!data) return null;
  const agg = new Map<
    string,
    { productId: string; productTitle: string; productHandle: string; quantity: number; revenue: number; currency: string }
  >();
  for (const order of data.orders.nodes) {
    for (const li of order.lineItems.nodes) {
      if (!li.product) continue;
      const key = li.product.id;
      const existing = agg.get(key);
      const lineRevenue = Number.parseFloat(li.originalTotalSet.shopMoney.amount || '0');
      if (existing) {
        existing.quantity += li.quantity;
        existing.revenue += lineRevenue;
      } else {
        agg.set(key, {
          productId: li.product.id,
          productTitle: li.product.title,
          productHandle: li.product.handle,
          quantity: li.quantity,
          revenue: lineRevenue,
          currency: li.originalTotalSet.shopMoney.currencyCode,
        });
      }
    }
  }
  const topByQuantity = [...agg.values()].sort((a, b) => b.quantity - a.quantity).slice(0, 10);
  return { topByQuantity };
}

export type DashboardSeoGaps = {
  productsMissingSeoTitle: number;
  productsMissingSeoDescription: number;
  productsMissingSku: number;
  productsMissingImage: number;
  sampleProducts: Array<{ handle: string; title: string; gap: string }>;
};

export async function getSeoGaps(): Promise<DashboardSeoGaps | null> {
  // Sample first 100 active products and compute gap rates. Full
  // catalog would require pagination; sampling is fine for a dashboard.
  const data = await adminGql<{
    products: {
      nodes: Array<{
        handle: string;
        title: string;
        seo: { title: string | null; description: string | null };
        featuredMedia: { id: string } | null;
        variants: { nodes: Array<{ sku: string | null }> };
      }>;
    };
  }>(
    `query SeoGaps {
      products(first: 100, query: "status:active", sortKey: ID) {
        nodes {
          handle title
          seo { title description }
          featuredMedia { id }
          variants(first: 1) { nodes { sku } }
        }
      }
    }`,
  );
  if (!data) return null;
  const products = data.products.nodes;
  let missingTitle = 0;
  let missingDesc = 0;
  let missingSku = 0;
  let missingImage = 0;
  const samples: DashboardSeoGaps['sampleProducts'] = [];
  for (const p of products) {
    const noTitle = !p.seo.title?.trim();
    const noDesc = !p.seo.description?.trim();
    const noSku = !p.variants.nodes[0]?.sku?.trim();
    const noImage = !p.featuredMedia;
    if (noTitle) missingTitle += 1;
    if (noDesc) missingDesc += 1;
    if (noSku) missingSku += 1;
    if (noImage) missingImage += 1;
    if (samples.length < 8 && (noTitle || noImage)) {
      samples.push({ handle: p.handle, title: p.title, gap: noTitle ? 'seo.title' : 'image' });
    }
  }
  return {
    productsMissingSeoTitle: missingTitle,
    productsMissingSeoDescription: missingDesc,
    productsMissingSku: missingSku,
    productsMissingImage: missingImage,
    sampleProducts: samples,
  };
}
