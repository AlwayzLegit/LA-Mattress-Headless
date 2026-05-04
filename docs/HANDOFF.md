# Session handoff — 2026-05-04

## Where things stand

**Branch:** `claude/migrate-hydrogen-nextjs-O4Lo0`
**Last code commit:** `9b364e6` — "Phase 11: pre-Storefront wrap-up"
**Build state:** clean — `tsc --noEmit`, `next lint`, `next build` all pass.
**Live Storefront:** wired and verified (see "What got verified" below).

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

## Known issue — to address next session

**`/products/[handle]` and `/collections/[handle]` return HTTP 200 (not
404) when the handle doesn't exist.** Body is correct (renders the 404
"Lost in the night" page), but the status code is wrong. This is bad
for SEO since Google would index missing handles as live 200 pages.

What works correctly: `/pages/[handle]`, `/blogs/[blog]`,
`/blogs/[blog]/[article]` all return 404.

What I tried that didn't fix it:
- Calling `notFound()` from `generateMetadata` (in addition to the page
  handler) — didn't change PDP/PLP status, and on the article route it
  caused a 500 (`DYNAMIC_SERVER_USAGE` digest). Reverted.

The pattern in PDP/PLP/PAGES/BLOG is identical (same `revalidate = 600`,
`dynamicParams = true`, `notFound()` in page handler) so it's not
obvious why two of the five misbehave. Likely a Next.js 14.2.x quirk
related to ISR + `notFound()` interacting with how PDP/PLP pages also
render multiple client islands (`<BuyBox>`, `<FilterPanel>` etc).

Next session: try one of these in order, smallest to largest:
1. Upgrade Next.js to 14.2.x latest patch (currently 14.2.35) — there
   was a known regression around `notFound()` + ISR statuses fixed in
   later patches.
2. Try `export const dynamic = 'force-dynamic'` on PDP/PLP only when
   the entity is null (won't work cleanly — `dynamic` is module-level).
3. Switch PDP/PLP to use a server-side redirect to `/not-found` on
   missing entity (preserves URL but emits 404). Hacky.
4. Upgrade to Next 15 — the entire `notFound` semantic has been
   reworked there.

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
