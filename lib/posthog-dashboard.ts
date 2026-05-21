/**
 * Dashboard data fetchers for /admin/dashboard, layered on top of
 * lib/posthog-query.ts. Each fetcher returns its widget's typed data
 * shape, or null on failure (gates the "data unavailable" state).
 *
 * Queries are intentionally simple HogQL — anything more complex
 * (true funnels with order enforcement, retention) should be a saved
 * PostHog Insight and deep-linked from the dashboard rather than
 * reimplemented client-side. The point of this module is the
 * single-pane-of-glass overview, not a PostHog UI replacement.
 */

import 'server-only';
import { hogQL } from './posthog-query';

/* ------------------------------------------------------------------------ *
 * Conversion funnel — counts per event, all unique persons, last N days
 *
 * Note: this is a parallel-event count, not a strict-order funnel.
 * The values are directionally correct (each step <= the prior step
 * under the assumption the journey is monotonic) but a user who
 * fired add_to_cart without a preceding plp_view is still counted
 * in both numerators. For exact funnels with order enforcement, use
 * PostHog's Funnels insight (deep-linked from the widget header).
 * ------------------------------------------------------------------------ */

export type FunnelStep = { event: string; label: string; persons: number };
export type ConversionFunnel = { days: number; steps: FunnelStep[] };

const FUNNEL_STEPS: Array<{ event: string; label: string }> = [
  { event: 'plp_view',         label: 'Browsed PLP' },
  { event: 'pdp_view',         label: 'Viewed PDP' },
  { event: 'add_to_cart',      label: 'Added to cart' },
  { event: 'cart_view',        label: 'Viewed cart' },
  { event: 'checkout_started', label: 'Started checkout' },
  { event: 'order_completed',  label: 'Completed order' },
];

export async function getConversionFunnel(days = 30): Promise<ConversionFunnel | null> {
  const data = await hogQL(`
    SELECT event, count(DISTINCT person_id) AS persons
    FROM events
    WHERE event IN ('plp_view', 'pdp_view', 'add_to_cart', 'cart_view', 'checkout_started', 'order_completed')
      AND timestamp >= now() - INTERVAL ${days} DAY
    GROUP BY event
  `);
  if (!data) return null;
  const counts = new Map<string, number>();
  for (const row of data.results) {
    const ev = String(row[0]);
    const n = Number(row[1] ?? 0);
    counts.set(ev, n);
  }
  return {
    days,
    steps: FUNNEL_STEPS.map((s) => ({
      event: s.event,
      label: s.label,
      persons: counts.get(s.event) ?? 0,
    })),
  };
}

/**
 * Phase 300: conversion funnel for the previous period of equal length,
 * ending `days` ago. Powers the dashboard's "vs previous N days" delta
 * on the overall conversion rate (last step / first step).
 *
 * Same HogQL shape as getConversionFunnel, just with a different
 * timestamp window. Returned as a parallel ConversionFunnel so the
 * caller can compute deltas client-side without re-implementing the
 * step mapping.
 */
export async function getConversionFunnelPrev(days = 30): Promise<ConversionFunnel | null> {
  const data = await hogQL(`
    SELECT event, count(DISTINCT person_id) AS persons
    FROM events
    WHERE event IN ('plp_view', 'pdp_view', 'add_to_cart', 'cart_view', 'checkout_started', 'order_completed')
      AND timestamp >= now() - INTERVAL ${days * 2} DAY
      AND timestamp <  now() - INTERVAL ${days} DAY
    GROUP BY event
  `);
  if (!data) return null;
  const counts = new Map<string, number>();
  for (const row of data.results) {
    counts.set(String(row[0]), Number(row[1] ?? 0));
  }
  return {
    days,
    steps: FUNNEL_STEPS.map((s) => ({
      event: s.event,
      label: s.label,
      persons: counts.get(s.event) ?? 0,
    })),
  };
}

/* ------------------------------------------------------------------------ *
 * Top entry pages + bounce rate, last N days
 *
 * Uses a CTE to compute per-session stats (pageview count + entry path)
 * then aggregates back by entry path. ClickHouse / HogQL support CTEs.
 * Sessions without an attached $session_id are excluded (they break
 * the bounce metric) — that's a small minority on this stack since
 * PostHog autocapture stamps every event with a session_id.
 * ------------------------------------------------------------------------ */

