# Backlinks outreach — 2026-05-28 Semrush export

Companion to `backlinks-outreach-20260528.csv`. Same source data, ranked
and broken out so the merchant has a clear order of operations.

## The bucket overall

Semrush's "Acquire backlinks from these domains" idea family resolved
to 328 unique target domains across 945 mentions. The CSV groups them
by domain and assigns a priority class:

| Class | Count | Description |
|---|---|---|
| **A-publisher** | 5 | Editorial outlets that actually publish guest content or expert quotes. Highest-ROI outreach targets. |
| **A-directory** | 2 | Curated local-business directories. Submission is the entire process. |
| **A-aggregator** | 3 | Sites that aggregate / syndicate retail content. Different submission paths per site. |
| **B-evaluate** | 295 | Not pre-classified — research each one before pursuing. The bulk of the list. |
| **B-niche** | 4 | Smaller blogs/niche sites. Lower volume but possible guest-post wins. |
| **C-competitor** | 3 | Direct competitors. Won't link. |
| **C-low-value** | 2 | Supplier directories. Marginal SEO transfer. |
| **D-noise** | 14 | Search engines, your own domain, utility apps, language mismatches. Skip. |

The merchant should work top-to-bottom on the Tier A rows — those are
the only ones with both a real backlink path AND domain authority that
moves the needle. Everything below B-niche is research-then-decide.

## Outreach templates

### Template 1 — A-publisher (guest column / expert quote)

> **Subject:** Pitch — *[Topic angle]* feature for [Publication]
>
> Hi [Editor name],
>
> I run [LA Mattress Store](https://www.mattressstoreslosangeles.com/) — five
> showrooms across Los Angeles, in business since [year]. I read
> [recent piece they published] and wanted to pitch a [piece type] you
> might find useful for [Publication]'s readers.
>
> [One-sentence pitch with a concrete angle: "Why mattress recycling
> doubled in California after the new bedding waste mandate" / "The
> bedroom-feng-shui mistakes I see every weekend in LA showrooms" /
> "What 12 years of fitting mattresses taught me about back-pain
> mattresses" — pitch ONE concrete angle, not the topic-area].
>
> Happy to draft 600–1,200 words with original photos from the
> showroom, and to include data we have from [N] customer fittings
> last year. Would that work as a starting point?
>
> Best,
> [Your name]
> [Phone] · [Email]

Sites to use this with: `designrulz.com`, `hfbusiness.com`,
`futureofpersonalhealth.com`, `weekand.com`, `eatthis.com`.

For `hfbusiness.com` (trade pub) the angle should be B2B / industry
trend; for the consumer ones (`designrulz.com`, `eatthis.com`,
`weekand.com`, `futureofpersonalhealth.com`) the angle should be
consumer-actionable.

### Template 2 — A-directory (one-shot submission)

> Apply directly via each site's submission form. Required info per
> submission:
> - Business name: LA Mattress Store
> - 5 showroom addresses + hours (lib/showrooms.ts has them)
> - Phone numbers
> - Website URL
> - Categories / tags: Mattress store · Bedding · Furniture
> - Photos of each showroom
> - Hours of operation
>
> Sites: `threebestrated.com`, `wheretobuyamattress.com`. Both audit
> annually — submission gets you in the queue for the next refresh.

### Template 3 — A-aggregator (varies per site)

- **yahoo.com (97 mentions)** — Yahoo News surfaces press-release
  syndicate content. Set up a recurring distribution via PRWeb /
  Business Wire / Cision. One $400-700 announcement gets you Yahoo
  coverage plus 100+ aggregator pickups. Best ROI when announcing a
  showroom opening, promotion, or charity partnership.
- **shopmattressondemand.com (13 mentions)** — Mattress
  price-comparison aggregator. Submit your product feed via their
  partner program (contact form on their About page).
- **redditrecs.com (3 mentions)** — Aggregates Reddit
  recommendations. The path here is to BE recommended on Reddit.
  Engage authentically in `r/Mattress`, `r/LosAngeles`,
  `r/SleepApnea` over months (no self-promotion — moderators ban for
  that; participate as a knowledgeable shop owner answering
  questions).

### What NOT to do

- **Do NOT** pay for link-building services. The remaining 295
  B-evaluate domains have a mix of legitimate sites and link farms.
  Buying placement on most of them is a Google manual-action risk.
- **Do NOT** reach out to competitor stores (Tier C). They won't link.
- **Do NOT** spend time on D-noise tier — search engines, utility
  apps, language-mismatched sites have zero SEO transfer.

## Refreshing this list

When Semrush exports a new ideas file, re-run:

```bash
# (one-time setup) save the new Semrush XLSX as CSV in Excel
python3 scripts/seo-backlinks-outreach.py path/to/semrush.csv \
  > docs/seo-audits/backlinks-outreach-YYYYMMDD.csv
```

The classification dictionary in the Python script can be extended as
new target domains appear.
