/**
 * Dashboard data fetchers for /admin, layered on top of
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
 * Search query conversion — which search queries drive purchases.
 *
 * Joins `search` events to `order_completed` events by session_id via a
 * HogQL CTE: per session, take the FIRST search query (via
 * `argMin(query, timestamp)`) and a converted flag, then aggregate by
 * query. Same session-attribution pattern as `getTopConvertingArticles`.
 *
 * Sample-size guarded: `HAVING sessions >= 5` so a single conversion on
 * a long-tail query doesn't inflate to 100%. Tail queries can still be
 * audited via the existing `getTopSearches` card (which shows volume +
 * zero-result %); this card is specifically for the "what converts"
 * decision.
 *
 * Caveats noted in source: per-session first-search attribution means
 * a session with multiple searches credits only the FIRST query. Same
 * heuristic GA4 and PostHog UI use by default.
 * ------------------------------------------------------------------------ */

export type SearchConversion = {
  query: string;
  sessions: number;
  orders: number;
  conversionPct: number;
};

export async function getSearchConversion(days = 30, limit = 10): Promise<SearchConversion[] | null> {
  const data = await hogQL(`
    WITH session_search AS (
      SELECT
        properties.$session_id AS sid,
        argMin(lower(trim(toString(properties.query))), timestamp) AS first_q,
        countIf(event = 'order_completed') > 0 AS converted
      FROM events
      WHERE timestamp >= now() - INTERVAL ${days} DAY
        AND properties.$session_id != ''
        AND (
          (event = 'search' AND toString(properties.query) != '')
          OR event = 'order_completed'
        )
      GROUP BY sid
      HAVING first_q != ''
    )
    SELECT
      first_q AS q,
      count() AS sessions,
      countIf(converted) AS orders,
      round(100.0 * countIf(converted) / count(), 2) AS conversion_pct
    FROM session_search
    GROUP BY q
    HAVING sessions >= 5
    ORDER BY orders DESC, sessions DESC
    LIMIT ${limit}
  `);
  if (!data) return null;
  return data.results.map((r) => ({
    query: String(r[0] ?? ''),
    sessions: Number(r[1] ?? 0),
    orders: Number(r[2] ?? 0),
    conversionPct: Number(r[3] ?? 0),
  }));
}

/* ------------------------------------------------------------------------ *
 * Web Vitals (LCP / INP / CLS / FCP / TTFB) — Google's Core Web Vitals
 * report shape: per-metric counts split into good / needs-improvement /
 * poor buckets, using Google's documented thresholds.
 *
 * Source: web_vital events fired client-side by app/_components/
 * analytics-ga4.tsx (via Next.js useReportWebVitals). Each event
 * carries metric_name, metric_value, metric_rating, metric_path.
 *
 * Buckets use Google's published thresholds (web.dev/vitals):
 *   - LCP:  good ≤ 2500ms,  ni ≤ 4000ms,  poor > 4000ms
 *   - INP:  good ≤ 200ms,   ni ≤ 500ms,   poor > 500ms
 *   - CLS:  good ≤ 0.1,     ni ≤ 0.25,    poor > 0.25
 *   - FCP:  good ≤ 1800ms,  ni ≤ 3000ms,  poor > 3000ms
 *   - TTFB: good ≤ 800ms,   ni ≤ 1800ms,  poor > 1800ms
 *
 * One HogQL query per metric (5 total) so each can apply its own
 * thresholds via countIf. Run in parallel; failures degrade gracefully
 * to null on a per-metric basis so a single PostHog hiccup doesn't
 * black out the whole card.
 *
 * Uses only allow-listed HogQL functions (count, countIf, toString,
 * toFloatOrZero, now). Bucket boundaries inlined as plain integers/
 * floats — safe because they're hard-coded constants, not user input.
 * ------------------------------------------------------------------------ */

const WEB_VITAL_METRICS = [
  { name: 'LCP',  goodMax: 2500,  niMax: 4000 },
  { name: 'INP',  goodMax: 200,   niMax: 500 },
  { name: 'CLS',  goodMax: 0.1,   niMax: 0.25 },
  { name: 'FCP',  goodMax: 1800,  niMax: 3000 },
  { name: 'TTFB', goodMax: 800,   niMax: 1800 },
] as const;