export type EntryPage = {
  path: string;
  sessions: number;
  bounces: number;
  bouncePct: number;
};

export async function getTopEntryPages(days = 7, limit = 10): Promise<EntryPage[] | null> {
  const data = await hogQL(`
    WITH session_stats AS (
      SELECT
        properties.$session_id AS sid,
        countIf(event = '$pageview') AS pv,
        argMin(properties.$pathname, timestamp) AS entry_path
      FROM events
      WHERE timestamp >= now() - INTERVAL ${days} DAY
        AND properties.$session_id IS NOT NULL
        AND properties.$session_id != ''
      GROUP BY sid
    )
    SELECT
      entry_path,
      count() AS sessions,
      countIf(pv = 1) AS bounces,
      round(100.0 * countIf(pv = 1) / count(), 1) AS bounce_pct
    FROM session_stats
    WHERE entry_path != '' AND entry_path IS NOT NULL
    GROUP BY entry_path
    ORDER BY sessions DESC
    LIMIT ${limit}
  `);
  if (!data) return null;
  return data.results.map((r) => ({
    path: String(r[0] ?? ''),
    sessions: Number(r[1] ?? 0),
    bounces: Number(r[2] ?? 0),
    bouncePct: Number(r[3] ?? 0),
  }));
}

/* ------------------------------------------------------------------------ *
 * Top search queries + zero-result rate, last N days
 *
 * Depends on the `search` event added in PostHog Phase 1. Until that
 * event has been firing for a while the table will be sparse — the
 * widget renders "no data yet" in that case.
 * ------------------------------------------------------------------------ */

export type SearchQuery = {
  query: string;
  searches: number;
  zeroResult: number;
  zeroPct: number;
};

export async function getTopSearches(days = 30, limit = 15): Promise<SearchQuery[] | null> {
  const data = await hogQL(`
    SELECT
      lower(trim(toString(properties.query))) AS q,
      count() AS searches,
      countIf(toString(properties.result_count) = '0') AS zero_result,
      round(100.0 * countIf(toString(properties.result_count) = '0') / count(), 1) AS zero_pct
    FROM events
    WHERE event = 'search'
      AND timestamp >= now() - INTERVAL ${days} DAY
      AND properties.query IS NOT NULL
      AND toString(properties.query) != ''
    GROUP BY q
    ORDER BY searches DESC
    LIMIT ${limit}
  `);
  if (!data) return null;
  return data.results.map((r) => ({
    query: String(r[0] ?? ''),
    searches: Number(r[1] ?? 0),
    zeroResult: Number(r[2] ?? 0),
    zeroPct: Number(r[3] ?? 0),
  }));
}

/* ------------------------------------------------------------------------ *
 * Top traffic sources — utm_source, falling back to referrer host
 * ------------------------------------------------------------------------ */

export type TrafficSource = {
  source: string;
  visitors: number;
  sessions: number;
};

export async function getTopTrafficSources(days = 30, limit = 10): Promise<TrafficSource[] | null> {
  const data = await hogQL(`
    SELECT
      coalesce(
        nullif(toString(properties.utm_source), ''),
        nullif(toString(properties.session_referrer_host), ''),
        '(direct)'
      ) AS source,
      count(DISTINCT person_id) AS visitors,
      count(DISTINCT properties.$session_id) AS sessions
    FROM events
    WHERE event = '$pageview'
      AND timestamp >= now() - INTERVAL ${days} DAY
    GROUP BY source
    ORDER BY visitors DESC
    LIMIT ${limit}
  `);
  if (!data) return null;
  return data.results.map((r) => ({
    source: String(r[0] ?? '(unknown)'),
    visitors: Number(r[1] ?? 0),
    sessions: Number(r[2] ?? 0),
  }));
}

