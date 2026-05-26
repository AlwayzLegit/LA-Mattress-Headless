/**
 * Shopify Admin API client — server-only.
 *
 * Used by the `/admin` route to surface metrics the Storefront
 * API can't reach (orders, revenue, inventory, customer counts). Reads
 * `SHOPIFY_ADMIN_TOKEN` from the env, which is the same secret the
 * scripts/seo-*.mjs backfills use.
 *
 * No-throws — returns null on failure so the dashboard widget renders a
 * "data unavailable" state instead of crashing the page. Logs failures
 * to console.error for Vercel function logs.
 */

import 'server-only';
import * as Sentry from '@sentry/nextjs';
import { numericIdFromGid } from './gid';
import {
  summarizeCustomerLifetime,
  type CustomerLifetimeSummary,
} from '@/lib/dashboard/customer-lifetime';
import { aggregateRefundsByLineItem } from '@/lib/dashboard/refund-aggregation';

// Re-export so admin.ts callers can keep their `import { numericIdFromGid }
// from '@/lib/shopify/admin'` paths unchanged. The pure helper now lives
// in ./gid so the unit-test suite can import it without `server-only`.
export { numericIdFromGid };

// Read env vars per-call (not at module init) so Vercel env-var updates
// take effect on the next function invocation without needing a redeploy.
// Wrapped in a helper to keep call sites tidy.
function adminConfig(): { store: string | undefined; token: string | undefined; version: string } {
  return {
    store: process.env.SHOPIFY_STORE_DOMAIN,
    token: process.env.SHOPIFY_ADMIN_TOKEN,
    version: process.env.SHOPIFY_API_VERSION ?? '2024-10',
  };
}

// Snapshot at module load for the dashboard's "configured?" check —
// this stays a one-shot read because the dashboard page guards with it
// at render time, which already gives the most-recent value per request
// (server components re-evaluate the import on each render in dev / on
// each cold start in prod).
export const ADMIN_CONFIGURED = Boolean(process.env.SHOPIFY_STORE_DOMAIN && process.env.SHOPIFY_ADMIN_TOKEN);