export type WebVitalRow = {
  /** Metric name as web-vitals reports it (LCP, INP, CLS, FCP, TTFB). */
  metric: string;
  /** Total samples in the window. */
  total: number;
  /** Samples whose value is in Google's "good" range. */
  good: number;
  /** Samples in the "needs improvement" range. */
  needsImprovement: number;
  /** Samples in the "poor" range. */
  poor: number;
  /** "Good" share as a 0-1 fraction. Google's pass criterion is
   *  goodShare ≥ 0.75 on each metric (a CWV-pass site). */
  goodShare: number;
};

async function fetchVitalRow(
  metric: { name: string; goodMax: number; niMax: number },
  days: number,
): Promise<WebVitalRow | null> {
  const data = await hogQL(`
    SELECT
      count() AS total,
      countIf(toFloatOrZero(toString(properties.metric_value)) <= ${metric.goodMax}) AS good_n,
      countIf(toFloatOrZero(toString(properties.metric_value)) > ${metric.goodMax}
              AND toFloatOrZero(toString(properties.metric_value)) <= ${metric.niMax}) AS ni_n,
      countIf(toFloatOrZero(toString(properties.metric_value)) > ${metric.niMax}) AS poor_n
    FROM events
    WHERE event = 'web_vital'
      AND toString(properties.metric_name) = '${metric.name}'
      AND timestamp >= now() - INTERVAL ${days} DAY
  `);
  if (!data || data.results.length === 0) return null;
  const [total, good, ni, poor] = data.results[0].map((v) => Number(v ?? 0));
  return {
    metric: metric.name,
    total,
    good,
    needsImprovement: ni,
    poor,
    goodShare: total > 0 ? good / total : 0,
  };
}

export async function getWebVitals(days = 30): Promise<WebVitalRow[] | null> {
  const rows = await Promise.all(WEB_VITAL_METRICS.map((m) => fetchVitalRow(m, days)));
  const populated = rows.filter((r): r is WebVitalRow => r !== null);
  return populated.length > 0 ? populated : null;
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
 * Quiz step drop-off — per-question participation count.
 *
 * SleepQuiz captures `quiz_step` events with { step, question_id,
 * choice, total_steps } per option-select (app/(storefront)/sleep-
 * quiz/sleep-quiz.tsx). Aggregating distinct persons per step yields
 * the participation funnel: which question is the bail-out point?
 *
 * Persons-per-step is naturally monotonically decreasing because once
 * a user advances past step N they've reached step N. Re-selects on
 * back-button visits don't inflate (countDistinct deduplicates by
 * person_id). Step 0 ≈ "started"; the last populated step ≈ "answered
 * all questions" (which should equal quiz_completed roughly).
 *
 * Drop-off-from-previous is computed in TS for clarity.
 * ------------------------------------------------------------------------ */

export type QuizStepDropoffRow = {
  /** 1-indexed step number, for display. */
  step: number;
  questionId: string;
  persons: number;
  /** Drop-off from the prior step in the array (0-1 fraction). 0 on step 1. */
  dropoffFromPrev: number;
};

export type QuizStepDropoff = {
  days: number;
  steps: QuizStepDropoffRow[];
  /** Total people who fired `quiz_completed` in the window — the
   *  expected "completed" tail of the funnel. */
  completedPersons: number;
};

export async function getQuizStepDropoff(days = 30): Promise<QuizStepDropoff | null> {
  // Two queries in parallel: per-step participation + completion count.
  // Step is stringified upfront because PostHog stores event properties
  // with their original JSON type and `toString` round-trips both number
  // and string cases cleanly (the allow-list-linted HogQL functions
  // include `toString` but exclude integer-conversion variants which
  // were proven unreliable in cowork 20260521).
  const [perStep, completed] = await Promise.all([
    hogQL(`
      SELECT
        toString(properties.step) AS step_str,
        toString(properties.question_id) AS question_id,
        count(DISTINCT person_id) AS persons
      FROM events
      WHERE event = 'quiz_step'
        AND timestamp >= now() - INTERVAL ${days} DAY
        AND properties.step != ''
      GROUP BY step_str, question_id
    `),
    hogQL(`
      SELECT count(DISTINCT person_id) AS persons
      FROM events
      WHERE event = 'quiz_completed'
        AND timestamp >= now() - INTERVAL ${days} DAY
    `),
  ]);
  if (!perStep) return null;

  // Parse + sort in TS. PostHog returns step as the stringified form;
  // coerce to number for ordering + display. The questionId carries
  // through for context labels.
  const parsed: Array<{ stepNum: number; questionId: string; persons: number }> = [];
  for (const row of perStep.results) {
    const stepNum = Number.parseInt(String(row[0] ?? ''), 10);
    if (!Number.isFinite(stepNum)) continue;
    parsed.push({
      stepNum,
      questionId: String(row[1] ?? ''),
      persons: Number(row[2] ?? 0),
    });
  }
  parsed.sort((a, b) => a.stepNum - b.stepNum);

  // Compute drop-off vs previous step. Step 0 (the first option-select)
  // has no prior step → dropoffFromPrev=0.
  const steps: QuizStepDropoffRow[] = parsed.map((row, i) => {
    const prev = i > 0 ? parsed[i - 1].persons : row.persons;
    const dropoff = prev > 0 ? Math.max(0, 1 - row.persons / prev) : 0;
    return {
      // 1-indexed for display ("Step 1" not "Step 0").
      step: row.stepNum + 1,
      questionId: row.questionId,
      persons: row.persons,
      dropoffFromPrev: dropoff,
    };
  });

  return {
    days,
    steps,
    completedPersons: Number(completed?.results[0]?.[0] ?? 0),
  };
}

