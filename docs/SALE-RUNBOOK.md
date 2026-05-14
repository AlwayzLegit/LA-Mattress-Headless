# Sale launch runbook

This runbook covers the end-to-end procedure for launching a sale event on
mattressstoreslosangeles.com — Memorial Day, July 4th, Labor Day,
Black Friday, etc.

Time per sale once you know the steps: **~15 minutes**. No code, no deploy,
no engineer needed.

## What you control from Shopify Admin

| Surface | Where to edit | What it does |
|---|---|---|
| Top-of-page banner | Content → Metaobjects → Announcement bar → `default` entry | Replaces the trust strip with sale messaging across every page |
| Homepage hero takeover | Content → Metaobjects → Hero slide → entries | Swap or add sale-themed hero slides for the duration |
| Sale landing page | Online Store → Pages | Dedicated `/pages/your-sale-name` page with sale layout |
| Sale collection | Products → Collections | Tag-based smart collection that auto-populates products on sale |
| Featured sale on PDPs / PLPs | Tag products with `on-sale` | Standard product tagging; the on-sale collection picks them up |

## Step-by-step: launching a sale

### 1. Tag the sale products (5 min)

Shopify Admin → Products → bulk-select the mattresses on sale → "Add tags" → add tag
`memorial-day` (or whichever event tag you prefer). You can layer multiple tags;
the `on-sale` collection picks up anything with the `on-sale` tag, and the
event-specific tag lets you build a focused event collection.

### 2. Create (or update) the sale collection (2 min)

Shopify Admin → Products → Collections → "Create collection"

- Title: "Memorial Day Sale"
- Handle: `memorial-day-sale` (this becomes `/collections/memorial-day-sale`)
- Type: Smart collection
- Rules: tag equals `memorial-day`
- Save

The collection auto-populates with every product you tagged in step 1.

If you'd rather just use the existing `/collections/on-sale` collection,
you can skip this step — just ensure each sale product has the `on-sale` tag.

### 3. Create the sale landing page (5 min)

Shopify Admin → Online Store → Pages → "Add page"

- Title: "Memorial Day Sale 2026" (or whatever the year)
- URL handle: `memorial-day-sale-2026`
  - **The handle pattern matters.** Any page with `sale`, `memorial-day`,
    `labor-day`, `presidents-day`, `july-4`, `black-friday`, `cyber-monday`,
    `christmas`, `clearance`, etc. in the handle automatically gets the
    full-bleed sale layout (see `app/pages/[handle]/page.tsx` →
    `SALE_HANDLE_PATTERNS`).
- Content: write the sale-specific copy. Include:
  - A short hero paragraph explaining the offer (becomes `bodySummary` on the page)
  - Sale terms (discount %, dates, exclusions)
  - Featured deals (link to specific products)
  - A "Shop the Sale" CTA pointing at the collection from step 2
- Search engine listing: write a custom meta title + description for SEO
- Save

The page is live at `/pages/memorial-day-sale-2026` immediately.

### 4. Turn on the announcement bar (1 min)

Shopify Admin → Content → Metaobjects → Announcement bar → `default` entry

- `enabled`: true
- `message`: e.g. "Memorial Day Sale — Up to 60% off all mattresses through Monday."
- `cta_label`: e.g. "Shop the Sale"
- `cta_href`: `/collections/memorial-day-sale` (or `/pages/memorial-day-sale-2026`)
- `style`: `accent` (use `urgent` for the final 48 hours — that turns it red)
- `starts_at`: optional. Set to midnight on the sale start date if you want
  it to auto-activate. Otherwise leave blank and toggle `enabled` manually.
- `ends_at`: optional. Set to the sale end datetime if you want it to
  auto-deactivate. Otherwise toggle `enabled` manually.
- Save

The bar appears sitewide within seconds (webhook-revalidated, not the
5-minute fallback).

### 5. Swap homepage hero slides (3 min)

Shopify Admin → Content → Metaobjects → Hero slide → "Add entry"

Create 1–3 Memorial Day-themed slides:

- `display_order`: 1 (and 2, 3 if more slides — lower numbers appear first)
- `enabled`: true
- `eyebrow`: e.g. "Memorial Day Event"
- `title`: e.g. "Up to&#10;60% off." (use newlines for visual line breaks)
- `body`: subhead paragraph, 1-2 sentences
- `bg_image`: upload the Memorial Day hero photo (1920×1080 recommended)
- `bg_image_alt`: alt text for accessibility
- `primary_label`: "Shop the Sale"
- `primary_href`: `/collections/memorial-day-sale`
- `primary_icon`: `arrow-right` (or leave blank)
- `secondary_label`: "See all deals" (or similar)
- `secondary_href`: `/collections/on-sale`
- `accent`: true (gives the slide the sale-event color treatment)
- `starts_at`: optional auto-show datetime (e.g., Friday midnight)
- `ends_at`: optional auto-hide datetime (e.g., Tuesday midnight)
- Save

Optionally: disable existing default hero slides for the sale window so the
sale slides take full takeover. Find the default entries → set
`enabled: false` (or set their `ends_at` to before the sale starts).

### 6. Verify

Visit the live site:

- Homepage should show the new hero slides
- Announcement bar should be visible at the top of every page
- `/pages/memorial-day-sale-2026` should render with the full-bleed
  navy sale-page layout (big title, lede, "Shop the Sale" + "Find a
  showroom" CTAs)
- `/collections/memorial-day-sale` should list the products you tagged

## Ending the sale

If you set `ends_at` on the announcement bar and hero slides, **they auto-hide
at the right time**. No action required.

If you didn't set `ends_at`, manually:

1. Announcement bar → `enabled: false`
2. Sale-themed hero slides → `enabled: false` (and re-enable the default
   slides if you disabled them)
3. The sale landing page can stay published indefinitely — Google indexes
   it, and you can use it next year by changing the title/year/content.
   Or unpublish it via Online Store → Pages → uncheck "Visible".

## Reusing for next year

For annual sales (Memorial Day, Black Friday, etc.) the smart approach is:

1. **Don't delete last year's announcement bar entry** — duplicate it,
   update the year + dates, and use the duplicate. You build up a library.
2. **Don't delete the previous year's hero slides** — set `enabled: false`
   and `ends_at` in the past. They sit dormant until you need a similar
   theme. Duplicate the entry for the new year with updated `display_order`,
   `starts_at`, and `ends_at`.
3. **The sale landing page** can be reused. Update the title to include
   the new year, refresh the copy, save. The URL handle can stay the same
   (preserves SEO) or you can create a new page with a year-specific handle.

## What you don't have to do per sale

- Write code
- Deploy
- Coordinate with engineering
- Touch any of these:
  - The shop's brand identity (logo / slogan / OG image — those live in
    Settings → Store details → Brand, separately from sale assets)
  - Mattress product pages (PDPs)
  - The PLP layouts
  - The site's color theme
  - robots.txt or sitemap.xml

## What can break and how to spot it

- **Hero slide doesn't appear**: check `enabled: true` AND `starts_at` is
  in the past AND `ends_at` is in the future (or blank).
- **Announcement bar doesn't appear**: same checks on the `default`
  announcement_bar entry. Plus the existing trust strip (TopBar) is hidden
  when the announcement is active — that's expected.
- **Sale page renders with default CMS layout instead of full-bleed
  hero**: the handle doesn't match `SALE_HANDLE_PATTERNS`. Either rename
  the page handle to include `sale`/`memorial-day`/`black-friday`/etc.,
  or ask engineering to add the new pattern to that constant.
- **Image looks pixelated**: re-upload at 1920×1080 minimum. Shopify
  CDN scales down but doesn't scale up.

## Quick-reference timing diagram

```
Friday 12:01 AM         starts_at fires on announcement_bar + sale hero slides
  ↓
  → Site auto-shows sale takeover
Monday 11:59 PM         ends_at fires
  ↓
  → Site auto-reverts to default look
```

This works because we have a Shopify webhook → `/api/revalidate` wired
up. As soon as you save in Admin (or as the timestamps tick over),
Next.js's ISR cache invalidates and the live site reflects the change
within seconds.

## When in doubt

- Test the changes in Shopify Admin's "Preview" mode if available (some
  metaobject editors don't have a preview — saving immediately publishes).
- If you make a mistake live, toggle `enabled: false` on whatever's wrong;
  the site reverts within seconds.
- The default fallback content (trust strip, original 3 hero slides) is
  hardcoded in the storefront — so even if all metaobjects are misconfigured,
  the site renders something reasonable.
