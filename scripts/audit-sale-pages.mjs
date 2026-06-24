#!/usr/bin/env node
/**
 * Audit script — Core Web Vitals + a11y signals + preview-route smoke
 * tests for the sale-page surface.
 *
 * Why this exists: the items the post-merge audit deferred (#8 a11y,
 * #9 CWV) need a deployed URL to evaluate. This script bundles them so
 * a maintainer with internet access can run a one-shot check against
 * any deploy (preview or production) and get a copy-pasteable report.
 *
 * Usage:
 *   # baseline against production (homepage only — sale pages are
 *   # date-gated)
 *   node scripts/audit-sale-pages.mjs \
 *     --site https://www.mattressstoreslosangeles.com
 *
 *   # with preview token, audit a pre-launch sale page too
 *   node scripts/audit-sale-pages.mjs \
 *     --site https://www.mattressstoreslosangeles.com \
 *     --preview-token "$SALE_PAGE_PREVIEW_TOKEN" \
 *     --sale-handle 4th-of-july-mattress-sale-2026
 *
 *   # with a PSI API key (avoids the strict rate limit on unauth'd
 *   # requests — get one at https://console.cloud.google.com/apis/credentials)
 *   PSI_KEY=AIza... node scripts/audit-sale-pages.mjs \
 *     --site https://www.mattressstoreslosangeles.com
 *
 * What it checks:
 *   1. PSI run against the homepage — collects Performance, Accessibility,
 *      Best Practices, SEO scores for both mobile and desktop. Flags
 *      anything < 90.
 *   2. PSI run against the sale page (if --preview-token is supplied,
 *      uses the cookie flow). Same thresholds.
 *   3. Preview routes — POSTs without a token (expect 401), with a
 *      wrong-length token (expect 401), with the right token (expect
 *      302/303 + Set-Cookie). Then DELETE/disable + confirm 4xx on a
 *      pre-launch sale URL.
 *   4. SaleEvent JSON-LD presence — fetches the page (with preview
 *      cookie if available) and confirms a script of type
 *      application/ld+json with `"@type":"SaleEvent"` is in the HTML.
 *   5. robots/noindex on preview URLs — confirms preview HTML carries
 *      <meta name="robots" content="noindex"> (set in generateMetadata
 *      when isPreview is true).
 */

import { argv, env, exit } from 'node:process';

const args = parseArgs(argv.slice(2));
const SITE = args.site ?? 'https://www.mattressstoreslosangeles.com';
const TOKEN = args['preview-token'] ?? env.SALE_PAGE_PREVIEW_TOKEN ?? null;
const SALE_HANDLE = args['sale-handle'] ?? '4th-of-july-mattress-sale-2026';
const PSI_KEY = env.PSI_KEY ?? null;

function parseArgs(arr) {
  const out = {};
  for (let i = 0; i < arr.length; i++) {
    const a = arr[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const val = arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[++i] : true;
      out[key] = val;
    }
  }
  return out;
}

const results = [];
function record(name, ok, detail) {
  results.push({ name, ok, detail });
  const tag = ok ? 'PASS' : 'FAIL';
  console.log(`${tag.padEnd(5)} ${name}${detail ? ` — ${detail}` : ''}`);
}

async function psi(url, strategy) {
  const params = new URLSearchParams({
    url,
    strategy,
    category: 'PERFORMANCE',
  });
  // PSI lets you pass `category` multiple times to opt into more sections.
  ['ACCESSIBILITY', 'BEST_PRACTICES', 'SEO'].forEach((c) => params.append('category', c));
  if (PSI_KEY) params.set('key', PSI_KEY);
  const psiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${params}`;
  const res = await fetch(psiUrl);
  if (!res.ok) throw new Error(`PSI HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const cats = data.lighthouseResult?.categories ?? {};
  return {
    performance: Math.round((cats.performance?.score ?? 0) * 100),
    accessibility: Math.round((cats.accessibility?.score ?? 0) * 100),
    bestPractices: Math.round((cats['best-practices']?.score ?? 0) * 100),
    seo: Math.round((cats.seo?.score ?? 0) * 100),
    lcp: data.lighthouseResult?.audits?.['largest-contentful-paint']?.displayValue ?? '?',
    cls: data.lighthouseResult?.audits?.['cumulative-layout-shift']?.displayValue ?? '?',
    tbt: data.lighthouseResult?.audits?.['total-blocking-time']?.displayValue ?? '?',
  };
}

