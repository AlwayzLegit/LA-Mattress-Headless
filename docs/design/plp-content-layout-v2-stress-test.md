# Stress-test of RFC v2.1 + metafields audit (pre-implementation review)

**Date:** 2026-05-20.
**Author:** Engineering (self-review).
**Scope:** Critical pre-implementation review of `plp-content-layout-v2.md` (v2.1) + `shopify-metafields-metaobjects-audit.md`. Goal is to surface gaps, risks, or improvements **before** any Shopify mutation or code change lands.

Findings are graded **BLOCKER** (must resolve before implementation), **SHOULD-FIX** (fix before merge), or **NICE-TO-HAVE** (queue for follow-up). Each finding has a concrete remediation.

---

## Summary

| Severity | Count | Categories |
|---|---|---|
| BLOCKER | 3 | Validator math, deletion safety, feature-flag SSR cohort |
| SHOULD-FIX | 6 | Heading hierarchy, fallback duplication, sequencing, sanitizer behavior on H1, ISR revalidation, telemetry conversion metric |
| NICE-TO-HAVE | 4 | Pin position, sibling-nav visuals, LCP-element check, decisions table format |

The RFC is structurally sound and aligned to industry norms. The fixes below are tactical — none change the core direction (metafield-with-fallback + audit cleanup).

---

## BLOCKER findings

### B1. Validator math is wrong — `300-600 chars ≠ 60-80 words`

**Current spec (RFC §5.1):** `min:300 max:600` chars described as "≈ 60-80 words at 5 chars/word average". Industry citation is the 50-100 word band.

**Reality:** English averages **~4.7 chars/word + 1 space ≈ 5.7 chars/word**. So:
- 300 chars ≈ **53 words** (lower end of industry band ✓)
- 600 chars ≈ **105 words** (slightly above industry band — minor)

The 60-80 word claim is wrong; the actual range is **53-105 words**. That's still within the industry sweet spot, but the description in the metafield definition (which merchants will read in the admin UI) misleads.

**Remediation:** Either
- (a) Keep `min:300 max:600` chars but rewrite the description as "Target ~55-100 words / 300-600 characters" — accurate and matches industry; or
- (b) Tighten to `min:300 max:500` chars (~55-90 words) to match the cited 50-100 sweet spot more precisely.

Recommend (a) — wider band gives merchants flexibility, no engineering reason to clip.

### B2. Phase 3 deletions (14 fields) need a data-presence check first

**Current spec (audit §5 Phase 3):** Delete 14 collection metafield definitions in a single batch via `metafieldDefinitionDelete`. Default to "delete definition only" so any data on resources persists.

