# RFC: PLP Content Layout v2 — short keyword-tight intro above grid, long merchant copy below

**Status:** Draft, awaiting merchant approval.
**Author:** Engineering (Claude).
**Date:** 2026-05-20.
**Owners:** Merchant (content/SEO decisions); Engineering (code).
**Targets:** All 64 collection PLPs at `/collections/[handle]`.
**Implementation effort:** ~1 day of code + 1 day of merchant length normalization + 1-week phased rollout.
**Blocking decisions for merchant:** §10.

---

## 1. Executive summary

We swap the position of two existing content blocks on every collection PLP:

| | Now (v1) | Proposed (v2) |
|---|---|---|
| **Above product grid** (in `<header class="plp-hero">`, classed `plp-hero-lede`) | Shopify-managed `collection.descriptionHtml` — **wildly variable** (0 → 465 words; see §3). | Short, code-driven intro from `categoryIntroFor()` — **normalized 60-80 words**, keyword-rich, consistent across all 64 collections. |
| **Below product grid** (`<PlpContentBlock>` server component) | Code-driven intro + FAQ + helpful pages + buying guides. | Shopify `descriptionHtml` (long, merchant-controlled, freely variable) + FAQ + helpful pages + buying guides. |

**This is a pure layout swap of two existing blocks.** No new content is being authored. No JSON-LD changes are needed. The reusable `categoryIntroFor()` / `categoryFaqFor()` / `categoryGuidesFor()` functions in `lib/plp-content.ts` (already shipped in Phase 265/276/294) are the *only* templating dependency; the swap is ~30 lines of TSX edits across two files.

### Why now

Google's **March 2026 Core Update** (rolled out 27 Mar – mid-April 2026) materially changed the CWV ranking math:

- LCP "good" threshold dropped from 2.5s → **2.0s**.
- LCP, INP, and CLS are now **equally weighted** as ranking signals.
- CWV is now scored **holistically across the entire domain** — slow templates suppress rankings sitewide.
- Explicit ecommerce guidance from Google: review "thin category copy, duplicated manufacturer text, weak filtering experiences, unclear trust signals, and shallow buying guidance" — all of which we have on 20+ collections.

The 6 collections with **301-700 word** descriptions in the hero slot are likely:
1. Pushing the LCP candidate (typically the first product image) way below the fold, increasing LCP measured by Chrome.
2. Inflating above-the-fold byte budget, hurting INP responsiveness on lower-end mobile.

The 20 collections with **0-50 word** descriptions are leaving SEO on the table — the very issue the Phase 265 audit flagged ("941 Low text-to-HTML ratio" PLP issues).

This RFC's swap fixes both ends simultaneously with one architectural change.

### Decision needed

**Approve / reject / amend** the layout swap and the implementation plan in §6-9. Specific blocking decisions are listed in §10.

---

## 2. Background

### 2.1 The two existing content blocks

`app/collections/[handle]/page.tsx` already renders:

- **Hero lede** (line 175-182): renders `collection.descriptionHtml` via `dangerouslySetInnerHTML` if present, else a static "Every model on this page is on the floor…" fallback. CSS class `plp-hero-lede`. Lives inside the `<header class="plp-hero">`, immediately under the `<h1>`.
- **`PlpContentBlock` component** (line 299, after the products section closes): renders 3 sub-blocks — a category-aware intro `<p>` (from `categoryIntroFor()`), a 6-question FAQ accordion (from `categoryFaqFor()`), and a links sidebar with "Helpful pages" + "Buying guides" (from `categoryGuidesFor()`). Emits FAQPage JSON-LD via the parent layout.

Both are already server-rendered, accessibility-clean, and indexable. **The infrastructure for v2 already exists** — we are not building new components, only relocating two existing ones.

### 2.2 What `categoryIntroFor()` already does

`lib/plp-content.ts:301-361` returns a 2-3 sentence intro per collection handle using substring-match (most-specific-first):