/* ------------------------------------------------------------------------ *
 * Quiz funnel — started → completed → recommendation clicked
 *
 * "Started" = any person who fired at least one quiz_step.
 * "Completed" = any person who fired quiz_completed.
 * "Clicked" = any person who fired quiz_recommendation_clicked.
 *
 * Drop-off computed in TS for clarity. Like the main conversion
 * funnel, this is parallel-event counts, not order-enforced — but
 * the events are ordered by construction in the SleepQuiz state
 * machine, so the approximation is tight.
 * ------------------------------------------------------------------------ */

export type QuizFunnel = {
  days: number;
  started: number;
  completed: number;
  clicked: number;
};

export async function getQuizFunnel(days = 30): Promise<QuizFunnel | null> {
  const data = await hogQL(`
    SELECT event, count(DISTINCT person_id) AS persons
    FROM events
    WHERE event IN ('quiz_step', 'quiz_completed', 'quiz_recommendation_clicked')
      AND timestamp >= now() - INTERVAL ${days} DAY
    GROUP BY event
  `);
  if (!data) return null;
  const counts = new Map<string, number>();
  for (const row of data.results) {
    counts.set(String(row[0]), Number(row[1] ?? 0));
  }
  return {
    days,
    started: counts.get('quiz_step') ?? 0,
    completed: counts.get('quiz_completed') ?? 0,
    clicked: counts.get('quiz_recommendation_clicked') ?? 0,
  };
}

/**
 * Phase 300b: quiz funnel for the previous period of equal length.
 * Same shape as getQuizFunnel, windowed to days*2..days ago. Caller
 * computes completion-rate / click-rate deltas vs the current period.
 */
export async function getQuizFunnelPrev(days = 30): Promise<QuizFunnel | null> {
  const data = await hogQL(`
    SELECT event, count(DISTINCT person_id) AS persons
    FROM events
    WHERE event IN ('quiz_step', 'quiz_completed', 'quiz_recommendation_clicked')
      AND timestamp >= now() - INTERVAL ${days * 2} DAY
      AND timestamp <  now() - INTERVAL ${days} DAY
    GROUP BY event
  `);
  if (!data) return null;
  const counts = new Map<string, number>();
  for (const row of data.results) {
    counts.set(String(row[0]), Number(row[1] ?? 0));
  }
  return {
    days,
    started: counts.get('quiz_step') ?? 0,
    completed: counts.get('quiz_completed') ?? 0,
    clicked: counts.get('quiz_recommendation_clicked') ?? 0,
  };
}

/* ------------------------------------------------------------------------ *
 * Device breakdown — sessions + order_completed by $device_type
 *
 * Surfaces the mobile-vs-desktop conversion gap. Mobile traffic on a
 * mattress site usually 70-80% of sessions, but desktop converts at
 * 2-3x the rate — so the gap matters for merchandising decisions
 * (mobile-first hero copy, cart UX investment, etc).
 * ------------------------------------------------------------------------ */

export type DeviceRow = {
  deviceType: string;
  sessions: number;
  orders: number;
  conversionPct: number;
};

export async function getDeviceBreakdown(days = 30): Promise<DeviceRow[] | null> {
  const data = await hogQL(`
    SELECT
      coalesce(nullif(toString(properties.$device_type), ''), '(unknown)') AS device,
      count(DISTINCT properties.$session_id) AS sessions,
      countIf(event = 'order_completed') AS orders
    FROM events
    WHERE timestamp >= now() - INTERVAL ${days} DAY
      AND properties.$session_id IS NOT NULL
    GROUP BY device
    ORDER BY sessions DESC
    LIMIT 6
  `);
  if (!data) return null;
  return data.results.map((row) => {
    const deviceType = String(row[0] ?? '(unknown)');
    const sessions = Number(row[1] ?? 0);
    const orders = Number(row[2] ?? 0);
    return {
      deviceType,
      sessions,
      orders,
      conversionPct: sessions > 0 ? (orders / sessions) * 100 : 0,
    };
  });
}

/* ------------------------------------------------------------------------ *
 * Revenue by acquisition source — uses initial_utm_source person prop
 * + order_completed value, last N days
 *
 * Uses person-level properties (initial_utm_source set on first
 * landing) so a return-visitor purchase still attributes to the
 * acquisition channel, not "(direct)" from the return visit. Falls
 * back to session-scope utm if initial isn't set.
 * ------------------------------------------------------------------------ */

