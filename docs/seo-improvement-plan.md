# Deep SEO Audit & Improvement Plan — mattressstoreslosangeles.com

## Implementation status (rolling — updated as PRs land)

| Phase | Item | Status | Commit |
|---|---|---|---|
| 1 | GA4 (env-gated, useReportWebVitals for CWV) | ✅ shipped | 277a |
| 1 | Search Console + Bing verification meta | ✅ shipped | 277a |
| 1 | `docs/seo-measurement.md` runbook | ✅ shipped | 277a |
| 2 | `Organization.sameAs` scaffold (`SOCIAL_PROFILES`) | ✅ shipped | 277b |
| 2 | Daily inventory snapshot GitHub Action | ✅ shipped | 277b |
| 2 | Image `sizes` audit (verified — all `<Image fill>` already have `sizes`) | ✅ verified | 277b |
| 2 | Hero LCP preload (already handled by next/image `priority`) | ✅ verified | 277b |
| 2 | FAQ schema on showrooms + 3 CMS pages | ✅ shipped | 277c |
| 2 | PDP H1 ≠ title fix ("in Los Angeles" infix on fallback) | ✅ shipped | 277c |
| 2 | Review schema on review-style articles | ⏸ deferred — needs merchant product+rating data | — |
| 2 | VideoObject schema | ⏸ deferred — needs YouTube oEmbed metadata | — |
| 2 | Sitemap split into per-type index | ⏸ deferred — current ~400 URLs well under 50K; splitting risks breaking GSC submission | — |
| 3 | `seo-backfill-product-seo.mjs` (dry-run + `--apply`) | ✅ shipped | 277d |
| 3 | `seo-backfill-skus.mjs` (dry-run + `--apply`) | ✅ shipped | 277d |
| 3 | `seo-tag-cleanup-report.mjs` (read-only CSV) | ✅ shipped | 277d |
| 3 | `seo-image-alt-report.mjs` (read-only CSV) | ✅ shipped | 277d |
| 3 | `docs/seo-shopify-runbook.md` operating guide | ✅ shipped | 277d |
| 3 | Run the scripts against production catalog | ⏳ pending — requires merchant + SHOPIFY_ADMIN_TOKEN |  |
| 6 | Neighborhood page template + 8-entry data structure | ✅ shipped | 277e |
| 6 | Showroom + neighborhood sitemap priority bump (0.7 → 0.85) | ✅ shipped | 277e |
| 6 | Create the 8 neighborhood Shopify Pages | ⏳ pending — see `docs/seo-followup-tasks.md` §5 |  |
| 4 | Content refresh on 9 near-miss-keyword pages | ⏳ pending — see `docs/seo-followup-tasks.md` §6 |  |
| 5 | 5 new pillar articles | ⏳ pending — see `docs/seo-followup-tasks.md` §7 |  |
| 7-9 | Cross-cut sub-nav, off-page, monitoring | ⏳ pending |  |

**Full user-action checklist:** `docs/seo-followup-tasks.md`.

## Context

LA Mattress Store is a 5-showroom Los Angeles mattress retailer running on a
Next.js 15 App Router headless storefront (Shopify Storefront API backend,
checkout still hosted on `checkout.mattressstoreslosangeles.com`). The codebase
already implements an unusually strong on-page SEO foundation — see "Baseline
Strengths" below — so this plan is targeted at the gaps the data exposes and
at growth opportunities, not at re-doing work that's already correct.

**Current Semrush snapshot (US, May 2026):**

| Metric | Value |
|---|---|
| Organic keywords | 15,528 |
| Monthly organic traffic | ~7,509 sessions |
| Organic traffic value (CPC × clicks) | ~$18,095/mo |
| Authority Score / Trust Score | 28 / 28 |
| Backlinks / Referring domains | 16,912 / 983 |
| Domain rank | #230,886 globally |
| Paid (Google Ads) | $0 / 0 keywords |

**Live deployment:** Vercel project `prj_ZsYbO47m3igJBAFSiYDyz0fjZrwW`
(`la-mattress-headless`), latest production deploy `READY` on `main`.

**Traffic concentration (top 5 pages = 55% of all organic):**

1. `/blogs/mattress-buying-guide/the-best-queen-air-mattresses-for-camping…` — 1,466 visits (19.5%) **← informational, non-commercial**
2. `/` — 1,331 visits (17.7%)
3. `/pages/koreatown-best-mattress-store` — 614 visits (8.2%) **← local commercial**
4. `/pages/mattress-store-studio-city` — 436 visits (5.8%)
5. `/blogs/mattress-buying-guide/will-king-sheets-fit-a-california-king` — 327 visits (4.4%)

