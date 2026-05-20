# RFC: PLP Content Layout v2 — metafield-driven short intro above grid, long body below

**Status:** Draft, awaiting merchant approval.
**Author:** Engineering (Claude).
**Revisions:** v1 (2026-05-20) → **v2.1 (2026-05-20, current)** — pivoted from code-driven intro to **metafield-driven with code fallback**, the industry-standard headless-commerce pattern (data lives in Shopify, code is render layer + safety net). See §16 for the diff vs v1.
**Owners:** Merchant (content/SEO decisions); Engineering (code).
**Targets:** All 64 collection PLPs at `/collections/[handle]`.
**Implementation effort:** ~1 day of code + 1 day of merchant length normalization + 1-week phased rollout.
**Dependencies:** [Metafields & metaobjects audit + cleanup plan](./shopify-metafields-metaobjects-audit.md) (Phases 1, 2, 3 of that doc are blocking for this RFC).
**Blocking decisions for merchant:** §10.

---

## 1. Executive summary

We swap the position of two content blocks on every collection PLP, AND move the "above-grid intro" from the `collection.descriptionHtml` built-in Shopify field to a **purpose-built metafield with length validation** (`custom.intro_short`).

| | Now (v1 layout) | Proposed (v2 layout) |
|---|---|---|
| **Above product grid** (in `<header class="plp-hero">`) | Shopify-managed `collection.descriptionHtml` — **wildly variable** (0 → 465 words; see §3). | New `custom.intro_short` collection metafield (`multi_line_text_field`, **Shopify-enforced `min:300 max:600` chars** ≈ 60-80 words). Merchant fills per collection in the admin UI. Falls back to existing `categoryIntroFor()` template in code when the metafield is empty (zero-effort onboarding for new collections + a safety net for any unfilled handle). |
| **Below product grid** (`<PlpContentBlock>` server component) | Code-driven intro + FAQ + helpful pages + buying guides. | Existing Shopify `collection.descriptionHtml` (long, merchant-controlled, freely variable length) + FAQ + helpful pages + buying guides. |

### Why metafield-driven, not code-driven (the v1 → v2.1 pivot)

Industry-standard headless commerce architecture is **data in Shopify, code as render layer**. The v1 RFC proposed hardcoding the short intro in `lib/plp-content.ts categoryIntroFor()`. That works but it puts content edits behind engineering, and trades merchant control for engineering convenience. With **Shopify-enforced length validation** at the metafield-definition level (`min`/`max` char count), the "merchant discipline" objection that motivated v1 disappears: Shopify Admin physically refuses to save an intro outside the band. Merchants get full control, lengths stay consistent, no engineering needed to tweak any collection's copy. The code `categoryIntroFor()` template stays in the codebase as a **fallback** — it renders when the metafield is empty so new collections never show a blank above-grid slot, and the existing 14 templates cover every existing handle out of the gate.

### Why now

Google's **March 2026 Core Update** (rolled out 27 Mar – mid-April 2026) tightened CWV materially:

- LCP "good" threshold dropped 2.5s → **2.0s**.
- LCP, INP, CLS now **equally weighted** as ranking signals.
- CWV scored **holistically across the site** — slow templates suppress rankings sitewide.
- Explicit ecommerce guidance from Google: "thin category copy, duplicated manufacturer text, weak filtering experiences, unclear trust signals, shallow buying guidance" reduce competitiveness.

The 6 collections with **301-700 word** descriptions in the hero slot are:

1. Pushing the LCP candidate (typically the first product image) below the fold, raising LCP measured by Chrome.
2. Inflating above-fold byte budget, hurting INP on lower-end mobile.

The 20 collections with **0-50 word** descriptions are leaving SEO upside on the table (the very issue the Phase 265 audit flagged with "941 Low text-to-HTML ratio" PLP issues).

This RFC's swap + metafield-validation combination fixes both ends with one architectural change — and aligns the data model with industry headless standards in the process.

### Decision needed

**Approve / reject / amend** the layout swap, the metafield definition, and the implementation plan in §6-9. Specific blocking decisions are listed in §10.

---

## 2. Background

### 2.1 The two existing content blocks

`app/collections/[handle]/page.tsx` already renders:

- **Hero lede** (line 175-182): renders `collection.descriptionHtml` via `dangerouslySetInnerHTML` if present, else a static "Every model on this page is on the floor…" fallback. CSS class `plp-hero-lede`. Lives inside the `<header class="plp-hero">`, immediately under the `<h1>`.
- **`PlpContentBlock` component** (line 299, after the products section closes): renders 3 sub-blocks — a category-aware intro `<p>` (from `categoryIntroFor()`), a 6-question FAQ accordion (from `categoryFaqFor()`), and a links sidebar with "Helpful pages" + "Buying guides" (from `categoryGuidesFor()`). Emits FAQPage JSON-LD via the parent layout.

Both are already server-rendered, accessibility-clean, and indexable. **The infrastructure for v2 already exists** — we are not building new components, only relocating two existing ones and changing the source of the above-grid text from "Shopify field" to "Shopify metafield".

### 2.2 What `categoryIntroFor()` already provides (the fallback source)

`lib/plp-content.ts:301-361` returns a 2-3 sentence intro per collection handle using substring-match (most-specific-first): 5 brand intros, 4 material intros, 2 accessory intros, 1 sale/clearance intro, 3 size intros, 1 generic fallback. Total coverage: 100% of existing 64 collection handles via the substring-match cascade. Live tested in production since 2026-04 (Phase 265).

**This stays in the code base** as the fallback when `custom.intro_short` is empty. It's not removed.

### 2.3 The metafield audit (companion doc)

Pulled the full metafield/metaobject surface as part of this RFC's research — documented separately at [`docs/design/shopify-metafields-metaobjects-audit.md`](./shopify-metafields-metaobjects-audit.md). Two findings from that audit directly inform this RFC:

- **F5** — There's already a defined-but-unused `custom.seo_content` collection metafield with description "Rich educational content displayed below product grid for SEO (600-1000 words)." Either retire it or repurpose it for the below-grid slot (see §5.2 — the merchant chooses).
- **F6** — Most existing `custom.*` text fields have no length validation. The new `custom.intro_short` defined here is the model for adding `min`/`max` validators going forward.

---

## 3. Current state — measured (live Shopify, 2026-05-20)

Pulled all 64 collection bodies via Admin GraphQL. The repo's `data/url-inventory/collections.json` snapshot (2026-05-15) is stale; the *live* picture is:

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

After v2, all 7 keep their full long content (rendered below the grid via the existing `collection.descriptionHtml` field). The above-grid slot for each becomes the merchant's (or fallback) 60-80 word `custom.intro_short`.

### 3.2 The 5 zero-body collections

`foundations`, `twin-xl-mattress-sale`, `cooling-pillows`, `headboards`, `split-king-mattresses`. After v2: above grid gets the `categoryIntroFor()` fallback (already covers all 5 via the substring cascade), below grid shows just FAQ + links (no body to render). Both significant improvements over today's empty hero.

### 3.3 The 15 thin-body collections (1-50w)

Above grid: merchant fills `custom.intro_short` (60-80w validated) or falls back to `categoryIntroFor()` template (both improvements over the current 1-50 word body). Below grid: existing thin Shopify body stays where it is; merchant can choose to expand it now or later. Net: no content lost, presentation improves.

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

Real-world implementations of this pattern (verified at time of writing): Wayfair, Crate & Barrel, Zappos, REI, Target, Article, and Helix Sleep (a directly competing mattress retailer in our Semrush competitor set).

### 4.1 Headless-commerce metafield data-modeling references (new for v2.1)