/* ------------------------------------------------------------------------ *
 * Quiz results mix — what the quiz actually recommends.
 *
 * `quiz_completed` carries { recommended_type, completion_path } (see
 * app/(storefront)/sleep-quiz/sleep-quiz.tsx). Grouping by type shows
 * the recommendation distribution — the direct health check on the
 * Phase 231 recalibration (the original scoring bug routed 60-70% of
 * all paths to Hybrid; a relapse shows up here as one dominant slice).
 * `skipped` counts completions where the user hit "skip to results"
 * instead of answering everything — high skip share on a type means
 * its recommendations rest on thin answer data.
 * ------------------------------------------------------------------------ */

export type QuizResultsMixRow = {
  /** Recommendation display type, e.g. "Hybrid" — verbatim from the event. */
  type: string;
  /** Unique people who received this recommendation. */
  persons: number;
  /** Of those, how many arrived via the skip path (thin answer data). */
  skipped: number;
};

export async function getQuizResultsMix(days = 30): Promise<QuizResultsMixRow[] | null> {
  const data = await hogQL(`
    SELECT
      toString(properties.recommended_type) AS rec_type,
      count(DISTINCT person_id) AS persons,
      count(DISTINCT if(toString(properties.completion_path) = 'skipped', person_id, NULL)) AS skipped
    FROM events
    WHERE event = 'quiz_completed'
      AND timestamp >= now() - INTERVAL ${days} DAY
      AND toString(properties.recommended_type) != ''
    GROUP BY rec_type
    ORDER BY persons DESC
  `);
  if (!data) return null;
  return data.results.map((r) => ({
    type: String(r[0] ?? ''),
    persons: Number(r[1] ?? 0),
    skipped: Number(r[2] ?? 0),
  }));
}

/* ------------------------------------------------------------------------ *
 * Quiz click targets — which result-page CTA earns the click.
 *
 * `quiz_recommendation_clicked` carries { target } where target is one
 * of: primary_cta (matched collection), product_hero (single best-fit
 * product), alternate ("worth comparing" collection), showroom (find a
 * showroom). The split decides where result-page design effort goes —
 * e.g. if product_hero dominates, the single-pick card is doing the
 * selling and the collection CTA can shrink.
 * ------------------------------------------------------------------------ */

export type QuizClickTargetRow = {
  /** Raw target key from the event (primary_cta / product_hero / …). */
  target: string;
  /** Unique people who clicked this target. */
  persons: number;
  /** Total clicks (a person can click several targets / repeat). */
  clicks: number;
};

export async function getQuizClickTargets(days = 30): Promise<QuizClickTargetRow[] | null> {
  const data = await hogQL(`
    SELECT
      toString(properties.target) AS target,
      count(DISTINCT person_id) AS persons,
      count() AS clicks
    FROM events
    WHERE event = 'quiz_recommendation_clicked'
      AND timestamp >= now() - INTERVAL ${days} DAY
      AND toString(properties.target) != ''
    GROUP BY target
    ORDER BY persons DESC
  `);
  if (!data) return null;
  return data.results.map((r) => ({
    target: String(r[0] ?? ''),
    persons: Number(r[1] ?? 0),
    clicks: Number(r[2] ?? 0),
  }));
}