**Top keyword rankings (already ranking #1 for):** `la mattress stores koreatown`, `la mattress`, `la mattress store`, `beds los angeles`, `mattress sales los angeles`, `la mattress studio city`.

**Big near-miss opportunities (positions 3-12 on high-volume terms):**

| Keyword | Vol/mo | Pos | URL |
|---|---|---|---|
| mattress stores los angeles | 1,900 | #3 | / |
| mattress delivery | 4,400 | #12 | /pages/shipping-and-delivery |
| spring air mattress | 2,900 | #4 | /collections/spring-air-mattresses |
| best mattress for fibromyalgia | 1,300 | #9 | /blogs/.../fibromyalgia |
| bed frame stores | 1,300 | #11 | /collections/bed-frames |
| sam's club queen mattress | 1,900 | #8 | /blogs/.../sams-club-queen |
| sealy vs serta | 880 | #11 | /blogs/.../sealy-vs-serta |
| eastern king vs california king | 880 | #6 | /blogs/.../eastern-king-vs-cal-king |
| how much does a mattress cost | 4,400 | #17 | /blogs/.../how-much-spend |

**Direct organic competitors (Semrush relevance ≥0.04):** `sleepline.com`, `airpedic.com`, `orthomattress.com` (local LA), `us-mattress.com`, `mattressstarla.com`, `puffy.com`, `tempurpedic.com` (brand).

## Baseline Strengths — Do Not Re-Implement

The codebase already does the following well; the plan below assumes these stay.
Source: code-exploration sub-agent report.

- **Next.js 15 App Router**, ISR 600s on PDPs/PLPs/articles, SSG for top revenue products via `generateStaticParams` (app/products/[handle]/page.tsx, app/collections/[handle]/page.tsx).
- **Dynamic per-route metadata** via `generateMetadata()`, with `firstNonEmpty()` fallback chain and `capTitle()` / `truncDescription()` (`lib/seo.ts`).
- **Comprehensive JSON-LD**: Organization + WebSite + LocalBusiness sitewide (app/layout.tsx); Product + AggregateOffer + AggregateRating + BreadcrumbList on PDPs; CollectionPage + ItemList on PLPs; BlogPosting on articles; FurnitureStore + OpeningHoursSpecification + Service[] on showroom pages; FAQPage on homepage.
- **Canonical URLs everywhere** (`alternates.canonical` declared in every `generateMetadata`).
- **Sitemap + robots.txt smart filtering** (`app/sitemap.ts`, `app/robots.ts`): non-empty collections only, deprecated `beds-mattresses` blog excluded, tracking params (`srsltid`, `_pos`, `_sid`, `_ss`) disallowed, canonical-based duplicate handling for `?variant=` and `?after=`.
- **Custom Shopify CDN image loader** (`lib/image-loader.ts`) bypassing Vercel's optimizer quota; `next/image` everywhere with `priority` on first 3 LCP cards.
- **Sentry + Vercel Analytics + Speed Insights** wired.
- **372-entry redirect map** (`data/url-inventory/redirects.json`) wired into `next.config.mjs#redirects()` — preserves legacy Hydrogen URLs.
- **Collections SEO fields: 100% backfilled** in Shopify (sample of 30 — every collection has a custom seo.title and seo.description).

## Diagnosed Gaps (the targets of this plan)

### Technical SEO

1. **No GA4 / GTM** — only Vercel Analytics; no Search Console keyword data attribution. Highest-leverage measurement gap.
2. **No Search Console / Bing Webmaster verification meta tags** in `app/layout.tsx`.
3. **No `Organization.sameAs`** social profiles in sitewide LD (`lib/structured-data.ts`).
4. **No FAQ schema on PDPs/PLPs/showrooms** — only homepage emits FAQPage. Showroom pages especially could rank for "is mattress store X open" rich results.
5. **No Review schema on review-style blog articles** (e.g., `englander-mattress-reviews-2024`, `sealy-vs-beautyrest-mattresses`).
6. **No VideoObject schema** anywhere; if Shopify product HTML embeds videos, they're invisible to video search.
7. **Inventory snapshot is manual** (`scripts/pull-inventory.mjs` requires admin token) → sitemap freshness depends on a human running it. Site adds new products/articles without sitemap updates.
8. **Image `sizes` audit not done** — some non-LCP images may lack responsive `sizes` hint.
9. **Hero LCP image not preloaded** via `<link rel="preload" as="image">` — could shave LCP.
10. **No `next-sitemap` style splitting** — single sitemap.xml currently fine (~400 URLs) but no plan for the 50K URL limit; also no separate sitemap index per content type.
11. **Legacy Semrush audit (May 2026) flagged issues that may persist on the new site** — needs a fresh crawl after the headless launch is fully indexed:
    - 129 pages with `H1 == title` (duplicate-content signal)
    - 40 titles > 60 chars
    - 365 pages low text-to-HTML ratio
    - 56 pages with only 1 internal inbound link
    - 12 pages missing meta description
    - 1 page with malformed structured data

### On-Page / Shopify-Side SEO

12. **Products: ~35% missing custom `seo.title`** (7/20 in sample) — falls back to product title; loses "in Los Angeles" / brand-suffix opportunity.
13. **Products: variants have empty SKUs** — Product JSON-LD `sku` field is omitted on most products, weakening Google Product results eligibility.
14. **Product tags bloated** — 50+ tags per product, many overlapping (`King Memory Foam Mattresses` + `Memory Foam Queen Mattresses` + `Tempur-Pedic Queen Hybrid Mattresses` all on a king-size product) — likely creates duplicate-content collection pages.
15. **Image alt text fallback to product title** — works but generic; for top-revenue products, custom alt text drives image search clicks.

### Content / Internal Linking

16. **Traffic dominated by non-commercial blog topics** (air mattresses, sheet sizing). Each top-traffic blog post needs a contextual CTA to mattresses/showrooms with strong anchor text.
17. **Big content gaps in commercial-intent comparison/buyer space**:
    - `best mattress for back pain` (5,400/mo) — no ranking page
    - `where is the best place to buy a mattress` (3,600/mo) — no ranking page
    - `when is the best time to buy a mattress` (3,600/mo) — no ranking page
    - `what is the best mattress` (4,400/mo) — no ranking page
    - `best mattress for side sleepers` (1,300/mo) — no ranking page
18. **Local presence missed in non-showroom neighborhoods** — Beverly Hills, Santa Monica, DTLA, Pasadena, Burbank, Sherman Oaks, Hollywood, Long Beach have search demand but no targeted page.
19. **Brand × Size cross-cut collections** — collections exist for `tempur-pedic-mattresses` and `queen-size-mattresses` separately but not the high-intent intersection (`tempur-pedic-queen-mattresses`) — visible in product tags, not surfaced as a route.

### Off-Page

20. **Authority Score 28** with 983 referring domains, 16,912 backlinks — adequate but capped. Mattress space is competitive (`tempurpedic.com` AS far higher). Need a structured PR/outreach loop, not opportunistic links.

---

## Phased Implementation Plan

Each phase ends with a measurable acceptance signal. Phases are ordered by
expected impact-per-engineering-hour, not strict dependency.

### Phase 1 — Measurement & Verification (ship first; everything else needs this data)

Goal: Be able to attribute SEO changes to outcomes within 2 weeks.

- **Add GA4** via a tag-only `<Script>` in `app/layout.tsx`, gated on `NEXT_PUBLIC_GA_MEASUREMENT_ID`. Use `next/script` with `strategy="afterInteractive"` to avoid hurting LCP. Wire `useReportWebVitals` so CWV land in GA4 events.
- **Add Search Console + Bing verification meta tags** to root layout metadata's `verification` block (env-driven). Submit `sitemap.xml` in GSC once verified.
- **Add Google Merchant Center feed** (later wired to Google Shopping ads if desired) — Shopify can already publish to Google Merchant; document the toggle.
- **Re-run Semrush Site Audit** (`mcp__c1fe7bd5...__siteaudit_research`) post-deploy: create project, point at production URL, snapshot. Compare to the 2026-05-04 baseline CSV in `data/seo-audit/`.

Files: `app/layout.tsx`, `.env.example`, new `app/_components/analytics-ga4.tsx`, new `docs/seo-measurement.md`.

Acceptance: GSC shows verified ownership + sitemap submitted; GA4 receives sessions; baseline CWV dashboard exists.

### Phase 2 — Technical SEO Polish

Goal: Close the schema and crawl gaps the Semrush audit flagged.

- **Extend `lib/structured-data.ts` Organization LD with `sameAs`** — populate from `lib/showrooms.ts` (existing) plus Facebook/Instagram/X/YouTube URLs (collect from marketing).
- **Add FAQ schema to showroom pages and a few high-traffic CMS pages** (`/pages/mattress-warranty`, `/pages/mattress-store-financing`, `/pages/shipping-and-delivery`) — wire to Shopify page metafields so non-engineers can add Q&As.
- **Add Review schema on review-style articles** — detect articles tagged `review`/`comparison` and emit `Review` + `itemReviewed: Product` JSON-LD alongside `BlogPosting`. Implement in `app/blogs/[blog]/[article]/page.tsx`.
- **Add VideoObject schema** — scan article/product `descriptionHtml` for `<iframe src="*youtube.com*">` or Shopify-hosted videos; emit VideoObject. Implement in `lib/structured-data.ts` helper used by PDP + article templates.
- **Preload hero LCP image** — `app/page.tsx` and `app/_components/hero.tsx`; emit `<link rel="preload" as="image" href={firstSlide.image} imagesrcset=... fetchpriority="high">`.
- **Sitemap split** — refactor `app/sitemap.ts` into a sitemap index (`sitemap.xml`) plus per-type sitemaps (`sitemap-products.xml`, `sitemap-collections.xml`, `sitemap-blog.xml`, `sitemap-pages.xml`). Future-proofs the 50K-URL limit and gives GSC per-section indexation diagnostics.
- **Automate inventory snapshot** — turn `scripts/pull-inventory.mjs` into a scheduled GitHub Action (daily 04:00 UTC), commit changes to `data/url-inventory/` via PR. Requires `SHOPIFY_ADMIN_TOKEN` repo secret.
- **Audit images for missing `sizes`** — grep all `<Image>` usages, ensure every non-`fill` image has `sizes`. Sub-task per top file: `plp-card.tsx`, `gallery.tsx`, `recently-viewed-rail.tsx`, `hero-slide-image.tsx`, `article-card.tsx`, showroom photos.
- **Fix any leftover `H1 == title` duplicates** — check `app/products/[handle]/page.tsx`, `app/collections/[handle]/page.tsx`, `app/blogs/[blog]/[article]/page.tsx`: if H1 renders the same string the title uses verbatim, soften the H1 (e.g., title="Tempur-Pedic ProAdapt Soft Mattress in Los Angeles · LA Mattress", H1="Tempur-Pedic ProAdapt Soft").

Files: `lib/structured-data.ts`, `app/layout.tsx`, `app/_components/hero.tsx`, `app/page.tsx`, `app/sitemap.ts`, new `app/sitemap-*.ts` files, `app/blogs/[blog]/[article]/page.tsx`, `app/pages/[handle]/page.tsx`, `.github/workflows/refresh-inventory.yml`, image-using components.

Acceptance: Schema.org validator passes on all page types; Semrush re-audit shows fewer "Duplicate content in h1 and title" + "Title too long" hits; LCP percentile improves in Vercel Speed Insights.

### Phase 3 — Shopify Content Data Quality (operations, not engineering)

Goal: Ensure the data flowing through the existing strong metadata pipeline is itself complete. This is mostly Shopify Admin work; the engineering portion is reporting tools.

- **Backfill product `seo.title`** on the 35% of products without one. Template: `{Product Title} | {Brand} Mattress in Los Angeles · LA Mattress` (cap 60 chars). Build a one-shot script `scripts/backfill-product-seo.mjs` using Shopify Admin GraphQL (`productUpdate`).
- **Backfill variant SKUs** — even synthetic SKUs (`{handle}-{size}`) unblock Product JSON-LD `sku` field; do this via Shopify Admin GraphQL `productVariantsBulkUpdate`. Engineering owns the script; merchant approves the SKU pattern.
- **Tag cleanup audit** — produce a report of products with >20 tags, group near-duplicate tag pairs (e.g., `King Memory Foam Mattresses` vs `King Memory Foam` vs `Memory Foam Mattresses`). Don't auto-remove — produce a CSV for merchant review.
- **Custom image alt text for top-50 products** — script that lists products without `featuredImage.altText`, pre-fills with `{Brand} {Title} mattress in Los Angeles, {Size} size`. Merchant approves before push.

Files: new `scripts/seo-backfill-product-seo.mjs`, `scripts/seo-backfill-skus.mjs`, `scripts/seo-tag-cleanup-report.mjs`, `scripts/seo-image-alt-report.mjs`, `docs/seo-shopify-runbook.md`.

Acceptance: 100% of products have `seo.title`; 100% of variants have SKUs; Product JSON-LD on PDP includes `sku` (verify with rich-results test).

### Phase 4 — On-Page Content Boosts for Near-Miss Keywords

Goal: Move the 9 near-miss keywords (page 1, positions 3-17, high volume) up by ≥3 positions each.

For each target page, the play is the same: improve title/description, expand body copy with the keyword's semantic cluster, add internal links from related pages with descriptive anchors, add FAQ block (which now emits schema thanks to Phase 2), refresh inventory snapshot.

- **`/` for "mattress stores los angeles" (1,900/mo, #3 → #1)** — homepage H1 currently brand-led; add a sub-line "Los Angeles mattress stores in Koreatown, Studio City, Glendale, West LA & more — free white-glove delivery." Refresh top blog posts to link to homepage with anchor text "mattress stores in Los Angeles".
- **`/pages/shipping-and-delivery` for "mattress delivery" (4,400/mo, #12)** — expand body, add a "free white-glove delivery in Los Angeles" FAQ block (4-6 Q&As), add internal links from every PDP that has "free delivery" copy.
- **`/collections/spring-air-mattresses` for "spring air mattress" (2,900/mo, #4)** — collection currently has good metadata; add a 200-word intro paragraph (collection `descriptionHtml` in Shopify) targeting "Spring Air mattress" + "Spring Air Back Supporter" + "where to buy Spring Air in Los Angeles". The PLP template renders Shopify HTML — no code changes needed if Shopify body is updated.
- **`/collections/bed-frames` for "bed frame stores" (1,300/mo, #11)** — same pattern: expanded intro, LA showroom mention, link from `/pages/koreatown-best-mattress-store` etc.
- **High-volume blog ranking #6-#17** — refresh the `englander-mattress-reviews-2024`, `sam's-club-queen-mattress`, `sealy-vs-serta`, `eastern-king-vs-cal-king`, `how-much-should-you-spend-on-a-mattress` articles with: updated date, new FAQ section, internal links to commercial pages (showrooms + on-sale collection).

Engineering side this is mostly thin — the data flows through `descriptionHtml`. The work is in Shopify Admin (merchant + SEO).

Acceptance: ≥6 of 9 near-miss keywords advance by ≥3 positions in 90 days.

### Phase 5 — New Pillar Content for Open Keyword Space

Goal: Capture commercial-intent queries currently un-ranked.

Create new long-form pillar articles + landing pages targeting the 5 biggest open queries. Each pillar article should be 2,000+ words, with hub-and-spoke internal linking from related smaller articles.

Targets (search volume / current rank):

1. **"Best mattress for back pain in 2026" guide** (5,400/mo, not ranking) — pillar at `/blogs/mattress-buying-guide/best-mattress-for-back-pain`. Should link to `/blogs/.../fibromyalgia`, `/blogs/.../sacroiliac-joint-pain`, `/blogs/.../scoliosis` (cluster) and out to relevant Diamond/Tempur-Pedic PDPs.
2. **"Where to buy a mattress in Los Angeles" guide** (3,600/mo) — `/blogs/.../where-to-buy-a-mattress-in-los-angeles`. Heavy local intent; links into all 5 showroom pages with descriptive anchors.
3. **"When is the best time to buy a mattress"** (3,600/mo) — `/blogs/.../when-to-buy-a-mattress` — calendar guide (Memorial Day, Labor Day, Presidents Day, Black Friday). Refreshed annually.
4. **"What is the best mattress" buyer's guide** (4,400/mo) — `/blogs/.../how-to-choose-a-mattress` (long, evergreen).
5. **"Best mattress for side sleepers" guide** (1,300/mo) — `/blogs/.../best-mattress-for-side-sleepers`.

Engineering: zero changes (articles flow through Shopify Online Store → blog → headless site automatically). The content team writes; engineering only refreshes the inventory snapshot or trusts Phase 2's GitHub Action.

Acceptance: All 5 pillars indexed and ranking in top 30 within 60 days; ≥2 in top 10 within 120 days.

### Phase 6 — Local SEO Expansion

Goal: Capture LA neighborhood-level demand beyond the 5 existing showroom pages.

The existing showroom template (`app/pages/[handle]/page.tsx` with per-showroom data from `lib/showrooms.ts`) is the asset to scale. Two routes:

- **"Mattress store in [neighborhood]" content pages** — create Shopify Pages for: `/pages/mattress-store-beverly-hills`, `/pages/mattress-store-santa-monica`, `/pages/mattress-store-downtown-la`, `/pages/mattress-store-pasadena`, `/pages/mattress-store-burbank`, `/pages/mattress-store-sherman-oaks`, `/pages/mattress-store-hollywood`, `/pages/mattress-store-long-beach`. Each page lists the 1-2 nearest physical showrooms with driving directions, a "Serving [neighborhood] from our [nearest] showroom" CTA, and unique 400-word neighborhood-specific copy. Implement with the same `FurnitureStore` JSON-LD as showrooms but `areaServed` rather than `address` (which keeps the physical-store schema clean).
- **Google Business Profile parity** — verify all 5 showrooms have GBP pages with: photos, hours, mattress brand list, reviews requested per visit. Each showroom page in the codebase should `sameAs` link to its GBP URL once known. Add a `gbpUrl` field to `lib/showrooms.ts` and emit in `FurnitureStore` LD.

Files: `lib/showrooms.ts` (add `gbpUrl`, `areaServed`), `app/pages/[handle]/page.tsx` (recognize neighborhood-page handles, swap template), `lib/structured-data.ts`.

Acceptance: 8 new neighborhood pages indexed; ≥3 ranking in top 10 for `mattress store [neighborhood]` within 90 days.

### Phase 7 — Brand × Size Cross-Cut Collections

Goal: Capture high-commercial-intent queries like "Tempur-Pedic queen mattress" (visible in product tags but no dedicated PLP).

Audit Shopify collections — many cross-cut collections (`tempur-pedic-queen-mattresses`, `tempur-pedic-king-mattresses`, `diamond-california-king-mattresses`) already exist as tag-based collections. Run `mcp__820a5230...__search_collections` to inventory, then ensure:

- Each non-empty cross-cut has unique `seo.title` and `seo.description` (the script from Phase 3 handles this).
- Each cross-cut has a 150-word intro paragraph in Shopify (template-fillable: brand + size + "in Los Angeles" + price-from).
- Sitemap (already filtering empty collections) automatically includes them.
- Internal links: from the brand index page (e.g., `/collections/tempur-pedic-mattresses`), link to each size variant; mirror on size index pages.

Engineering: small change to `app/collections/[handle]/page.tsx` to optionally render a "Shop by size" / "Shop by brand" sub-nav when the current collection has cross-cuts. Use the existing inventory snapshot to find sibling collections.

Acceptance: ≥30 cross-cut collections have 100% SEO field coverage and an intro paragraph; each indexed within 30 days.

### Phase 8 — Off-Page / Authority Building

Goal: Lift Authority Score from 28 toward 35-40 over 12 months.

- **Digital PR**: pitch LA-local press on stories like "the rise of organic mattresses in LA", "sleep tips from a 4th-generation mattress store" (Diamond Mattress angle is genuine). Target: LA Times, LAist, Hoodline, Time Out LA.
- **Vendor co-marketing**: ask Tempur-Pedic, Sealy, Diamond, Spring Air, Englander for dealer-link inclusion on their store-locator pages — many publish "find a dealer near you" SEO pages.
- **Local citation cleanup**: ensure NAP (Name, Address, Phone) consistency across Yelp, Yellow Pages, Foursquare, Apple Maps for all 5 showrooms.
- **Earned content**: HARO / Qwoted responses from a sleep-expert byline (the founder or a credentialed staff member) about sleep + mattress topics — slow trickle of high-quality links.
- **Resource / link-bait**: turn the existing sleep-quiz (`/sleep-quiz`) into a shareable widget that other sleep blogs can embed with attribution back-link. Engineering: ~1 sprint to build the embed.

Acceptance: ≥50 new referring domains in 6 months (currently 983), AS ≥32 within 12 months.

### Phase 9 — Monitoring, Maintenance, Iteration

Ship once, then maintain:

- **Monthly Semrush re-audit**: scheduled via `mcp__c1fe7bd5...__siteaudit_research` snapshot; diff against prior month, file issues for new regressions.
- **Quarterly content refresh**: the top-traffic blog posts (sheet sizes, queen vs full, etc.) should get a "Last reviewed: {date}" header in the article template (already exists), refreshed on a 6-month cadence.
- **Weekly GSC review**: clicks/impressions/CTR per page, fix titles for low-CTR-high-impression pages.
- **CWV alerting**: Vercel Speed Insights → Slack webhook when p75 LCP > 2.5s or INP > 200ms.
- **Sitemap freshness audit**: scheduled check that newest Shopify product appears in `sitemap-products.xml` within 24h (relies on Phase 2 GitHub Action).

---

## Critical Files & Locations

Code files that will be touched by this plan (group ordered by phase):

**Phase 1** — `app/layout.tsx`, `.env.example`, new `app/_components/analytics-ga4.tsx`, new `docs/seo-measurement.md`.

**Phase 2** — `lib/structured-data.ts` (Organization.sameAs + Review + VideoObject helpers), `app/blogs/[blog]/[article]/page.tsx` (Review schema + VideoObject detection), `app/pages/[handle]/page.tsx` (FAQPage on showroom + CMS), `app/products/[handle]/page.tsx` (VideoObject from description HTML), `app/_components/hero.tsx` (LCP preload), `app/page.tsx` (LCP preload), `app/sitemap.ts` (split into index), new `app/sitemap-products.ts` / `sitemap-collections.ts` / `sitemap-blog.ts` / `sitemap-pages.ts`, `.github/workflows/refresh-inventory.yml`, multiple image-using components for `sizes` audit.

**Phase 3** — new `scripts/seo-backfill-product-seo.mjs`, `scripts/seo-backfill-skus.mjs`, `scripts/seo-tag-cleanup-report.mjs`, `scripts/seo-image-alt-report.mjs`, `docs/seo-shopify-runbook.md`. Existing `scripts/pull-inventory.mjs` is the template.

**Phase 4** — no code; Shopify Admin only (PLP collection descriptions, blog article body refreshes).

**Phase 5** — no code; Shopify Admin only (new blog articles).

**Phase 6** — `lib/showrooms.ts` (add `areaServed`, `gbpUrl`), `app/pages/[handle]/page.tsx` (neighborhood template branch), `lib/structured-data.ts` (FurnitureStore w/ areaServed variant). New Shopify Pages.

**Phase 7** — `app/collections/[handle]/page.tsx` (sibling-collection sub-nav), driven by `data/url-inventory/collections.json`. Mostly Shopify Admin.

**Phase 8** — `app/sleep-quiz/` (embeddable widget) is the only code work; rest is operational.

**Phase 9** — `.github/workflows/seo-monthly-audit.yml` (Semrush snapshot diff), `docs/seo-runbook.md`.

## Reused Utilities & Patterns (do not re-implement)

- Title/description truncation: `lib/seo.ts` — `capTitle()`, `truncDescription()`, `firstNonEmpty()`. Reuse for every new metadata block.
- Sitewide LD constants: `lib/structured-data.ts` — `ORGANIZATION_LD`, `LOCAL_BUSINESS_LD`, `WEBSITE_LD`. Extend in place; don't fork.
- Showroom data: `lib/showrooms.ts` — 5 showrooms with address + geo + hours. Extend; don't duplicate.
- Inventory snapshot: `data/url-inventory/*.json` — already loaded by sitemap + redirects. Use it for sitemap-split + collection sub-nav.
- Shopify GraphQL: `lib/shopify/queries/*` + `SEO_FRAGMENT`. Already pulls seo fields — use these for any new templates.
- Custom image loader: `lib/image-loader.ts`. Don't introduce raw `<img>` or revert to Vercel's optimizer.

## Verification — How to Confirm the Plan Worked

After each phase ships, verify with the relevant subset; full-plan verification at the end:

1. **Schema.org rich-results test** ([https://search.google.com/test/rich-results](https://search.google.com/test/rich-results)) — run on: homepage, top 3 PDPs, top 3 PLPs, top 3 articles, all 5 showroom pages, all 8 neighborhood pages. All schemas valid, no errors. (Phases 2, 6.)

2. **Semrush re-audit** — `siteaudit_research → snapshots → snapshot → meta_issues`. Compare issue counts to the May 2026 baseline in `data/seo-audit/`. Target: ≥80% reduction in flagged issue types after Phase 2; specifically `H1 == title`, `title too long`, `missing meta description`, `low text/HTML ratio` should approach zero.

3. **GSC + GA4 sanity** — within 14 days of Phase 1, GSC shows sitemap submitted + indexed page count matching `app/sitemap.ts` URL count; GA4 receives sessions with `engagement_time_msec > 0`.

4. **Keyword rank lift** — `mcp__c1fe7bd5...__execute_report` for `domain_organic` with `display_filter +|Po|Gt|3|+|Po|Lt|21` at T+90 days. Target: ≥6 of 9 near-miss keywords moved up by ≥3 positions (Phase 4 outcome).

5. **New keyword acquisition** — `domain_organic` with `display_positions=new` at T+90 days. Target: ≥50 new ranking keywords on the 5 new pillar pages (Phase 5).

6. **Core Web Vitals** — Vercel Speed Insights p75: LCP ≤ 2.0s (currently unknown, set baseline first), CLS ≤ 0.05, INP ≤ 150ms across PDP, PLP, homepage, article (Phase 2 LCP work).

7. **Authority Score** — Semrush `backlinks_overview` at T+180 days. Target: AS ≥ 32 (up from 28); referring domains ≥ 1,050 (up from 983) (Phase 8).

8. **Local pack visibility** — manual check via incognito Google for `mattress store [neighborhood]` for each neighborhood. Target: ≥3 of 8 new neighborhood pages on page 1 within 90 days (Phase 6).

9. **End-to-end** — at T+180 days, monthly organic traffic ≥ 12,000 sessions (up from 7,509), with ≥30% of growth from commercial-intent / local pages, not just the air-mattress blog. Verify via GA4 landing-page report cross-referenced with Semrush `domain_organic_unique`.

---

## Suggested Scope for First Sprint (if approved)

If approving the full plan is too much at once: ship **Phase 1 + Phase 2's
quick wins** in the first 2 weeks (GA4 + GSC + sameAs + LCP preload + image
sizes audit + automated inventory snapshot). That re-baselines measurement,
captures most of the technical wins for ~20% of total effort, and unblocks
all later phases.

---

# 2026-05-19 Refresh — Live Semrush Re-Pull + Recovery Re-Prioritization

> This section supersedes the phase **ordering** above (the phase
> *content* still stands). It is based on a fresh Semrush pull on
> 2026-05-19 (US database) covering domain overview, 14-month history,
> organic keywords, won/lost keywords, top pages, competitors and
> backlinks. The new data exposes a problem the original plan did not
> see: **a large organic-traffic decline from the 2025 peak**, driven
> by keyword cannibalization across the 1,133-article blog. Recovery
> now outranks growth in priority order.

## Fresh snapshot vs. the original baseline

| Metric | Plan baseline | 2026-05-19 | Note |
|---|---|---|---|
| Organic keywords | 15,528 | **16,257** | down from ~23,000 in early 2025 |
| Monthly organic traffic | ~7,509 | **~9,478** | down from ~17,964 (Sep 2025 peak) |
| Organic traffic value | ~$18,095 | **~$21,144/mo** | |
| Authority / Trust Score | 28 / 28 | **27 / 27** | flat-to-down |
| Backlinks / ref domains | 16,912 / 983 | **17,281 / 987** | follows 10,304 / nofollows 7,006 |
| Domain rank (global) | #230,886 | **#187,912** | improved |
| Paid (Google Ads) | $0 | **$0** | unchanged |

The original "baseline" was captured near a trough. The real story is
the **14-month trajectory**, not the month-over-month delta.

## The headline: a ~45% peak-to-trough organic decline

Monthly organic sessions, Semrush `domain_rank_history` (US):

| Month | Traffic | Keywords |
|---|---|---|
| 2025-03 | 41,198* | 22,815 |
| 2025-09 | **17,964** (peak) | 19,928 |
| 2025-11 | 13,123 | 20,348 |
| 2025-12 | 8,953 | 18,932 |
| 2026-02 | 8,936 | 17,984 |
| 2026-04 | **6,393** (trough) | 15,574 |
| 2026-05 | 9,478 (rebound) | 16,257 |

\* The Mar-2025 41K spike is a one-off SERP-feature/seasonal anomaly —
ignore it for trend purposes.

**Read:** the site lost roughly **half its organic traffic** between
Sep-2025 and Apr-2026 and ~7,000 ranking keywords, then began
recovering in May-2026 (+48% MoM, likely the Phase 277/29x SEO work +
sitemap/redirect cleanup landing in the index). The job now is to
**accelerate and defend the rebound**, not start from a clean baseline.

## Root-cause diagnosis (evidence-backed)

1. **Blog content cannibalization (primary cause).** The site has
   **1,133 blog articles**. The Semrush *lost-keywords* report shows
   the same query served by 2–3 competing in-house URLs, e.g.
   *"full mattress size"* (6,600/mo) split across
   `/blogs/.../how-much-space-does-a-full-size-mattress-really-give-you`,
   `/pages/mattress-sizes`, and `/blogs/.../full-vs-queen-mattress` —
   **all now out of the top 100**. The full-size-dimensions intent
   alone is targeted by ~10 near-duplicate articles
   (`full-size-bed-dimensions-two-people`,
   `full-size-bed-dimensions-width-couples`,
   `full-size-mattress-dimensions-how-wide-and-long-are-they`,
   `full-size-mattress-measurements-room-layout-tips`,
   `how-much-space-does-a-full-size-mattress-really-give-you`,
   `how-many-cubic-feet-is-a-full-sized-mattress`, plus
   `full-vs-queen-mattress`, `what-is-the-standard-size-of-a-full-bed`,
   `queen-mattress-vs-full-xl-mattress`). This is the classic Google
   Helpful-Content / dilution failure pattern.

2. **High-volume informational pages decayed out of the index.**
   Not slow growth — outright loss: *"how much does a mattress cost"*
   (4,400/mo) went **#17 → lost** (it was a flagged near-miss in the
   original plan and got *worse*); *"gel memory foam mattress"*
   (4,400) #24 → lost; *"tempur-pedic mattress"* (3,600) → lost;
   *"king size mattress for couples"* (6,600) → lost;
   *"diamond mattress"* (1,900) #30 → lost.

3. **Headless-migration host/redirect churn.** Semrush still indexes
   `www.` and apex variants of the *same* article separately
   (e.g. `will-king-sheets-fit-a-california-king-mattress` ranks under
   both hosts). Code already forces the `www` canonical
   (`lib/site-config.ts#canonicalizeSiteUrl`) and sitemap/robots are
   clean; the **apex→www 307→308 fix is still open** (followup §9b —
   2-min Vercel dashboard toggle, no code). Until it lands, link
   equity is split across hosts.

4. **Commercial collections under-rank for their own head terms.**
   `/collections/king-size-mattresses` sits **#25–31** for *"king
   size mattress"* (110,000/mo) and *"king mattress"* (60,500/mo) —
   page-3 for six-figure-volume commercial intent, while thin blog
   posts absorb the long-tail. Collection bodies are SEO-titled but
   thin on indexable on-page copy. Confirmed non-issue:
   `/collections/king`, `/collections/king-mattresses` etc. already
   308-redirect to `king-size-mattresses` in `redirects.json` — the
   stale `/collections/king` Semrush row is just Google catching up.

## Re-prioritized action plan

Priority is now **impact-on-recovery per engineering hour**. Maps onto
the existing phases where applicable.

### P0 — Stop the bleeding (code-actionable, this sprint)

| # | Action | Where | Owner | Reversible? |
|---|---|---|---|---|
| P0-1 | **Prune the cannibalizing blog clusters.** Pick ONE canonical winner per intent cluster (full-size dimensions, full-vs-queen, queen-vs-full-xl, sam's-club-queen, king-sheets-cal-king). `noindex, follow` every duplicate loser via the existing `lib/noindex-articles.ts` set (it already does exactly this for doorway posts; `follow:true` keeps link equity). Drives index focus back to the winner. | `lib/noindex-articles.ts`, `app/sitemap.ts` (already reads the set) | Eng (list needs merchant 👍 — losing a traffic page costs money) | Yes — delete the key to re-include |
| P0-2 | **Consolidate, don't just hide.** For each pruned loser, 301 the dead duplicates to the canonical winner via `data/url-inventory/redirects.json` (already wired into `next.config.mjs` + `lib/sanitize.ts` render-time resolution). Hide thin variants that still have a few links; redirect zero-value exact dupes. | `redirects.json` | Eng + merchant | Yes |
| P0-3 | **Land the apex→www 308.** Flip the Vercel domain redirect 307→308 (followup-tasks §9b). Kills the host-split flagged in cause #3. | Vercel dashboard | Merchant (2 min) | Yes |
| P0-4 | **Re-pull the inventory snapshot + re-submit sitemap** in GSC/Bing after P0-1/2 so the index re-crawls the slimmed URL set. | GitHub Action + GSC | Merchant | n/a |

### P1 — Recover commercial head terms (mixed)

- **King / Twin / On-Sale collection bodies.** Add 150–250 words of
  unique, keyword-targeted intro copy to the underperforming
  collections (`king-size-mattresses` → "king size mattress" 110K /
  "king mattress" 60K; `/collections/twin` → "twin mattress nearby"
  5,400 @ #15; `/collections/on-sale` → "mattress sale" 22,200 @ #30).
  **Zero code** — the PLP template already renders Shopify
  `descriptionHtml`; this is Shopify Admin collection-description work.
  Internal-link from the highest-traffic blog posts with exact-match
  anchors.
- **Recover the decayed informational winners** (cause #2): for the
  surviving canonical article in each cluster, refresh date + expand
  to genuinely best-in-class depth, then internal-link from the
  cluster's noindexed losers (which still `follow`). Targets:
  `how-much-should-you-spend-on-a-mattress` (4,400/mo, was #17),
  `full-vs-queen-mattress` (multi-keyword hub), the king-size
  collection for the gel/tempur/diamond brand terms.

### P2 — Capture (near-miss + new content)

Largely the original plan's Phases 4–7, still valid, but **gated
behind P0** — adding more content before fixing cannibalization makes
the dilution worse. Current near-miss board (post-decline):

| Keyword | Vol/mo | Pos | URL |
|---|---|---|---|
| king size mattress | 110,000 | #25 | /collections/king-size-mattresses |
| king mattress | 60,500 | #31 | /collections/king-size-mattresses |
| mattress sale | 22,200 | #30 | /collections/on-sale |
| medium firm mattress | 12,100 | #25 | /blogs/.../what-does-medium-firm-mattress-mean |
| twin mattress nearby | 5,400 | #15 | /collections/twin |
| where is the best place to buy a mattress | 3,600 | #9 | /blogs/.../best-places-buy-mattress-los-angeles |
| spring air mattress | 2,900 | #4 | /collections/spring-air-mattresses |
| mattress stores los angeles | 1,900 | #3 | / |
| sam's club mattress queen | 1,900 | #5 | /blogs/.../ultimate-sam-s-club-queen-mattress-review |
| bed frame stores | 1,300 | #11 | /collections/bed-frames |
| best mattress for fibromyalgia | 1,300 | #9 | /blogs/.../fibromyalgia |
| eastern king vs california king | 880 | #6 | /blogs/.../eastern-king-and-california-king |

The 5 new pillar articles (original Phase 5) are **deferred until P0
ships** — net-new informational content right now feeds the
cannibalization problem. Exception: net-new *commercial / local*
pages (neighborhood pages, brand×size cross-cuts) are safe to proceed
in parallel — they don't compete with the blog.

### P3 — Authority / off-page (unchanged)

Original Phase 8 stands. AS is flat at 27 (was 28); follows
10,304 / nofollows 7,006 — the nofollow ratio (≈40%) is high, so
prioritize editorial/dofollow link earning (digital PR, vendor
dealer-locator links) over directory volume. Local rivals
`airpedic.com` (~32K organic) and `orthomattress.com` (~23K)
out-traffic us despite our larger keyword footprint — confirming the
problem is **on-page quality/dilution, not link scarcity**.

## Updated verification baseline (T0 = 2026-05-19)

- Organic traffic **9,478/mo** → target **18,000/mo within 180 days**
  (i.e. reclaim the 2025 peak, with mix shifted toward commercial).
- Lost-keyword count: re-run `domain_organic display_positions=lost`
  monthly; P0 success = the 6,600/4,400-vol "lost" cluster terms
  re-enter the top 50 on the *single* canonical URL (no more split).
- `king size mattress` / `king mattress`: #25/#31 → **top 10** within
  120 days (P1 collection-body work).
- Indexed URL count in GSC should **drop** after P0-1/2 (fewer, better
  pages) while impressions hold or rise — the signal that pruning
  worked, not regressed.
- Re-pull cadence: monthly `domain_rank_history` + `domain_organic`
  (won/lost) diff; quarterly full re-pull of this section.

## What I can execute now vs. what needs you

**Code-actionable on this branch (no external access needed):**
P0-1 (noindex list expansion) and P0-2 (redirect consolidation) — both
extend existing, reversible mechanisms. The *engineering* is trivial;
the *risk* is choosing the wrong canonical winner per cluster
(noindexing a page that still earns money). I have the per-cluster
traffic/position data to propose the exact list — but it should get a
merchant 👍 before it ships, because it's a hard-to-reverse signal to
Google.

**Needs merchant action (no code):** P0-3 (Vercel 307→308 toggle),
P0-4 (GSC sitemap re-submit), all P1 collection-body copy, P2 content,
P3 outreach. These are tracked in `docs/seo-followup-tasks.md`.