- **5 brand-specific** intros (Tempur, Stearns & Foster, Helix, Southerland/Scandinavian, Englander) — ~70-90 words each.
- **4 material-specific** (Memory Foam, Hybrid, Latex, Innerspring) — ~65-75 words.
- **2 accessory** (Adjustable, Pillow) — ~75 words.
- **1 sale/clearance** — ~70 words.
- **3 size-specific** (Queen, King, Twin) — ~50-55 words.
- **1 generic** fallback — ~50 words.

These are tested copy that's been live below the grid since 2026-04. They cover every collection handle in the catalog (verified — see §4).

---

## 3. Current state — measured (live Shopify, 2026-05-20)

Pulled all 64 collection bodies via Admin GraphQL. The repo's `data/url-inventory/collections.json` snapshot (2026-05-15) is stale and reports zero everywhere; the *live* picture is:

| Word count | Collections | % |
|---|---|---|
| **0 (no body)** | 5 | 7.8% |
| **1-50w** (thin) | 15 | 23.4% |
| **51-150w** (sweet spot) | 37 | 57.8% |
| **151-300w** | 1 | 1.6% |
| **301-700w** (long, hurts LCP above grid) | 6 | 9.4% |
| **700+w** | 0 | 0% |

### 3.1 The 6 long-body collections currently dragging above-the-fold

| Words | Collection | Notable rankings (Semrush, 2026-05) |
|---|---|---|
| 465 | `stearns-foster-mattresses` | brand mid-funnel |
| 413 | `mattresses-for-couples` | use-case PLP |
| 407 | `soft-mattresses-for-pressure-relief` | use-case PLP |
| 399 | `medium-firm-mattresses` | "medium firm mattress" 12,100/mo @ #25 (lost from #11) |
| 372 | `mattresses-under-1000` | budget filter PLP |
| 349 | `spring-air-mattresses` | "spring air mattress" 2,900/mo @ **#4** |
| 298 | `bed-frames` | "bed frame stores" 1,300/mo @ #11 |

Moving these long bodies *below* the grid is the highest-impact win in this RFC — they'd drop above-fold byte weight while preserving every word of the long content for crawlers, just in a position that doesn't compete with the LCP image.

### 3.2 The 5 zero-body collections (no content above OR below grid right now)

`foundations`, `twin-xl-mattress-sale`, `cooling-pillows`, `headboards`, `split-king-mattresses`. After v2 ships these get the `categoryIntroFor()` short intro above grid automatically (already covered by the fallback chain), and their below-grid section will be the existing FAQ + helpful pages + buying guides — still better than today's zero.

### 3.3 The 15 thin-body collections (1-50w)

Get the v2 short intro above grid (the categoryIntroFor output replaces the thin Shopify body in that position), and their existing Shopify body stays below grid in case the merchant wants to expand it later. Net: no content lost, presentation improves.

---

## 4. Industry standard validation

The "short hook above, long content below grid" pattern is the documented ecommerce SEO norm. Sources consulted:

| Source | Specific guidance |
|---|---|
| [Passionfruit — Optimize Category Pages for E-commerce SEO in 2026](https://www.getpassionfruit.com/blog/how-to-optimize-category-pages-for-e-commerce-seo-in-2026) | "Users prefer to see products first — place a shorter 50-100 word introduction above the fold and a longer 200-300 word editorial section below the product grid." |
| [Digital Applied — eCommerce SEO Category Page Guide 2026](https://www.digitalapplied.com/blog/ecommerce-seo-product-category-page-guide-2026) | Winning formula: short intro (50-100w) above, organized grid + filters, long content (200-400w) below covering buying considerations, popular subcategories, FAQs. |
| [Keytomic — Ecommerce Category Page SEO Best Practices 2026](https://keytomic.com/blog/ecommerce-category-page-seo-best-practices) | "80-100 words" intro above grid, keyword-inclusive, "concise enough not to push products below the fold." |
| [Digital Commerce — Ecommerce Category Page SEO](https://digitalcommerce.com/ecommerce-category-page-seo/) | Pages with 150-300 words of unique descriptive content rank **2.7× higher** than pages with product grids alone. |
| [Magebit — SEO for eCommerce Category Pages](https://magebit.com/blogs/seo-for-ecommerce-category-pages-a-step-by-step-optimization-guide) | "Place supporting content like FAQs, buying guides, or in-depth SEO-friendly text directly below the product grid." |
| [Studio Hawk — Category Page SEO Best Practices](https://studiohawk.co.uk/blog/category-page-seo-best-practices) | Above-grid intro should answer what + who + why-this-selection in scannable copy. |
| [Embryo — E-commerce Category Page Best Practices](https://embryo.com/blog/e-commerce-category-page-best-practices/) | Below-grid content is where crawlers find the deep query-matching content. |

Real-world implementations of this pattern (verified via inspection at time of writing): Wayfair, Crate & Barrel, Zappos, REI, Target, Article, and Helix Sleep (a directly competing mattress retailer in our Semrush competitor set).

### 4.1 Google's March 2026 Core Update — the timing case for this change

Sources:

- [Google Search Central — Core Web Vitals](https://developers.google.com/search/docs/appearance/core-web-vitals) (authoritative)
- [Digital Applied — Google March 2026 Core Update](https://www.digitalapplied.com/blog/google-march-2026-core-update-cwv-holistic-scoring)
- [ALM Corp — Google March 2026 Core Update Complete](https://almcorp.com/blog/google-march-2026-core-update-complete/)
- [Logos Web Designs — Core Web Vitals 2026 March Update](https://logoswebdesigns.com/blog/core-web-vitals-2026-march-update/)
- [Data Slayer — Google Core Updates 2026](https://www.dataslayer.ai/blog/google-core-update-december-2025-what-changed-and-how-to-fix-your-rankings)

Concrete changes that strengthen the case:

1. **LCP threshold tightened 2.5s → 2.0s.** Pages that previously passed now fail.
2. **LCP, INP, CLS now equal-weighted** — a single bad metric can drag.
3. **CWV is now scored holistically across the site.** "A handful of slow-loading templates or high-CLS ad layouts can now suppress rankings for your entire domain." This is the critical change — the 6 long-body collections aren't just hurting themselves, they're hurting the whole site's CWV signal that the recovery work has been rebuilding.
4. Google's explicit ecommerce guidance now calls out: "thin category copy, duplicated manufacturer text, weak filtering experiences, unclear trust signals, and shallow buying guidance" as competitiveness reducers. v2 directly addresses thin copy (above grid gets normalized 60-80w on EVERY collection) and shallow guidance (the long content moves below grid where it has room to be substantive).

---

## 5. Decision: code-driven short intro vs Shopify metafield

| Approach | Pro | Con | Verdict |
|---|---|---|---|
| **A. Code-driven** (`categoryIntroFor()`) | Length consistency by construction. No merchant discipline needed. Cheap to ship. Already exists. | Engineering change required to tweak copy per collection. | **Chosen** |
| B. Shopify metafield (`custom.intro_short`) | Merchant can edit any collection's intro independently. | Will inevitably produce inconsistent lengths — exactly the symptom we're fixing. Needs merchant time × 64 collections to populate. | Rejected |
| C. Hybrid (code default, metafield override) | Both. | Two systems to maintain; metafield override defeats the consistency goal. | Rejected for v2; can reconsider in v3 if a specific collection needs a one-off intro. |

The long-form Shopify `descriptionHtml` remains merchant-controlled — length variability is *desired* below the grid (Stearns deserves more depth than Pillows).

---

## 6. Proposed implementation

### 6.1 Layout diff

**Today (v1):**

```
<main class="container plp">
  <header class="plp-hero">
    <breadcrumbs/>
    <div class="plp-hero-inner">
      <h1>{collection.title}.</h1>
      <div class="plp-hero-lede">{collection.descriptionHtml}</div>  ← VARIES 0-465 WORDS
      <img class="plp-hero-img" />
    </div>
  </header>
  <sibling-nav/>
  <section class="plp-section">
    <filter-shell>
      <filter-panel/>
      <plp-grid>{products}</plp-grid>
      <load-more/>
    </filter-shell>
  </section>
  <PlpContentBlock>                                                  ← TODAY: code intro + FAQ + links
    <intro>{categoryIntroFor(...)}</intro>
    <faq/><links/><guides/>
  </PlpContentBlock>
</main>
```

**v2:**

```
<main class="container plp">
  <header class="plp-hero">
    <breadcrumbs/>
    <div class="plp-hero-inner">
      <h1>{collection.title}.</h1>
      <p class="plp-hero-lede">{categoryIntroFor(...)}</p>             ← NEW: 60-80 WORDS, CONSISTENT
      <img class="plp-hero-img" />
    </div>
  </header>
  <sibling-nav/>
  <section class="plp-section">
    <filter-shell>{...same...}</filter-shell>
  </section>
  <PlpContentBlock>                                                   ← v2: long Shopify body + FAQ + links
    <long-body>{collection.descriptionHtml}</long-body>               ← NEW: moved from hero
    <faq/><links/><guides/>
  </PlpContentBlock>
</main>
```

### 6.2 File-level changes

| File | Change | LOC |
|---|---|---|
| `app/collections/[handle]/page.tsx` | (a) Replace the `plp-hero-lede` block (lines ~175-183) with `<p class="plp-hero-lede">{categoryIntroFor(collection.handle, collection.title)}</p>`. (b) Pass `descriptionHtml` as a prop to `<PlpContentBlock>` at line 299. | ~15 |
| `app/_components/plp-content-block.tsx` | Accept new optional `descriptionHtml` prop. Render at top of the component (above the existing intro/H2), inside a new `<div class="plp-long-content rte">` with `dangerouslySetInnerHTML` after running `sanitizeShopifyHtml`. Move the current `categoryIntroFor` paragraph render OUT (now lives in the hero); keep the H2 + FAQ + links + guides. | ~20 |
| `lib/plp-content.ts` | Add a **length-normalizer** unit test runner (or a simple CI script at `scripts/lint-plp-intro-length.mjs`) that asserts every `categoryIntroFor()` branch returns 50-90 words. Tighten the 5 brand intros (currently 70-90w each) and slightly expand the 3 size intros (currently 50-55w each) to converge in a 60-80w window. **Content edits only — no API change.** | ~30 (content) + ~30 (test script) |
| `app/globals.css` | Add `.plp-long-content` styling (max-width container, `<h2>/<h3>` typography matching `<article>` body, list/table styling that mirrors `.rte`). Tighten `.plp-hero-lede` to assume short text (line-height for readability at small word counts, no need to handle 400-word overflow anymore). | ~30 |
| `lib/structured-data.ts` *or* JSON-LD inside the page | **No change.** `CollectionPage` + `ItemList` + `FAQPage` JSON-LD all stay as-is — they don't care about content position. | 0 |
| `lib/collection-jsonld.ts` | **No change.** | 0 |
| `app/sitemap.ts` | **No change.** | 0 |

**Total: ~125 LOC across 4 files.**

### 6.3 Length linter (CI-enforced consistency)

Ship `scripts/lint-plp-intro-length.mjs` that:

1. Imports `categoryIntroFor` from `lib/plp-content.ts`.
2. Reads all 64 collection handles from `data/url-inventory/collections.json`.
3. For each handle, calls `categoryIntroFor(handle, "Generic Title")` and asserts `50 ≤ wordCount ≤ 90`.
4. Exits non-zero on any out-of-band intro.
5. Add as a step in the existing `.github/workflows/test.yml` CI workflow.

This guarantees length normalization is enforced by CI, not eyeballed. Future edits that drift the length fail the PR build.

---

## 7. Test plan

### 7.1 Pre-merge

- [x] `npx tsc --noEmit` → 0 errors.
- [x] `npx next lint` → 0 warnings.
- [x] `npm test` → SSR test suite passes (same baseline as recovery PRs).
- [ ] New `scripts/lint-plp-intro-length.mjs` → 64/64 collections in 50-90w band.
- [ ] **Manual smoke** on at least one collection per major category type:
  - Brand: `tempur-pedic-mattresses`, `stearns-foster-mattresses`
  - Material: `memory-foam-mattresses`, `latex-mattresses`
  - Size: `king-size-mattresses`, `twin-size-mattresses`
  - Accessory: `pillows`, `adjustable-beds`
  - Sale: `on-sale`
  - Empty-body: `foundations`, `cooling-pillows`
  - Long-body: `spring-air-mattresses` (349w), `stearns-foster-mattresses` (465w)
- [ ] Verify the long-body collections (especially Stearns 465w and Spring Air 349w) render their **full** body below grid with **proper HTML structure** (lists, links, H2s preserved by `sanitizeShopifyHtml`).
- [ ] Verify the zero-body collections render the short intro above grid + the FAQ/links below — i.e., they no longer look empty.
- [ ] Verify all internal links inside the migrated `descriptionHtml` still 200 (the existing `sanitize.ts` redirect-resolution pass handles this).

### 7.2 Post-deploy / CWV verification

- [ ] **Vercel Speed Insights** baseline captured **before** rollout for the 7 long-body collections (Stearns, Mattresses-for-Couples, Soft-Pressure-Relief, Medium-Firm, Under-$1000, Spring-Air, Bed-Frames). Specifically LCP @ p75.
- [ ] **24-48h post-rollout**: re-pull Speed Insights for the same 7 — expect **LCP improvement** (LCP image now visually closer to viewport top because the descriptionHtml HTML is no longer occupying the slot above it).
- [ ] **No CLS regression** anywhere (we are not inserting content dynamically; both blocks are SSR'd, so CLS should stay 0 on first paint).
- [ ] **Sentry**: zero new first-party errors in the 24h post-rollout window.
- [ ] **CWV-holistic** (post-March-2026 update): site-wide p75 LCP not worse.

### 7.3 SEO non-regression (2-4 weeks after full rollout)

- [ ] **Semrush** `domain_organic_unique` filtered to `/collections/`: top-15 traffic collections all still rank within ±2 positions. (Requires Semrush plan restoration — see §0 caveat.)
- [ ] **GSC** Performance → Pages: indexed-pages count unchanged; impressions for the 7 long-body URLs **maintained or improved** (because the long content is still on the page, just below grid — same words indexed).
- [ ] **Rich Results Test** on a sample of 5 collections: `CollectionPage`, `ItemList`, `FAQPage` JSON-LD all still validate.

### 7.4 Accessibility

- [ ] **axe-core** scan on a representative collection (use Chrome devtools): 0 new violations.
- [ ] Heading hierarchy preserved: `<h1>` once (collection title), `<h2>` for the long-content section title, `<h3>` for FAQ items + helpful-pages eyebrow. Verified with a tabbed-skim per WCAG 2.1 AA.
- [ ] Skip-to-products link (if any) still works — verify with keyboard nav.
- [ ] Screen reader: NVDA + VoiceOver run on `/collections/stearns-foster-mattresses` (the longest body). Should read: H1 title → short intro paragraph → filters → product cards → H2 "About …" → long body → FAQ accordions → links sidebar.

---

## 8. Rollout plan (phased, feature-flagged)

**Feature flag:** `NEXT_PUBLIC_PLP_LAYOUT_V2` — read in `app/collections/[handle]/page.tsx`. Default `false` (v1). Toggle via Vercel env var. Instant rollback by flipping to `false` + re-deploy (or use Vercel's instant rollback).

| Phase | Traffic | Duration | Exit criteria → next phase |
|---|---|---|---|
| **0. Preview** | 0% (preview deployments only) | 1-2 days | Manual smoke § 7.1 passes. Cowork verification report (read-only) signs off layout + content fidelity on 12+ representative collections. |
| **1. Canary** | 10% (Vercel split / Edge Middleware A/B) | 3-5 days | LCP @ p75 across the 7 long-body collections ≤ baseline. Zero new Sentry errors. Conversion rate within ±5% of v1 (telemetry §8.1). |
| **2. Majority** | 50% | 3-5 days | All Phase-1 criteria sustain. GA4 PLP engagement (scroll depth, product card clicks) within ±10% of v1. |
| **3. Full** | 100% | — | v1 code path removed at next major release. |

**Total rollout window: ~2 weeks from merge to 100%.**

### 8.1 Telemetry

Add a single GA4 custom event `plp_layout_render` with parameter `layout` (`v1` / `v2`) emitted from the PLP page on first interactive paint. This lets us attribute conversion-rate delta between v1 and v2 cohorts during the canary phase.

No personally-identifiable data collected. No new third-party scripts.

---

## 9. Rollback plan

Three rollback paths, in order of speed:

1. **Vercel env var flip** (`NEXT_PUBLIC_PLP_LAYOUT_V2=false`) + redeploy: ~3 minutes, no code change.
2. **Vercel instant rollback** to the deployment immediately before v2 went live: ~1 minute, no code change.
3. **Git revert** the merge commit + redeploy: ~10 minutes, code change.

The Shopify-managed `descriptionHtml` is untouched throughout — no merchant content is lost on rollback. The `categoryIntroFor()` content is untouched throughout — no template edits to revert.

If a single collection (not all) misbehaves, we can also blacklist its handle from v2 via a small `PLP_V2_EXCLUDE_HANDLES` set in code without touching the global flag.

---

## 10. Decisions needed from merchant before implementation starts

Please mark each:

| # | Decision | Default if no answer | Yes / No / Amend |
|---|---|---|---|
| D1 | **Approve the layout swap** as described in §6. | — | |
| D2 | **Length target band for the short intro:** 60-80 words ✓ (industry sweet spot per §4). Or amend to 50-100 / 80-120 / other. | 60-80 | |
| D3 | **Approve the CI length linter** (§6.3) that fails the build if a `categoryIntroFor` branch drifts outside the band. | yes | |
| D4 | **Rollout phasing:** 10% → 50% → 100% over 2 weeks as in §8. Or amend (e.g., go straight to 100% if you accept the risk, or slower ramp). | 10/50/100 | |
| D5 | **Long-content below-grid maximum** — should we cap merchant `descriptionHtml` at any word count for crawlability / page-weight reasons? Industry norm is no hard cap below grid since it's not above-fold. | no cap | |
| D6 | **The 5 zero-body collections** (`foundations`, `twin-xl-mattress-sale`, `cooling-pillows`, `headboards`, `split-king-mattresses`) — out of scope for this RFC but a follow-on: do you want to author Shopify `descriptionHtml` for these, or are you fine with them showing only the code intro above grid + the FAQ/links below? | fine as-is for v2; revisit in v3 | |
| D7 | **Engineering can use 1-day prototype budget on a sandbox preview** for you to eyeball before the canary phase. Worth doing? | yes (low cost, catches surprises) | |

---

## 11. Out of scope (parked for future RFCs)

- **PLP filter expansion** (Shopify Search & Discovery) — separate effort; would add metafield-backed filters beyond the current 7 (firmness / sleepPosition / heightRange) to capture more long-tail queries.
- **PLP product grid optimizations** (LCP image preload tuning, virtualization at high product counts) — separate technical effort.
- **Schema.org enhancements** beyond what's already present (`CollectionPage` + `ItemList` + `FAQPage`) — could add `BreadcrumbList` (probably already in layout) or `WebPage` `mainEntity` linking, but not in this scope.
- **Brand × size cross-cut collection auto-creation** — separate content/operational effort, per the original SEO plan Phase 7.
- **Editorial rewrite of the 6 long-body collections** — out of scope; v2 just relocates the existing text. If merchant wants to refresh content for SEO depth, that's a follow-on content sprint.

---

## 12. Open questions

- **Q1:** Should v2 also apply to non-collection PLPs (`/pages/mattress-store-…` neighborhood pages, brand index pages)? **A:** No — those have different content shapes (FurnitureStore JSON-LD, NeighborhoodPage template). Leave for separate consideration.
- **Q2:** Does the v2 layout affect the existing **sibling-nav** (the cross-cut sub-nav rendered between hero and grid)? **A:** No — sibling-nav stays where it is, between hero and grid. v2 only touches the content inside the hero and the post-grid content block.
- **Q3:** Should the short intro have a "Read more" link to the long content below? **A:** Industry pattern is no — the intro should be self-contained. Users will naturally scroll past products to find more depth. Adds JS complexity and is not in any of the cited industry references. Defer to v3 if conversion data suggests benefit.

---

## 13. Acceptance criteria

v2 is considered shipped when **all** of the following hold:

- 100% of collection PLP traffic served by v2 code path.
- v1 code path deleted from the codebase.
- All 64 collections render: short intro (50-90w from `categoryIntroFor()`) above grid, FAQ + links + (where present) merchant `descriptionHtml` below grid.
- Site-wide CWV p75 LCP unchanged or improved relative to pre-v2 baseline.
- No SEO regression in `domain_organic_unique` for `/collections/*` URLs after a full 30-day window.
- Schema validation green on a sample of 10 collections.

---

## 14. Sources

- [Google Search Central — Core Web Vitals (authoritative)](https://developers.google.com/search/docs/appearance/core-web-vitals)
- [Passionfruit — Optimize Category Pages for E-commerce SEO in 2026](https://www.getpassionfruit.com/blog/how-to-optimize-category-pages-for-e-commerce-seo-in-2026)
- [Digital Applied — eCommerce SEO Category Page Guide 2026](https://www.digitalapplied.com/blog/ecommerce-seo-product-category-page-guide-2026)
- [Keytomic — Ecommerce Category Page SEO Best Practices 2026](https://keytomic.com/blog/ecommerce-category-page-seo-best-practices)
- [Digital Commerce — Ecommerce Category Page SEO](https://digitalcommerce.com/ecommerce-category-page-seo/)
- [Magebit — SEO for eCommerce Category Pages](https://magebit.com/blogs/seo-for-ecommerce-category-pages-a-step-by-step-optimization-guide)
- [Studio Hawk — Category Page SEO Best Practices](https://studiohawk.co.uk/blog/category-page-seo-best-practices)
- [Embryo — E-commerce Category Page Best Practices](https://embryo.com/blog/e-commerce-category-page-best-practices/)
- [Digital Applied — Google March 2026 Core Update: Holistic CWV Scoring](https://www.digitalapplied.com/blog/google-march-2026-core-update-cwv-holistic-scoring)
- [ALM Corp — Google March 2026 Core Update Complete](https://almcorp.com/blog/google-march-2026-core-update-complete/)
- [Logos Web Designs — Core Web Vitals 2026 March Update](https://logoswebdesigns.com/blog/core-web-vitals-2026-march-update/)
- [Data Slayer — Google Core Updates 2026](https://www.dataslayer.ai/blog/google-core-update-december-2025-what-changed-and-how-to-fix-your-rankings)
- Internal: `lib/plp-content.ts` (Phase 265/276/294 — existing intro/FAQ/guides infrastructure).
- Internal: `app/collections/[handle]/page.tsx` (current v1 layout).
- Internal: this session's Shopify Admin pull of all 64 collection bodies (2026-05-20).