**Risk:** We've verified the **definitions** aren't queried in headless code. We have **not** verified whether the merchant has populated data on those fields on any of the 64 collections. If they have (e.g., a banner CTA they edited last year that's still scheduled to be wired up someday), the deletion silently strands the data — recoverable, but unobservable in the admin UI after deletion.

**Remediation:** Before any `metafieldDefinitionDelete`, run a read-only audit script that queries `metafields(first: 250, namespace: "custom") { edges { node { key value } } }` on every collection, and outputs a CSV of every `link*`/`label*`/`description_`/`seo_content` field that actually has a non-empty value. Merchant reviews the CSV before approving deletion. Add this as a new step (Phase 2.5 or an explicit "audit-before-delete" pre-flight) in the cleanup plan.

The PR shipping the deletions should include the pre-flight CSV as evidence the merchant had visibility before sign-off.

### B3. Feature flag rollout via `NEXT_PUBLIC_*` env var can't do 10/50% cohort splits

**Current spec (RFC §8):** "10% (Vercel split / Edge Middleware A/B)" via `NEXT_PUBLIC_PLP_LAYOUT_V2`.

**Problem:** A `NEXT_PUBLIC_*` env var is a build-time constant baked into the bundle. It's binary across all visitors (everyone gets v1 or everyone gets v2) — you cannot do a percentage split with this mechanism alone. The §8 phasing table assumes cohorting that the suggested mechanism can't deliver.

**Remediation:** Two cleaner paths:
- **(a) Vercel Edge Middleware** — set a sticky `plp_v2` cookie based on a hash of the visitor ID (so the same user sees the same layout across pageviews and across the session). Edge middleware reads the cookie and forwards either to the v1 or v2 SSR. Concrete cohort split (10% / 50% / 100%) is the cookie's bucket boundary.
- **(b) Skip cohorting entirely** — given the layout swap is reversible in 1-3 minutes via Vercel instant-rollback (RFC §9), and the test plan §7.1 + cowork verification cover the manual smoke surface, a **canary deployment to a preview URL** (full layout, no cohorting) reviewed for 24-48h, then 100% production cutover, is materially simpler. The added safety of cohorting is small relative to the operational complexity it adds.

Recommend **(b)** — preview canary + instant-rollback if anything regresses. Keep cohorting as a fallback if the merchant explicitly wants it. Update §8 to reflect.

---

## SHOULD-FIX findings

### S1. Long-body content moved below grid may clash with `<PlpContentBlock>` H2

`PlpContentBlock` already emits an `<h2 class="h2 plp-content-title">` (`plp-content-block.tsx:43`). Several of the 6 long-body collections (e.g. `stearns-foster-mattresses`, `medium-firm-mattresses`) contain their own H2 or H3 headings inside `descriptionHtml`. Moving that HTML into the same block as the existing H2 will create **competing H2s** at the same logical level, which (a) confuses screen-reader hierarchy and (b) breaks the page outline algorithm.

**Remediation:** In `<PlpContentBlock>`, when `descriptionHtml` is rendered:
- Demote merchant H1s and H2s by one level (`sanitizeShopifyHtml` already strips H1s; extend it to also rewrite H2 → H3 inside `descriptionHtml` rendered below grid), OR
- Wrap merchant HTML inside a section with its own H2 (e.g. "About {collection.title}") and let the merchant content's H2s become H3-equivalent via styling rather than tag.

Test the chosen approach on `stearns-foster-mattresses` (465w, has H2s) and `medium-firm-mattresses` (399w) before merging.

### S2. Fallback duplication across collections — duplicate-content risk

`categoryIntroFor()` uses substring-cascade. If 12 brand-prefixed collections all hit `if (h.includes('tempur'))`, they all get the **same** ~70-word paragraph. Indexed at scale, Google sees identical above-the-fold copy across multiple PLPs — exactly the "duplicated manufacturer text" antipattern cited in §1's Google guidance.

Looking at the cascade (`lib/plp-content.ts:301-361`):
- 5 brand patterns (tempur, stearns+foster, helix, southerland/scandinavian, englander).
- 4 material patterns (memory-foam, hybrid, latex, innerspring).
- 2 accessory (adjustable, pillow).
- 1 sale.
- 3 size (queen, king, twin — these are slightly handle-specific via `${title}`).
- 1 generic.

That's **15 templates for 64 collections**. Up to 8 collections could share the `tempur` template if there are multiple Tempur sub-PLPs (sale, by-size, etc.). Worst-case: 5-10 PLPs sharing identical above-the-fold paragraphs.

**Remediation:** Either
- (a) Make the substring cascade more specific — vary by sub-category (e.g. tempur-pedic-mattresses vs tempur-pedic-pillows vs tempur-pedic-bases), OR
- (b) Rely on the backfill helper (RFC §6.3) to fill `custom.intro_short` for every collection so the fallback is the exception, not the rule. The backfill script should generate **handle-specific** copy (interpolating the actual collection title into the template) rather than dumping the bare template.

Recommend **(b)** — ship the backfill helper as part of the v2 launch (not optional, as the RFC currently flags it). Add a guardrail: the backfill script must produce copy that varies per handle (not the same template applied 5 times).

### S3. Sequencing of the four shipping steps not explicit

The RFC describes the work but doesn't pin the order. The correct sequence is non-obvious:
1. **Shopify:** create `custom.intro_short` definition (Phase 1 of audit).
2. **Shopify:** create the audit Phase 3 backup CSV (see B2) — optional but recommended.
3. **Shopify:** delete the 14 orphans (Phase 3 of audit) once merchant approves CSV.
4. **Code:** ship the layout change behind feature flag (or to preview-canary). At this stage `custom.intro_short` is defined but empty, so every collection renders the fallback. **The site is in a valid state at this point.**
5. **Shopify:** run the backfill script to populate `custom.intro_short` on every collection (optional but recommended — addresses S2).
6. **Production cutover:** enable v2 layout 100%.

**Reversibility at each step:** 1+3 are reversible via re-create (definition only). 4 is reversible via Vercel rollback. 5 is reversible by emptying the metafield.

**Remediation:** Add an explicit Phase 0 sequencing diagram to the RFC §8, with step-by-step go/no-go gates between each.

### S4. `sanitizeShopifyHtml` H1 stripping is not verified

The RFC §6.2 says `<PlpContentBlock>` will render `descriptionHtml` via `sanitizeShopifyHtml` + `dangerouslySetInnerHTML`. Best practice for SEO: every page has exactly one H1 (the collection title on PLPs). If `sanitizeShopifyHtml` doesn't strip stray H1s in `descriptionHtml`, the page can end up with multiple H1s.

**Remediation:** Add a single check before merging — `grep -n "h1\|stripH1\|removeH1" lib/sanitize.ts` and verify the sanitizer drops any H1 element from arbitrary Shopify HTML. If not, add it as a small extension to `sanitize.ts`. Add a unit test if there isn't one.

### S5. ISR revalidation not documented for merchant edits

`lib/shopify/client.ts:63` sets `revalidate: 600` (10 min) by default for all Shopify fetches. When the merchant edits `custom.intro_short` in admin, the storefront caches the old value for **up to 10 minutes** before the next ISR refresh picks it up. This is identical to the current `descriptionHtml` behavior, so it's not a regression — but the merchant will likely not know this.

**Remediation:** Add a one-line note to the RFC §8 (or to `docs/seo-shopify-runbook.md`) that "intro changes take up to 10 minutes to appear on production". Optional follow-up: add a tag-based `revalidateTag('collections')` hook that the merchant can trigger from the admin UI (out of scope for v2.1).

### S6. Telemetry conversion metric is unspecified

RFC §8 phase-1 exit criteria: "Conversion within ±5% of v1." But conversion happens **downstream** of the PLP (PDP → cart → checkout). The metric needs concrete attribution:

- PLP-level proxies: PLP→PDP clickthrough rate, PLP scroll depth, time-on-page.
- True conversion: add-to-cart rate on PDPs **whose referrer is a v2 PLP** vs v1 PLP.

The RFC implies the latter but doesn't say so. Without that, the criteria can't be evaluated.

**Remediation:** Lock the metric explicitly in §8.1: the GA4 `plp_layout_render` event already carries `layout` (v1/v2), so the comparison is "add-to-cart rate among sessions where `plp_layout_render` fired with `layout=v2` vs `v1`". Specify ±5% as relative, not absolute.

---

## NICE-TO-HAVE findings

### N1. Pin position for `custom.intro_short` not specified

RFC §5.1 says `pin: true` without a position. After audit Phase 3 deletes 14 collection metafields, pin positions 1-14 will have gaps. Specify the new pin order for the surviving + new fields:

| Pin | Field |
|---|---|
| 1 | `custom.heading` (existing) |
| 2 | **`custom.intro_short`** (new) |
| 3 | `custom.seo_content` (if kept per F5 Option B's alternative) OR removed entirely |

Add this to the audit doc Phase 6.

### N2. Sibling-nav visual flow with shorter hero

The collection page has a sibling-nav row between hero and grid (`SiblingNav` in `app/collections/[handle]/page.tsx`). With v1, the hero is ~150-465 words. With v2, the hero shrinks to ~55-100 words. The sibling-nav row may now visually float in white space.

**Remediation:** Eyeball during the manual smoke pass (§7.1). If it looks empty, tighten `.plp-hero` margins. Not a blocker — purely visual.

### N3. LCP-element verification

RFC §1 / §3.1 claims that the long descriptionHtml above the grid is "pushing the LCP candidate below the fold." Worth verifying — the actual LCP element on PLP pages today may be the hero `<img class="plp-hero-img">`, in which case shortening the text above it doesn't change its position. The benefit may be smaller than claimed (or larger if the LCP element is actually a product card image).

**Remediation:** Add a 5-minute pre-rollout check using Chrome DevTools Performance panel on `stearns-foster-mattresses` (the worst case at 465w) to confirm what the LCP element is today. Document the result. If it's already the hero `<img>`, refine the RFC's expected benefit (still net positive on layout shift + text below image, but smaller LCP win).

### N4. Decisions tables in two docs lack a shared merchant-checklist view

D1-D9 (RFC) + C1-C6 (audit) = **15 decisions across 2 documents**. The merchant has to read both to act. A consolidated 1-page checklist would be more actionable.

**Remediation:** Add a new `docs/design/plp-v2-merchant-decisions.md` that aggregates all 15 decisions with defaults + one-checkbox approvals. Link from both source docs. Optional.

---

## What's good (no change needed)

- Industry citations (§4) are well-researched and authoritative.
- Reversibility story (RFC §9, audit §5) is genuinely robust — three rollback paths, no destructive operations.
- The metafield-with-fallback architecture (v1 → v2.1 pivot) is correct for headless commerce; v1's code-driven approach was the wrong call and v2.1 fixes it properly.
- Test plan §7 covers pre-merge, post-deploy CWV, SEO non-regression, accessibility — all four bases.
- The audit's identification of `custom.seo_content` as a defined-but-unused field directly relevant to this RFC (F5) shows the audit-first approach paid off — without it, we'd have created a redundant new field.
- Decision matrix in RFC §5 honestly weighs all three options including the rejected ones.

---

## Proposed action sequence

1. **Apply blocker fixes** to both docs:
   - B1: rewrite the validator description (~5 minutes).
   - B2: add a pre-flight data-presence audit step + script (~30 minutes script work).
   - B3: simplify the rollout to preview-canary + instant-rollback (~5 minute doc edit; removes cohort middleware work entirely).
2. **Apply should-fix items** to docs:
   - S1: extend `sanitizeShopifyHtml` to demote merchant H2 → H3 inside `<PlpContentBlock>`.
   - S2: ship the backfill helper as **required**, not optional. Backfill must produce handle-specific copy.
   - S3: add explicit sequencing diagram.
   - S4: verify sanitizer strips H1.
   - S5: one-line ISR revalidation note.
   - S6: lock GA4 metric definition.
3. **Run B2's pre-flight audit script** against the live store — concrete CSV of any data on the 14 to-be-deleted fields.
4. **Pause for merchant approval** of the consolidated decisions (N4's optional checklist will help here).
5. **Implement** — Shopify mutations → code change → backfill → preview canary → 100%.

Total additional work introduced by this stress-test: **~2-3 hours** (script + 4 small doc edits + 1 sanitizer extension). Worth it for the deletion safety net (B2) and the validator-description accuracy (B1) alone.

---

## Files this stress-test recommends changing

- `docs/design/plp-content-layout-v2.md` — apply B1, B3, S3, S5, S6.
- `docs/design/shopify-metafields-metaobjects-audit.md` — apply B2, N1.
- `lib/sanitize.ts` — apply S1, S4 (when implementation starts).
- `scripts/seo-metafields-data-audit.mjs` (new) — apply B2.
- `scripts/seo-backfill-collection-intro-short.mjs` (new) — apply S2 with handle-specific generator.
- `docs/design/plp-v2-merchant-decisions.md` (new, optional) — apply N4.