/* ------------------------------------------------------------------------ *
 * Quiz → purchase — same-session attribution, mirroring
 * getSearchConversion / getTopConvertingArticles: a session counts as
 * converted when it contains both a quiz_completed and an
 * order_completed. Same caveat as those cards: order_completed from
 * the server webhook lacks $session_id, so this only credits orders
 * whose client-side event fired in-session — treat it as a floor, not
 * an exact rate.
 * ------------------------------------------------------------------------ */

export type QuizConversion = {
  /** Sessions in the window that completed the quiz. */
  sessions: number;
  /** Of those, sessions that also completed an order. */
  orders: number;
  conversionPct: number;
};

export async function getQuizConversion(days = 30): Promise<QuizConversion | null> {
  const data = await hogQL(`
    WITH session_quiz AS (
      SELECT
        properties.$session_id AS sid,
        countIf(event = 'quiz_completed') > 0 AS quiz_done,
        countIf(event = 'order_completed') > 0 AS converted
      FROM events
      WHERE timestamp >= now() - INTERVAL ${days} DAY
        AND properties.$session_id != ''
        AND event IN ('quiz_completed', 'order_completed')
      GROUP BY sid
      HAVING quiz_done
    )
    SELECT
      count() AS sessions,
      countIf(converted) AS orders,
      round(100.0 * countIf(converted) / count(), 2) AS conversion_pct
    FROM session_quiz
  `);
  if (!data || !data.results[0]) return null;
  const row = data.results[0];
  return {
    sessions: Number(row[0] ?? 0),
    orders: Number(row[1] ?? 0),
    conversionPct: Number(row[2] ?? 0),
  };
}

/* ------------------------------------------------------------------------ *
 * Chat assistant — usage + reliability, from two event families:
 *
 *   Client (person + $session_id scoped, lib/analytics track()):
 *     chat_opened { pathname }, chat_dismissed { source, pathname },
 *     chat_product_clicked { product_url, vendor }.
 *   Server (lib/chat/telemetry.ts, distinct_id = chat-session-<uuid>):
 *     chat_turn_completed { duration_ms, tool_calls_count, tools_called,
 *     fallback_count, has_error, cache_hit_ratio, … }.
 *
 * The two families deliberately DON'T share an id space (server events
 * use the chat-session UUID, not the storefront person), so the usage
 * card reports them side by side rather than as a joined funnel.
 * ------------------------------------------------------------------------ */

export type ChatUsage = {
  /** Unique storefront persons who opened the chat panel. */
  openedPersons: number;
  /** Unique persons who clicked a product card inside the chat. */
  productClickPersons: number;
  /** Distinct chat sessions with at least one completed turn. */
  conversations: number;
  /** Total assistant turns served. */
  turns: number;
  /** Turns that ended in an SSE error. */
  errorTurns: number;
  /** Mean wall-clock duration of a turn, ms. */
  avgDurationMs: number;
  /** Total tool calls across all turns. */
  toolCalls: number;
  /** Tool calls that fell back from hosted MCP to in-house tools. */
  fallbackCalls: number;
  /** Mean prompt-cache hit ratio across turns (0-1). */
  cacheHitRatio: number;
};

export async function getChatUsage(days = 30): Promise<ChatUsage | null> {
  // Two queries because the metrics live on different id spaces (see
  // block comment): client events count storefront persons, server
  // events count chat-session distinct_ids.
  const [client, server] = await Promise.all([
    hogQL(`
      SELECT
        count(DISTINCT if(event = 'chat_opened', person_id, NULL)) AS opened,
        count(DISTINCT if(event = 'chat_product_clicked', person_id, NULL)) AS clicked
      FROM events
      WHERE event IN ('chat_opened', 'chat_product_clicked')
        AND timestamp >= now() - INTERVAL ${days} DAY
    `),
    hogQL(`
      SELECT
        count(DISTINCT distinct_id) AS conversations,
        count() AS turns,
        countIf(toString(properties.has_error) = 'true') AS error_turns,
        avg(toFloatOrZero(toString(properties.duration_ms))) AS avg_duration_ms,
        sum(toFloatOrZero(toString(properties.tool_calls_count))) AS tool_calls,
        sum(toFloatOrZero(toString(properties.fallback_count))) AS fallbacks,
        avg(toFloatOrZero(toString(properties.cache_hit_ratio))) AS cache_hit
      FROM events
      WHERE event = 'chat_turn_completed'
        AND timestamp >= now() - INTERVAL ${days} DAY
    `),
  ]);
  if (!client || !server) return null;
  const c = client.results[0] ?? [];
  const s = server.results[0] ?? [];
  return {
    openedPersons: Number(c[0] ?? 0),
    productClickPersons: Number(c[1] ?? 0),
    conversations: Number(s[0] ?? 0),
    turns: Number(s[1] ?? 0),
    errorTurns: Number(s[2] ?? 0),
    avgDurationMs: Number(s[3] ?? 0),
    toolCalls: Number(s[4] ?? 0),
    fallbackCalls: Number(s[5] ?? 0),
    cacheHitRatio: Number(s[6] ?? 0),
  };
}

