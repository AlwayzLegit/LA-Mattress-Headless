# LA Mattress — Headless (Next.js)

Migration target for `mattressstoreslosangeles.com` — Shopify Hydrogen → Next.js (App Router) with Shopify Storefront API as the headless backend. Checkout remains Shopify-hosted on `checkout.mattressstoreslosangeles.com`.

See the operating brief in conversation history for full migration scope. This README documents what's currently in the repo.

## Status

**Phase 0 — Foundation (homepage only)**: scaffold + design-port complete.

| Phase | Status |
|---|---|
| Phase 0 — Next.js scaffold + design system | ✅ Done |
| Phase 0 — Homepage (`/`) — full design port | ✅ Done |
| Phase 1 — `/products/[handle]` PDP | ⬜ Not started |
| Phase 1 — `/collections/[handle]` PLP | ⬜ Not started |
| Phase 1 — `/pages/[handle]` | ⬜ Not started |
| Phase 2 — Cart + checkout hand-off | ⬜ Not started |
| Phase 3 — Custom pages (showrooms, quiz, financing) | ⬜ Not started |
| URL inventory pull | 🟢 Collections (61), products (195), pages (110) — complete. 🟡 Blog articles + redirects need full pull via `scripts/pull-inventory.mjs` |
| Storefront API integration | ⬜ Not started — homepage uses hardcoded sample data per design spec |
| SEO audit CSV ingestion | 🟡 Imported to `data/seo-audit/`, not yet applied |

## Local development

```bash
npm install
npm run dev          # http://localhost:3000
npm run build        # production build
npm run typecheck    # tsc --noEmit
```

Requires Node ≥ 18.18.

## Tech stack

- **Next.js 14.2** App Router with React Server Components by default
- **TypeScript** strict mode
- **Plain CSS** with custom-property design tokens — no Tailwind. The design system ships an opinionated component-class API (`.h-display`, `.eyebrow`, `.btn-primary`, `.section-dark`, `.pcard`, etc.) that's the source of truth; mixing in Tailwind would duplicate the token system
- **`next/image`** for the logo and (eventually) Shopify CDN imagery; placeholder lifestyle images are painted as `background-image` via the `.ph[data-img]` hook so they don't go through the optimizer

## Design system

Ported from a complete handoff bundle (see conversation history). Key tokens live in `app/globals.css` under `:root`:

- Brand: `--brand-navy #1B2C5E` (logo / dark sections), `--brand-red #D8232A` (logo accent only — never functional)
- Accent: `--accent #1428A0` (Samsung electric blue, locked) — all buttons, links, focus rings
- Type: `Geist` (UI/body), `Geist Mono` (numerics/eyebrows), `Source Serif 4` (editorial display), `Bebas Neue` (display only)
- Spacing: 8px base, micro 4px step
- Layout: 1440px max container, 32px gutter, 64px nav, 32px top bar

Detailed token table is at `data/design-handoff/02-design-system.md` (when ported) or in the original handoff bundle.

## Repo layout

```
app/
  globals.css              All design CSS (tokens + components + responsive)
  layout.tsx               Root layout — html, TopBar, Nav, children, Footer
  page.tsx                 Homepage composition + JSON-LD (LocalBusiness, WebSite)
  _components/
    icon.tsx               SVG icon registry (1.5px stroke, currentColor)
    images.ts              Image registry + phImg() helper for .ph backgrounds
    topbar.tsx             Top utility bar (free shipping, financing, find-a-store)
    nav.tsx                Sticky nav with mega menu (client component)
    hero.tsx               Homepage hero carousel — 3 slides, 7s autoplay, pauseable
    footer.tsx             5-column footer + signature + legal links
    sections/
      static-sections.tsx  TrustBar, ShopByCategory, BrandStrip, WhyUs, QuizTeaser, Reviews
      popular-products.tsx Horizontal product scroller (client — useRef for scroll)
      showrooms.tsx        Horizontal showroom scroller (client — useRef)
      faq.tsx              Accordion (client — useState)
public/
  assets/
    la-mattress-logo.png   Brand logo (400×224)
data/
  seo-audit/               Semrush-style site audit CSV from the live site
  url-inventory/
    collections.json       61 collections (handle + SEO + counts)
    products.json          195 active+published products
    pages.json             110 pages (26 published)
    blogs.json             7 blog handles (article enumeration deferred)
    redirects.json         placeholder — populate via scripts/pull-inventory.mjs
scripts/
  pull-inventory.mjs       Re-runnable Admin-API inventory pull
                           (needs SHOPIFY_STORE_DOMAIN + SHOPIFY_ADMIN_TOKEN env)
next.config.mjs            Allows images.unsplash.com, cdn.shopify.com, mattressstoreslosangeles.com
```

## Hard constraints (from the migration brief)

1. **URL preservation is non-negotiable.** Every existing `/products/{handle}`, `/collections/{handle}`, `/pages/{handle}`, and `/blogs/{blog}/{article}` URL on the live site must resolve at the same path on the new app. The homepage links here all point to those preserved URLs (most will 404 until later phases build the routes — this is expected and tracked).
2. **Checkout is Shopify-hosted.** Cart hand-off goes via `cart.checkoutUrl` to `checkout.mattressstoreslosangeles.com`. We do not recreate checkout.
3. **Read-only Storefront API in the app.** Admin operations stay in Shopify Admin. No Admin API tokens in this codebase.
4. **No Tailwind.** Plain CSS with the design's token + component system.

## Homepage — what's hardcoded vs real

This is Phase 0; data is hardcoded to match the design spec. Replacement plan in Phase 1:

| Section | Current source | Phase 1 swap |
|---|---|---|
| Hero carousel | Hardcoded copy + Unsplash imagery | Real CMS-driven slides (Shopify metaobjects) |
| Trust bar | Static | Static (intended to remain static) |
| Popular products | 8 products, several handles match real Shopify products | Storefront API `getProductsByHandles` for the Popular collection |
| Shop by category | 6 hardcoded category tiles → real `/collections/...` URLs | Stay hardcoded (curated set), tile counts can be dynamic |
| Showrooms | 5 hardcoded → real `/pages/koreatown-best-mattress-store` etc. | Stay hardcoded; pages are rendered separately |
| Brand strip | 9 hardcoded → real `/collections/{brand}-mattresses` URLs | Stay hardcoded |
| Why us | Static | Static |
| Quiz teaser | Links to `/sleep-quiz` (route not built yet) | Builds in Phase 3 |
| Reviews | 6 sample Google reviews | Replace with live review feed (Birdeye/Yotpo TBD) |
| FAQ | 6 hardcoded Q&As | Stay hardcoded; expanded set lives at `/pages/mattress-faq` |
