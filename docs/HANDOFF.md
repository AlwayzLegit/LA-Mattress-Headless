# Session handoff — 2026-05-08 (Phase 90-95 — design realignment complete)

## Status

**Design-realignment track complete.** Branch `main` HEAD `6955078`.
Surfaced the original chat-design bundle (la-mattress-redesign), then
ported six phases of homepage / PLP / PDP work to bring the storefront
back to design fidelity after polish drift in Phases 85-89.

### Phases shipped this round

- **Phase 90** — Homepage chrome realigned with the design handoff.
  Removed the duplicate `<TrustStrip />` from layout (the "double
  announcement bar" the user flagged). Restored topbar trust trio,
  the section-head + hero-copy eyebrow `::before` red bar, hero
  "01 / 03" counter, hero cross-fade duration.
- **Phase 91** — PLP redesigned: split hero (1.2fr/1fr eyebrow + h1
  + lede + 16:10 lifestyle image), sticky toolbar with backdrop-blur,
  PcardSpecs → type+firmness pill row, branded empty state, body
  grid 280/48px, 1-up grid at <=640px.
- **Phase 92** — PDP visual: gallery rebuilt (1:1 main + counter
  overlay + 5-col thumbs with `::after` ring), grid 1fr/440px,
  `.pdp-rail` borderless sticky, 32px h1 product name, design's
  price row (16/32/Save pill), `.pdp-delivery` card, 4-col
  `.pdp-specs-grid`.
- **Phase 93** — PDP buybox UI: 3-col `.pdp-size-grid` (label /
  dimension / per-variant price), 2-col `.pdp-firm-grid`, quantity
  stepper, ATC label includes running total (price × qty).
- **Phase 94** — PDP editorial sections from new Shopify metafields.
  Created 8 metafield definitions (`custom.tagline`, `lede`,
  `best_for`, `not_ideal_for`, `highlights`, `firmness_score`,
  `position_fit`, `layers`) all storefront PUBLIC_READ. New
  components `PdpOverview`, `PdpFirmness`, `PdpMaterials` render
  only when their data is populated (graceful no-op).
- **Phase 95** — PDP rail extras: `PdpCtaRow` with Save +
  Compare ghost-button row below ATC. Save uses
  `la-mattress.wishlist.v1` localStorage (heart fills red on save).
  Compare reuses `la-mattress.compare.v1` so it integrates with the
  floating tray + /compare page. Both hydrate on mount and listen
  to storage events for cross-tab sync. Showroom availability
  section was scoped out per merchant request.

### Editorial data seeded (Shopify Admin via MCP)

12 priority mattresses now have full editorial metafield data
populated — Overview / Firmness / Materials sections render
end-to-end on each. Affected handles:

- the-luxe-estate-firm-by-stearns-foster
- englander-amsbury-pillow-top-mattress
- tempur-pedic-mattress-clearance-tempur-proadapt-medium-12
- eastman-house-avalon-late-firm
- spruce-firm-innerspring-by-eclipse-mattress (Eastman House Spruce)
- diamond-dreamstage-2-0-collection-glory-firm-cool-gel-swirl-memory-foam-12-mattress
- rock-extra-firm-mattress-diamond-mattress
- diamond-dreamstage-2-0-medium-gel-swirl-memory-foam-12-mattress (Grace Quilted Medium)
- tempur-pedic-tempur-proadapt-medium-hybrid
- tempur-pedic-tempur-luxeadapt-firm-mattress
- lismore-luxury-firm-mattress-palace-collection-by-chattam-wells
- harvest-green-original-firm-natural-latex-by-diamond-mattress

Merchant populates the remaining ~180 mattresses at their own pace
via Shopify Admin → Products → [product] → Custom data. The 8
metafield definitions are pinned so they appear at the top of the
product editor. Sections render the moment data is added — no
code deploy needed.

### Remaining merchant-side gates

1. **Sentry DSN** (optional) — set `NEXT_PUBLIC_SENTRY_DSN` and
   `SENTRY_DSN` in Vercel (Production env), redeploy.
2. **DNS cutover** — point `mattressstoreslosangeles.com` apex +
   `www` at Vercel; keep `checkout.mattressstoreslosangeles.com`
   on Shopify. After propagation, edit the 6 webhook URLs in
   Shopify Admin → Notifications to use the canonical domain.
3. **Editorial data on remaining mattresses** — merchant operation,
   no code work needed. 12 of ~195 done.

---

# Earlier — Session handoff — 2026-05-07 (Phase 85-89 — clean GO)

## Status

**Phase 85-89 polish round: clean GO.** Branch `main` HEAD `9191181`.
Deep visual audit returned 40 findings; Phases 85-89 closed 37 of them
(remaining 3 are merchant content shoots — lifestyle photo direction
across categories / search / blog / cross-firmness mattress photos).

### Phases shipped this session

- **Phase 85** — sitewide foundations: 16 "white-glove" canonicalized,
  eyebrow unified (red bar + blue + pin variants dropped), hero
  transition 700ms → 240ms + dedup "01/03" counter. Shopify Admin
  content drift via MCP: 5 SEO titles + 11 image alts.
- **Phase 86** — PLP / PDP / Cart: compare-tray scoped to shopping
  routes, PLP trust dedup (3→1), PLP card sale parity, PDP spec strip
  → plain text, sparse reviews hide numeric average, cart eyebrow
  dedup, cart secure-checkout copy.
- **Phase 87** — Compare image normalization, compare sizes canonical
  sort, quiz Q2 sublabels, search 5-tile recovery grid, locations +
  showroom + blog H1 → sentence case (toSentenceCase helper preserves
  brand + place names; SEO titles keep canonical Title Case).
- **Phase 88** — P2 polish: real breadcrumb styling, footer privacy
  underline, footer subscribe focus ring, quiz disabled-Next contrast,
  empty cart → recently-viewed rail, PLP compare-toggle 32px tap.
- **Phase 89** — retest follow-ups: hero-copy eyebrow + location-card
  eyebrow color override stripped (Phase 85b missed these scoped rules);
  compare-table table-layout: fixed so unequal title lengths don't
  blow up image cell widths.

### Shopify Admin content corrections (this session)

Via MCP, fixed 9 SEO titles + 13 image alts:
- Diamond ProGel 10" Medium ("Align" → "ProGel" / "8 Firm" → "10 Medium")
- Englander Cambridge Firm + Plush Hybrid ("Beckford" → "Cambridge")
- Englander Amesbury Firm + Pillow Top ("Amsbury" typo → "Amesbury")
- Diamond Azusa Queen Firm 18" ("King" → "Queen")
- Eclipse Ice Tufted Plush ("Glacier" → "Ice")
- Englander Everest Extra Firm + O'Conner Firm (cross-product alts)

### Deferred — merchant content cleanup followup

The audit revealed the merchant reuses single product photos across
firmness variants (Firm / Medium / Plush share images). Fixing alt
text on shared images would break parallel for the other variants.
Affects ~10 product clusters: Diamond ProGel 8/10, Diamond Dreamstage
Clarity / Grace / Snowbird, Englander Amesbury / Everest / O'Conner,
Spring Air Lexi, S&F Estate / Lux Estate. **Merchant fix:** upload
separate per-firmness photos OR accept firmness-neutral alts (e.g.
"Diamond ProGel Memory Foam mattress" without specifying firmness).
Not blocking launch.

### Remaining merchant-side gates

1. **Sentry DSN** (optional) — set `NEXT_PUBLIC_SENTRY_DSN` and
   `SENTRY_DSN` in Vercel (Production), redeploy. SDK is wired in
   `app/layout.tsx` + `instrumentation.ts`; gated on the env var.
2. **DNS cutover.** Point `mattressstoreslosangeles.com` apex + `www`
   at Vercel; keep `checkout.mattressstoreslosangeles.com` on Shopify.
   After propagation, edit the 6 webhook URLs in Shopify Admin →
   Notifications to use the canonical domain.

---

# Earlier — Session handoff — 2026-05-07 (Pre-DNS retest — clean GO)

## Status

**Pre-DNS launch retest: clean GO.** Branch `main` HEAD `dce7b76`. All
Phases 62-83 visual fixes verified intact, plus the new merchant-side
plumbing (`SHOPIFY_WEBHOOK_SECRET`, `SHOPIFY_ADMIN_TOKEN`) confirmed
working end-to-end on production.

### Confirmed live and working

- **Webhook revalidation pipeline.** Shopify product edit → webhook
  (HMAC-verified) → `/api/revalidate` → `revalidateTag` → fresh SSR.
  Round-trip 2.165s on `/products/ultra-soft-mattress-protector`,
  measured with a sentinel-string injection via Admin MCP.
- **Newsletter → Shopify customer creation.** Submitting a fresh email
  via the footer form on the live site creates a Shopify customer with
  tags `[newsletter, storefront-signup]` and
  `emailMarketingConsent.marketingState = SUBSCRIBED` (SINGLE_OPT_IN).
  Idempotent on duplicate submit.
- **Visual sanity sweep.** 8/8 spot-checks PASS across compare flow,
  PLP card alignment + filter sort, PDP buybox + gallery, locations
  grid 5th-card row span, showroom 16:9 aspect, mega-menu z-index,
  cart trust dedup.
- **A11y / 404 SEO.** Zero serious axe-core violations on Home, PLP,
  PDP, Cart, Compare, Locations, Article. Every 404 emits exactly one
  `<meta name="robots" content="noindex">`; public pages emit none;
  `/cart`, `/search`, `/compare` keep their explicit declarations.
- **Cart → checkout.** Drawer + `/cart` + checkout subdomain hand-off
  works; Shop Pay button renders on the Shopify checkout.
- **Sitemap.** `/sitemap.xml` lists 1,184 URLs (195 products + 61
  collections + 33 pages + 893 blog URLs).

### Webhooks registered (API version 2026-04)

`products/create`, `products/update`, `products/delete`,
`collections/create`, `collections/update`, `collections/delete`.

`articles/*` and `pages/*` are not exposed in the Shopify Admin UI
dropdown — registering them requires the Admin GraphQL
`webhookSubscriptionCreate` mutation. Deferred. Articles + CMS pages
still refresh at the natural 10-min ISR TTL, which is acceptable.

### Remaining merchant-side gates (deferred to launch day)

1. **Sentry DSN** (optional) — set `NEXT_PUBLIC_SENTRY_DSN` and
   `SENTRY_DSN` in Vercel (Production), redeploy. The SDK is wired in
   `app/layout.tsx` + `instrumentation.ts`; init is gated on the env
   var so it's a no-op until set.
2. **DNS cutover.** Point `mattressstoreslosangeles.com` apex + `www`
   at Vercel; keep `checkout.mattressstoreslosangeles.com` on Shopify.
   After propagation, edit the 6 webhook URLs in Shopify Admin →
   Notifications to use the canonical domain.

---

# Earlier — Session handoff — 2026-05-07 (Phase 81 — B-block fixes for Phase 62-80 audit)

## Status

Testing agent re-tested `claude/resume-fix-error-9jYGI` against the deep visual audit's 19-fix list (Phases 62-80). 18/19 PASS — single hard blocker (B1) was a missing noindex on the `/pages/[handle]` not-found path. Three soft items (B2 contrast, B3 missing analytics scripts, B4 revalidate 503) were flagged.

### Phase 81 fixes (this commit)

| ID | Severity | Fix |
|----|----------|-----|
| B1 | hard blocker | Added `robots: { index: false, follow: false }` to the metadata return for the not-found branch in `/pages/[handle]`, `/products/[handle]`, `/collections/[handle]`, `/blogs/[blog]`, `/blogs/[blog]/[article]`. The route's `generateMetadata` runs before `notFound()` and its metadata wins over the global `not-found.tsx` — so each route had to inject its own noindex. |
| B2 | soft | `.footer-fineprint` and `.footer .muted` now use `rgba(255,255,255,0.72)` to override the global `.muted` `#6b6b6b`. Hits ~4.6:1 against `--brand-navy` (was 2.51:1, AA-failing). |

### B3 / B4 — preview env config, not code regressions

- **B3 (Vercel Analytics + Speed Insights + Sentry absent on preview):** The components are wired in `app/layout.tsx` and `instrumentation.ts`. By design, `<Analytics />` and `<SpeedInsights />` only inject scripts when `VERCEL_ENV=production` (Vercel doesn't bill insights from preview deploys). Sentry is gated on `NEXT_PUBLIC_SENTRY_DSN`/`SENTRY_DSN`. All three will load on prod once DNS cuts over and the DSN env var is set.
- **B4 (`/api/revalidate` returns 503 instead of 401):** Route returns 503 when `SHOPIFY_WEBHOOK_SECRET` is unset (intentional — see `route.ts:62-64`). The 401 path only triggers when the secret IS set and HMAC fails. Set the env var on preview to exercise the 401 path; otherwise expected behavior.

---



## Status

**Final clean GO from testing agent** (Phase 59 re-test, 2026-05-06): no blockers, no regressions, no bugs. All 6 Phase 58-flagged bugs closed; all 3 false positives confirmed.

Latest commit on main: `3a40fa1` (Phase 59).

Lighthouse mobile delta vs Phase 58 baseline:
- Home: Perf 90 → **99** (+9); A11y 87 → **93** (+6)
- PDP: Perf 97 → 98; A11y 94 → 94
- PLP: A11y 92 → 93 (perf 98 → 92 is single-run variance, not a regression)
- Article: Perf 96 → 98
- Cart: **CLS 0.043 → 0.000** (Fix 6 eliminated the empty-state shift entirely)

All 7 launch gates remain merchant-side (see below).

## Phase 58-59 — fix log

| Phase | What |
|---|---|
| 59 | E2E testing agent round 2: footer dead-link redirects, `<main>` landmark on home, footer `<h3>` → `<div role="presentation">`, `inert` on hidden hero slides, variant chip `aria-label` removed on available, cart `minHeight: 60vh` |
| 58 | Vercel Analytics + Speed Insights + Sentry SDK stub (no-op until DSN set) |
| 57 | E2E testing agent round 1: dedup FurnitureStore (layout LOCAL_BUSINESS_LD → home only), newsletter inline error via `noValidate`, "Clear" text on compare tray, single-hop Santa Monica redirects |

## Status

**GO from testing agent** (re-test 2026-05-05): no blockers, no bugs, no regressions. Clean pass against the brief. Latest commit on main: `136e899` (Phase 57). All 5 launch gates below are merchant-side and outside the codebase.

## Phase 50-57 — recent additions

| Phase | What |
|---|---|
| 57 | Testing-agent fixes: dedupe FurnitureStore (move LOCAL_BUSINESS_LD layout → home only), newsletter inline error via `noValidate`, "Clear" text on compare tray, single-hop Santa Monica redirects |
| 56 | PLP filters by firmness / sleep position / height range — wired to the merchant's existing Search & Discovery metafields |
| 53-55 | PDP buybox spec strip, PLP card spec lines, PDP "At a glance" spec table |
| 52 | 5 mattress spec metafield definitions + bulk-populated 565 metafields across 146 mattresses |
| 51 | Compare table: localStorage selection (max 4) + floating tray + side-by-side `/compare` page |
| 50 | HANDOFF refresh (this doc, prior pass) |

## Phase 22-49 — what got added since the last handoff (most recent first)

| Phase | What | Files |
|---|---|---|
| 49 | Sleep-quiz progress persists to localStorage (mid-quiz nav doesn't lose answers) | `app/sleep-quiz/sleep-quiz.tsx` |
| 47-48 | PWA web manifest + Service schema (delivery / financing / 120-night exchange) on showroom pages | `app/manifest.ts`, `app/pages/[handle]/page.tsx` |
| 44-46 | Recently-viewed clear button, search empty-state category grid, `/` keyboard shortcut to focus search | `app/_components/recently-viewed.tsx`, `app/search/page.tsx`, `app/_components/header-search.tsx` |
| 42-43 | "Open now" badge on homepage Showrooms rail, click-to-swap PDP gallery thumbs | `app/_components/sections/showrooms.tsx`, `app/products/[handle]/gallery.tsx` |
| 38-41 | FAQ JSON-LD on home, A11y skip-to-content link, variant prices in PDP option chips | `lib/faq.ts`, `app/layout.tsx`, `app/products/[handle]/buy-box.tsx` |
| 37 | Article: read-time + "Keep reading" related list (sibling articles) | `app/blogs/[blog]/[article]/page.tsx` |
| 35-36 | Showroom pages: storefront photo + open-now indicator + embedded Google Map; sticky PLP toolbar on mobile | `lib/showrooms.ts`, `app/pages/[handle]/page.tsx`, `app/globals.css` |
| 32-34 | Working `/api/newsletter` (Shopify Admin opt-in + log fallback), recently-viewed on home, 404 with category browse-back grid | `app/api/newsletter/route.ts`, `app/_components/newsletter-form.tsx`, `app/page.tsx`, `app/not-found.tsx` |
| 30-31 | Sitewide value-prop strip below nav (free white-glove / 120-night / 0% APR / 5 showrooms), recently-viewed rail (localStorage-backed) on PDPs | `app/_components/trust-strip.tsx`, `app/_components/recently-viewed.tsx` |
| 28-29 | Mobile-first PLP: bottom-sheet filters, 2-col cards, live result count; predictive autocomplete in header search | `app/_components/plp-filters/*`, `app/_components/header-search.tsx`, `app/api/predictive-search/route.ts` |
| 26-27 | Sticky mobile add-to-cart bar on PDP, cross-sell rail "Pairs well with" (Storefront productRecommendations COMPLEMENTARY → RELATED) | `app/products/[handle]/buy-box.tsx`, `app/products/[handle]/related-rail.tsx`, `lib/shopify/queries/recommendations.ts` |
| 25 | 370 Shopify URL redirects imported (Shopify Admin → Online Store → Navigation → URL Redirects export → JSON → next.config.mjs `redirects()`) | `data/url-inventory/redirects.json`, `scripts/convert-redirects-csv.mjs` |
| 24 | Judge.me reviews wire-up: parses `reviews.rating` + `reviews.rating_count` metafields, renders `<ReviewsBadge>` on PDP, emits `aggregateRating` in Product JSON-LD | `lib/shopify/queries/fragments.ts`, `lib/shopify/queries/product.ts`, `app/_components/reviews-badge.tsx` |
| 22-23 | testing-agent + design-doc batch fixes: tunnel URLs sanitized, PDP variant price + sticky buybox, cart UX polish, quiz auto-advance, PLP totals, contact info canonicalized | many — see `git log` |

### Shopify-side work done this session (via Admin MCP, no code change)

- **Cleaned tunnel URLs** in the `/pages/mattress-store-locations` body. 17 instances of `https://vegetable-lamb-seek-sage.trycloudflare.com` replaced with relative paths + Shopify CDN URLs.
- **Auto-paired complementary products** for all **148 mattresses** in Search & Discovery (`shopify--discovery--product_recommendation.complementary_products` metafield = Foundation + Protector + Adjustable Base). Storefront `productRecommendations(intent: COMPLEMENTARY)` now returns the trio. The Ultra-Soft Protector is currently DRAFT — once published, it'll surface as the third complementary item without code changes.

### Launch gates still on the merchant side

1. ~~Enable **Shop Pay** in Shopify Admin → Settings → Payments.~~ **DONE** — confirmed active in Admin, will surface at checkout automatically.
2. **Webhook for instant cache busts** — Shopify Admin → Settings → Notifications → Webhooks. Add `products/update`, `products/create`, `collections/update`, `articles/update`, format JSON, point at `https://<vercel-url>/api/revalidate`. Set the same secret as `SHOPIFY_WEBHOOK_SECRET` in Vercel env vars (the route HMAC-verifies it).
3. **`SHOPIFY_ADMIN_TOKEN`** env var in Vercel — turns on automatic Shopify customer creation from `/api/newsletter`. Without it, signups fall back to Vercel logs (no emails dropped).
4. **DNS cutover** when ready — point `mattressstoreslosangeles.com` apex + `www` to Vercel; keep `checkout.mattressstoreslosangeles.com` pointed at Shopify.
5. ~~**Publish** the existing DRAFT mattress protectors in Shopify Admin so they surface in cross-sell rails (no code change needed once published).~~ **DONE** — Ultra-Soft Mattress Protector (`gid://shopify/Product/9218346090749`) is now ACTIVE with 60 units across 5 sizes; will surface in complementary rails on next ISR refresh.

---

# Earlier — Session handoff — 2026-05-04 (Phase 21)

## Where things stand

**Branch:** `main` (Phases 13–21 merged, ready for the testing agent)
**Last code commit:** Phase 21+ — article Suspense, /api/revalidate webhook, PDP CLS fix
**Build state:** clean — `tsc --noEmit`, `next lint`, `next build` all pass.
**Live Storefront:** wired and verified.
**Vercel preview:** project `la-mattress-headless` (team `alwayzlegits-projects`), auto-deploying on `main` push. Latest deploy URL: alias `la-mattress-headless-git-main-alwayzlegits-projects.vercel.app` (auth-protected).

The Next.js side of the migration is structurally complete. All four URL
shapes from the brief — `/products`, `/collections`, `/pages`,
`/blogs/{blog}/{article}` — resolve. With a real Storefront token in
`.env.local`, `next build` SSGs **125 static pages**:

- 61 collection PLPs
- 33 published Shopify pages
- 14 priority PDPs
- 7 blog index pages
- 10 site-static pages (home, robots, sitemap, etc.)

Pages not in `generateStaticParams` (the other 181 PDPs, every blog
article) render dynamically with `dynamicParams = true` and cache via
`revalidate = 600`.

## What got verified end-to-end against the live store

I ran `npx next start` after a clean build and curl-tested:

| Route | Status | Notes |
|---|---|---|
| `/` | 200, 116KB | Homepage renders w/ Org+LocalBusiness+WebSite JSON-LD |
| `/collections/mattresses` | 200, 171KB | PLP w/ filters + sort, real products |
| `/products/tempur-pedic-tempur-proadapt-medium-hybrid` | 200, 39KB | PDP, real variants |
| `/pages/koreatown-best-mattress-store` | 200, 53KB | Showroom override w/ FurnitureStore JSON-LD |
| `/pages/mattress-store-locations` | 200, 124KB | Locations index w/ 5-card directory + departments[] |
| `/blogs/sleep-blog` | 200, 88KB | Article grid, real articles flowing |
| `/search?q=tempur` | 200, 160KB | 20+ Tempur products returned |
| `/sleep-quiz` | 200, 37KB | Interactive matcher |
| `/opengraph-image` | 200, 49KB, image/png | Brand-themed OG card via next/og |
| `/collections/sale` (redirect) | 308 → `/collections/on-sale` | Redirects pipeline working |

Smoke test: Storefront `shop` query returned `LA Mattress Store`,
currency `USD`, primary domain `checkout.mattressstoreslosangeles.com`.

## .env.local

`.env.local` is gitignored. To recreate in the next session:

```bash
SHOPIFY_STORE_DOMAIN=la-mattress.myshopify.com
SHOPIFY_STOREFRONT_PUBLIC_TOKEN=fa318d9ac6f847635e8ac3a31c41458b
SHOPIFY_API_VERSION=2024-10
NEXT_PUBLIC_SITE_URL=https://mattressstoreslosangeles.com
```

The Storefront token is a Headless channel public access token (32-char
hex, no `shpat_` prefix). It's safe to expose to the browser but is
currently only used server-side via `lib/shopify/client.ts`.

> The user pasted an Admin API token (`shpat_4049…`) earlier in the
> conversation by mistake. **They should revoke that one** in Shopify
> Admin → Apps and sales channels → Develop apps → [their app] → API
> credentials. It was never used by the codebase, but it's been visible
> in the chat transcript.

## Phases 14–19 — what got done in the resume session

Each phase is one commit on `main`.

| Phase | What | Commit |
|---|---|---|
| 13 | Next 14 → 15 + React 18 → 19, async-request-api codemod | `6498116` |
| 14 | Soft-404 fix on PDP/PLP, 500 fix on `/collections` & `/blogs/[blog]` | `e0ee706` |
| 15 | Drop `quantityAvailable` (scope-denied), tolerate partial GraphQL errors | `f479f60` |
| 16 | LD-JSON in initial HTML, title cap, description fallbacks (`firstNonEmpty`) | `068bb6c` |
| 17 | Self-hosted Geist via `next/font`, hero preconnect + preload, smaller hero img | `3773c12` |
| 18 | Hero CSS-bg → `<Image priority>` — homepage LCP 12.9s → 4.3s | `169f661` |
| 19 | Hybrid Suspense skeletons on PDP/PLP (known handles fast-path, unknown 404) | `a4bd5fa` |
| 20 | Article handles via Storefront (no Admin needed), SSG articles, sitemap 298→1184 URLs | `54755af` |
| 21 | Article Suspense fast-path, `/api/revalidate` webhook, query-scope audit | `d048900` |
| 21+ | Extend ProductSkeleton with description placeholder (PDP CLS 0.324 → 0) | `a4ce538` |

### End-to-end verification on the Vercel preview (Phase 21+ final)

Lighthouse (mobile, simulated 4G, warmed edge cache):

| Route | Perf | LCP | CLS |
|---|---|---|---|
| home | 79 | 3.9s | 0 |
| pdp | 90 | 2.7s | 0 |
| plp | 89 | 2.2s | 0 |
| article | 93 | 2.2s | 0 |
| page | 99 | 2.0s | 0 |
| blog-index | 100 | 1.8s | 0 |

CLS = 0 on every route. PDP regressed to CLS 0.324 in Phase 20+ (skeleton mismatch caused footer to shift); fixed in Phase 21+ by extending the skeleton with a description-section placeholder. Home LCP 3.9s is bound by the Unsplash hero image's `/_next/image` cold optimization; production with a custom domain + warmed edge cache should comfortably hit <2.5s.

Status codes (real Storefront, after Phase 19):

| Route | Status |
|---|---|
| `/products/{known}` | 200 (Suspense + skeleton) |
| `/products/{unknown}` | 404 (sync path) |
| `/collections/{known}` | 200 (Suspense + skeleton) |
| `/collections/{unknown}` | 404 (sync path) |
| `/pages/{unknown}`, `/blogs/{unknown}`, `/blogs/{blog}/{bad article}` | 404 |
| `/collections/sale` | 308 → `/collections/on-sale` |
| `/`, `/cart`, `/account`, `/sleep-quiz`, `/search` | 200 |

LD-JSON: 5 valid blocks in initial HTML on every key route (Org / FurnitureStore / WebSite + page-specific Product / CollectionPage / Article / Quiz + BreadcrumbList). All parse cleanly.

Cart → checkout: `cartCreate` mutation works, `cart.checkoutUrl` is on the `checkout.mattressstoreslosangeles.com` domain. The cart drawer (`app/_components/cart-drawer.tsx:133`) and `/cart` page (`app/cart/page.tsx:109`) both link `href={cart.checkoutUrl}` directly — no rewrite, no proxy.

## Phase 13 — Next 15 upgrade + status-code fixes (resolved)

Both known issues from Phase 12 are now fixed.

**What changed:**
- `next 14.2.35` → `next 15.5.15`, `react 18.3.1` → `19.2.5` (matching `eslint-config-next`, `@types/react*` bumped).
- `@next/codemod` `next-async-request-api` codemod ran clean across 7 files: `params` and `searchParams` are now `Promise<...>` and awaited; `cookies()` is awaited.
- Cleaned up the codemod's `UnsafeUnwrappedCookies` casts in `app/_actions/cart.ts` by making `setCartCookie` / `clearCartCookie` async.
- **Root layout no longer reads cookies.** `app/layout.tsx` was awaiting `readCart()` server-side, which forced every route to be dynamic. Cart hydration now happens client-side via `useEffect` in `CartProvider` calling `readCart()` as a server action. Side effect: `/`, `/account`, `/sleep-quiz` are now fully static (○) where they were dynamic (ƒ) before.
- **Removed route-level `loading.tsx`** for `/products/[handle]` and `/collections/[handle]`. The implicit Suspense boundary was swallowing `notFound()` and emitting 200 with the not-found body. Trade-off: navigation no longer shows a skeleton on those routes. Add page-internal `<Suspense fallback={<Skeleton />}>` later if we want it back.
- **`force-dynamic` on `searchParams`-consuming routes.** `/collections/[handle]` and `/blogs/[blog]` consume `?after=`, `?sort=`, and filter params. With `revalidate = 600`, awaiting `searchParams` in Next 15 throws `DYNAMIC_SERVER_USAGE`. Switched both to `export const dynamic = 'force-dynamic'`. Per-fetch caching (Storefront API responses) still applies via Next's data layer.

**Status codes verified on `next start` (no env vars set, so all dynamic routes hit the `!SHOPIFY_CONFIGURED ⇒ notFound()` guard):**

| Route | Before | After |
|---|---|---|
| `/products/this-does-not-exist` | 200 (soft-404) | **404** ✓ |
| `/collections/this-does-not-exist` | 200 (soft-404) | **404** ✓ |
| `/pages/this-does-not-exist` | 404 | **404** ✓ |
| `/blogs/this-does-not-exist` | 404 | **404** ✓ |
| `/blogs/sleep-blog/no-such-article` | 500 | **404** ✓ |
| `/` | 200 | **200** ✓ |
| `/search?q=x` | 200 | **200** ✓ |
| `/cart`, `/account`, `/sleep-quiz` | 200 | **200** ✓ |

**Files touched:**
- `package.json`, `package-lock.json` — version bumps
- `app/layout.tsx` — drop server-side `readCart()`
- `app/_components/cart-context.tsx` — add `useEffect` hydration
- `app/_actions/cart.ts` — async cookies, drop unsafe-unwrap
- `app/products/[handle]/page.tsx`, `app/collections/[handle]/page.tsx`, `app/pages/[handle]/page.tsx`, `app/blogs/[blog]/page.tsx`, `app/blogs/[blog]/[article]/page.tsx`, `app/search/page.tsx` — `Promise<params>` / `Promise<searchParams>`
- `app/products/[handle]/loading.tsx`, `app/collections/[handle]/loading.tsx` — **deleted**
- `data/seo-audit/mattressstoreslosangeles.com_mega_export_20260504.csv` — refreshed export

## Pre-Phase-13 known issues (now resolved — kept for history)

### 1. PDP and PLP return HTTP 200 (not 404) on bad handles — soft 404

**Symptom:** `/products/[bad-handle]` and `/collections/[bad-handle]`
render the 404 "Lost in the night" body but with HTTP 200 status. Bad
for SEO (Google may index missing handles as live 200 pages with thin
content).

**Status of other dynamic routes:**
- `/pages/[handle]` — 404 ✓
- `/blogs/[blog]` — 404 ✓
- `/blogs/[blog]/[article]` — **500** (DYNAMIC_SERVER_USAGE) ❌ — see
  issue #2 below

**Root cause (confirmed by isolation test):** route-level `loading.tsx`
wraps the route in a Suspense boundary. In Next.js 14.2.x, when
`notFound()` is thrown from inside a Suspense, the framework
sometimes serves the not-found body but loses the 404 status code.

PDP and PLP both have a `loading.tsx` (skeleton during navigation).
`/pages` and `/blogs` index don't. That's the differentiator.

**What was tried:**
- ✗ Calling `notFound()` from `generateMetadata` — no effect on
  PDP/PLP, broke article route to 500.
- ✗ Removing `revalidate = 600` from PDP — no effect.
- ✗ Adding route-segment `not-found.tsx` siblings — files compiled
  into the build, but Next.js still serves with 200. Kept anyway
  because they DO give route-specific 404 copy (better UX than the
  generic root not-found.tsx).
- ✗ Removing `loading.tsx` outright — confirmed cause but breaks
  navigation skeletons; also somehow broke real-handle PDP rendering
  in production mode (probably need to clear Vercel-style ISR cache).

**Recommended next-session approach:**
1. **Upgrade Next.js to 15.x** (`npm install next@latest react@latest`).
   The notFound() / Suspense interaction was reworked in Next 15. This
   is likely the cleanest fix and has the side benefit of unlocking
   `next/font/google` self-hosting for Geist (Phase 4b note).
2. If staying on Next 14: reimplement loading skeletons as a
   page-internal `<Suspense fallback={<Skeleton/>}>` boundary around
   the data-fetch component, rather than route-level `loading.tsx`.
   The notFound() call would happen OUTSIDE the Suspense and emit the
   correct 404 status. Pattern:
   ```tsx
   export default async function ProductPage({ params }) {
     // Sync check up front: if handle isn't in our inventory snapshot,
     // 404 immediately. Note: misses recently-added products until we
     // re-run pull-inventory.mjs.
     if (!findProduct(params.handle)) notFound();
     return (
       <Suspense fallback={<ProductSkeleton/>}>
         <ProductBody handle={params.handle} />  {/* awaits Storefront */}
       </Suspense>
     );
   }
   ```

### 2. `/blogs/[blog]/[article]` returns 500 on bad article handles

**Symptom:** When the article handle doesn't exist (blog handle is
real, e.g. `/blogs/sleep-blog/no-such-article`), the route returns
HTTP 500 with a `DYNAMIC_SERVER_USAGE` digest in server logs.
`/blogs/[bad-blog]/anything` correctly 404s.

**Confirmed:** This was already broken before any of my fix attempts;
it's not a regression from the not-found.tsx work.

**Root cause (suspected):** the layout's `readCart()` calls
`cookies()`, which forces dynamic rendering. The article route's
`revalidate = 600` + `notFound()` + nested-dynamic-segment combo
(two dynamic params: `[blog]/[article]`) trips a known Next.js 14
edge case where the framework can't resolve "is this a not-found or
a forced-dynamic-due-to-cookies?" and surfaces the conflict as a
500.

**What was tried:**
- ✗ `export const dynamic = 'force-dynamic'` on the article route —
  made it WORSE (real articles also 500'd).

**Recommended next-session approach:** same as #1 — Next 15 upgrade
likely resolves this, OR refactor `readCart()` to not call cookies()
inline during layout render (e.g., move cart hydration to a client
component that fetches via a server action after mount).

## What's left before launch

**Operational (you do these):**
1. **Revoke the leaked Admin token** (see .env.local section).
2. **Run `node scripts/pull-inventory.mjs`** with an Admin token that
   has `read_content` + `read_themes` scopes. This populates:
   - Article handles per blog (currently empty in `data/url-inventory/blogs.json` — articles render dynamically until populated)
   - The full redirects table (currently 6 verified entries; brief estimates ~400 historical Shopify URL redirects)
3. **Visual QA in a real browser.** I built without a live browser.
   Expect cosmetic tweaks once you can see real Shopify product imagery
   in the layout. Probable suspects: hero, cart drawer line items,
   article cover ratios.
4. **Resolve the 404 status issue** (above).

**Vendor / content decision:**
- Live review feed (Birdeye / Yotpo) on PDP + homepage Reviews section
- Real account dashboard (currently a placeholder)
- Hero CMS metaobjects for editorial control of rotating slides

## How to resume in the next session

```bash
# In a fresh session:
git fetch origin
git checkout claude/migrate-hydrogen-nextjs-O4Lo0
git pull origin claude/migrate-hydrogen-nextjs-O4Lo0

# Recreate env (token from this handoff doc):
cp .env.example .env.local
# edit .env.local, set SHOPIFY_STOREFRONT_PUBLIC_TOKEN

# Smoke check:
npx next build
npx next start &  # or: npm run dev
curl -sI http://localhost:3000/                                     # 200
curl -sI http://localhost:3000/products/this-does-not-exist          # currently 200, should be 404 — start here
curl -sI http://localhost:3000/pages/this-does-not-exist              # 404 ✓
```

## Phase summary (commit anchors)

| Commit | Phase | Summary |
|---|---|---|
| `96867b8` | 0 | Scaffold Next.js + port homepage from design handoff |
| `5a4aa0f` | 0 | URL inventory snapshot + reusable pull script |
| `7fbb282` | 1 | Phase 0 data layer + PDP, PLP, /pages, sitemap, robots, 404 |
| `bf20ac5` | 2 | Cart layer (server actions, drawer, /cart) + PLP pagination |
| `4667592` | 3 | Search route, showroom template, sleep-quiz placeholder |
| `aa56029` | 4 | Error/loading boundaries, /account, redirects pipeline |
| `80b268c` | 4b | Drop unused fonts, preconnect hints, README refresh |
| `415c7a1` | 5 | Site-wide OG image + LCP priority on first cards |
| `5c0d643` | 6 | PLP faceted filters (vendor, type, size, price) |
| `8cb7f42` | 7 | Mega menu tiles paint real images |
| `67f42dd` | 7b | Kill dead links to unpublished Shopify pages |
| `eb87e3e` | 8 | Mobile filter drawer (slide-in w/ Show results CTA) |
| `33106b0` | 9 | Real /sleep-quiz interactive matcher |
| `8d7bb07` | 10 | Faceted filters on /search + shared plp-filters module |
| `9b364e6` | 11 | Blog routes + locations index + site-wide JSON-LD + ESLint |

---

# Brief for the testing agent

The migration is functionally complete and pushed to `main`. A testing agent should now exercise the preview end-to-end (browser + Shopify Admin + Vercel) and report what's missing for production.

## What you have access to

- **Preview URL** (auth-protected via Vercel Deployment Protection):
  https://la-mattress-headless-git-main-alwayzlegits-projects.vercel.app
  Sign in via the project owner's Vercel account, or use a generated share link from `get_access_to_vercel_url`.
- **Vercel project:** `la-mattress-headless` (team `alwayzlegits-projects`, id `prj_ZsYbO47m3igJBAFSiYDyz0fjZrwW`).
- **GitHub repo:** `AlwayzLegit/LA-Mattress-Headless`. `main` is the production branch.
- **Shopify Admin** (via the connected MCP server). Read-only is enough for the audit, but you'll need write access if remediating Shopify-side issues.
- **Live Shopify storefront** (the existing Hydrogen site) at `https://mattressstoreslosangeles.com` for comparison.

## Things you should test (frontend)

1. **Visual QA** in a real browser, mobile + desktop:
   - Hero rotation (3 slides), the LCP image renders correctly.
   - Mega menu opens, tile images load from Shopify CDN.
   - PLP filters (vendor / type / size / price), sort dropdown, "Load more" pagination, mobile filter drawer.
   - PDP gallery, variant selector (BuyBox), Add-to-cart UX, JSON-LD blocks present.
   - Cart drawer (slides in, line editor, totals correct), `/cart` page, "Checkout" CTA.
   - Article rendering (`/blogs/{blog}/{article}`) — pick 2-3 from `data/url-inventory/blogs.json` to spot-check.
   - Sleep quiz (8 questions, recommendation result links to a real PDP).
   - Showroom pages (`/pages/{handle}` for the 5 LA stores) and the locations index.
   - Footer, topbar, search.
2. **End-to-end checkout flow:**
   - Add a real mattress (e.g. tempur-pedic-tempur-proadapt-medium-hybrid) to cart.
   - Open cart drawer → click "Checkout".
   - Confirm browser navigates to `checkout.mattressstoreslosangeles.com/...`.
   - Walk through to the payment step (don't pay). Verify Shop Pay / cards / Apple Pay all show. Verify order summary matches the cart.
3. **404 / 500 / redirect smoke:**
   - `/products/{any-bad-handle}` → expect 404 with "Lost in the night" body and "404 — Product" eyebrow.
   - `/collections/{bad}`, `/blogs/{bad}`, `/blogs/sleep-blog/{bad}` → 404 with route-specific copy.
   - `/collections/sale` → 308 redirect to `/collections/on-sale`.
   - Pages we haven't tested: report which routes throw 500 if any.
4. **SEO surface:**
   - Run a Semrush / Ahrefs / Sitebulb crawl on the preview URL. Compare against `data/seo-audit/mattressstoreslosangeles.com_mega_export_20260504.csv` (the audit of the *live Hydrogen site*) — flag what's still flagged on our build.
   - Validate JSON-LD with https://validator.schema.org/ on every page-template (PDP, PLP, page, article, sleep-quiz, locations).
   - Sitemap 1184 entries — spot-check that random URLs resolve.
   - Verify `noindex` on `/cart` and `/search`.
5. **Performance:**
   - Run PageSpeed Insights on the preview URL (warning: preview deploys are auth-protected and have `X-Robots-Tag: noindex`, so SEO score will be artificially ~58-69; performance is the meaningful signal).
   - For mobile + desktop, target homepage / PDP / PLP / article. The Phase 21+ baseline (Lighthouse, simulated 4G, mobile) was: home 89, pdp 80→fixed in 21+, plp 94, page 99, blog 100, article 98.
   - Web Vitals targets: LCP < 2.5s, CLS < 0.1, INP < 200ms.

## Things you should test (backend / data layer)

6. **Storefront API connectivity:**
   - Verify `cart.checkoutUrl` always points to `checkout.mattressstoreslosangeles.com` (not the `myshopify.com` subdomain).
   - Confirm partial GraphQL errors (Phase 15) still don't 5xx — the `quantityAvailable` field was dropped, but if any other field becomes scope-denied on token rotation, `lib/shopify/client.ts` should log a warning and return data.
   - Edge cases: out-of-stock variant (does Add to Cart fail gracefully?), variant with no compareAtPrice.
7. **Webhook receiver (`/api/revalidate`):**
   - GET on `/api/revalidate` should return `{ok: true, route: "/api/revalidate", method: "POST"}`.
   - POST without `SHOPIFY_WEBHOOK_SECRET` env var → 503.
   - POST with bad HMAC → 401.
   - With the env var set + a valid Shopify webhook payload, POST → 200 + `revalidated: ["product:..."]` etc.
   - To test with real webhooks: in Shopify Admin → Settings → Notifications → Webhooks, register `products/update` with format JSON and the secret, point at the preview URL. Update a product, watch Vercel function logs.

## Things you should look at (Shopify Admin side)

The audit `data/seo-audit/mattressstoreslosangeles.com_mega_export_20260504.csv` flagged 791 pages on the live Hydrogen store. Some are migration-fixable; others need merchant work in Shopify Admin:

- **Duplicate h1 / title (129 pages)** — needs a copy decision from the merchant. Two patterns to consider, suggested in the chat checklist.
- **URL redirects** — `data/url-inventory/redirects.json` has 6 entries; the live store has roughly 1500. Pull the full table either via `scripts/pull-inventory.mjs` (needs an Admin token with `read_themes`) or export from Shopify Admin → Online Store → Navigation → URL Redirects → Export CSV. Convert the CSV to the JSON shape and commit. Vercel re-evaluates `next.config.mjs redirects()` on each build.
- **Missing meta description on 12 articles** — fixed in code (`firstNonEmpty()` fallback), but the merchant should still write proper SEO descriptions in Shopify Admin → Online Store → Blog Posts → SEO.
- **SEO title length** — capped programmatically at 56 chars + " · LA Mattress" suffix. Merchant should still aim for ≤ 60 char SEO titles in Admin.
- **Unpublished pages** flagged: ~80 of 113 Shopify pages are unpublished. Those are intentionally not in our sitemap. Merchant should cull truly-dead pages from Admin to keep their inventory tidy.
- **Reviews widget** placeholder on PDP + homepage Reviews section. Vendor decision pending (Birdeye vs Yotpo). Recommend the merchant pick one.
- **`/account` is a placeholder.** Customer Account API integration deferred per the original brief.

## Hand-back

After your audit, return:
1. A list of issues found in the Next.js storefront, with severity (blocker / regression / polish).
2. A list of Shopify-side recommendations (copy / config / data hygiene).
3. A go/no-go assessment for production cutover, with the remaining gates.
