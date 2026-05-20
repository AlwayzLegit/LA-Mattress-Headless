# Shopify metafields & metaobjects audit + cleanup plan

**Status:** Draft, awaiting merchant approval.
**Author:** Engineering (Claude).
**Date:** 2026-05-20.
**Owners:** Merchant (data decisions); Engineering (code wiring).
**Scope:** Every metafield definition and every metaobject definition on `la-mattress.myshopify.com`.

---

## 1. Verdict — yes, cleanup is needed

### Headline findings

| # | Finding | Severity | Affected |
|---|---|---|---|
| F1 | **Three overlapping "firmness" fields** with no single source of truth (`shopify.firmness` standardized metaobject ref + `custom.firmness` free text + `custom.firmness_score` 1-10 number + `custom.comfort_level` free text). | High | All ~200 PRODUCTS |
| F2 | **Duplicate singular/plural** `custom.sleep_position` (orphan, never queried) vs `custom.sleep_positions` (the one actually used by Search & Discovery filtering). | Medium | All PRODUCTS |
| F3 | **Trailing-underscore typo** `custom.description_` rich-text on COLLECTIONS — confirmed not queried in headless code. Orphan from an older theme era. | Low | All 64 COLLECTIONS (definition only; data may also be orphaned) |
| F4 | **10 orphan COLLECTION URL/label fields** (`custom.link1`–`link5`, `custom.label1`–`label5`) — none referenced in headless code. Legacy Shopify-theme banner-CTA pattern that never carried over to the headless. | Medium | All 64 COLLECTIONS |
| F5 | **`custom.seo_content` rich-text COLLECTION metafield exists, is properly defined ("600–1000 words SEO content below product grid"), but is never read by the headless code.** Either was a previously-planned feature, an old theme dependency, or a future intent that stalled. | High (opportunity) | All 64 COLLECTIONS — directly relevant to the PLP layout v2 RFC |
| F6 | **Missing length validation** on every free-text `custom.*` field on PRODUCT and COLLECTION. The variable-length collection-body problem we're solving in the PLP RFC is a symptom of this. Shopify supports `min`/`max` char-count validators that the merchant admin UI enforces at save time. | Medium | All `custom.*` text fields |
| F7 | **Inconsistent storefront access** — `custom.comfort_level` and `custom.sleep_positions` are set to `access.storefront = NONE` while their siblings (`custom.firmness`, `custom.sleep_disruptors`) are `PUBLIC_READ`. Works for S&D filtering (different mechanism) but blocks direct headless reads if ever needed. | Low | 2 PRODUCT metafields |
| F8 | **Pinning hygiene** — the 14 link/label collection fields all hold pinned slots (1, 2, 3, …, 14) in the admin UI, making the pinned section cluttered with fields nobody uses. Once deleted (F3/F4), pinning the actually-used fields cleanly is straightforward. | Cosmetic | COLLECTION admin UX |

### Non-issues / things done well

- **PRODUCT metafields are otherwise well-organized.** 16 actively-used `custom.*` fields with clear names, pin order, descriptions; `fragments.ts` queries them via stable aliases (`firmnessMetafield`, `taglineMetafield`, etc.).
- **Metaobjects are well-modelled.** `announcement_bar` has 7 fields with validators (`max:120` on message, `choices` on style). `hero_slide` has 15 well-named fields including scheduling (`starts_at`/`ends_at`). Both have docstrings pointing at code wiring.
- **Shopify standard-taxonomy metaobjects** (13 of them: `mattress-features`, `firmness`, `bedding-size`, etc.) are correctly opted into — these are auto-managed by Shopify and shouldn't be touched.
- **Namespace discipline** is clean: 5 namespaces in active use (`custom`, `shopify`, `shopify--discovery--*`, `mm-google-shopping`, `reviews`), each with a clear owner. No accidental cross-namespace collisions.

---

## 2. Methodology