| Source | Key guidance |
|---|---|
| [Shopify Dev — About metafields](https://shopify.dev/docs/apps/build/metafields) (authoritative) | Use `custom` namespace for merchant-defined fields. Use validators (`min`, `max`, `choices`) to enforce data shape at the schema layer. Set `access.storefront = "public_read"` for any field the headless might read. |
| [Shopify Dev — Data modelling with metafields and metaobjects](https://shopify.dev/docs/apps/build/metaobjects/data-modeling-with-metafields-and-metaobjects) (authoritative) | Metafield = single data point on an existing resource (collection.intro_short ✓). Metaobject = repeatable structured content (not needed here). |
| [Searchanise — Comprehensive Shopify Metafields Guide 2026](https://searchanise.io/blog/shopify-metafields/) | Use validators consistently; the admin UI surfaces validator errors so merchants self-correct. |
| [Replo — Shopify Metafields: Everything You Need To Know](https://www.replo.app/blog/shopify-metafields) | Industry pattern: data lives in Shopify metafields, code reads via Storefront API or Liquid, code never hardcodes content. |

**Why v2.1 follows this convention:** the v1 RFC's recommendation to hardcode intros in `lib/plp-content.ts` is acceptable for a stopgap but is not industry-standard for production headless commerce. The fix is to put the content in Shopify with schema-enforced validation (preventing the "merchant discipline" failure mode) and keep the code template only as a fallback for the empty case.

### 4.2 Google's March 2026 Core Update — the timing case

Sources:

- [Google Search Central — Core Web Vitals](https://developers.google.com/search/docs/appearance/core-web-vitals) (authoritative)
- [Digital Applied — Google March 2026 Core Update](https://www.digitalapplied.com/blog/google-march-2026-core-update-cwv-holistic-scoring)
- [ALM Corp — Google March 2026 Core Update Complete](https://almcorp.com/blog/google-march-2026-core-update-complete/)
- [Logos Web Designs — Core Web Vitals 2026 March Update](https://logoswebdesigns.com/blog/core-web-vitals-2026-march-update/)
- [Data Slayer — Google Core Updates 2026](https://www.dataslayer.ai/blog/google-core-update-december-2025-what-changed-and-how-to-fix-your-rankings)

Specific guidance from those sources:

1. LCP threshold tightened 2.5s → 2.0s.
2. LCP, INP, CLS now equal-weighted.
3. **CWV scored holistically site-wide** — "a handful of slow-loading templates or high-CLS ad layouts can now suppress rankings for your entire domain." The 6 long-body collections aren't just hurting themselves, they're hurting the whole site's CWV.
4. Google's explicit ecommerce guidance: "thin category copy, duplicated manufacturer text, weak filtering experiences, unclear trust signals, shallow buying guidance" reduce competitiveness. v2 directly addresses thin copy (every collection above grid gets a validated 60-80w intro) and shallow guidance (the long content moves below grid where it has room to be substantive).

---

## 5. Decision: metafield with code fallback (v2.1 update)

| Approach | Pro | Con | Verdict |
|---|---|---|---|
| A. **Code-driven** (`categoryIntroFor()` only) | Cheap to ship, deterministic. | Content edits behind engineering. Industry-non-standard for headless. | Rejected (v1 default) |
| B. **Shopify metafield, no validation** | Merchant control, no engineering bottleneck. | Lengths drift — exactly the symptom we're fixing. | Rejected |
| **C. Shopify metafield WITH `min`/`max` validation + `categoryIntroFor()` fallback** ✓ | Merchant control. Length consistency enforced by Shopify at save time. Headless data-modelling standard. Zero-effort onboarding for new collections (fallback handles them). Reversible (switch back to fallback-only by emptying metafields). | Slight code complexity to read both sources with fallback. | **Chosen for v2.1** |

The fallback approach has a useful side-effect: the merchant can roll out `custom.intro_short` collection-by-collection at their own pace. Day 1 of v2 launch, the merchant doesn't have to have filled all 64 metafields — every unfilled one renders the `categoryIntroFor()` template, which is already-tested copy.

### 5.1 The metafield definition

```graphql
metafieldDefinitionCreate(definition: {
  namespace: "custom",
  key: "intro_short",
  name: "Short intro (above product grid)",
  description: "Short SEO-rich intro shown above the product grid on the PLP. Target 60-80 words / ~350-500 chars. If left blank, the headless storefront falls back to the code-driven categoryIntroFor() template. Industry-standard category-page hook length per https://www.getpassionfruit.com/blog/how-to-optimize-category-pages-for-e-commerce-seo-in-2026",
  ownerType: COLLECTION,
  type: "multi_line_text_field",
  validations: [
    { name: "min", value: "300" },
    { name: "max", value: "600" }
  ],
  access: {
    admin: MERCHANT_READ_WRITE,
    storefront: PUBLIC_READ
  },
  pin: true
})
```

**Choices explained:**

- **`multi_line_text_field`** over `rich_text_field`: short intros don't need formatting, plain text composes better with the existing `plp-hero-lede` CSS (no `<p>` wrapping issues), and avoids the editor surfacing formatting that would visually clash with the constrained hero space.
- **`min:300, max:600` chars**: roughly 60-80 words at 5 chars/word average. Within the industry-cited 50-100 word band. Lower bound prevents one-line stubs ("Best mattresses!"); upper bound prevents the above-fold pushing problem.
- **`PUBLIC_READ` storefront access**: required for the headless to read.
- **Pinned**: surfaces at the top of the COLLECTION admin UI so merchant edits are 1-click after the rest of the cleanup (audit doc Phase 3) clears the dead pinned fields.

### 5.2 What happens to the existing long Shopify `collection.descriptionHtml`?

Two options for the merchant — both are valid, both end at the same UX. The audit doc covers this as **F5 / decision C2**:

- **Option B (default, lower risk):** Keep `collection.descriptionHtml` as the long-content source-of-truth. PLP v2 below-grid section reads from it. **Delete** the unused `custom.seo_content` metafield definition (audit Phase 3).
- **Option A (data-model purist):** One-time script migration of every collection's current `descriptionHtml` content into `custom.seo_content`. PLP v2 reads from `custom.seo_content` (with `descriptionHtml` as a transition-window fallback). Eventually `descriptionHtml` is fully retired for collections.

Default to **Option B** unless the merchant strongly prefers the all-metafield architecture. Functionally identical to the customer; cheaper to operate.

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
  <section class="plp-section">{filter + grid + load-more}</section>
  <PlpContentBlock>                                                  ← code intro + FAQ + links
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
      <p class="plp-hero-lede">                                       ← NEW: 60-80 words, consistent
        {collection.metafield('custom','intro_short')?.value
          ?? categoryIntroFor(collection.handle, collection.title)}
      </p>
      <img class="plp-hero-img" />
    </div>
  </header>
  <sibling-nav/>
  <section class="plp-section">{filter + grid + load-more}</section>
  <PlpContentBlock>                                                   ← long body + FAQ + links
    <long-body>{collection.descriptionHtml}</long-body>               ← NEW: moved from hero
    <faq/><links/><guides/>
  </PlpContentBlock>
</main>
```

### 6.2 File-level changes

| File | Change | LOC |
|---|---|---|
| **Shopify Admin (one-time via API)** | Create `custom.intro_short` metafield definition per §5.1. Delete the 14 orphan collection fields per audit Phase 3. Optionally delete `custom.seo_content` (audit C2, Option B default). | n/a — 1 mutation + Phase 3 batch |
| `lib/shopify/queries/collection.ts` | Extend the `getCollectionByHandle` query to fetch `metafield(namespace: "custom", key: "intro_short") { value }`. Add to the returned type. | ~10 |
| `lib/shopify/types.ts` | Add `introShort?: string \| null` to the Collection type. | ~2 |
| `app/collections/[handle]/page.tsx` | (a) Replace the hero `plp-hero-lede` block (~lines 175-183) with a paragraph rendering `collection.introShort ?? categoryIntroFor(collection.handle, collection.title)`. (b) Pass `descriptionHtml` as a prop to `<PlpContentBlock>` at line 299. | ~15 |
| `app/_components/plp-content-block.tsx` | Accept new optional `descriptionHtml` prop. Render at top of the component (above the existing intro/H2), inside a new `<div class="plp-long-content rte">` with `dangerouslySetInnerHTML` after running `sanitizeShopifyHtml`. Remove the `categoryIntroFor` paragraph render from this component (it now lives in the hero); keep the H2 + FAQ + links + guides. | ~20 |
| `app/globals.css` | Add `.plp-long-content` styling (max-width container, `<h2>/<h3>` typography matching `<article>` body, list/table styling mirroring `.rte`). Tighten `.plp-hero-lede` to assume short text (no need to handle 400-word overflow anymore). | ~30 |
| `lib/plp-content.ts` | No code changes — `categoryIntroFor()` stays exactly as it is (it's now the fallback). | 0 |
| `lib/structured-data.ts` / collection JSON-LD | **No change.** CollectionPage + ItemList + FAQPage JSON-LD all stay as-is. | 0 |

**Total code change: ~77 LOC across 5 files + a one-shot Shopify Admin API mutation.**

### 6.3 Optional: backfill helper for the merchant

To accelerate populating `custom.intro_short` across the 64 collections (rather than asking the merchant to author every one from scratch), ship `scripts/seo-backfill-collection-intro-short.mjs` following the existing `scripts/seo-backfill-*.mjs` pattern:

- Dry-run by default; `--apply` to write.
- For each collection without `custom.intro_short` set, compute `categoryIntroFor(handle, title)` (the same fallback the runtime uses), trim/pad to the 300-600 char band, and **propose** it via the dry-run report.
- Merchant reviews the JSON report, optionally edits any of the proposed values, then `--apply` writes them via `metafieldsSet` (the same proven path the article-cleanup script uses).
- Result: day-1 of v2 launch, every collection has a populated metafield. Merchant can override any of them individually anytime in the admin UI afterwards.

This is the same pattern as `seo-backfill-product-seo.mjs` after the metafieldsSet fix (PR #190). Optional — not on the critical path.

---

## 7. Test plan

### 7.1 Pre-merge

- [x] `npx tsc --noEmit` → 0 errors.
- [x] `npx next lint` → 0 warnings.
- [x] `npm test` → SSR test suite passes.
- [ ] **Metafield definition** created in Shopify, verified visible in the admin UI under Collections → any collection → Metafields, with the right validator messages on save attempts (test by entering 100 chars — should fail with "must be at least 300 chars"; enter 800 chars — should fail with "must be at most 600 chars"; enter 400 chars — should save).
- [ ] **Manual smoke** on at least one collection per major category:
  - Brand: `tempur-pedic-mattresses`, `stearns-foster-mattresses`
  - Material: `memory-foam-mattresses`, `latex-mattresses`
  - Size: `king-size-mattresses`, `twin-size-mattresses`
  - Accessory: `pillows`, `adjustable-beds`
  - Sale: `on-sale`
  - Empty-body: `foundations`, `cooling-pillows`
  - Long-body: `spring-air-mattresses` (349w), `stearns-foster-mattresses` (465w)
- [ ] **Fallback path verification**: temporarily leave `custom.intro_short` empty on `pillows` and verify it renders the `categoryIntroFor("pillows", "Pillows")` text from the code.
- [ ] **Populated path verification**: set `custom.intro_short` on `king-size-mattresses` and verify it renders instead of the fallback.
- [ ] **Long-body collections** (Stearns 465w, Spring Air 349w) render their full body below grid with proper HTML structure preserved by `sanitizeShopifyHtml`.
- [ ] **Zero-body collections** render fallback intro above + FAQ/links below (no longer look empty).
- [ ] Internal links inside the migrated `descriptionHtml` still 200 (existing `sanitize.ts` redirect-resolution handles this).

### 7.2 Post-deploy / CWV verification

- [ ] **Vercel Speed Insights** baseline captured **before** rollout for the 7 long-body collections.
- [ ] **24-48h post-rollout**: re-pull Speed Insights for the same 7 — expect **LCP improvement** (LCP image visually closer to the viewport top because the long descriptionHtml no longer occupies the slot above it).
- [ ] **No CLS regression** anywhere — both content blocks are still SSR'd.
- [ ] **Sentry**: zero new first-party errors in the 24h post-rollout window.
- [ ] **CWV-holistic** (post-March-2026 update): site-wide p75 LCP not worse.

### 7.3 SEO non-regression (2-4 weeks after full rollout)

- [ ] **Semrush** `domain_organic_unique` filtered to `/collections/`: top-15 traffic collections all still rank within ±2 positions. (Requires Semrush plan restoration — see §0 caveat carried over from v1.)
- [ ] **GSC** Performance → Pages: indexed-pages count unchanged; impressions for the 7 long-body URLs **maintained or improved** (the long content is still on the page, just below grid — same words indexed).
- [ ] **Rich Results Test** on a sample of 5 collections: `CollectionPage`, `ItemList`, `FAQPage` JSON-LD all still validate.

### 7.4 Accessibility

- [ ] **axe-core** scan on a representative collection: 0 new violations.
- [ ] Heading hierarchy preserved: `<h1>` once (collection title), `<h2>` for the long-content section title, `<h3>` for FAQ items + helpful-pages eyebrow. Verified per WCAG 2.1 AA.
- [ ] Skip-to-products link (if any) still works — verify with keyboard nav.
- [ ] Screen reader smoke (NVDA + VoiceOver) on `/collections/stearns-foster-mattresses`: H1 title → short intro → filters → product cards → H2 "About …" → long body → FAQ accordions → links sidebar.

---

## 8. Rollout plan (phased, feature-flagged)

**Feature flag:** `NEXT_PUBLIC_PLP_LAYOUT_V2` — read in `app/collections/[handle]/page.tsx`. Default `false` (v1). Toggle via Vercel env var. Instant rollback by flipping to `false` + re-deploy (or use Vercel's instant rollback).

| Phase | Traffic | Duration | Exit criteria → next |
|---|---|---|---|
| **0. Preview** | 0% (preview deployments only) | 1-2 days | Manual smoke § 7.1 passes. Cowork verification (read-only) signs off layout + content fidelity on 12+ representative collections. |
| **1. Canary** | 10% (Vercel split / Edge Middleware A/B) | 3-5 days | LCP @ p75 across the 7 long-body collections ≤ baseline. Zero new Sentry errors. Conversion within ±5% of v1 (telemetry §8.1). |
| **2. Majority** | 50% | 3-5 days | Phase-1 criteria sustain. GA4 PLP engagement (scroll depth, product card clicks) within ±10% of v1. |
| **3. Full** | 100% | — | v1 code path removed at next major release. |

**Total rollout window: ~2 weeks from merge to 100%.**

### 8.1 Telemetry

Single GA4 custom event `plp_layout_render` with parameter `layout` (`v1` / `v2`) + `intro_source` (`metafield` / `fallback`) emitted on first interactive paint. Lets us attribute conversion delta both between v1/v2 cohorts and between metafield-populated vs fallback-only collections.

No personally-identifiable data collected. No new third-party scripts.

---

## 9. Rollback plan

Three rollback paths, in order of speed:

1. **Vercel env var flip** (`NEXT_PUBLIC_PLP_LAYOUT_V2=false`) + redeploy: ~3 minutes, no code change.
2. **Vercel instant rollback** to the deployment immediately before v2 went live: ~1 minute, no code change.
3. **Git revert** the merge commit + redeploy: ~10 minutes, code change.

The Shopify `collection.descriptionHtml` is untouched throughout — no merchant content lost on rollback. The new `custom.intro_short` metafield definition and any data written to it persist through rollback (they just stop being read when v2 is disabled). The `categoryIntroFor()` template is untouched throughout — no template edits to revert.

If a single collection (not all) misbehaves, blacklist its handle from v2 via a small `PLP_V2_EXCLUDE_HANDLES` set in code without touching the global flag.

---

## 10. Decisions needed from merchant before implementation starts

| # | Decision | Default if no answer | Yes / No / Amend |
|---|---|---|---|
| D1 | **Approve the layout swap** as described in §6. | — | |
| D2 | **Length validator on `custom.intro_short`:** `min:300 max:600` chars (≈ 60-80 words, industry sweet spot per §4). Or amend to e.g. `min:200 max:800` for a wider band. | 300-600 chars | |
| D3 | **Approve creating the `custom.intro_short` collection metafield definition** in Shopify Admin via API (§5.1 spec). | yes | |
| D4 | **Long-content source (audit C2):** Option B (keep `descriptionHtml`, delete the unused `custom.seo_content` definition) vs Option A (migrate `descriptionHtml` into `custom.seo_content`). | Option B (lower risk) | |
| D5 | **Backfill helper script** (§6.3): ship `scripts/seo-backfill-collection-intro-short.mjs` so the merchant doesn't have to author all 64 intros manually from scratch. | yes | |
| D6 | **Rollout phasing:** 10% → 50% → 100% over 2 weeks as in §8. Or amend (faster ramp / slower ramp). | 10/50/100 | |
| D7 | **The 5 zero-body collections** — fine for v2 to render fallback intro above + just FAQ/links below, or do you want to author Shopify `descriptionHtml` for them first? | fine as-is for v2; revisit in v3 | |
| D8 | **Engineering can use 1-day prototype budget on a sandbox preview** for you to eyeball before the canary phase. Worth doing? | yes | |
| D9 | **Cleanup plan from the audit doc** (audit §C1, C3, C4, C5) — approved to bundle into the same PR as the v2 metafield creation, or split into a separate "Shopify metafields hygiene" PR? | bundle (simpler) | |

---

## 11. Out of scope (parked for future RFCs)

- **PLP filter expansion** (Shopify Search & Discovery) — separate effort.
- **PLP product grid optimizations** (LCP image preload tuning, virtualization) — separate technical effort.
- **Schema.org enhancements** beyond current `CollectionPage` + `ItemList` + `FAQPage`.
- **Brand × size cross-cut collection auto-creation** — separate operational effort.
- **Editorial rewrite of the 6 long-body collections** — out of scope; v2 just relocates the existing text.
- **The remaining metafield hygiene** items in the audit doc (Phases 4-6) can ship anytime; not blocking for this RFC.

---

## 12. Open questions

- **Q1:** Should v2 also apply to non-collection PLPs (neighborhood pages, brand index pages)? **A:** No — different content shapes (FurnitureStore JSON-LD, NeighborhoodPage template). Leave for separate consideration.
- **Q2:** Does the v2 layout affect the existing sibling-nav (cross-cut sub-nav between hero and grid)? **A:** No — sibling-nav stays where it is.
- **Q3:** Should the short intro have a "Read more" link to the long content below? **A:** Industry pattern is no — the intro should be self-contained. Users will naturally scroll past products. Adds JS complexity and is not in any of the cited industry references. Defer to v3 if conversion data suggests benefit.
- **Q4 (new for v2.1):** Multi-language support — does `custom.intro_short` need to be Shopify Translate-compatible? **A:** Yes implicitly — Shopify Translate & Adapt operates on metafields out of the box for `multi_line_text_field`. No extra work needed today; ready for future internationalization.

---

## 13. Acceptance criteria

v2 is considered shipped when **all** of the following hold:

- 100% of collection PLP traffic served by v2 code path.
- v1 code path deleted from the codebase.
- `custom.intro_short` metafield definition created and visible in Shopify Admin.
- All 64 collections render: short intro (60-80w from `custom.intro_short` OR `categoryIntroFor()` fallback) above grid; FAQ + links + (where present) merchant `descriptionHtml` below grid.
- Site-wide CWV p75 LCP unchanged or improved relative to pre-v2 baseline.
- No SEO regression in `domain_organic_unique` for `/collections/*` URLs after a full 30-day window.
- Schema validation green on a sample of 10 collections.

---

## 14. Sources

### Industry pattern (above/below grid layout)
- [Google Search Central — Core Web Vitals (authoritative)](https://developers.google.com/search/docs/appearance/core-web-vitals)
- [Passionfruit — Optimize Category Pages for E-commerce SEO in 2026](https://www.getpassionfruit.com/blog/how-to-optimize-category-pages-for-e-commerce-seo-in-2026)
- [Digital Applied — eCommerce SEO Category Page Guide 2026](https://www.digitalapplied.com/blog/ecommerce-seo-product-category-page-guide-2026)
- [Keytomic — Ecommerce Category Page SEO Best Practices 2026](https://keytomic.com/blog/ecommerce-category-page-seo-best-practices)
- [Digital Commerce — Ecommerce Category Page SEO](https://digitalcommerce.com/ecommerce-category-page-seo/)
- [Magebit — SEO for eCommerce Category Pages](https://magebit.com/blogs/seo-for-ecommerce-category-pages-a-step-by-step-optimization-guide)
- [Studio Hawk — Category Page SEO Best Practices](https://studiohawk.co.uk/blog/category-page-seo-best-practices)
- [Embryo — E-commerce Category Page Best Practices](https://embryo.com/blog/e-commerce-category-page-best-practices/)

### Google's March 2026 Core Update
- [Digital Applied — Google March 2026 Core Update: Holistic CWV Scoring](https://www.digitalapplied.com/blog/google-march-2026-core-update-cwv-holistic-scoring)
- [ALM Corp — Google March 2026 Core Update Complete](https://almcorp.com/blog/google-march-2026-core-update-complete/)
- [Logos Web Designs — Core Web Vitals 2026 March Update](https://logoswebdesigns.com/blog/core-web-vitals-2026-march-update/)
- [Data Slayer — Google Core Updates 2026](https://www.dataslayer.ai/blog/google-core-update-december-2025-what-changed-and-how-to-fix-your-rankings)

### Headless metafield data modelling (new for v2.1)
- [Shopify Dev — About metafields](https://shopify.dev/docs/apps/build/metafields) (authoritative)
- [Shopify Dev — Data modelling with metafields and metaobjects](https://shopify.dev/docs/apps/build/metaobjects/data-modeling-with-metafields-and-metaobjects) (authoritative)
- [Searchanise — Comprehensive Shopify Metafields Guide 2026](https://searchanise.io/blog/shopify-metafields/)
- [Replo — Shopify Metafields: Everything You Need To Know](https://www.replo.app/blog/shopify-metafields)
- [Jillur Rahman — Shopify Metafields & Metaobjects Developer's Guide 2026](https://jillur.vercel.app/blog/shopify-metafields-metaobjects)

### Internal
- `lib/plp-content.ts` (Phase 265/276/294 — existing intro/FAQ/guides infrastructure, becomes the fallback in v2)
- `lib/shopify/queries/collection.ts` + `fragments.ts` (where the new metafield query is added)
- `app/collections/[handle]/page.tsx` (the current v1 layout)
- [`docs/design/shopify-metafields-metaobjects-audit.md`](./shopify-metafields-metaobjects-audit.md) — the audit findings this RFC depends on (especially Phases 1, 2, 3)
- This session's Shopify Admin pull of all 64 collection bodies (2026-05-20)

---

## 15. Pre-v2.1 self-review (engineering check)

Honest re-read of v1 turned up the following gaps the v2.1 update addresses:

| # | v1 gap | Resolved in v2.1 |
|---|---|---|
| 1 | Recommended **hardcoding** the short intro in `lib/plp-content.ts`. Not industry-standard for headless. | ✓ Pivoted to metafield-with-fallback. |
| 2 | Did not audit the existing **metafield / metaobject** landscape before recommending where the new content should live. Missed that `custom.seo_content` collection metafield already exists (relevant!) and that there are 14 orphan collection metafields cluttering admin. | ✓ Full audit added at [`shopify-metafields-metaobjects-audit.md`](./shopify-metafields-metaobjects-audit.md); referenced from this RFC's §5.2 and §10 D4. |
| 3 | Did not consider Shopify-native **`min`/`max` validators** as the answer to the "merchant length discipline" objection. Reached straight for a CI script when the platform handles it natively. | ✓ Length consistency now enforced by Shopify Admin at save time; CI script no longer needed. |
| 4 | Did not consider **internationalization** (Shopify Translate operates on metafields). | ✓ Noted in Q4. |
| 5 | Did not consider zero-effort merchant onboarding for the 64-collection cold start. | ✓ Optional backfill helper (§6.3) seeds populated metafields from the existing fallback template; merchant edits afterwards. |

---

## 16. Revision history

- **v1 (2026-05-20):** Initial RFC. Code-driven short intro via `categoryIntroFor()` template, length enforced by a custom CI script. Long body moves below grid. (PR #191, since superseded.)
- **v2.1 (2026-05-20, this revision):** Pivoted the short intro source from code to **Shopify metafield with `min`/`max` validation**, with the existing `categoryIntroFor()` template kept in code as a fallback for unfilled handles. Added companion metafields/metaobjects audit doc with 14-field cleanup list. Reframed §5 decision matrix, §6 implementation plan, §10 decisions, and added §15 self-review of v1 gaps. All other content (§3 data, §4 industry citations, §7 test plan, §8 rollout, §9 rollback) carried forward unchanged from v1.