export type RevenueBySource = {
  source: string;
  orders: number;
  revenue: number;
};

export async function getRevenueBySource(days = 30, limit = 8): Promise<RevenueBySource[] | null> {
  const data = await hogQL(`
    SELECT
      coalesce(
        nullif(toString(person.properties.initial_utm_source), ''),
        nullif(toString(properties.utm_source), ''),
        nullif(toString(person.properties.initial_referrer_host), ''),
        nullif(toString(properties.session_referrer_host), ''),
        '(direct)'
      ) AS source,
      count() AS orders,
      sum(toFloatOrZero(toString(properties.value))) AS revenue
    FROM events
    WHERE event = 'order_completed'
      AND timestamp >= now() - INTERVAL ${days} DAY
    GROUP BY source
    ORDER BY revenue DESC
    LIMIT ${limit}
  `);
  if (!data) return null;
  return data.results.map((r) => ({
    source: String(r[0] ?? '(unknown)'),
    orders: Number(r[1] ?? 0),
    revenue: Number(r[2] ?? 0),
  }));
}

/* ------------------------------------------------------------------------ *
 * Showroom traffic — pageviews + sessions on each of the 5 LA showroom
 * pages, last N days.
 *
 * The five canonical showroom pages live at /pages/<handle> and the
 * handles come from lib/showrooms.ts (the same source the storefront
 * Showrooms section + showroom-detail page use). The query filters
 * $pageview events to these paths and aggregates per-page so the
 * dashboard can answer "which showroom is getting the most online
 * attention" without the merchant having to scroll through Top entry
 * pages and pick out the rows by hand.
 *
 * Zero-traffic showrooms are included in the output (with pageviews =
 * sessions = 0) so the card always renders all five locations — easier
 * to read than a list that hides quiet branches.
 * ------------------------------------------------------------------------ */

export type ShowroomTrafficRow = {
  handle: string;
  /** Human-readable showroom name from lib/showrooms.ts ("Hancock Park"). */
  name: string;
  /** The /pages/<handle> URL, exposed for in-card deep-link rendering. */
  pagePath: string;
  pageviews: number;
  sessions: number;
};

export async function getShowroomTraffic(
  days = 30,
  showrooms: ReadonlyArray<{ handle: string; name: string }>,
): Promise<ShowroomTrafficRow[] | null> {
  if (showrooms.length === 0) return [];

  // Build the HogQL `IN ('a', 'b', ...)` list from the showroom handles.
  // Handles come from a code-defined const (lib/showrooms.ts) so SQL-
  // injection concerns don't apply — defensively single-quote anyway.
  const paths = showrooms.map((s) => `/pages/${s.handle}`);
  const inList = paths.map((p) => `'${p.replace(/'/g, "\\'")}'`).join(', ');

  const data = await hogQL(`
    SELECT
      toString(properties.$pathname) AS path,
      count() AS pageviews,
      count(DISTINCT properties.$session_id) AS sessions
    FROM events
    WHERE event = '$pageview'
      AND timestamp >= now() - INTERVAL ${days} DAY
      AND toString(properties.$pathname) IN (${inList})
    GROUP BY path
  `);
  if (!data) return null;

  // PostHog returns one row per path that actually had traffic. Map by
  // pathname so we can left-join against the canonical showroom list —
  // the renderer wants all 5 rows even when some have 0 traffic.
  const byPath = new Map<string, { pageviews: number; sessions: number }>();
  for (const row of data.results) {
    const p = String(row[0] ?? '');
    byPath.set(p, {
      pageviews: Number(row[1] ?? 0),
      sessions: Number(row[2] ?? 0),
    });
  }

  return showrooms.map((s) => {
    const pagePath = `/pages/${s.handle}`;
    const hit = byPath.get(pagePath);
    return {
      handle: s.handle,
      name: s.name,
      pagePath,
      pageviews: hit?.pageviews ?? 0,
      sessions: hit?.sessions ?? 0,
    };
  }).sort((a, b) => b.pageviews - a.pageviews);
}