Pulled the full metafield definition surface across all owner types via Shopify Admin API in one query (see §6 for the exact query). Cross-referenced every `custom.*` key against the headless codebase using `grep -rE` in `app/`, `lib/`, and `scripts/`. Verified industry conventions against [Shopify's own metafield/metaobject best-practices docs](#7-sources--industry-standards) and four current ecommerce data-modelling references.

---

## 3. Inventory by owner type

### 3.1 PRODUCT — 47 definitions

| Group | Count | Notes |
|---|---|---|
| App-installed (Shopify Discovery + Google Shopping + Judge.me reviews) | 7 | Don't touch — managed by the app installations. |
| Shopify standard taxonomy (`shopify.*` → metaobject refs) | 15 | Auto-managed by Shopify Catalog. |
| **`custom.*` (merchant-defined)** | **22** | The interesting set — see breakdown below. |
| `mm-google-shopping.custom_product` | 1 | Single Google Shopping boolean; fine. |
| `reviews.rating`/`rating_count` | 2 | Judge.me-populated; fine. |

**`custom.*` PRODUCT breakdown** (22 definitions):

| Pin | Key | Type | Used in code? | Verdict |
|---|---|---|---|---|
| 1 | `blog_product` | product_reference | likely on blog template | keep |
| 2 | `blog_products` | list.product_reference | likely on blog template | keep |
| **3** | **`sleep_position`** (singular) | list.single_line_text_field | **not queried** (grep clean) | **F2 — DELETE (orphan; duplicate of plural)** |
| 4 | `height` | list.single_line_text_field | S&D filter (`heightRange` in `plp-filters/filters.ts`) | keep |
| 5 | `sleep_disruptors` | list.single_line_text_field | unclear — may be PDP or quiz | verify with merchant; keep if used |
| 6 | `our_own_products` | list.metaobject_reference (→ `build_your_own`) | likely on PDP | keep |
| **7** | **`firmness`** | single_line_text_field | queried as `firmnessMetafield` in `fragments.ts` | keep — but **F1** see below |
| 8 | `height_inches` | number_decimal | queried as `heightMetafield` | keep |
| 9 | `material_type` | single_line_text_field | queried as `materialMetafield` | keep |
| 10 | `warranty_years` | number_integer | queried as `warrantyMetafield` | keep |
| 11 | `trial_nights` | number_integer | queried as `trialMetafield` | keep |
| 12 | `tagline` | single_line_text_field | queried as `taglineMetafield` (PDP) | keep |
| 13 | `lede` | multi_line_text_field | queried as `ledeMetafield` (PDP) | keep |
| 14 | `not_ideal_for` | list.single_line_text_field | queried (PDP) | keep |
| 15 | `highlights` | json | queried (PDP) | keep |
| 16 | `firmness_score` | number_integer (min:1, max:10) | queried (PDP firmness scale) | keep — but **F1** see below |
| 17 | `position_fit` | json | queried (PDP) | keep |
| 18 | `layers` | json | queried (PDP) | keep |
| 19 | `best_for` | list.single_line_text_field | queried (PDP) | keep |
| (unpinned) | **`comfort_level`** | single_line_text_field, `access.storefront=NONE` | **not queried** | **F1 — likely DELETE** (overlaps `firmness`); confirm with merchant before delete |
| (unpinned) | `sleep_positions` (plural) | list.single_line_text_field, `access.storefront=NONE` | **S&D filter** (`sleepPosition` in plp-filters) | keep but **F7 fix storefront access to PUBLIC_READ** |
| (unpinned) | `complementary_handles` | json | queried (PDP "Complete Your Bed") | keep |

### 3.2 COLLECTION — 15 definitions

| Key | Type | Used in code? | Verdict |
|---|---|---|---|
| **`heading`** | single_line_text_field | yes (`app/page.tsx`, `not-found.tsx`, blog article) | keep |
| **`description_`** (trailing underscore!) | rich_text_field | **not queried** (false-positive grep hit was unrelated) | **F3 — DELETE** |
| `link`, `link1`–`link5` (6 URL fields) | url | **none queried** | **F4 — DELETE all 6** |
| `label`, `label1`–`label5` (6 text fields) | single_line_text_field | **none queried** | **F4 — DELETE all 6** |
| **`seo_content`** | rich_text_field | **not currently queried**, but description says "Rich educational content displayed below product grid for SEO (600-1000 words)" | **F5 — REPURPOSE for PLP v2 long-content slot** (see RFC) |

**Net** after cleanup: 1 keep (`heading`) + 1 reuse (`seo_content`) + 1 add (`intro_short`, new for PLP v2) = **3 active collection metafields** vs the 15 today.

### 3.3 PAGE — 0 definitions

Clean. Nothing to do.

### 3.4 ARTICLE — 1 definition

`custom.blog_product` (product_reference). Keep.

### 3.5 PRODUCTVARIANT — 11 definitions

10 are Google Shopping fields (`mm-google-shopping.*`). 1 is `custom.variant_upsell_products` (list of metaobject_reference). All are app- or merchant-driven. Keep.

### 3.6 SHOP — 3 definitions

All app config (Fast Bundle, Google Shopping extension). Keep.

### 3.7 METAOBJECT definitions — 17

| Group | Count | Verdict |
|---|---|---|
| Shopify standard taxonomy (`shopify--*`) | 13 | Auto-managed; do not touch. |
| `build_your_own` (2 fields) | 1 | Used via `custom.our_own_products`. Keep. |
| `variant_upsell` (2 fields) | 1 | Used via `custom.variant_upsell_products`. Keep. |
| **`announcement_bar`** (7 fields, validated) | 1 | Used by `lib/shopify/queries/announcement.ts`. Keep — exemplar of good metaobject design. |
| **`hero_slide`** (15 fields, scheduling) | 1 | Used by `lib/shopify/queries/hero-slides.ts`. Keep — exemplar. |

**All metaobjects are properly used. No metaobject cleanup needed.**

---

## 4. Issues — detailed

### F1. Firmness has 4 fields, no single source of truth

The store has:

1. **`shopify.firmness`** (`list.metaobject_reference` → `shopify--firmness` standard-taxonomy metaobject). Shopify Catalog-managed; values are standardized to Shopify's product taxonomy.
2. **`custom.firmness`** (single_line_text_field free text, pin 7). Actively read in `fragments.ts` as `firmnessMetafield` and used on the PDP. No `choices` validation — free-form text. Description says "Soft / Medium-Soft / Medium / Medium-Firm / Firm / Extra Firm" but nothing enforces that.
3. **`custom.firmness_score`** (number_integer 1-10, pin 16). Read as `firmnessScoreMetafield`. Renders as a marker on the PDP firmness scale.
4. **`custom.comfort_level`** (single_line_text_field, no pin, `access.storefront=NONE`). Not queried anywhere in the headless code. Description references "Plush Comfort, Medium Comfort, Firm Comfort" — a separate taxonomy from #2.

These are doing related-but-not-identical work, and they will drift. The PDP currently reads `custom.firmness` (#2) for display and `custom.firmness_score` (#3) for the visual scale. `shopify.firmness` (#1) is required for the Shopify-standard product taxonomy (needed for Google Shopping feed compatibility). `custom.comfort_level` (#4) is the duplicate to retire.

**Recommendation:**

- Keep `custom.firmness` as the user-facing firmness label (display source of truth). Add `choices` validation: `["Soft","Medium-Soft","Medium","Medium-Firm","Firm","Extra Firm"]`.
- Keep `custom.firmness_score` as the 1-10 numeric, with the existing `min:1`/`max:10` validators (already correct).
- Keep `shopify.firmness` for the Shopify taxonomy (required by Google Shopping etc.) — don't surface it in the headless directly; let Shopify Catalog manage it.
- **Delete `custom.comfort_level`** after the merchant confirms it isn't being used by an app or Shopify-side process not visible to me.

### F2. Singular/plural `sleep_position` duplicate

- `custom.sleep_position` (singular, pin 3) — never read in headless code.
- `custom.sleep_positions` (plural, no pin, access `NONE`) — read by Search & Discovery filtering (`sleepPosition` filter param in `app/_components/plp-filters/filters.ts`).

Almost certainly the singular was created first, then a plural with the corrected name was created later; the singular was never removed. **Delete `custom.sleep_position` (singular).**

### F3. `custom.description_` (trailing underscore)

A `rich_text_field` collection metafield with a trailing-underscore key — classic accidental keystroke when defining the field. Description blank. Not queried in code. **Delete.**

### F4. 12 orphan collection link/label fields

Six `custom.link1`–`link5` + `custom.link` URL fields and six matching `custom.label1`–`label5` + `custom.label` text fields. None are referenced in `app/` or `lib/`. The shape matches a common Shopify-theme banner-CTA pattern (5 promo banners per collection page) that was almost certainly carried over from the pre-headless theme era and never wired into Next.js.

**Delete all 12** unless the merchant identifies a Shopify-side dependency (e.g., a Shopify-hosted page that still uses them, or a 3rd-party app that reads them).

### F5. `custom.seo_content` (orphan but VALUABLE)

A `rich_text_field` collection metafield with a clear description: **"Rich educational content displayed below product grid for SEO (600-1000 words)"**. Definition exists. Not read in code. Has no data populated on any collection (per inspection during the audit).

This is the cleanest possible vehicle for the PLP v2 long-content slot (RFC `plp-content-layout-v2.md`). Rather than creating a new field, we **reuse this definition** for the long below-grid content. The merchant's intent was clearly to use it for that purpose — engineering just never got around to wiring it.

We do also need to consider: the Shopify `collection.descriptionHtml` (a built-in collection field, not a metafield) currently holds the long body. **Migration question for the merchant:**

- **Option A:** Reuse `custom.seo_content` for the new long-content slot. Move existing `descriptionHtml` content into `custom.seo_content` (script-migrate via Admin API), then PLP v2 reads from `custom.seo_content` (with `descriptionHtml` as fallback for a transition window).
- **Option B:** Keep `descriptionHtml` as the long-content source (zero data migration), and **delete `custom.seo_content`** definition as redundant.

Industry-standard headless practice favors **Option A** (all content in metafields with explicit semantics) but **Option B** is materially cheaper, has zero data-migration risk, and the difference is largely aesthetic since both fields render the same way to the customer. RFC v2.1 documents both as a decision for the merchant.

### F6. Missing length validation on free-text fields

The proximate symptom is the wildly variable collection `descriptionHtml` (0 → 465 words) we're fixing in the PLP RFC. The structural cause is that Shopify-native validators (`min`, `max` character counts on text fields; `choices` on enum-like fields) aren't applied to any `custom.*` text definitions. Once the new `custom.intro_short` (PLP RFC v2.1) ships with `min:300 max:600` chars, that's the model — extend to the rest of the `custom.*` text fields over time.

### F7. Inconsistent storefront access

`custom.comfort_level` and `custom.sleep_positions` have `access.storefront = NONE`. The S&D filter pipeline works for `custom.sleep_positions` (it doesn't need storefront read access for facet generation), but if the headless ever wants to read either directly, it can't. Set both to `PUBLIC_READ` for consistency with their siblings.

### F8. Pinning hygiene

Cosmetic. Once F3/F4 deletions land (12 fields removed from the pinned section), the merchant can re-pin the active collection metafields (`heading`, `seo_content`, the new `intro_short`) in a sane order without scrolling past dead pins.

---

## 5. Cleanup plan — phased, reversible

Each phase is independent. Phases 1 and 2 are **prerequisites** for the PLP RFC v2.1 implementation; phases 3–5 are general hygiene that can land anytime.

### Phase 1 — Add the new `custom.intro_short` definition (1 mutation, 0 data risk)

Create the metafield definition with `min:300 max:600` char validation, `access.storefront=PUBLIC_READ`, descriptive admin help text. No data is added or removed; the definition just becomes available for merchant editing.

### Phase 2 — Decide F5 (Option A migration vs Option B delete)

Merchant decision. Engineering can script either path. Default if no answer: **Option B (delete `custom.seo_content`)** — lower risk, same end result.

### Phase 2.5 — Pre-flight data-presence audit (new per stress-test B2)

**Blocking gate before Phase 3.** Run `scripts/seo-metafields-data-audit.mjs` to query every collection's `metafields` and produce a CSV of every `link*` / `label*` / `description_` / `seo_content` / `sleep_position` value actually populated on any of the 64 collections (or any product, for `sleep_position`). Output: `data/seo-metafields/data-audit-{timestamp}.csv`.

Reason: we've verified the **definitions** aren't read by the headless code, but we haven't verified whether the merchant has data on them that they intend to wire up later. If data is found, the merchant decides per-field:
- "I never populated this — safe to delete." → proceed to Phase 3.
- "I populated this but it's stale / superseded — safe to delete." → proceed to Phase 3.
- "I rely on this in Shopify Admin / a 3rd-party app." → drop it from the deletion list and re-audit code path.

The CSV is the **evidence trail** the merchant signs off against before any deletion runs. Read-only — script does not mutate Shopify.

### Phase 3 — Delete confirmed orphans (≤14 fields, fully reversible)

After Phase 2.5 sign-off, delete the orphans confirmed safe by the merchant:

- `custom.description_` (1) — F3
- `custom.link`, `custom.link1`–`link5` (6) — F4
- `custom.label`, `custom.label1`–`label5` (6) — F4
- `custom.sleep_position` (singular) (1) — F2

Total: **up to 14 deletions** (subject to Phase 2.5 trims). Each is a single `metafieldDefinitionDelete` mutation. The merchant can preview the impact in Shopify Admin first (Settings → Custom data → Collections), and Shopify supports a "delete definition only" mode that keeps any orphaned data on resources reachable via the API (for true recovery if needed).

### Phase 4 — Resolve firmness duplication (F1)

Add `choices` validation to `custom.firmness`. Delete `custom.comfort_level` after merchant confirms no Shopify-side dependency.

### Phase 5 — Storefront-access consistency (F7)

Flip `custom.comfort_level` (if it survives Phase 4) and `custom.sleep_positions` to `PUBLIC_READ`.

### Phase 6 — Re-pin (F8)

Cosmetic; after Phase 3 deletions, repin the surviving collection fields cleanly. Recommended final pin order (stress-test N1):

| Pin | Field | Reason |
|---|---|---|
| 1 | `custom.heading` (existing) | Most-edited collection field per merchant pattern; surface first. |
| 2 | `custom.intro_short` (new — PLP v2.1) | New short above-grid intro; pin near the top so merchant edits are 1-click. |
| 3 | `custom.seo_content` (only if kept per F5 Option A) | Below-grid long content. **If Option B is chosen (default), this pin slot drops away and `intro_short` keeps pin 2.** |

Pinning is a single `metafieldDefinitionUpdate` per field. Cosmetic only — does not change which fields are queryable or how data is stored.

---

## 6. The audit query (reproducibility)

The single GraphQL query that powered this audit, runnable by any team member with `read_metaobject_definitions` + `read_products` scopes:

```graphql
query AuditAll {
  productDefs:    metafieldDefinitions(first: 100, ownerType: PRODUCT)        { nodes { id namespace key name type { name } pinnedPosition description validations { name value } access { admin storefront customerAccount } } }
  collectionDefs: metafieldDefinitions(first: 100, ownerType: COLLECTION)     { nodes { id namespace key name type { name } pinnedPosition description validations { name value } access { admin storefront customerAccount } } }
  pageDefs:       metafieldDefinitions(first: 100, ownerType: PAGE)           { nodes { id namespace key name type { name } } }
  articleDefs:    metafieldDefinitions(first: 100, ownerType: ARTICLE)        { nodes { id namespace key name type { name } } }
  variantDefs:    metafieldDefinitions(first: 100, ownerType: PRODUCTVARIANT) { nodes { id namespace key name type { name } } }
  shopDefs:       metafieldDefinitions(first: 50,  ownerType: SHOP)           { nodes { id namespace key name type { name } } }
  metaobjectDefs: metaobjectDefinitions(first: 50)                            { nodes { id type name fieldDefinitions { key name type { name } required validations { name value } } } }
}
```

To re-audit after cleanup: re-run this query, diff against a saved baseline. Could be wrapped into a `scripts/seo-metafields-audit.mjs` script following the same pattern as the other `scripts/seo-*.mjs` files if recurring audits are wanted.

---

## 7. Sources + industry standards

The cleanup rules above conform to the following references. Anywhere a recommendation deviates from a cited norm, the rationale is given.

- [Shopify Dev Docs — About metafields](https://shopify.dev/docs/apps/build/metafields) (authoritative)
- [Shopify Dev Docs — Data modelling with metafields and metaobjects](https://shopify.dev/docs/apps/build/metaobjects/data-modeling-with-metafields-and-metaobjects) (authoritative — covers when to use metafield vs metaobject; metaobject = repeatable structured content with multiple fields; metafield = single data point on an existing resource)
- [Jillur Rahman — Shopify Metafields & Metaobjects: A Developer's Guide (2026)](https://jillur.vercel.app/blog/shopify-metafields-metaobjects)
- [Replo — Shopify Metafields: Everything You Need To Know](https://www.replo.app/blog/shopify-metafields)
- [smplx — Shopify Metaobjects: When, Why & How (2026)](https://smplx.media/en/wissen/shopify-metaobjects-erklaert)
- [MESA — Shopify Metafields Complete Guide (2026)](https://www.getmesa.com/blog/shopify-metafields/)
- [Base2Brand — Metafields vs Metaobjects in Shopify](https://www.base2brand.com/blog/metafields-vs-metaobjects-in-shopify)
- [Searchanise — Comprehensive Shopify Metafields Guide (2026)](https://searchanise.io/blog/shopify-metafields/)
- [Skailama — Shopify Metafields Complete 2026 Guide](https://www.skailama.com/blog/the-complete-guide-to-shopify-metafields)

Key industry consensus the audit applies:

1. **Use `custom` namespace** for merchant-defined fields. Avoid app-namespace creation.
2. **Use validators** (`min`, `max`, `choices`, etc.) to enforce data shape at the Shopify layer, not at the rendering layer.
3. **Prune unused definitions** — Shopify caps at 200 metafields per resource; orphans clutter admin UI and confuse future engineers.
4. **Set `access.storefront = PUBLIC_READ`** consistently for any field the headless might read; reserve `NONE` for genuinely admin-only fields.
5. **Use metaobjects for repeatable structured content** (multiple fields per entry); use metafields for single data points on existing resources.
6. **Pin actively-used fields** to the top of the admin UI; un-pin everything else.

---

## 8. Decisions needed from merchant before any cleanup mutation runs

| # | Decision | Default |
|---|---|---|
| C1 | Approve Phase 3 deletions (up to 14 orphan fields) **after** reviewing the Phase 2.5 data-presence CSV. Reversible — Shopify keeps the definitions deletable but data on resources persists by default unless explicitly purged. | yes, pending Phase 2.5 CSV |
| C2 | **F5 / Phase 2:** Option A (migrate `descriptionHtml` into `custom.seo_content`, all-metafield) or Option B (delete `custom.seo_content`, keep `descriptionHtml` as the long-content source). | Option B (lower risk, same UX) |
| C3 | Approve `custom.comfort_level` deletion (F1). Confirm no Shopify-side app/process relies on it. | confirm-then-delete |
| C4 | Approve adding `choices` validator to `custom.firmness` with the 6 listed values. | yes |
| C5 | Approve flipping `custom.sleep_positions` and (if it survives) `custom.comfort_level` to `access.storefront=PUBLIC_READ`. | yes |
| C6 | Approve the new `custom.intro_short` definition (depends on PLP RFC v2.1). | yes |

Each cleanup mutation can run as a single Admin API call. If approved, engineering can ship them in one batch under a `scripts/seo-metafields-cleanup.mjs` script following the same dry-run + `--apply` pattern as the existing `scripts/seo-*.mjs` family.

---

## 9. Out of scope

- **Resource-level data on metafields being deleted.** Shopify offers a "delete definition only" vs "delete definition + data" choice on definition deletion. The Phase 3 deletions default to "definition only" to keep recovery possible; if the merchant wants the actual data on resources purged too, that's a follow-on operation.
- **Search & Discovery metafield-backed filter reconfiguration.** Adding `choices` validators to `custom.firmness` may require updating the corresponding S&D filter rule. Engineering will flag this in the implementation PR if applicable.
- **Storefront API field-by-field caching strategy.** Pulling fewer metafields per query (after Phase 3) marginally reduces Storefront API cost and PLP TTFB. Not measured here — out of scope.
