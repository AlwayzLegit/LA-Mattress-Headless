# LA Mattress — Headless (Next.js)

Migration target for `mattressstoreslosangeles.com` — Shopify Hydrogen → Next.js (App Router) with Shopify Storefront API as the headless backend. Checkout remains Shopify-hosted on `checkout.mattressstoreslosangeles.com`.

See the operating brief in conversation history for full migration scope. This README documents what's currently in the repo.

## Status

| Phase | Status |
|---|---|
| Phase 0 — Next.js scaffold + design system | ✅ Done |
| Phase 0 — Homepage (`/`) — full design port | ✅ Done |
| Phase 0 — Storefront API client + typed queries + cart mutations | ✅ Done |
| Phase 0 — URL inventory snapshot (collections, products, pages) | ✅ Done |
| Phase 1 — `/products/[handle]` PDP w/ variant selector + Product JSON-LD | ✅ Done |
| Phase 1 — `/collections/[handle]` PLP w/ grid + sort + cursor pagination + CollectionPage JSON-LD | ✅ Done |
| Phase 1 — `/pages/[handle]` w/ HTML body + LocalBusiness JSON-LD on location pages | ✅ Done |
| Phase 1 — `sitemap.xml` + `robots.txt` + `not-found` page | ✅ Done |
| Phase 1 — `/search` route (Storefront `search`) + nav search wiring | ✅ Done |
| Phase 2 — Server-action cart layer (cookie-backed cart id, `useOptimistic` count) | ✅ Done |
| Phase 2 — Cart drawer + `/cart` page with line editor | ✅ Done |
| Phase 3 — Showroom-page template override on `/pages/[handle]` (5 LA locations w/ FurnitureStore JSON-LD) | ✅ Done |
| Phase 3 — `/sleep-quiz` placeholder + `/account` placeholder | ✅ Done |
| Phase 4 — `error.tsx`, `global-error.tsx`, route-level `loading.tsx` | ✅ Done |
| Phase 4 — `next.config.mjs` `redirects()` pipeline reading from `data/url-inventory/redirects.json` | ✅ Done |
| Phase 4 — Resource hints (preconnect to Google Fonts + cdn.shopify.com) + drop unused fonts | ✅ Done |
| Phase 5 — Site-wide OG image (`app/opengraph-image.tsx`) + LCP `priority` on first 3 PLP/search cards | ✅ Done |
| Phase 6 — PLP faceted filters (vendor, type, size, price) — Storefront `productFilters` | ✅ Done |
| Phase 7 — Mega menu tiles painted via `phImg()` (last placeholder labels removed) | ✅ Done |
| Phase 7b — Dead-link audit (FAQ + delivery → temp 302s, homepage FAQ link relabeled) | ✅ Done |
| Phase 8 — Mobile filter drawer (slide-in + scrim + sticky "Show results" CTA) | ✅ Done |
| Phase 9 — Real `/sleep-quiz` interactive matcher (8-question state machine + recommendation algorithm + Quiz JSON-LD) | ✅ Done |
| Phase 10 — Faceted filters on `/search` + shared `app/_components/plp-filters/` module | ✅ Done |
| Phase 11 — `/blogs/[blog]` + `/blogs/[blog]/[article]` routes w/ Article + Blog + BreadcrumbList JSON-LD | ✅ Done |
| Phase 11 — Showroom locations index template override on `/pages/mattress-store-locations` (FurnitureStore w/ `department[]`) | ✅ Done |
| Phase 11 — Site-wide Organization + LocalBusiness + WebSite JSON-LD lifted to root layout | ✅ Done |
| Phase 11 — `.eslintrc.json` (`next/core-web-vitals`) — `next lint` passes clean | ✅ Done |
| `scripts/pull-inventory.mjs` for full article handles + redirects pull | 🟡 Pending — needs Admin token w/ `read_content` + `read_themes` scopes |
| Wire Storefront API (token + domain in `.env.local`) | 🟡 Code ready; awaiting token from user |
| Real review feed (Birdeye / Yotpo) on PDP + homepage Reviews section | ⬜ Deferred — vendor decision pending |

## Local development

```bash
npm install
cp .env.example .env.local         # then add SHOPIFY_STOREFRONT_PUBLIC_TOKEN
npm run dev                         # http://localhost:3000
npm run build                       # production build (works w/o env, just no prerender)
npm run typecheck                   # tsc --noEmit
npm run lint                        # next lint (eslint-config-next + core-web-vitals)
```

Requires Node ≥ 18.18 (Node 22 recommended).

The build will succeed without the Storefront token — dynamic routes
(`/products/[handle]`, `/collections/[handle]`, `/pages/[handle]`,
`/blogs/[blog]`, `/blogs/[blog]/[article]`) just won't pre-render any pages.
Once the token is set, `next build` will SSG every collection, every
published page, and the priority PDPs from the inventory snapshot.