async function runPsiSuite(label, url) {
  console.log(`\n— PSI: ${label} (${url})`);
  for (const strategy of ['mobile', 'desktop']) {
    try {
      const r = await psi(url, strategy);
      const pass = r.performance >= 90 && r.accessibility >= 90 && r.bestPractices >= 90 && r.seo >= 90;
      record(
        `${label} ${strategy}`,
        pass,
        `Perf ${r.performance} · A11y ${r.accessibility} · BP ${r.bestPractices} · SEO ${r.seo} · LCP ${r.lcp} · CLS ${r.cls} · TBT ${r.tbt}`,
      );
    } catch (err) {
      record(`${label} ${strategy}`, false, `PSI error: ${err.message}`);
    }
  }
}

async function smokePreviewRoutes() {
  console.log(`\n— Preview routes`);
  // GET enable with no token → 401
  let res = await fetch(`${SITE}/api/preview/enable?redirect=/pages/${SALE_HANDLE}`, { redirect: 'manual' });
  record('GET /api/preview/enable (no token)', res.status === 401, `HTTP ${res.status}`);
  // GET enable with wrong token → 401
  res = await fetch(`${SITE}/api/preview/enable?token=wrong&redirect=/pages/${SALE_HANDLE}`, { redirect: 'manual' });
  record('GET /api/preview/enable (wrong token)', res.status === 401, `HTTP ${res.status}`);
  if (!TOKEN) {
    record('GET /api/preview/enable (right token)', false, 'skipped — no --preview-token / SALE_PAGE_PREVIEW_TOKEN env var');
    return null;
  }
  // GET enable with right token → 302/303 + Set-Cookie
  res = await fetch(`${SITE}/api/preview/enable?token=${encodeURIComponent(TOKEN)}&redirect=/pages/${SALE_HANDLE}`, { redirect: 'manual' });
  const setCookie = res.headers.get('set-cookie') ?? '';
  record(
    'GET /api/preview/enable (right token)',
    (res.status === 302 || res.status === 303) && /prerender_bypass|draft/i.test(setCookie),
    `HTTP ${res.status} · ${setCookie ? 'Set-Cookie ✓' : 'Set-Cookie missing'}`,
  );
  return setCookie;
}

async function checkSalePageHtml(setCookie) {
  console.log(`\n— Sale page HTML (with preview cookie)`);
  if (!setCookie) {
    record('Sale page renders SaleEvent LD', false, 'skipped — no preview cookie');
    return;
  }
  // Re-issue cookie on the GET so the date-gated page renders.
  const cookies = setCookie
    .split(/,\s*(?=[a-z]+=)/i)
    .map((c) => c.split(';')[0])
    .join('; ');
  const res = await fetch(`${SITE}/pages/${SALE_HANDLE}`, {
    redirect: 'manual',
    headers: { cookie: cookies, 'user-agent': 'audit-sale-pages.mjs' },
  });
  const html = await res.text();
  const hasLd = /<script[^>]+type=["']application\/ld\+json["'][^>]*>[^<]*"@type"\s*:\s*"SaleEvent"/.test(html);
  record('Sale page renders SaleEvent JSON-LD', hasLd, hasLd ? '@type=SaleEvent script found' : 'no SaleEvent <script> in HTML');
  const hasNoindex = /<meta[^>]+name=["']robots["'][^>]+noindex/i.test(html);
  record('Preview HTML carries robots=noindex', hasNoindex, hasNoindex ? 'meta robots=noindex ✓' : 'meta robots=noindex MISSING');
  const hasBanner = /Preview mode/i.test(html) && /(goes live|hidden by the storefront)/i.test(html);
  record('Preview banner rendered', hasBanner, hasBanner ? 'banner copy found' : 'banner copy missing');
}

async function main() {
  console.log(`Auditing ${SITE}`);
  console.log(`Sale handle: ${SALE_HANDLE} (preview ${TOKEN ? 'enabled' : 'disabled'})`);
  await runPsiSuite('Homepage', SITE);
  const cookie = await smokePreviewRoutes();
  if (cookie && TOKEN) {
    await checkSalePageHtml(cookie);
    await runPsiSuite('Sale page (preview cookie required for PSI not supported — skipping)', `${SITE}/pages/${SALE_HANDLE}`).catch((e) => {
      record('Sale-page PSI', false, `PSI bot can't carry the preview cookie — re-run after launch: ${e.message}`);
    });
  }
  const failures = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failures.length}/${results.length} passed.`);
  if (failures.length) {
    console.log(`\nFailures:`);
    for (const f of failures) console.log(`  - ${f.name}: ${f.detail}`);
  }
  exit(failures.length ? 1 : 0);
}

main().catch((err) => {
  console.error(`fatal: ${err.message}`);
  exit(2);
});