/* ------------------------------------------------------------------------ *
 * Chat top tools — which capabilities the assistant actually uses.
 *
 * tools_called is a JSON array of DISTINCT tool names per turn, so
 * `turns` below reads as "turns that used this tool at least once".
 * arrayJoin unnests the array; JSONExtractArrayRaw keeps the raw
 * quoted elements, stripped with replaceAll (HogQL has no
 * JSONExtractString overload for array elements). The coalesce is
 * load-bearing: property access compiles to Nullable(String) and
 * ClickHouse rejects Array inside Nullable ("Nested type Array(String)
 * cannot be inside Nullable type" — observed live, 2026-06-12).
 * ------------------------------------------------------------------------ */

export type ChatToolRow = {
  tool: string;
  /** Turns in which the assistant called this tool at least once. */
  turns: number;
  /** Distinct chat sessions that used the tool. */
  conversations: number;
};

export async function getChatTopTools(days = 30, limit = 10): Promise<ChatToolRow[] | null> {
  const data = await hogQL(`
    SELECT
      replaceAll(arrayJoin(JSONExtractArrayRaw(coalesce(toString(properties.tools_called), '[]'))), '"', '') AS tool,
      count() AS turns,
      count(DISTINCT distinct_id) AS conversations
    FROM events
    WHERE event = 'chat_turn_completed'
      AND timestamp >= now() - INTERVAL ${days} DAY
      AND toString(properties.tools_called) NOT IN ('', '[]')
    GROUP BY tool
    ORDER BY turns DESC
    LIMIT ${limit}
  `);
  if (!data) return null;
  return data.results.map((r) => ({
    tool: String(r[0] ?? ''),
    turns: Number(r[1] ?? 0),
    conversations: Number(r[2] ?? 0),
  }));
}

/* ------------------------------------------------------------------------ *
 * Chat → purchase — same-session attribution via the client-side
 * chat_opened event (which carries $session_id; the server-side turn
 * events don't). Same shape + caveat as getQuizConversion: only
 * same-session client-fired orders are credited, so it's a floor.
 * ------------------------------------------------------------------------ */

export type ChatConversion = {
  /** Sessions in the window that opened the chat. */
  sessions: number;
  /** Of those, sessions that also completed an order. */
  orders: number;
  conversionPct: number;
};