## Tech stack

- **Next.js 14.2** App Router with React Server Components by default
- **TypeScript** strict mode
- **Plain CSS** with custom-property design tokens — no Tailwind. The design system ships an opinionated component-class API (`.h-display`, `.eyebrow`, `.btn-primary`, `.section-dark`, `.pcard`, etc.) that's the source of truth; mixing in Tailwind would duplicate the token system
- **`next/image`** for the logo and (eventually) Shopify CDN imagery; placeholder lifestyle images are painted as `background-image` via the `.ph[data-img]` hook so they don't go through the optimizer

## Design system

Ported from a complete handoff bundle (see conversation history). Key tokens live in `app/globals.css` under `:root`:

- Brand: `--brand-navy #1B2C5E` (logo / dark sections), `--brand-red #D8232A` (logo accent only — never functional)
- Accent: `--accent #1428A0` (Samsung electric blue, locked) — all buttons, links, focus rings
- Type: `Geist` (UI/body) + `Geist Mono` (numerics/eyebrows), loaded from Google Fonts with preconnect hints. Source Serif 4 / Bebas Neue from the original design handoff are unused and intentionally not loaded
- Spacing: 8px base, micro 4px step
- Layout: 1440px max container, 32px gutter, 64px nav, 32px top bar

Detailed token table is at `data/design-handoff/02-design-system.md` (when ported) or in the original handoff bundle.

## Repo layout

```
app/
  globals.css              All design CSS (tokens + components + responsive + filter drawer + quiz)
  layout.tsx               Root layout — html, head (preconnect), TopBar, Nav, children, Footer,
                           CartDrawer, site-wide Organization + LocalBusiness + WebSite JSON-LD
  page.tsx                 Homepage composition (sections) — site-wide JSON-LD lives in layout
  opengraph-image.tsx      Brand-themed 1200×630 social preview (next/og, edge runtime)
  error.tsx                Page-level error boundary (friendly retry + escape hatches)
  global-error.tsx         Root error boundary (renders own html/body when layout itself fails)
  not-found.tsx            404 page — "Lost in the night" w/ link list
  sitemap.ts               Sitemap from inventory snapshot (home + 195 PDPs + 61 PLPs +
                           26 published pages + 7 blog index URLs + /sleep-quiz)
  robots.ts                robots.txt — allow everything except /cart, /checkout, /account, /api, /search?
  _components/
    icon.tsx               SVG icon registry (1.5px stroke, currentColor)
    images.ts              Image registry + phImg() helper for .ph backgrounds
    topbar.tsx             Top utility bar (free shipping, financing, find-a-store)
    nav.tsx                Sticky nav with mega menu (client) + cart-drawer trigger
    hero.tsx               Homepage hero carousel — 3 slides, 7s autoplay, pauseable
    footer.tsx             5-column footer + signature + legal links
    cart-context.tsx       useOptimistic cart count + drawer open state
    cart-drawer.tsx        Slide-in cart drawer (Escape close, body-scroll lock)
    plp-filters/           Shared faceted-filter UI consumed by PLP and search:
                            filter-shell.tsx        Context provider for mobile drawer open state
                            filter-panel.tsx        Sidebar / mobile-drawer w/ checkbox lists + price form
                            filter-mobile-trigger.tsx  "Filter (3)" toolbar pill (mobile only)
                            active-filters.tsx      Chip row above grid + clear-all
                            filters.ts              URL parser, ProductFilter mapper, helpers
                            index.ts                Barrel
    sections/              Static homepage sections (PopularProducts, ShopByCategory, Showrooms, etc.)
  _actions/cart.ts         Server actions over Storefront cart mutations (HTTP-only `cartId` cookie)
  products/[handle]/       PDP — variant selector + Product JSON-LD + loading.tsx skeleton
  collections/[handle]/    PLP — grid + sort + cursor pagination + filters (consumes plp-filters)
                           + CollectionPage JSON-LD + loading.tsx
  pages/[handle]/          Shopify Page renderer w/ template overrides:
                            – per-showroom (5 LA handles) → FurnitureStore JSON-LD, address,
                              geo, opening hours, financing CTAs, sticky info card
                            – locations index (mattress-store-locations) → FurnitureStore w/
                              department[] for each showroom + 5-card directory grid
  blogs/[blog]/            Blog index — paginated article list + Blog JSON-LD
  blogs/[blog]/[article]/  Article body + BlogPosting JSON-LD + breadcrumb (article handles
                           render dynamically until pull-inventory.mjs populates them)
  search/                  /search route w/ filters + SearchInput client + loading.tsx
  cart/                    /cart page (force-dynamic, noindex) + line editor + loading.tsx
  account/                 /account placeholder (noindex) — deflects to phone + showrooms
  sleep-quiz/              /sleep-quiz interactive matcher (8-question state machine →
                           collection recommendation) + Schema.org Quiz JSON-LD
lib/
  shopify/
    client.ts              fetch-based Storefront client w/ typed errors + Next cache config
    types.ts               Hand-written TS types (Product, Collection, Page, Cart, Money, Image,
                           Article, Blog, AvailableFilter, ProductFilter)
    queries/               getProductByHandle, getCollectionByHandle, getPageByHandle,
                           getBlogByHandle, getArticleByHandle, getMenu, handles, search
    mutations/cart.ts      cartCreate, cartLinesAdd/Update/Remove, getCart
    index.ts               Barrel export — routes import from `@/lib/shopify`
  inventory.ts             Build-time accessors over data/url-inventory snapshots
  format.ts                formatMoney, formatPriceRange (Intl.NumberFormat)
  showrooms.ts             Hardcoded showroom directory (5 LA locations w/ address + geo + hours)
  structured-data.ts       Site-wide ORGANIZATION_LD + LOCAL_BUSINESS_LD + WEBSITE_LD constants
data/
  seo-audit/               Semrush-style site audit CSV from the live site
  url-inventory/
    collections.json       61 collections (handle + SEO + counts)
    products.json          195 active+published products
    pages.json             110 pages (26 published)
    blogs.json             7 blog handles (article enumeration deferred — pull-inventory.mjs)
    redirects.json         6 verified seed redirects (4 permanent + 2 temp 302s for unpublished
                           Shopify pages); pipeline reads this at build time
scripts/
  pull-inventory.mjs       Re-runnable Admin-API inventory pull
                           (needs SHOPIFY_STORE_DOMAIN + SHOPIFY_ADMIN_TOKEN env)
next.config.mjs            Image remote patterns + redirects() pipeline reading the inventory JSON
.eslintrc.json             eslint-config-next/core-web-vitals
```