export async function adminGql<T>(query: string, variables: Record<string, unknown> = {}): Promise<T | null> {
  const { store, token, version } = adminConfig();
  if (!store || !token) {
    const msg = `[admin.ts] Missing env: SHOPIFY_STORE_DOMAIN=${Boolean(store)} SHOPIFY_ADMIN_TOKEN=${Boolean(token)}`;
    console.error(msg);
    Sentry.captureMessage(msg, 'error');
    return null;
  }
  const queryFirstLine = query.trim().split('\n')[0].slice(0, 80);
  try {
    const res = await fetch(`https://${store}/admin/api/${version}/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': token,
      },
      body: JSON.stringify({ query, variables }),
      next: { revalidate: 300, tags: ['admin-dashboard'] },
    });
    if (!res.ok) {
      const body = await res.text();
      const msg = `[admin.ts] HTTP ${res.status} on \`${queryFirstLine}\`: ${body.slice(0, 500)}`;
      console.error(msg);
      Sentry.captureMessage(msg, 'error');
      return null;
    }
    const json = await res.json();
    if (json.errors) {
      const msg = `[admin.ts] GraphQL errors on \`${queryFirstLine}\`: ${JSON.stringify(json.errors).slice(0, 800)}`;
      console.error(msg);
      Sentry.captureMessage(msg, 'error');
      return null;
    }
    return json.data as T;
  } catch (err) {
    const msg = `[admin.ts] fetch failed on \`${queryFirstLine}\`: ${err instanceof Error ? err.message : String(err)}`;
    console.error(msg);
    Sentry.captureException(err instanceof Error ? err : new Error(msg));
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

/**
 * Phase 300: order summary enriched with previous-period totals + a
 * daily revenue/orders series for the sparkline. Two parallel Admin
 * GraphQL queries — current window + previous window of equal length
 * ending at `now() - days`. Daily series is built client-side from
 * the current-window orders (no extra query).
 *
 * Used by the dashboard's range-picker (7d / 30d / 90d) to show
 * "X orders, +Y% vs previous N days" deltas and inline sparklines.
 */
export type DashboardDailyPoint = { date: string; orders: number; revenue: number };
/**
 * Hour-of-day bucket — 24 entries, hour ∈ [0, 23] in the store's
 * physical timezone (America/Los_Angeles). Aggregated across every
 * day in the current window so the dashboard can render a "when do
 * orders come in" view independent of which calendar day they
 * happened on. PT chosen (cowork 20260521 follow-up; was UTC) so
 * the merchant doesn't have to do a 7-8h mental subtraction.
 */
export type DashboardHourPoint = { hour: number; orders: number; revenue: number };
export type DashboardOrderSummaryWithTrends = DashboardOrderSummary & {
  prev: { totalOrders: number; totalRevenue: number; avgOrderValue: number } | null;
  daily: DashboardDailyPoint[];
  hourly: DashboardHourPoint[];
};

export async function getOrderSummaryWithTrends(days = 30): Promise<DashboardOrderSummaryWithTrends | null> {
  const now = Date.now();
  const msPerDay = 24 * 60 * 60 * 1000;
  const sinceCurrent = new Date(now - days * msPerDay).toISOString();
  const untilPrev = new Date(now - days * msPerDay).toISOString();
  const sincePrev = new Date(now - 2 * days * msPerDay).toISOString();

  const query = `query OrderRange($q: String!) {
    orders(first: 250, query: $q, sortKey: CREATED_AT, reverse: true) {
      nodes {
        id name createdAt
        totalPriceSet { shopMoney { amount currencyCode } }
        customer { displayName }
        displayFulfillmentStatus
        displayFinancialStatus
      }
    }
  }`;

  type Row = {
    id: string; name: string; createdAt: string;
    totalPriceSet: { shopMoney: { amount: string; currencyCode: string } };
    customer: { displayName: string | null } | null;
    displayFulfillmentStatus: string | null;
    displayFinancialStatus: string | null;
  };

  const [current, prev] = await Promise.all([
    adminGql<{ orders: { nodes: Row[] } }>(query, { q: `created_at:>=${sinceCurrent}` }),
    adminGql<{ orders: { nodes: Row[] } }>(query, { q: `created_at:>=${sincePrev} created_at:<${untilPrev}` }),
  ]);

  if (!current) return null;

  const orders = current.orders.nodes;
  const totalRevenue = orders.reduce(
    (sum, o) => sum + Number.parseFloat(o.totalPriceSet.shopMoney.amount || '0'),
    0,
  );
  const currency = orders[0]?.totalPriceSet.shopMoney.currencyCode ?? 'USD';

  // Daily bucket — keyed by YYYY-MM-DD in UTC so the series is
  // deterministic regardless of the server's local timezone. Zero-fill
  // missing days so the sparkline renders as a continuous line rather
  // than collapsing on quiet days.
  const buckets = new Map<string, { orders: number; revenue: number }>();
  for (let i = 0; i < days; i++) {
    const d = new Date(now - i * msPerDay);
    const key = d.toISOString().slice(0, 10);
    buckets.set(key, { orders: 0, revenue: 0 });
  }
  for (const o of orders) {
    const key = o.createdAt.slice(0, 10);
    const b = buckets.get(key);
    if (b) {
      b.orders += 1;
      b.revenue += Number.parseFloat(o.totalPriceSet.shopMoney.amount || '0');
    }
  }
  const daily: DashboardDailyPoint[] = Array.from(buckets.entries())
    .map(([date, v]) => ({ date, orders: v.orders, revenue: v.revenue }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Hour-of-day bucket — 24 fixed slots in America/Los_Angeles, zero-
  // filled. Counts how many orders fall into each hour across every
  // day in the window, so a 30-day window with one order/day at 2pm PT
  // gives buckets[14] = 30. Renderer turns this into the "when do
  // orders come in" heatmap.
  //
  // Cowork 20260521 follow-up: was UTC, which forced the merchant to
  // do a 7-8h mental subtraction every time they read the card. Five
  // physical showrooms in LA + a customer base concentrated in
  // California → America/Los_Angeles is the operationally correct
  // zone. Hardcoded for this single-store deploy; if the dashboard
  // ever ships multi-store, swap to `Shop.ianaTimezone` from the
  // Shopify Admin API.
  const STORE_TZ = 'America/Los_Angeles';
  const hourFmt = new Intl.DateTimeFormat('en-US', {
    timeZone: STORE_TZ,
    hour: 'numeric',
    hour12: false,
  });
  const hourlyBuckets: DashboardHourPoint[] = Array.from({ length: 24 }, (_, h) => ({
    hour: h, orders: 0, revenue: 0,
  }));
  for (const o of orders) {
    // Intl.DateTimeFormat returns '0' through '23' (en-US, hour12:false).
    // '24' would mean midnight-end-of-day in some locales; en-US uses
    // '0' so the modulo is defensive, not load-bearing.
    const hour = Number(hourFmt.format(new Date(o.createdAt))) % 24;
    const bucket = hourlyBuckets[hour];
    if (bucket) {
      bucket.orders += 1;
      bucket.revenue += Number.parseFloat(o.totalPriceSet.shopMoney.amount || '0');
    }
  }

  let prevSummary: DashboardOrderSummaryWithTrends['prev'] = null;
  if (prev) {
    const prevOrders = prev.orders.nodes;
    const prevRevenue = prevOrders.reduce(
      (sum, o) => sum + Number.parseFloat(o.totalPriceSet.shopMoney.amount || '0'),
      0,
    );
    prevSummary = {
      totalOrders: prevOrders.length,
      totalRevenue: prevRevenue,
      avgOrderValue: prevOrders.length ? prevRevenue / prevOrders.length : 0,
    };
  }

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
    prev: prevSummary,
    daily,
    hourly: hourlyBuckets,
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
  // Phase 300b: productId added so the dashboard can render a
  // "Fix in Shopify" deep link straight to each gap'd product's
  // editor without a second lookup.
  sampleProducts: Array<{ id: string; handle: string; title: string; gap: string }>;
};

export async function getSeoGaps(): Promise<DashboardSeoGaps | null> {
  // Sample first 100 active products and compute gap rates. Full
  // catalog would require pagination; sampling is fine for a dashboard.
  const data = await adminGql<{
    products: {
      nodes: Array<{
        id: string;
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
          id handle title
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
      samples.push({
        id: numericIdFromGid(p.id),
        handle: p.handle,
        title: p.title,
        gap: noTitle ? 'seo.title' : 'image',
      });
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


/* ────────────────────────────────────────────────────────────────────── *
 * Blog SEO health — article-level gaps that drive the SEMrush
 * "structured-data errors" + "content not optimized" flags.
 *
 * Each gap maps to a real risk:
 *
 *   - missingImage  → BlogPosting JSON-LD falls back to the sitewide
 *                     logo (valid schema, but Google's content
 *                     guidelines prefer an article-representative image).
 *   - missingAuthor → BlogPosting JSON-LD falls back to an Organization
 *                     author stub (valid, but a real Person author
 *                     strengthens E-E-A-T).
 *   - missingSeoTitle / missingSeoDescription → falls back to the
 *                     article title / excerpt for SERP. Custom values
 *                     give the merchant control over the snippet.
 *   - thinContent   → article body below ~250 words. Maps to SEMrush's
 *                     "Low word count" + "Content not optimized" flags.
 *
 * Sample-based (first N active articles by recency). 250 covers about
 * 35% of the corpus on a single Admin GraphQL roundtrip; the gap-rate
 * extrapolates reliably to the whole catalog.
 *
 * Returns a list of sample articles with their gap so the dashboard
 * can deep-link the merchant straight to the Shopify Admin editor.
 * ────────────────────────────────────────────────────────────────────── */

export type DashboardBlogSeoGaps = {
  sampleSize: number;
  articlesMissingImage: number;
  articlesMissingAuthor: number;
  articlesMissingSeoTitle: number;
  articlesMissingSeoDescription: number;
  articlesThinContent: number;  // body < THIN_WORD_FLOOR words
  /** Sample articles to highlight (with gap + Admin deep-link). */
  sampleArticles: Array<{
    id: string;
    handle: string;
    title: string;
    blogHandle: string;
    /** Which gap surfaced this article into the sample. */
    gap: 'image' | 'author' | 'seo-title' | 'seo-description' | 'thin-content';
  }>;
};

/** Threshold below which an article is flagged "thin". Mirrors Google's
 *  rough cut-off for content-quality signals; SEMrush flags below ~250. */
const THIN_WORD_FLOOR = 250;

export async function getBlogSeoGaps(sampleSize = 250): Promise<DashboardBlogSeoGaps | null> {
  const first = Math.min(Math.max(sampleSize, 1), 250);
  // Shopify Admin Article doesn't expose an `seo` field directly (only
  // Storefront does); the SEO title / description live in metafields
  // under the standard `global.title_tag` / `global.description_tag`
  // namespace+key pair the platform writes when a merchant fills in
  // the SEO section of the article editor.
  const data = await adminGql<{
    articles: {
      nodes: Array<{
        id: string;
        handle: string;
        title: string;
        body: string | null;
        image: { id: string } | null;
        author: { name: string | null } | null;
        summary: string | null;
        blog: { handle: string };
        seoTitle: { value: string | null } | null;
        seoDescription: { value: string | null } | null;
      }>;
    };
  }>(
    `query BlogSeoGaps($first: Int!) {
      articles(first: $first, sortKey: PUBLISHED_AT, reverse: true, query: "published_status:published") {
        nodes {
          id handle title body summary
          image { id }
          author { name }
          blog { handle }
          seoTitle: metafield(namespace: "global", key: "title_tag") { value }
          seoDescription: metafield(namespace: "global", key: "description_tag") { value }
        }
      }
    }`,
    { first },
  );
  if (!data) return null;

  const articles = data.articles.nodes;
  let missingImage = 0;
  let missingAuthor = 0;
  let missingTitle = 0;
  let missingDescription = 0;
  let thin = 0;
  const samples: DashboardBlogSeoGaps['sampleArticles'] = [];

  for (const a of articles) {
    const noImage = !a.image;
    const noAuthor = !a.author?.name?.trim();
    const noTitle = !a.seoTitle?.value?.trim();
    const noDesc = !a.seoDescription?.value?.trim();
    // Body word count — strip HTML, collapse whitespace. Body is null
    // for articles with no content (Storefront API quirk).
    const bodyText = (a.body ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    const wordCount = bodyText ? bodyText.split(' ').length : 0;
    const isThin = wordCount > 0 && wordCount < THIN_WORD_FLOOR;

    if (noImage) missingImage += 1;
    if (noAuthor) missingAuthor += 1;
    if (noTitle) missingTitle += 1;
    if (noDesc) missingDescription += 1;
    if (isThin) thin += 1;

    // Prioritize the most-visible gaps in the sample list. One sample
    // per article — surface the FIRST gap that hit.
    if (samples.length < 12) {
      let gap: DashboardBlogSeoGaps['sampleArticles'][number]['gap'] | null = null;
      if (isThin) gap = 'thin-content';
      else if (noImage) gap = 'image';
      else if (noAuthor) gap = 'author';
      else if (noDesc) gap = 'seo-description';
      else if (noTitle) gap = 'seo-title';
      if (gap) {
        samples.push({
          id: numericIdFromGid(a.id),
          handle: a.handle,
          title: a.title,
          blogHandle: a.blog.handle,
          gap,
        });
      }
    }
  }

  return {
    sampleSize: articles.length,
    articlesMissingImage: missingImage,
    articlesMissingAuthor: missingAuthor,
    articlesMissingSeoTitle: missingTitle,
    articlesMissingSeoDescription: missingDescription,
    articlesThinContent: thin,
    sampleArticles: samples,
  };
}


/* ------------------------------------------------------------------------ *
 * Low-stock alerts — variants with inventoryQuantity at or below threshold
 *
 * Surfaces variants the merchant should reorder before they sell out.
 * Threshold defaults to 3 because mattresses are slow-turning inventory —
 * a "running low" signal needs to fire well before zero so reorder can
 * happen without missing same-day delivery promises. Threshold is a
 * parameter so the dashboard can tune it.
 *
 * Returns the offending variants with parent product info so the merchant
 * can deep-link straight to the Shopify Admin product editor.
 * ------------------------------------------------------------------------ */

export type DashboardLowStockVariant = {
  productId: string;        // numeric ID for Shopify admin URL
  productHandle: string;
  productTitle: string;
  variantTitle: string;
  sku: string | null;
  quantity: number;
};

export async function getLowStock(threshold = 3): Promise<DashboardLowStockVariant[] | null> {
  // Shopify variant search query: inventory_quantity:<=<n> + product status active.
  // Limit 20 — long lists past that bloat the card; merchant should drill
  // into Shopify Admin for the full report once any rows surface here.
  const data = await adminGql<{
    productVariants: {
      nodes: Array<{
        id: string;
        title: string;
        sku: string | null;
        inventoryQuantity: number | null;
        product: { id: string; handle: string; title: string; status: string };
      }>;
    };
  }>(
    `query LowStock($q: String!) {
      productVariants(first: 20, query: $q) {
        nodes {
          id title sku inventoryQuantity
          product { id handle title status }
        }
      }
    }`,
    { q: `inventory_quantity:<=${threshold} product_status:active` },
  );
  if (!data) return null;
  return data.productVariants.nodes
    // Defensive: the search query already excludes draft/archived but
    // belt-and-suspenders for the unlikely case the API returns one.
    .filter((v) => v.product.status === 'ACTIVE')
    .map((v) => ({
      productId: numericIdFromGid(v.product.id),
      productHandle: v.product.handle,
      productTitle: v.product.title,
      variantTitle: v.title,
      sku: v.sku,
      quantity: v.inventoryQuantity ?? 0,
    }))
    .sort((a, b) => a.quantity - b.quantity);
}

/* ------------------------------------------------------------------------ *
 * Single-order detail — powers /admin/orders/[id] drill-down
 *
 * Pulls everything one screen-worth of merchant context needs: line
 * items + their refunded quantities, fulfillment status + tracking,
 * payment status, refund history, customer info + lifetime order
 * count, shipping address, tags, internal note.
 *
 * One bigger query (vs N small ones) so the page renders in a single
 * Admin API round-trip. Shopify's GraphQL nested query cost is well
 * within the 1000-point budget for this shape.
 *
 * Returns null on any error so the page can render a "couldn't load
 * order — check Sentry" fallback rather than 500.
 * ------------------------------------------------------------------------ */

export type DashboardOrderDetailLineItem = {
  id: string;
  title: string;
  variantTitle: string | null;
  sku: string | null;
  quantity: number;
  /** Units that have been refunded across all refund records on this order. */
  quantityRefunded: number;
  /**
   * Dollar amount refunded on THIS line, aggregated across all refund
   * records. Distinct from quantityRefunded — a restock-only refund
   * decrements the quantity without returning any money, so a line can
   * have quantityRefunded > 0 with amountRefunded = 0. The order detail
   * page renders "(N refunded, $X)" when amountRefunded > 0 and
   * "(N restocked, no refund)" when it's a pure inventory return.
   * QA round 2 B4.
   */
  amountRefunded: number;
  productId: string | null;
  productHandle: string | null;
  unitPrice: number;
  totalPrice: number;
  currency: string;
};

export type DashboardOrderDetailFulfillment = {
  id: string;
  status: string;
  createdAt: string;
  trackingInfo: Array<{ company: string | null; number: string | null; url: string | null }>;
};

export type DashboardOrderDetailRefund = {
  id: string;
  createdAt: string;
  totalRefunded: number;
  currency: string;
  note: string | null;
};

export type DashboardOrderDetail = {
  id: string;            // numeric ID for admin.shopify.com links
  gid: string;           // full GID for any return-trips
  name: string;          // "#4045"
  createdAt: string;
  processedAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  displayFinancialStatus: string | null;
  displayFulfillmentStatus: string | null;
  /** Current total — net of refunds. From Shopify's currentTotalPriceSet. */
  total: number;
  /**
   * Original total — what the customer was charged at order time. From
   * Shopify's totalPriceSet (no "current" prefix). Differs from `total`
   * for partially-refunded orders. Same value the dashboard's Recent
   * orders table shows in the Total column.
   */
  originalTotal: number;
  subtotal: number;
  totalTax: number;
  totalShipping: number;
  totalRefunded: number;
  currency: string;
  customer: {
    id: string | null;       // numeric ID for admin link
    displayName: string | null;
    email: string | null;
    phone: string | null;
    numberOfOrders: number | null;
  } | null;
  shippingAddress: { formatted: string[]; name: string | null } | null;
  lineItems: DashboardOrderDetailLineItem[];
  fulfillments: DashboardOrderDetailFulfillment[];
  refunds: DashboardOrderDetailRefund[];
  tags: string[];
  note: string | null;
};

export async function getOrderDetail(numericId: string): Promise<DashboardOrderDetail | null> {
  // Build the GID from the numeric ID the route segment carries. The
  // page validates this upstream with a /^\d+$/ check so we don't need
  // to guard against injection here (the value already came from a
  // typed URL pattern).
  const gid = `gid://shopify/Order/${numericId}`;

  const data = await adminGql<{
    order: {
      id: string;
      name: string;
      createdAt: string;
      processedAt: string | null;
      cancelledAt: string | null;
      cancelReason: string | null;
      displayFinancialStatus: string | null;
      displayFulfillmentStatus: string | null;
      currentTotalPriceSet: { shopMoney: { amount: string; currencyCode: string } };
      totalPriceSet: { shopMoney: { amount: string; currencyCode: string } };
      currentSubtotalPriceSet: { shopMoney: { amount: string; currencyCode: string } } | null;
      currentTotalTaxSet: { shopMoney: { amount: string; currencyCode: string } } | null;
      totalShippingPriceSet: { shopMoney: { amount: string; currencyCode: string } } | null;
      totalRefundedSet: { shopMoney: { amount: string; currencyCode: string } } | null;
      tags: string[];
      note: string | null;
      customer: {
        id: string;
        displayName: string | null;
        email: string | null;
        phone: string | null;
        numberOfOrders: string | number | null;
      } | null;
      shippingAddress: { formatted: string[]; name: string | null } | null;
      lineItems: {
        nodes: Array<{
          id: string;
          title: string;
          variantTitle: string | null;
          sku: string | null;
          quantity: number;
          refundableQuantity: number;
          originalUnitPriceSet: { shopMoney: { amount: string; currencyCode: string } };
          originalTotalSet: { shopMoney: { amount: string; currencyCode: string } };
          product: { id: string; handle: string } | null;
        }>;
      };
      fulfillments: Array<{
        id: string;
        status: string;
        createdAt: string;
        trackingInfo: Array<{ company: string | null; number: string | null; url: string | null }>;
      }>;
      refunds: Array<{
        id: string;
        createdAt: string;
        note: string | null;
        totalRefundedSet: { shopMoney: { amount: string; currencyCode: string } };
        refundLineItems: {
          nodes: Array<{
            quantity: number;
            restockType: string | null;
            lineItem: { id: string };
            subtotalSet: { shopMoney: { amount: string; currencyCode: string } };
          }>;
        };
      }>;
    } | null;
  }>(
    `query OrderDetail($id: ID!) {
      order(id: $id) {
        id name createdAt processedAt cancelledAt cancelReason
        displayFinancialStatus displayFulfillmentStatus
        currentTotalPriceSet { shopMoney { amount currencyCode } }
        totalPriceSet { shopMoney { amount currencyCode } }
        currentSubtotalPriceSet { shopMoney { amount currencyCode } }
        currentTotalTaxSet { shopMoney { amount currencyCode } }
        totalShippingPriceSet { shopMoney { amount currencyCode } }
        totalRefundedSet { shopMoney { amount currencyCode } }
        tags note
        customer { id displayName email phone numberOfOrders }
        shippingAddress { formatted name }
        lineItems(first: 50) {
          nodes {
            id title variantTitle sku quantity refundableQuantity
            originalUnitPriceSet { shopMoney { amount currencyCode } }
            originalTotalSet { shopMoney { amount currencyCode } }
            product { id handle }
          }
        }
        fulfillments(first: 10) {
          id status createdAt
          trackingInfo { company number url }
        }
        refunds(first: 10) {
          id createdAt note
          totalRefundedSet { shopMoney { amount currencyCode } }
          refundLineItems(first: 50) {
            nodes {
              quantity
              restockType
              lineItem { id }
              subtotalSet { shopMoney { amount currencyCode } }
            }
          }
        }
      }
    }`,
    { id: gid },
  );

  if (!data || !data.order) return null;
  const o = data.order;
  const currency = o.currentTotalPriceSet.shopMoney.currencyCode || 'USD';

  // QA round 2 B4: aggregate refundLineItems across every refund record
  // on the order, grouped by the original line item id. Powers the
  // per-line "(N refunded, $X)" vs "(N restocked, no refund)" callout.
  // Pure helper in lib/dashboard/refund-aggregation.ts so the
  // edge-case logic is unit-testable (cowork 20260521 follow-up).
  const refundsByLineItem = aggregateRefundsByLineItem(o.refunds);

  return {
    id: numericIdFromGid(o.id),
    gid: o.id,
    name: o.name,
    createdAt: o.createdAt,
    processedAt: o.processedAt,
    cancelledAt: o.cancelledAt,
    cancelReason: o.cancelReason,
    displayFinancialStatus: o.displayFinancialStatus,
    displayFulfillmentStatus: o.displayFulfillmentStatus,
    total: Number.parseFloat(o.currentTotalPriceSet.shopMoney.amount || '0'),
    originalTotal: Number.parseFloat(o.totalPriceSet.shopMoney.amount || '0'),
    subtotal: Number.parseFloat(o.currentSubtotalPriceSet?.shopMoney.amount || '0'),
    totalTax: Number.parseFloat(o.currentTotalTaxSet?.shopMoney.amount || '0'),
    totalShipping: Number.parseFloat(o.totalShippingPriceSet?.shopMoney.amount || '0'),
    totalRefunded: Number.parseFloat(o.totalRefundedSet?.shopMoney.amount || '0'),
    currency,
    customer: o.customer
      ? {
          id: numericIdFromGid(o.customer.id),
          displayName: o.customer.displayName,
          email: o.customer.email,
          phone: o.customer.phone,
          numberOfOrders: o.customer.numberOfOrders !== null && o.customer.numberOfOrders !== undefined
            ? Number(o.customer.numberOfOrders)
            : null,
        }
      : null,
    shippingAddress: o.shippingAddress,
    lineItems: o.lineItems.nodes.map((li) => ({
      id: li.id,
      title: li.title,
      variantTitle: li.variantTitle,
      sku: li.sku,
      quantity: li.quantity,
      // Shopify's `refundableQuantity` is what's LEFT refundable.
      // Refunded quantity = original quantity - refundable. Saturate at
      // 0 in case Shopify returns refundable > quantity (shouldn't but
      // belt-and-suspenders for the partial-refund edge case).
      quantityRefunded: Math.max(li.quantity - li.refundableQuantity, 0),
      // Dollar value of all refundLineItems matched to this line. Zero
      // when only restock-only refunds reduced the quantity (the
      // quantity went down without money being returned). QA round 2 B4.
      amountRefunded: refundsByLineItem.get(li.id) ?? 0,
      productId: li.product ? numericIdFromGid(li.product.id) : null,
      productHandle: li.product?.handle ?? null,
      unitPrice: Number.parseFloat(li.originalUnitPriceSet.shopMoney.amount || '0'),
      totalPrice: Number.parseFloat(li.originalTotalSet.shopMoney.amount || '0'),
      currency: li.originalUnitPriceSet.shopMoney.currencyCode || currency,
    })),
    fulfillments: o.fulfillments.map((f) => ({
      id: f.id,
      status: f.status,
      createdAt: f.createdAt,
      trackingInfo: f.trackingInfo ?? [],
    })),
    refunds: o.refunds.map((r) => ({
      id: r.id,
      createdAt: r.createdAt,
      totalRefunded: Number.parseFloat(r.totalRefundedSet.shopMoney.amount || '0'),
      currency: r.totalRefundedSet.shopMoney.currencyCode || currency,
      note: r.note,
    })),
    tags: o.tags ?? [],
    note: o.note,
  };
}

/**
 * (numericIdFromGid moved to ./gid.ts so the unit-test suite can import
 * the pure helper without dragging in server-only / Sentry. Re-exported
 * at the top of this file for callers using the old import path.)
 */

/* ------------------------------------------------------------------------ *
 * Customer insights — new vs returning + repeat purchase rate, in window
 *
 * "New" = orders where customer.numberOfOrders (lifetime, snapshot at the
 * order moment via Shopify's stored counter) is 1.
 * "Returning" = numberOfOrders >= 2.
 * "Repeat purchase rate" = customers with >= 2 orders within this window
 * divided by total unique customers within this window. This is the
 * in-window repeat rate, not the lifetime LTV repeat rate — chosen
 * because the dashboard already has a "window" mental model from the
 * range picker, and "did they come back within N days" is the
 * actionable signal for merchandising decisions.
 *
 * Pulls the same first-250 order page as getOrderSummaryWithTrends but
 * with a different selection set (customer focus). The two queries
 * could in theory be merged into one — left split because the customer
 * card is independently lazy-loadable in future and the GraphQL
 * response is small enough that two parallel calls are net-faster than
 * one bigger one through Shopify's rate-limit cost model.
 * ------------------------------------------------------------------------ */

export type DashboardCustomerInsights = {
  totalCustomers: number;
  newCustomers: number;
  returningCustomers: number;
  repeatInWindow: number;
  repeatRatePct: number;
  topRepeaters: Array<{
    customerId: string;
    displayName: string;
    ordersInWindow: number;
    revenueInWindow: number;
    currency: string;
  }>;
  /**
   * Previous-period customer split (same window length, ending `days`
   * ago). Powers the new-customer-share-down anomaly detector. Set to
   * null when the second query fails — dashboard still renders the
   * current-window card; the anomaly detector silently skips.
   */
  prev: {
    totalCustomers: number;
    newCustomers: number;
    returningCustomers: number;
  } | null;
};

/**
 * Pure aggregator — counts new vs returning + builds the topRepeaters
 * leaderboard from a list of orders with attached customer info. Used
 * for both the current and previous windows so the math is identical
 * (no drift between the two timeframes).
 */
function aggregateCustomerInsights(
  orders: Array<{
    totalPriceSet: { shopMoney: { amount: string; currencyCode: string } };
    customer: { id: string; displayName: string | null; numberOfOrders: string | number | null } | null;
  }>,
) {
  let newCustomers = 0;
  let returningCustomers = 0;
  const byCustomer = new Map<string, { displayName: string; orders: number; revenue: number; currency: string }>();
  for (const o of orders) {
    if (!o.customer) continue;
    const cid = o.customer.id;
    const lifetimeOrders = Number(o.customer.numberOfOrders ?? 0);
    if (lifetimeOrders <= 1) newCustomers += 1;
    else returningCustomers += 1;
    const amount = Number.parseFloat(o.totalPriceSet.shopMoney.amount || '0');
    const currency = o.totalPriceSet.shopMoney.currencyCode || 'USD';
    const existing = byCustomer.get(cid);
    if (existing) {
      existing.orders += 1;
      existing.revenue += amount;
    } else {
      byCustomer.set(cid, {
        displayName: o.customer.displayName ?? '(no name)',
        orders: 1,
        revenue: amount,
        currency,
      });
    }
  }
  return { newCustomers, returningCustomers, byCustomer };
}

export async function getCustomerInsights(days = 30): Promise<DashboardCustomerInsights | null> {
  const now = Date.now();
  const msPerDay = 24 * 60 * 60 * 1000;
  const sinceCurrent = new Date(now - days * msPerDay).toISOString();
  const untilPrev = new Date(now - days * msPerDay).toISOString();
  const sincePrev = new Date(now - 2 * days * msPerDay).toISOString();

  const query = `query CustomerInsights($q: String!) {
    orders(first: 250, query: $q, sortKey: CREATED_AT, reverse: true) {
      nodes {
        id
        totalPriceSet { shopMoney { amount currencyCode } }
        customer { id displayName numberOfOrders }
      }
    }
  }`;
  type OrderRow = {
    id: string;
    totalPriceSet: { shopMoney: { amount: string; currencyCode: string } };
    customer: { id: string; displayName: string | null; numberOfOrders: string | number | null } | null;
  };

  // Two parallel queries — current window + previous window of equal
  // length ending `days` ago. Same pattern as getOrderSummaryWithTrends.
  // Previous window is best-effort: failure leaves prev: null and the
  // anomaly detector silently skips that comparison.
  const [current, prev] = await Promise.all([
    adminGql<{ orders: { nodes: OrderRow[] } }>(query, { q: `created_at:>=${sinceCurrent}` }),
    adminGql<{ orders: { nodes: OrderRow[] } }>(query, {
      q: `created_at:>=${sincePrev} created_at:<${untilPrev}`,
    }),
  ]);
  if (!current) return null;

  const cur = aggregateCustomerInsights(current.orders.nodes);
  const totalCustomers = cur.byCustomer.size;
  const repeatInWindow = [...cur.byCustomer.values()].filter((c) => c.orders >= 2).length;
  const repeatRatePct = totalCustomers > 0 ? (repeatInWindow / totalCustomers) * 100 : 0;
  const topRepeaters = [...cur.byCustomer.entries()]
    .filter(([, c]) => c.orders >= 2)
    .sort((a, b) => b[1].orders - a[1].orders || b[1].revenue - a[1].revenue)
    .slice(0, 6)
    .map(([id, c]) => ({
      customerId: numericIdFromGid(id),
      displayName: c.displayName,
      ordersInWindow: c.orders,
      revenueInWindow: c.revenue,
      currency: c.currency,
    }));

  let prevSummary: DashboardCustomerInsights['prev'] = null;
  if (prev) {
    const p = aggregateCustomerInsights(prev.orders.nodes);
    prevSummary = {
      totalCustomers: p.byCustomer.size,
      newCustomers: p.newCustomers,
      returningCustomers: p.returningCustomers,
    };
  }

  return {
    totalCustomers,
    newCustomers: cur.newCustomers,
    returningCustomers: cur.returningCustomers,
    repeatInWindow,
    repeatRatePct,
    topRepeaters,
    prev: prevSummary,
  };
}

/* ------------------------------------------------------------------------ *
 * Refund / cancellation health — orders by financial + cancellation status
 *
 * Counts the share of in-window orders that ended up refunded (full or
 * partial) or cancelled. A spike here usually points at product-quality
 * issues, delivery breakdowns, or fraud — all of which the merchant
 * needs to see ASAP, not in the next monthly report.
 *
 * Cancellation reasons are bucketed into the standard Shopify enum
 * values (CUSTOMER, FRAUD, INVENTORY, DECLINED, OTHER) — empty bucket
 * means no cancellations of that type, kept in output for stable shape.
 * ------------------------------------------------------------------------ */

export type DashboardRefundHealth = {
  totalOrders: number;
  refundedOrders: number;
  partiallyRefundedOrders: number;
  cancelledOrders: number;
  refundRatePct: number;
  cancellationRatePct: number;
  refundedRevenue: number;
  currency: string;
  cancelReasonBuckets: Array<{ reason: string; count: number }>;
};

export async function getRefundHealth(days = 30): Promise<DashboardRefundHealth | null> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const data = await adminGql<{
    orders: {
      nodes: Array<{
        id: string;
        cancelledAt: string | null;
        cancelReason: string | null;
        displayFinancialStatus: string | null;
        totalRefundedSet: { shopMoney: { amount: string; currencyCode: string } } | null;
        currentTotalPriceSet: { shopMoney: { amount: string; currencyCode: string } };
      }>;
    };
  }>(
    `query RefundHealth($q: String!) {
      orders(first: 250, query: $q, sortKey: CREATED_AT, reverse: true) {
        nodes {
          id
          cancelledAt
          cancelReason
          displayFinancialStatus
          totalRefundedSet { shopMoney { amount currencyCode } }
          currentTotalPriceSet { shopMoney { amount currencyCode } }
        }
      }
    }`,
    { q: `created_at:>=${since}` },
  );
  if (!data) return null;
  const orders = data.orders.nodes;
  let refundedOrders = 0;
  let partiallyRefundedOrders = 0;
  let cancelledOrders = 0;
  let refundedRevenue = 0;
  let currency = 'USD';
  const reasonCounts = new Map<string, number>();
  for (const o of orders) {
    if (o.cancelledAt) {
      cancelledOrders += 1;
      const r = o.cancelReason ?? 'OTHER';
      reasonCounts.set(r, (reasonCounts.get(r) ?? 0) + 1);
    }
    if (o.displayFinancialStatus === 'REFUNDED') refundedOrders += 1;
    else if (o.displayFinancialStatus === 'PARTIALLY_REFUNDED') partiallyRefundedOrders += 1;
    if (o.totalRefundedSet) {
      refundedRevenue += Number.parseFloat(o.totalRefundedSet.shopMoney.amount || '0');
      currency = o.totalRefundedSet.shopMoney.currencyCode || currency;
    } else if (o.currentTotalPriceSet) {
      currency = o.currentTotalPriceSet.shopMoney.currencyCode || currency;
    }
  }
  const totalOrders = orders.length;
  return {
    totalOrders,
    refundedOrders,
    partiallyRefundedOrders,
    cancelledOrders,
    refundRatePct: totalOrders > 0 ? ((refundedOrders + partiallyRefundedOrders) / totalOrders) * 100 : 0,
    cancellationRatePct: totalOrders > 0 ? (cancelledOrders / totalOrders) * 100 : 0,
    refundedRevenue,
    currency,
    cancelReasonBuckets: [...reasonCounts.entries()]
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count),
  };
}

/* ------------------------------------------------------------------------ *
 * Customer Lifetime Value — sample of top customers by lifetime spend
 *
 * Powers the LTV + lifecycle-distribution cards in the dashboard's
 * Customers section. Returns a Shopify-sorted top-N (default 250) so
 * the bucketing surfaces the SHAPE of the top of the customer curve
 * rather than the unbiased population. The existing window-scoped
 * getCustomerInsights answers "what % of THIS window's customers are
 * repeat"; this one answers "who are our best lifetime customers and
 * how many repeat orders does the top of the curve have".
 *
 * Single Shopify query — sortKey=AMOUNT_SPENT, reverse=true. Each
 * page is 250 customers max per Shopify's limit; we take one page.
 * Returns null on any fetch error (dashboard renders a "data
 * unavailable" state per the no-throws convention).
 * ------------------------------------------------------------------------ */

export type DashboardCustomerLifetime = CustomerLifetimeSummary;

export async function getCustomerLifetime(sampleSize = 250): Promise<DashboardCustomerLifetime | null> {
  // Clamp the sample size to Shopify's per-page max of 250 — the API
  // rejects larger first: values with a parse error. Anything below
  // 250 is accepted as-is.
  const first = Math.min(Math.max(sampleSize, 1), 250);

  const data = await adminGql<{
    customers: {
      nodes: Array<{
        id: string;
        displayName: string | null;
        email: string | null;
        numberOfOrders: string | number | null;
        amountSpent: { amount: string; currencyCode: string };
      }>;
    };
  }>(
    `query CustomerLifetime($first: Int!) {
      customers(first: $first, sortKey: AMOUNT_SPENT, reverse: true) {
        nodes {
          id
          displayName
          email
          numberOfOrders
          amountSpent { amount currencyCode }
        }
      }
    }`,
    { first },
  );
  if (!data) return null;

  // Map raw Shopify response into the shape the pure summarizer expects.
  // numberOfOrders comes back as a string from Shopify (GraphQL
  // UnsignedInt64 scalar) — defensive coerce to number.
  const customers = data.customers.nodes.map((c) => ({
    id: numericIdFromGid(c.id),
    displayName: c.displayName ?? '(no name)',
    email: c.email,
    ordersCount: Number(c.numberOfOrders ?? 0),
    amountSpent: Number.parseFloat(c.amountSpent.amount || '0'),
    currency: c.amountSpent.currencyCode || 'USD',
  }));

  return summarizeCustomerLifetime(customers);
}

/* ────────────────────────────────────────────────────────────────────── *
 * Repeat-buyer gap analysis — for customers with 2+ lifetime orders,
 * how long do they wait between purchases?
 *
 * For a mattress retailer where the primary product lasts 7-10 years,
 * "true" cohort retention is near-zero. But the customers who DO buy
 * again typically do so for predictable reasons:
 *
 *   - Same-day / same-week: add-on orders for the same household
 *     (mattress + frame, sheets, etc.) that split between two
 *     transactions instead of one.
 *   - Same-month: planned follow-ups (delayed bedding, second
 *     mattress for a guest room).
 *   - Quarterly to yearly: another room / family member buying.
 *   - Long-term (1y+): replacement cycle.
 *
 * Each bucket tells a different merchandising story; the distribution
 * is the actionable signal.
 *
 * Implementation note: Shopify Admin's `customer.orders` connection
 * is restricted to the last 60 days without the `read_all_orders`
 * scope. For repeat-buyer historical data we use `customer.createdAt`
 * (when the customer record was created, ≈ first checkout) as the
 * proxy for "first order date" — accurate within hours for customers
 * who placed their first order via the storefront. `lastOrder.createdAt`
 * is queryable as a direct field (no connection restriction).
 *
 * Sample: top 250 repeat customers (filtered server-side by
 * `orders_count:>1`), sorted newest-first by customer createdAt so
 * recently-acquired repeat buyers surface in the dashboard.
 * ────────────────────────────────────────────────────────────────────── */

export type RepeatBuyerGapBucket = {
  label: string;
  /** Lower bound in days (inclusive). */
  minDays: number;
  /** Upper bound in days (exclusive). Number.POSITIVE_INFINITY for the open-ended top tier. */
  maxDays: number;
  customers: number;
};

export type DashboardRepeatBuyerGap = {
  sampleSize: number;
  /** Customers with 2+ lifetime orders that were sampled. */
  repeatCustomers: number;
  /** Median gap across the repeat-customer sample, in days. */
  medianGapDays: number;
  /** 25th percentile gap, in days. */
  p25GapDays: number;
  /** 75th percentile gap, in days. */
  p75GapDays: number;
  buckets: RepeatBuyerGapBucket[];
};

const REPEAT_GAP_BUCKETS: ReadonlyArray<Pick<RepeatBuyerGapBucket, 'label' | 'minDays' | 'maxDays'>> = [
  { label: 'Same day (< 24h)',      minDays: 0,    maxDays: 1 },
  { label: 'Same week (1-7d)',      minDays: 1,    maxDays: 7 },
  { label: 'Same month (7-30d)',    minDays: 7,    maxDays: 30 },
  { label: 'Quarterly (30-90d)',    minDays: 30,   maxDays: 90 },
  { label: 'Half-year (90-180d)',   minDays: 90,   maxDays: 180 },
  { label: 'Annual (180-365d)',     minDays: 180,  maxDays: 365 },
  { label: 'Multi-year (365d+)',    minDays: 365,  maxDays: Number.POSITIVE_INFINITY },
];

function percentile(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) return 0;
  const idx = (sortedAsc.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sortedAsc[lo];
  const frac = idx - lo;
  return sortedAsc[lo] * (1 - frac) + sortedAsc[hi] * frac;
}

export async function getRepeatBuyerGap(sampleSize = 250): Promise<DashboardRepeatBuyerGap | null> {
  const first = Math.min(Math.max(sampleSize, 1), 250);
  const data = await adminGql<{
    customers: {
      nodes: Array<{
        id: string;
        numberOfOrders: string | number | null;
        createdAt: string;
        lastOrder: { createdAt: string } | null;
      }>;
    };
  }>(
    `query RepeatBuyerGap($first: Int!) {
      customers(first: $first, sortKey: CREATED_AT, reverse: true, query: "orders_count:>1") {
        nodes {
          id numberOfOrders createdAt
          lastOrder { createdAt }
        }
      }
    }`,
    { first },
  );
  if (!data) return null;

  // For each customer, compute gap = (lastOrder.createdAt - customer.createdAt) days.
  // Customer.createdAt is when the record was created — accurate within
  // hours of the first checkout for storefront-acquired customers.
  // Customers with numberOfOrders === 1 are filtered server-side; defensive
  // re-check here in case the Shopify filter behavior changes.
  const gaps: number[] = [];
  for (const c of data.customers.nodes) {
    if (Number(c.numberOfOrders ?? 0) < 2 || !c.lastOrder?.createdAt) continue;
    const first = new Date(c.createdAt).getTime();
    const last = new Date(c.lastOrder.createdAt).getTime();
    if (!Number.isFinite(first) || !Number.isFinite(last) || last < first) continue;
    const days = (last - first) / 86400000;
    gaps.push(days);
  }

  gaps.sort((a, b) => a - b);
  const buckets = REPEAT_GAP_BUCKETS.map((b) => ({
    ...b,
    customers: gaps.filter((d) => d >= b.minDays && d < b.maxDays).length,
  }));

  return {
    sampleSize: data.customers.nodes.length,
    repeatCustomers: gaps.length,
    medianGapDays: percentile(gaps, 0.5),
    p25GapDays: percentile(gaps, 0.25),
    p75GapDays: percentile(gaps, 0.75),
    buckets,
  };
}

/* ────────────────────────────────────────────────────────────────────── *
 * Order classification — new vs repeat customer breakdown for the window
 *
 * For each order in the last N days, classify by the customer's
 * lifetime order count (Shopify's `customer.numberOfOrders` at fetch
 * time). Buckets:
 *
 *   - first:  numberOfOrders == 1 → the customer's first-ever order
 *             (only possible if this order IS that first one)
 *   - second: numberOfOrders == 2 → first repeat, the "did they come
 *             back?" milestone
 *   - loyal:  numberOfOrders >= 3 → multiple repeat purchases
 *
 * Each bucket carries count + revenue + derived AOV. The split is the
 * single most actionable customer-segmentation view for the merchant —
 * it answers "are we acquiring new buyers or just servicing existing
 * ones" without needing a multi-month cohort analysis.
 *
 * Caveats:
 *   - numberOfOrders is point-in-time at fetch, not order-time. A
 *     customer who placed 3 orders this week shows numberOfOrders=3 on
 *     all 3. So the "first" bucket really counts orders from customers
 *     whose lifetime total is still 1 (no follow-up yet). Close enough
 *     for a top-of-page health check; not a true cohort analysis.
 *   - Guest checkouts (no customer attached) are counted in a fourth
 *     `guest` bucket so they don't get misclassified as "first".
 * ────────────────────────────────────────────────────────────────────── */

export type DashboardCustomerTier = {
  count: number;
  revenue: number;
  avgOrderValue: number;
};

export type DashboardOrderClassification = {
  currency: string;
  totalOrders: number;
  totalRevenue: number;
  first: DashboardCustomerTier;
  second: DashboardCustomerTier;
  loyal: DashboardCustomerTier;
  guest: DashboardCustomerTier;
};

export async function getOrderClassification(days = 30): Promise<DashboardOrderClassification | null> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  // Pull a generous page of orders for the window. Shopify caps `first`
  // at 250; that's enough for ~250 orders per window which covers the
  // entire current-period dataset for any range this dashboard supports
  // (7d / 30d / 90d) given the merchant's current order volume.
  const data = await adminGql<{
    orders: {
      nodes: Array<{
        id: string;
        totalPriceSet: { shopMoney: { amount: string; currencyCode: string } };
        customer: { id: string; numberOfOrders: string | number | null } | null;
      }>;
    };
  }>(
    `query OrderClassification($q: String!) {
      orders(first: 250, query: $q, sortKey: CREATED_AT, reverse: true) {
        nodes {
          id
          totalPriceSet { shopMoney { amount currencyCode } }
          customer { id numberOfOrders }
        }
      }
    }`,
    { q: `created_at:>=${since}` },
  );
  if (!data) return null;

  const orders = data.orders.nodes;
  const currency = orders[0]?.totalPriceSet.shopMoney.currencyCode ?? 'USD';

  const buckets = {
    first: { count: 0, revenue: 0 },
    second: { count: 0, revenue: 0 },
    loyal: { count: 0, revenue: 0 },
    guest: { count: 0, revenue: 0 },
  };
  let totalRevenue = 0;

  for (const o of orders) {
    const revenue = Number.parseFloat(o.totalPriceSet.shopMoney.amount || '0');
    totalRevenue += revenue;
    if (!o.customer) {
      buckets.guest.count++;
      buckets.guest.revenue += revenue;
      continue;
    }
    const n = Number(o.customer.numberOfOrders ?? 0);
    if (n <= 1) {
      buckets.first.count++;
      buckets.first.revenue += revenue;
    } else if (n === 2) {
      buckets.second.count++;
      buckets.second.revenue += revenue;
    } else {
      buckets.loyal.count++;
      buckets.loyal.revenue += revenue;
    }
  }

  const finalize = (b: { count: number; revenue: number }): DashboardCustomerTier => ({
    count: b.count,
    revenue: b.revenue,
    avgOrderValue: b.count > 0 ? b.revenue / b.count : 0,
  });

  return {
    currency,
    totalOrders: orders.length,
    totalRevenue,
    first: finalize(buckets.first),
    second: finalize(buckets.second),
    loyal: finalize(buckets.loyal),
    guest: finalize(buckets.guest),
  };
}