export async function getChatConversion(days = 30): Promise<ChatConversion | null> {
  const data = await hogQL(`
    WITH session_chat AS (
      SELECT
        properties.$session_id AS sid,
        countIf(event = 'chat_opened') > 0 AS chat_open,
        countIf(event = 'order_completed') > 0 AS converted
      FROM events
      WHERE timestamp >= now() - INTERVAL ${days} DAY
        AND properties.$session_id != ''
        AND event IN ('chat_opened', 'order_completed')
      GROUP BY sid
      HAVING chat_open
    )
    SELECT
      count() AS sessions,
      countIf(converted) AS orders,
      round(100.0 * countIf(converted) / count(), 2) AS conversion_pct
    FROM session_chat
  `);
  if (!data || !data.results[0]) return null;
  const row = data.results[0];
  return {
    sessions: Number(row[0] ?? 0),
    orders: Number(row[1] ?? 0),
    conversionPct: Number(row[2] ?? 0),
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
 * Device CONVERSION — client-side intent funnel by $device_type
 *
 * Why a separate metric from getDeviceBreakdown's order column: the
 * `order_completed` event is fired SERVER-SIDE from the Shopify
 * orders/paid webhook, so it carries no `$device_type` (there's no
 * browser on a webhook). That's why order-based device conversion was
 * always 0% and the column was dropped.
 *
 * The deepest funnel step we CAN attribute to a device is
 * `checkout_started` — it fires client-side (browser autocapture stamps
 * `$device_type`) right before the handoff to Shopify's hosted checkout.
 * So this measures device-level *purchase intent*: of the people who
 * viewed a PDP on a given device, what share reached checkout. It's the
 * honest, attributable answer to "does mobile convert worse than
 * desktop?" given the headless + Shopify-checkout architecture.
 *
 * Person-distinct counts per step (mirrors getConversionFunnel), grouped
 * by the device the event happened on. Each event attributes to its own
 * device, so a rare cross-device journey splits across rows — acceptable
 * for a rate comparison.
 * ------------------------------------------------------------------------ */

export type DeviceConversionRow = {
  deviceType: string;
  pdpViewers: number;
  addToCart: number;
  checkoutStarted: number;
  /** checkout_started ÷ pdp_view, as a %. Device-attributable intent rate. */
  conversionPct: number;
};

export async function getDeviceConversion(days = 30): Promise<DeviceConversionRow[] | null> {
  const data = await hogQL(`
    SELECT
      coalesce(nullif(toString(properties.$device_type), ''), '(unknown)') AS device,
      count(DISTINCT if(event = 'pdp_view', person_id, NULL)) AS pdp,
      count(DISTINCT if(event = 'add_to_cart', person_id, NULL)) AS atc,
      count(DISTINCT if(event = 'checkout_started', person_id, NULL)) AS checkout
    FROM events
    WHERE event IN ('pdp_view', 'add_to_cart', 'checkout_started')
      AND timestamp >= now() - INTERVAL ${days} DAY
    GROUP BY device
    ORDER BY pdp DESC
    LIMIT 6
  `);
  if (!data) return null;
  return data.results.map((row) => {
    const deviceType = String(row[0] ?? '(unknown)');
    const pdpViewers = Number(row[1] ?? 0);
    const addToCart = Number(row[2] ?? 0);
    const checkoutStarted = Number(row[3] ?? 0);
    return {
      deviceType,
      pdpViewers,
      addToCart,
      checkoutStarted,
      conversionPct: pdpViewers > 0 ? (checkoutStarted / pdpViewers) * 100 : 0,
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

/* ------------------------------------------------------------------------ *
 * Top-converting blog articles — sessions that started on a /blogs/* page
 * AND placed an order_completed in the same session.
 *
 * Directly attributes content investment (SEO articles, internal-link
 * work, etc.) to revenue: which articles brought a buyer to the
 * storefront? Useful for "where should we double down on content".
 *
 * Implementation — single CTE pass:
 *   1. For each session, find the earliest /blogs/* pathname viewed
 *      AND whether the session also fired order_completed
 *   2. Group by blog path; count sessions + converted sessions
 *
 * Same-session attribution is the simplest causal heuristic — Google
 * Analytics / PostHog both default to it. A multi-touch model would
 * be more accurate but needs cross-session linking data we don't
 * collect server-side.
 *
 * Sample-size guarded: only paths with >= 5 sessions in the window
 * show up. Otherwise a single conversion makes a low-traffic article
 * look like a 100%-converter.
 * ------------------------------------------------------------------------ */

export type ConvertingArticle = {
  path: string;
  sessions: number;
  orders: number;
  conversionPct: number;
};

export async function getTopConvertingArticles(days = 30, limit = 10): Promise<ConvertingArticle[] | null> {
  const data = await hogQL(`
    WITH session_meta AS (
      SELECT
        properties.$session_id AS sid,
        argMin(properties.$pathname, timestamp) AS blog_path,
        countIf(event = 'order_completed') > 0 AS converted
      FROM events
      WHERE timestamp >= now() - INTERVAL ${days} DAY
        AND properties.$session_id != ''
        AND (
          (event = '$pageview' AND startsWith(toString(properties.$pathname), '/blogs/'))
          OR event = 'order_completed'
        )
      GROUP BY sid
      HAVING blog_path != ''
    )
    SELECT
      blog_path,
      count() AS sessions,
      countIf(converted) AS orders,
      round(100.0 * countIf(converted) / count(), 2) AS conversion_pct
    FROM session_meta
    GROUP BY blog_path
    HAVING sessions >= 5
    ORDER BY orders DESC, sessions DESC
    LIMIT ${limit}
  `);
  if (!data) return null;
  return data.results.map((r) => ({
    path: String(r[0] ?? ''),
    sessions: Number(r[1] ?? 0),
    orders: Number(r[2] ?? 0),
    conversionPct: Number(r[3] ?? 0),
  }));
}