## Hard constraints (from the migration brief)

1. **URL preservation is non-negotiable.** Every existing `/products/{handle}`, `/collections/{handle}`, `/pages/{handle}`, and `/blogs/{blog}/{article}` URL on the live site must resolve at the same path on the new app. All four route shapes are now in place; once a Storefront token is configured they SSG from inventory and resolve any handle dynamically.
2. **Checkout is Shopify-hosted.** Cart hand-off goes via `cart.checkoutUrl` to `checkout.mattressstoreslosangeles.com`. We do not recreate checkout.
3. **Read-only Storefront API in the app.** Admin operations stay in Shopify Admin. No Admin API tokens in this codebase.
4. **No Tailwind.** Plain CSS with the design's token + component system.

## Homepage — what's hardcoded vs real

| Section | Current source | Future swap |
|---|---|---|
| Hero carousel | Hardcoded copy + Unsplash imagery | Real CMS-driven slides (Shopify metaobjects) |
| Trust bar | Static | Static (intended to remain static) |
| Popular products | 8 products, several handles match real Shopify products | Storefront API `getProductsByHandles` for the Popular collection |
| Shop by category | 6 hardcoded category tiles → real `/collections/...` URLs | Stay hardcoded (curated set), tile counts can be dynamic |
| Showrooms | 5 hardcoded → real `/pages/koreatown-best-mattress-store` etc. | Stay hardcoded; pages are rendered separately |
| Brand strip | 9 hardcoded → real `/collections/{brand}-mattresses` URLs | Stay hardcoded |
| Why us | Static | Static |
| Quiz teaser | Links to `/sleep-quiz` (now a real 8-question matcher) | Done |
| Reviews | 6 sample Google reviews | Replace with live review feed (Birdeye/Yotpo TBD) |
| FAQ | 6 hardcoded Q&As; "Ask a question" → `/pages/mattress-store-contact` | Stay hardcoded; full FAQ once Shopify publishes `/pages/mattress-faq` |

## What's left before launch

Operational (you do these, not code):

1. **Wire Storefront API token + domain in `.env.local`.** Required scopes:
   `unauthenticated_read_product_listings`, `unauthenticated_read_product_inventory`,
   `unauthenticated_read_content`, `unauthenticated_write_checkouts`,
   `unauthenticated_read_checkouts`. Once set, every dynamic route SSGs.
2. **Run `node scripts/pull-inventory.mjs`** with an Admin token that has
   `read_content` + `read_themes` scopes to populate the full `redirects.json`
   (estimated 200+ more entries observed in the live site) and to enumerate
   article handles per blog (currently only blog handles are snapshotted).
3. **Visual QA in a real browser.** The whole codebase has been built without
   live Storefront data and without browser smoke testing — assume cosmetic
   tweaks are needed once you can see real product imagery in the layout.

Deferred (vendor or content decision needed):

- Live review feed on PDP + homepage Reviews section (Birdeye / Yotpo / etc.)
- Real account dashboard (currently a placeholder that deflects to phone)
- Hero CMS metaobjects for editorial control of the rotating slides
