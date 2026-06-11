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
