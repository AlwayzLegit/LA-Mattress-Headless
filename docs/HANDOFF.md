# Session handoff — 2026-05-04 (Phase 19)

## Where things stand

**Branch:** `main` (Phases 13–19 merged)
**Last code commit:** Phase 19 — hybrid Suspense skeletons on PDP/PLP
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

### End-to-end verification on the Vercel preview (Phase 18 numbers)

Lighthouse (mobile, simulated 4G, six routes):

| Route | Perf | LCP | CLS |
|---|---|---|---|
| home | 77 | 4.3s | 0 |
| pdp | 90+ | 1.9s | 0 |
| plp | 91 | 2.8s | 0 |
| page | 97 | 1.6s | 0 |
| blog-index | 94 | 2.4s | 0 |
| search | 96 | 2.2s | 0 |

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
