# SEO Recovery Re-Verification #2 — post-enrichment

**Two explicit verdicts:**

- **Regressions since prior pass: NO.**
- **Enrichment renders correctly on the flagship: YES.**

| | |
|---|---|
| Production SHA | `0bdae96962dcc6e9e4e92024f9fecf20d75e5a72` |
| Commit | "Record full-vs-queen enrichment as applied (live) (#185)" |
| Vercel deployment | `dpl_8a21jrigNDh6Wpi6uQgRAVJ15DUy` · READY · target=production · ref=main |
| Includes | #184 (F1/F2 closure + report filed) + #185 (doc-only enrichment record) |
| Shopify article write | `597477622013`, `updatedAt 2026-05-19T07:57:39Z` (out-of-band) |
| Findings opened this pass | **0** |
| Verified by | cowork (read-only: live curl vs canonical www; repo read via raw.githubusercontent at SHA 0bdae969) |
| Date | 2026-05-19T08:36:50Z |

## Suite roll-up

| Suite | Result |
|---|---|
| **A. Enrichment render (PRIMARY)** | **PASS.** `<h2 id="standard-full-bed-size">` ×1, between `full-mattress-dimensions` and `queen-mattress-dimensions`. Real `<table>` inside `comparison-table` (4 rows). No `&lt;h2/p/table` escape leaks. TOC has 12 entries incl. `#standard-full-bed-size` → "Standard Full Bed Size: Quick Reference". Both in-section links 200. All 12 pre-existing H2-id sections in correct order; 8 FAQ accordions; phone `(800) 962-8789`; canonical = self; no `noindex`; BlogPosting JSON-LD parses cleanly. Cache: `PRERENDER age:0` — ISR already revalidated to the new body. |
| **B. Redirects (29/29)** | All single-hop 308 → documented destination → 200. |
| **C. Noindex (11/11)** | All `noindex, follow` + absent from sitemap. |
| **D. Sitemap** | 971 entries. 0 sources, 0 noindex, all 9 winners present, random 5/5 are 200. |
| **E. Host / robots** | Apex single-308 → www → 200. www robots open. myshopify 301→checkout. checkout `Disallow:/` for `User-agent: *`. |
| **F. Internal links** | 9 high-traffic pages × 1,128-row source set = 0 in-body redirect-source hits. Enrichment's 2 links both 200. |
| **G. Schema** | 5 templates clean: each `ld-*` id appears once, 0 parse errors, no `#S:0` traps. |
| **H. Twin (hero-lede vs plp-content-intro split)** | `/collections/twin` → `/collections/twin-size-mattresses` 308→200. Hero-lede (Shopify `descriptionHtml`) ≈199 words near H1 with all 3 internal links present. `plp-content-intro` (code, `lib/plp-content.ts`) tightened to ≈58 words lower — proportionate to siblings, matches F2 closure in #184. 3 target links all 200. |
| **I. Repo / doc accuracy** | `is-a-full-bed-wide-enough-for-two-sleepers` in 301 table with † footnote ✅. "2026-05-19 — optional enrichment APPLIED (live)" section present in `seo-prune-list.md`. Prior cowork report exists at `data/cowork-reports/…20260519T070513Z.md`. `redirects.json` = 1128 rows incl. std-full-bed; 0 self / 0 dup / 0 chain. |
| **J. Semrush T0** | Not runnable in this session (no Semrush surface). Procedure restated; **T+30 = 2026-06-18**. |
| **K. Sentry + Vercel** | 0 new Sentry first-party in last 2h. 0 error logs on `dpl_8a21jrigNDh6Wpi6uQgRAVJ15DUy`. Third-party noise unchanged. |

## Constraint disclosure

Read-only pass. No code/data/Shopify/theme/setting mutations made.
Source-of-truth files (`redirects.json` 1,128 rows · `noindex-articles.ts`
· `plp-content.ts` · `app/sitemap.ts` · `app/robots.ts` ·
`lib/site-config.ts` · `lib/sanitize.ts` · `lib/article-toc.ts` ·
`docs/seo-prune-list.md`) read via `raw.githubusercontent.com` at SHA
0bdae969. Live behavior probed via curl against canonical www.

## Recommended Semrush T0 capture (T+30 = 2026-06-18)

- `domain_rank` (US) — organic keywords / traffic / authority snapshot
- `domain_organic display_positions=lost` (sort `nq_desc`) — watchlist:
  "full mattress size" (6,600), "how big is a full size mattress"
  (6,600), "how much does a mattress cost" (4,400), "diamond mattress"
  (1,900)
- `domain_organic_unique` filtered to the full / queen / cal-king
  cluster slugs — confirm signal consolidating onto single canonical URLs

Success at T+30 = the lost high-volume size terms re-enter the SERP on
a **single** canonical URL (not split 2–3 ways) and the Apr→May rebound
continues.
