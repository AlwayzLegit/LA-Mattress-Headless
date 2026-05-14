# SEO Measurement Runbook

Phase 1 of the SEO improvement plan (see `docs/seo-improvement-plan.md`).
Goal: every SEO change has an attributable outcome within 14 days.

## What's wired

The codebase emits three independent telemetry streams. Each can be
toggled on or off via env var, and each has a different purpose.

| Stream | File | Env var | Purpose |
|---|---|---|---|
| Vercel Analytics | `app/layout.tsx` (`<Analytics />`) | always on | First-party session counts, page views (no PII) |
| Vercel Speed Insights | `app/layout.tsx` (`<SpeedInsights />`) | always on | Field LCP / CLS / INP at p75 / p95 (CrUX-style) |
| Google Analytics 4 | `app/_components/analytics-ga4.tsx` | `NEXT_PUBLIC_GA_MEASUREMENT_ID` | Search Console keyword attribution, conversions, audiences |
| Sentry | `instrumentation-client.ts` | `NEXT_PUBLIC_SENTRY_DSN` | Error capture (not SEO) |

GA4 also forwards Core Web Vitals as events via `useReportWebVitals`, so
the same field CWV that Google ranks on is queryable in GA4 alongside
session and conversion data.

## One-time setup (per environment)

### 1. Google Analytics 4

1. Create a GA4 property at <https://analytics.google.com> → Admin →
   Create Property. Use the production domain
   (`mattressstoreslosangeles.com`) as the property name.
2. Create a Web Data Stream pointing at
   `https://www.mattressstoreslosangeles.com`.
3. Copy the Measurement ID (`G-XXXXXXXXXX`).
4. Add to Vercel → Project Settings → Environment Variables:
   ```
   NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
   ```
   Set in all three environments (Production / Preview / Development).
5. Redeploy. Within a few minutes, GA4 → Reports → Realtime should show
   active users.

### 2. Google Search Console

1. Go to <https://search.google.com/search-console> → Add property →
   URL prefix. Use `https://www.mattressstoreslosangeles.com/`.
2. Choose verification method **HTML tag**. Copy the value attribute
   from the `<meta name="google-site-verification" content="...">`
   tag — *just the value*, not the whole tag.
3. Add to Vercel env vars (all environments):
   ```
   NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION=<paste here>
   ```
4. Redeploy. In GSC, click "Verify".
5. Once verified, submit the sitemap: GSC → Sitemaps → enter
   `sitemap.xml` → Submit. Expect "Success" status within a few hours.
6. Link GA4: GSC → Settings → Associations → Google Analytics →
   choose the GA4 property created above. This unlocks the keyword
   attribution that GA4 alone doesn't have.

### 3. Bing Webmaster Tools (optional but cheap)

1. <https://www.bing.com/webmasters> → Add site →
   `https://www.mattressstoreslosangeles.com/`.
2. Choose verification by **Meta tag**. Copy the `content` value.
3. Add to Vercel env vars:
   ```
   NEXT_PUBLIC_BING_SITE_VERIFICATION=<paste here>
   ```
4. Redeploy → click "Verify" in Bing Webmaster. Submit `sitemap.xml`.

### 4. Google Merchant Center (optional, gates Google Shopping)

Shopify can already publish the product feed to Google Merchant — no
code work. To enable:

1. Shopify Admin → Sales channels → Google → install if not already.
2. Connect a Merchant Center account at
   <https://merchants.google.com/>.
3. Shopify will sync the product feed (uses the Storefront API + the
   product `seo.title` / `seo.description` fields, which is why Phase
   3 of the SEO plan backfills those).
4. Verify the feed status weekly in Merchant Center → Diagnostics for
   item-level issues (missing GTIN, image size, etc.).

This is independent of running Shopping Ads — feed publication alone
unlocks the free Google Shopping organic surface, which is a separate
ranking system from regular organic search.

## How to read the data

| Question | Where to look |
|---|---|
| How many sessions today / this week? | Vercel Analytics dashboard *or* GA4 Reports → Realtime / Acquisition |
| What's our p75 LCP for product pages? | Vercel Speed Insights → filter by route /products/[handle] |
| Which keywords drove clicks last 28 days? | GSC → Performance → Queries (sortable by clicks / CTR) |
| Did a sitewide change regress CWV? | Vercel Speed Insights → date-range compare |
| What's the indexed page count vs. submitted? | GSC → Sitemaps row + GSC → Indexing → Pages |
| Which pages get crawled but not indexed? | GSC → Indexing → Pages → "Crawled — currently not indexed" |
| Which new pages aren't being discovered? | GSC → Indexing → Pages → "Discovered — currently not indexed" |

## Baseline to capture before any SEO work ships

Run once after Phase 1 ships, save numbers to this file:

| Metric | Value (Date: __________) |
|---|---|
| GA4 sessions / 30d | _____ |
| GSC clicks / 28d | _____ |
| GSC impressions / 28d | _____ |
| GSC avg CTR / 28d | _____ % |
| GSC avg position / 28d | _____ |
| Vercel Speed Insights p75 LCP (home) | _____ ms |
| Vercel Speed Insights p75 LCP (PDP) | _____ ms |
| Vercel Speed Insights p75 LCP (PLP) | _____ ms |
| Vercel Speed Insights p75 INP (sitewide) | _____ ms |
| Vercel Speed Insights p75 CLS (sitewide) | _____ |
| Semrush Authority Score | 28 (2026-05) |
| Semrush organic keywords | 15,528 (2026-05) |
| Semrush organic traffic | 7,509 (2026-05) |
| Semrush referring domains | 983 (2026-05) |

The Semrush row is pre-filled from the audit in
`docs/seo-improvement-plan.md`. Re-pull monthly via
`mcp__c1fe7bd5...__overview_research domain_rank` and
`mcp__c1fe7bd5...__backlink_research backlinks_overview`.

## Privacy / consent

Vercel Analytics is cookieless by design (no consent banner needed).
GA4 sets a first-party cookie. If California CCPA opt-out becomes
relevant, the existing `/pages/data-sharing-opt-out` page is where
that's surfaced — GA4 respects the standard `_gaUserPrefs` cookie used
by browser do-not-track add-ons, but a full consent-mode v2
implementation is out of scope here.

## Failure modes

- **`window.gtag is not defined` in console**: GA4 script blocked by an
  extension (uBlock Origin, Privacy Badger). The fallback in
  `analytics-ga4.tsx` guards `typeof window.gtag !== 'function'` so
  this just no-ops; not an error.
- **GSC says "Sitemap could not be fetched"**: usually a 301 redirect
  loop. Verify `https://www.mattressstoreslosangeles.com/sitemap.xml`
  returns 200, not a redirect. The www→apex redirect (if any) must not
  apply to /sitemap.xml.
- **GA4 shows zero sessions after 24h**: check the measurement ID is
  formatted `G-XXXXXXXXXX` (not `UA-` which is the deprecated
  Universal Analytics format). Check Network tab in browser devtools
  for a request to `googletagmanager.com/gtag/js` — if absent, the env
  var didn't make it into the build.
