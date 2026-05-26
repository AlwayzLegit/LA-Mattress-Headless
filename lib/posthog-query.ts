/**
 * PostHog Query API client — server-only.
 *
 * Used by the /admin route to read live PostHog data
 * (funnels, event counts, top entry pages, etc.) and render it
 * inline alongside the Shopify Admin widgets. The dashboard goes
 * from "deep-links to PostHog" → "data shown inline + deep-links".
 *
 * Two PostHog credentials are involved:
 *   - `POSTHOG_PERSONAL_API_KEY` (server-only). Personal API key
 *     with project-read scope. NOT the project's ingestion key
 *     (NEXT_PUBLIC_POSTHOG_KEY) — that one is write-only.
 *   - `POSTHOG_PROJECT_ID` (server-only). Numeric ID from PostHog
 *     Settings → Project.
 *
 * Defensive env-var reads. Common naming variants are accepted so
 * a key saved under (say) POSTHOG_API_KEY still works without a
 * rename. The accepted variants are logged in the Sentry message
 * on miss so the dashboard's "data unavailable" state surfaces a
 * concrete next step.
 *
 * No-throws. Returns null on any failure. The dashboard renders
 * a "data unavailable" widget instead of crashing the page.
 */

import 'server-only';
import * as Sentry from '@sentry/nextjs';

const PERSONAL_API_KEY_VARIANTS = [
  'POSTHOG_PERSONAL_API_KEY',
  'POSTHOG_API_KEY',
  'POSTHOG_QUERY_API_KEY',
  'POSTHOG_READ_API_KEY',
  'POSTHOG_PRIVATE_KEY',
  'POSTHOG_PERSONAL_KEY',
] as const;

const PROJECT_ID_VARIANTS = [
  'POSTHOG_PROJECT_ID',
  'NEXT_PUBLIC_POSTHOG_PROJECT_ID',
  'POSTHOG_PROJECT',
  'POSTHOG_TEAM_ID',
] as const;

const API_HOST_VARIANTS = [
  'POSTHOG_API_HOST',
  'NEXT_PUBLIC_POSTHOG_API_HOST',
] as const;

const INGESTION_HOST_VARIANTS = [
  'POSTHOG_HOST',
  'NEXT_PUBLIC_POSTHOG_HOST',
] as const;

function readFirst(variants: readonly string[]): { value: string | undefined; name: string | undefined } {
  for (const name of variants) {
    const v = process.env[name];
    if (v && v.trim()) return { value: v.trim(), name };
  }
  return { value: undefined, name: undefined };
}

/**
 * Resolves the PostHog API host. Order of precedence:
 *   1. explicit POSTHOG_API_HOST / NEXT_PUBLIC_POSTHOG_API_HOST.
 *   2. derived from POSTHOG_HOST / NEXT_PUBLIC_POSTHOG_HOST — the
 *      ingestion host (us.i.posthog.com) maps to the API host
 *      (us.posthog.com) by dropping the ".i." subdomain.
 *   3. default to https://us.posthog.com.
 */
function resolveApiHost(): string {
  const explicit = readFirst(API_HOST_VARIANTS).value;
  if (explicit) return explicit.replace(/\/+$/, '');

  const ingestion = readFirst(INGESTION_HOST_VARIANTS).value;
  if (ingestion) {
    // Strip protocol if present
    const noProto = ingestion.replace(/^https?:\/\//, '').replace(/\/+$/, '');
    // us.i.posthog.com → us.posthog.com (the API host)
    // eu.i.posthog.com → eu.posthog.com
    const apiHost = noProto.replace(/\.i\.posthog\.com$/, '.posthog.com');
    return `https://${apiHost}`;
  }

  return 'https://us.posthog.com';
}

export type PostHogConfig = {
  apiKey: string;
  apiKeyName: string;
  projectId: string;
  projectIdName: string;
  apiHost: string;
};

export function postHogConfig(): PostHogConfig | null {
  const key = readFirst(PERSONAL_API_KEY_VARIANTS);
  const proj = readFirst(PROJECT_ID_VARIANTS);
  if (!key.value || !proj.value) {
    const msg =
      `[posthog-query.ts] Missing env. Checked PERSONAL_API_KEY in [${PERSONAL_API_KEY_VARIANTS.join(', ')}]` +
      ` (found=${key.name ?? 'none'}), PROJECT_ID in [${PROJECT_ID_VARIANTS.join(', ')}]` +
      ` (found=${proj.name ?? 'none'}).`;
    console.error(msg);
    Sentry.captureMessage(msg, 'warning');
    return null;
  }
  return {
    apiKey: key.value,
    apiKeyName: key.name as string,
    projectId: proj.value,
    projectIdName: proj.name as string,
    apiHost: resolveApiHost(),
  };
}

export const POSTHOG_CONFIGURED = Boolean(
  readFirst(PERSONAL_API_KEY_VARIANTS).value && readFirst(PROJECT_ID_VARIANTS).value,
);

/**
 * Run a HogQL query against the project's events table.
 *
 * Returns { columns, results } on success, null on failure (with the
 * failure recorded in Sentry). Caches at the Next.js fetch level for
 * 5 minutes under the `admin-dashboard` tag so a single dashboard
 * load doesn't fan out N+1 queries to PostHog.
 */
export type HogQLResult = {
  columns: string[];
  results: Array<Array<string | number | null>>;
};

export async function hogQL(query: string): Promise<HogQLResult | null> {
  const cfg = postHogConfig();
  if (!cfg) return null;
  const queryFirstLine = query.trim().split('\n')[0].slice(0, 80);
  try {
    const res = await fetch(`${cfg.apiHost}/api/projects/${cfg.projectId}/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify({ query: { kind: 'HogQLQuery', query } }),
      next: { revalidate: 300, tags: ['admin-dashboard'] },
    });
    if (!res.ok) {
      const body = await res.text();
      const msg = `[posthog-query.ts] HTTP ${res.status} on \`${queryFirstLine}\`: ${body.slice(0, 500)}`;
      console.error(msg);
      Sentry.captureMessage(msg, 'error');
      return null;
    }
    const json = (await res.json()) as { columns?: string[]; results?: Array<Array<string | number | null>>; error?: string };
    if (json.error) {
      const msg = `[posthog-query.ts] PostHog error on \`${queryFirstLine}\`: ${json.error.slice(0, 500)}`;
      console.error(msg);
      Sentry.captureMessage(msg, 'error');
      return null;
    }
    return { columns: json.columns ?? [], results: json.results ?? [] };
  } catch (err) {
    const msg = `[posthog-query.ts] fetch failed on \`${queryFirstLine}\`: ${err instanceof Error ? err.message : String(err)}`;
    console.error(msg);
    Sentry.captureException(err instanceof Error ? err : new Error(msg));
    return null;
  }
}
