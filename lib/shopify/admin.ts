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
import * as Sentry from '@sentry/nextjs';

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
export type DashboardOrderSummaryWithTrends = DashboardOrderSummary & {
  prev: { totalOrders: number; totalRevenue: number; avgOrderValue: number } | null;
  daily: DashboardDailyPoint[];
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

/**
 * Extract the numeric portion of a Shopify GID (e.g.
 * gid://shopify/Product/12345 -> "12345"). Used to build
 * admin.shopify.com deep-links from GraphQL IDs.
 */
export function numericIdFromGid(gid: string): string {
  const m = /\/(\d+)$/.exec(gid);
  return m ? m[1] : gid;
}

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
};

export async function getCustomerInsights(days = 30): Promise<DashboardCustomerInsights | null> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const data = await adminGql<{
    orders: {
      nodes: Array<{
        id: string;
        totalPriceSet: { shopMoney: { amount: string; currencyCode: string } };
        customer: {
          id: string;
          displayName: string | null;
          numberOfOrders: string | number | null;
        } | null;
      }>;
    };
  }>(
    `query CustomerInsights($q: String!) {
      orders(first: 250, query: $q, sortKey: CREATED_AT, reverse: true) {
        nodes {
          id
          totalPriceSet { shopMoney { amount currencyCode } }
          customer { id displayName numberOfOrders }
        }
      }
    }`,
    { q: `created_at:>=${since}` },
  );
  if (!data) return null;
  const orders = data.orders.nodes;
  let newCustomers = 0;
  let returningCustomers = 0;
  const byCustomer = new Map<string, { displayName: string; orders: number; revenue: number; currency: string }>();
  for (const o of orders) {
    if (!o.customer) continue;
    const cid = o.customer.id;
    // numberOfOrders is returned as a string from Shopify; coerce defensively.
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
  const totalCustomers = byCustomer.size;
  const repeatInWindow = [...byCustomer.values()].filter((c) => c.orders >= 2).length;
  const repeatRatePct = totalCustomers > 0 ? (repeatInWindow / totalCustomers) * 100 : 0;
  const topRepeaters = [...byCustomer.entries()]
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
  return {
    totalCustomers,
    newCustomers,
    returningCustomers,
    repeatInWindow,
    repeatRatePct,
    topRepeaters,
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
