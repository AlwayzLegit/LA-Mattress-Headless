/**
 * Guards the CSP allowances the Judge.me review widget needs to render.
 *
 * Incident (2026-06-11): the day-one CSP (#438) allowlisted only
 * api.judge.me in connect-src, but the LEGACY review widget — the one
 * Judge.me support switched this shop to account-side on 2026-06-01 —
 * loads its content via XHR from cache.judge.me. The blocked fetch
 * failed with status 0 ("Cannot load Judge.me widget contents due to
 * caching server error" in PostHog replay console logs) and every PDP
 * reviews widget rendered empty. These assertions fail loudly if a
 * future CSP edit drops any origin the widget depends on.
 *
 * HTTP-level: reads the Content-Security-Policy response header from
 * the dev server (any route — the header is set on /:path*).
 */
import test from 'node:test';
import assert from 'node:assert/strict';

const BASE_URL = process.env.TEST_BASE_URL ?? 'http://127.0.0.1:3100';

async function getCspDirectives() {
  const res = await fetch(`${BASE_URL}/`, { redirect: 'manual' });
  const csp = res.headers.get('content-security-policy');
  assert.ok(csp, 'Content-Security-Policy header missing');
  const directives = new Map();
  for (const part of csp.split(';')) {
    const tokens = part.trim().split(/\s+/);
    directives.set(tokens[0], tokens.slice(1));
  }
  return directives;
}

test('CSP allows the Judge.me widget pipeline end to end', async () => {
  const d = await getCspDirectives();

  // Preloader + widget JS.
  assert.ok(d.get('script-src')?.includes('https://cdnwidget.judge.me'), 'script-src: cdnwidget.judge.me');
  assert.ok(d.get('script-src')?.includes('https://cdn.judge.me'), 'script-src: cdn.judge.me');

  // The legacy widget boots its fetched payload via eval() — without
  // 'unsafe-eval' the reviews section renders empty (EvalError in
  // PostHog replay logs, 2026-06-11, second stage of the same incident).
  assert.ok(d.get('script-src')?.includes("'unsafe-eval'"), "script-src: 'unsafe-eval'");

  // Widget content XHR — api.judge.me (write-a-review etc.) AND
  // cache.judge.me (the legacy widget's cached-contents endpoint; this
  // was the 2026-06-11 breakage).
  assert.ok(d.get('connect-src')?.includes('https://api.judge.me'), 'connect-src: api.judge.me');
  assert.ok(d.get('connect-src')?.includes('https://cache.judge.me'), 'connect-src: cache.judge.me');

  // Widget stylesheet + star icon font.
  assert.ok(d.get('style-src')?.includes('https://cdn.judge.me'), 'style-src: cdn.judge.me');
  assert.ok(d.get('font-src')?.includes('https://cdn.judge.me'), 'font-src: cdn.judge.me');

  // Review iframes (photo lightbox etc.).
  const frames = d.get('frame-src') ?? [];
  assert.ok(frames.includes('https://judge.me') || frames.includes('https://*.judge.me'), 'frame-src: judge.me');
});

test('CSP reports violations to Sentry when a DSN is configured', async (t) => {
  // The report-uri directive is derived from NEXT_PUBLIC_SENTRY_DSN at
  // config time (next.config.mjs#sentryCspReportUri) — it's the alarm
  // wire that makes any future CSP-vs-vendor conflict visible in
  // Sentry within minutes instead of waiting for a human to notice a
  // broken widget. Skips when the env (local/CI without secrets)
  // carries no DSN, because then the directive is intentionally absent.
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) {
    t.skip('NEXT_PUBLIC_SENTRY_DSN not set — report-uri intentionally omitted');
    return;
  }
  const d = await getCspDirectives();
  const uri = d.get('report-uri')?.[0] ?? '';
  assert.match(uri, /^https:\/\/.+\/api\/\d+\/security\/\?sentry_key=/, 'report-uri targets the Sentry security endpoint');
});
