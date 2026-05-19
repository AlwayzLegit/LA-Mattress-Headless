# SEO Recovery Verification — post-#182/#183

**Verdict: regressions introduced by #182/#183 — NO. Ship-clean.**

| | |
|---|---|
| Production SHA | `1b631b1533b75ee5699179b63297b0133875180c` |
| Commit | "SEO recovery: P0 cannibalization prune + full-bed 301 consolidation (#183)" |
| Vercel deployment | `dpl_BRwJYSV8hogjsHxsmf4zD9asQTw7` · READY · target=production · ref=main |
| Includes | #182 (SEO plan refresh + prune-list docs) + #183 (28 new 301s + 11 noindex + de-chained full-bed entry) |
| Verified by | cowork (read-only: live HTTP, Shopify, Sentry, Vercel; repo read via raw.githubusercontent at SHA 1b631b15) |
| Date | 2026-05-19T07:05:13Z |

## Suite roll-up

| Suite | Result |
|---|---|
| **A. Redirects** (28 new + 1 de-chained) | **29/29 pass.** Every source: single-hop 308 → documented destination → 200. De-chain explicitly verified: `…/is-a-full-bed-wide-enough-for-two-sleepers` → `/blogs/…/full-vs-queen-mattress` in **one** hop (not via `full-size-bed-dimensions-width-couples`). |
| **B. Noindex** (11 articles) | **11/11 pass.** Each emits `<meta name="robots" content="noindex, follow">` (follow intact) and is absent from sitemap. |
| **C. Sitemap integrity** | **Pass.** 971 `<loc>` entries; 0 of the 29 redirect sources present; 0 of the 11 noindex URLs present; all 9 named winners present; random 5/5 are 200. |
| **D. Host / canonical / robots** | **Pass.** Apex → single 308 → www; www root 200; www `robots.txt` open + lists the www sitemap; `la-mattress.myshopify.com` 301s to checkout host (`x-redirect-reason: primary_domain_redirection`); `checkout.*` `robots.txt` carries the merchant `User-agent: * / Disallow: /` block (verified verbatim). |
| **E. Winners / KEEP** | **12/12 effectively pass.** All KEEP pages 200 + indexable + in sitemap. The one apparent failure (`is-a-full-bed-wide-enough-for-two-sleepers` — 308, not in sitemap) is the brief's named de-chained 301 case; doc lagged the decision → finding **F1**. |
| **F. Internal-link resolution** | **Pass.** 9 high-traffic pages × full 1,128-entry redirect-source set: 0 in-body hrefs hit a redirect source. `sanitize.ts` render-time pass working. |
| **G. Schema regression** | **Pass.** Home / PDP / PLP / article (`full-vs-queen-mattress`) / showroom: each `ld-*` id appears once, 0 parse errors, no JSON-LD trapped. No regression vs prior baseline. |
| **H. Twin collection** | **Functional pass, minor copy finding.** `/collections/twin` → `/collections/twin-size-mattresses` 308 → 200; 3 target internal links present + all 200; rendered `plp-content-intro` lede is 38 words vs brief's ~170 expectation → finding **F2**. |
| **I. Semrush T0** | **Not runnable** in this session (no Semrush surface). Recommended T0 capture procedure handed to the team member with Semrush access. T+30 = **2026-06-18**. |
| **J. Optional enrichment** | **ABSENT, as expected** — `<h2 id="standard-full-bed-size">` not on `full-vs-queen-mattress` (merchant paste pending — known-not-defect). |
| Sentry + Vercel | 0 new first-party errors since #183. Third-party noise unchanged. |

## Findings (neither blocks ship)

- **F1 (minor, doc):** `docs/seo-prune-list.md` Cluster-A KEEP table listed
  `is-a-full-bed-wide-enough-for-two-sleepers` as KEEP; the implemented
  decision in `redirects.json` is a 301 to the hub (per the dd97b0c
  follow-up). **Proposed fix:** move the row to the 301 →
  `full-vs-queen-mattress` table.
  → **Resolved 2026-05-19** (row moved + footnote added).
- **F2 (minor, copy):** twin `plp-content-intro` lede is 38 words; the
  brief expected ~170. The 3 target internal links + targets all 200;
  functionally fine.
  → **Resolved/clarified 2026-05-19:** the ~170-word copy *is* live in
  the `plp-hero-lede` (Shopify `descriptionHtml`,
  `app/collections/[handle]/page.tsx:175`); the 38-word element is the
  separate, pre-existing code block (`lib/plp-content.ts`), now tightened
  toward the twin / twin-XL near-miss intent. Not a defect.

## Constraint disclosure

No repo-write access from the cowork session. Source-of-truth files
(`data/url-inventory/redirects.json` 1,128 rows · `lib/noindex-articles.ts`
· `docs/seo-prune-list.md` · `app/sitemap.ts` · `app/robots.ts` ·
`lib/site-config.ts` · `lib/sanitize.ts`) read via `raw.githubusercontent.com`
at SHA 1b631b15, then probed live. No code, data, Shopify content,
redirects, themes, or settings were modified by cowork.

## Recommended Semrush T0 capture (for the team member with access)

Run at the current production SHA to anchor the T+30 (2026-06-18) recovery check:

- `domain_rank` (US) — organic keywords / traffic / authority snapshot
- `domain_organic display_positions=lost` (sort `nq_desc`) — watchlist:
  "full mattress size" (6,600), "how big is a full size mattress" (6,600),
  "how much does a mattress cost" (4,400), "diamond mattress" (1,900)
- `domain_organic_unique` filtered to the full / queen / cal-king cluster
  slugs — confirm signal consolidating onto single canonical URLs

Success at T+30 = the lost high-volume size terms re-enter the SERP on a
**single** canonical URL (not split 2–3 ways) and the Apr→May rebound continues.
