# Pre-launch Cowork test plan

A complete UX / interaction / visual-polish audit script for the LA Mattress headless storefront before DNS cutover to `mattressstoreslosangeles.com`.

> **For the testing agent**: you have full deployment-testing access (real browser, mobile + desktop viewports, keyboard, screen reader) but no source access. Run every test below against the current production deployment. Report PASS / FAIL with concrete evidence (URLs visited, screenshots, error messages). When in doubt, FAIL it — false positives are cheaper than missed bugs at launch.
>
> Origin author (Claude Code session) can fix anything you flag. Group findings by severity (P0 blocker / P1 should-fix / P2 polish) in your final report.

---

## 0. Test environment

- **Browsers**: Chrome (latest), Safari (latest), one mobile browser (iOS Safari or Chrome Android)
- **Viewports to cover at minimum**:
  - 1440×900 (desktop)
  - 1024×768 (tablet)
  - 375×667 (iPhone SE / common mobile)
  - 412×915 (Android phone)
- **Network**: throttle to "Fast 3G" for one full pass to catch loading-state gaps
- **Reduced motion**: run one pass with `prefers-reduced-motion: reduce` enabled
- **Dark mode**: run one pass with `prefers-color-scheme: dark` enabled (verify nothing breaks even if site is light-only)

---

## Part 1 — Per-page interaction flows

### 1.1 Homepage `/`

Hero carousel (Phase 195 server-shell + client-island split):
- [ ] Page loads, hero is visible above the fold, slide 0 (showroom) is active
- [ ] Wait 7 seconds: slide auto-advances to slide 1 (product). Wait again → slide 2 (sale event)
- [ ] After slide 2, autoplay wraps back to slide 0
- [ ] Hover over the hero: autoplay pauses; the active dot's progress-fill animation pauses
- [ ] Move mouse off: autoplay resumes
- [ ] Click pause button (top-right of hero): autoplay stops, icon changes to play
- [ ] Click each dot manually: hero jumps to that slide
- [ ] Tab to a dot: focus ring visible. Arrow Left/Right cycles slides + dots. Home/End jumps to first/last
- [ ] Tab into a hero CTA button: autoplay pauses (Phase 195 focus-pause). Shift+Tab out: autoplay resumes
- [ ] Counter shows "01 / 03", "02 / 03", "03 / 03" correctly

Below hero:
- [ ] Trust strip / category tiles / brand strip / quiz teaser / popular products / showrooms / reviews / FAQ render in order without layout shift
- [ ] Popular products section: product cards have images (not just placeholders), prices, brand labels
- [ ] Showrooms section: 5 cards, "Open now" badge accurate (current LA time)
- [ ] FAQ section: clicking a question expands its answer (`<details>` native). Multiple can be open at once
- [ ] Footer renders fully with newsletter input + legal links

### 1.2 PLP `/collections/mattresses` (and any other collection)

Initial paint:
- [ ] First 3 cards above the fold have images loaded eagerly (network panel: `priority` / `fetchPriority="high"`)
- [ ] Cards 4+ lazy-load as you scroll
- [ ] Toolbar shows "Showing N of 169 mattresses" (or similar — N matches grid count; total matches inventory)
- [ ] Sort dropdown defaults to "Featured"

Sort:
- [ ] Click sort dropdown, select "Price: low to high": URL updates with `?sort=PRICE`, grid re-orders, cheapest first
- [ ] Select "Price: high to low": URL `?sort=PRICE-r`, most expensive first
- [ ] Select "Newest": URL `?sort=CREATED-r`
- [ ] Sort change resets the page (no "load more" pagination persists across sort changes)

Filters (desktop):
- [ ] Click a vendor filter (e.g. Tempur-Pedic): URL gets `?vendor=Tempur-Pedic`, grid filters
- [ ] Add a second filter (e.g. size=Queen): URL `?vendor=Tempur-Pedic&size=Queen`, grid narrows further
- [ ] "Active filters" row shows pills for each active filter
- [ ] Click X on a pill: that filter removes from URL, grid re-expands
- [ ] "Clear all" button: URL drops all filter params

Filters (mobile <768px):
- [ ] Filter button visible in toolbar
- [ ] Tap it: drawer slides in from left, body scroll locks
- [ ] Tap a filter → tap Apply → drawer closes, grid updates
- [ ] Tap X / scrim / press Esc: drawer closes without applying
- [ ] Focus returns to filter button after close

Load more (Phase 217, the original bug):
- [ ] Click "Load more" at the bottom of the grid
- [ ] Existing cards stay in place. No page navigation. No scroll jump.
- [ ] A row of skeleton cards appears below the existing grid while fetching (Fast 3G makes this visible)
- [ ] After fetch: new product cards replace the skeletons
- [ ] Count text updates: "Showing 48 of 169" → "Showing 72 of 169" (cumulative)
- [ ] Button stays present until last page; then disappears
- [ ] On the LAST click that loads the final page, count text matches total
- [ ] Click Load More with a slow connection; click again rapidly: no double-fetch (button is `disabled` during in-flight)
- [ ] Pull-to-refresh / hard reload: page comes back to its starting state (no `?after=` in URL)

Empty state:
- [ ] Apply filters that match nothing: "No products match your filters" + "Clear all filters" CTA. No grid, no skeleton

Compare toggle on cards:
- [ ] Click "Compare" on a card: button fills, label changes to "✓ Compare". Compare-tray appears at bottom-center with count "1"
- [ ] Click again: button empties, tray count drops
- [ ] Add 4 cards: 5th add silently fails with SR announce "Compare is full"

### 1.3 PDP `/products/<any handle>`

Initial paint:
- [ ] Gallery shows hero image (image 0), thumbnails strip below (up to 8)
- [ ] Hero image is high-priority (network panel)
- [ ] Counter overlay on gallery shows "01 / N"
- [ ] Right rail: brand, title, price row, size picker, firmness picker (if applicable), quantity stepper, ATC, save/compare row
- [ ] Below the buy-box: PDP overview / firmness / materials sections IF the merchant populated those metafields, otherwise gracefully omitted (no "[empty]" placeholders)

Gallery:
- [ ] Click thumbnail 2: hero swaps to image 2, counter updates "02 / N", thumbnail 2 has active ring
- [ ] Tab to a thumbnail: only the SELECTED thumb is in tab order (`tabindex=0`). Arrow Left/Right move focus AND change hero. Home/End jump
- [ ] Wraparound: ArrowLeft from thumb 0 → thumb N (last). ArrowRight from last → thumb 0

Variant selectors:
- [ ] Click each size chip: price row updates if the variant has different pricing. Chip styling reflects active state
- [ ] Out-of-stock combinations: chip shows as "unavailable" with aria-label, click is no-op
- [ ] Click firmness chip (if multiple firmness options): same behavior
- [ ] After each change, screen reader announces the new variant (verify with NVDA / VoiceOver)

Quantity stepper:
- [ ] − button: decrements (min 1), disabled at 1
- [ ] + button: increments (max 10), disabled at 10
- [ ] Stepper value reads live to SR (aria-live polite)

ATC:
- [ ] Click "Add to cart": button shows "Adding…", cart drawer slides in from right
- [ ] Cart drawer has the added line with image + title + size/firmness + price + qty selector
- [ ] Close drawer (X / scrim / Esc): drawer closes, focus returns to ATC button

Sticky mobile ATC bar (Phase 209, mobile <880px):
- [ ] Scroll past the main ATC button: sticky bar slides in at the bottom of the viewport with image + title + price + Add button
- [ ] Click sticky Add: same drawer-open behavior
- [ ] Scroll back up past main ATC: sticky bar slides away

Save (Phase 213 wishlist via `useWishlistSet`):
- [ ] Click "Save": heart fills, label changes to "Saved"
- [ ] Navigate to /wishlist: this product appears as a card
- [ ] Open the same PDP in another tab → save there. Switch back to first tab: heart is filled (cross-tab sync via `storage` event)

Compare (Phase 212 compare via `useCompareSet`):
- [ ] Click "Compare": button fills, "In compare". Compare-tray appears
- [ ] Navigate to /compare: this product is in the table

Recently viewed:
- [ ] Visit 3 different PDPs. On the 3rd, scroll below the buy-box. "Recently viewed" rail shows the other 2 cards
- [ ] Click "Clear history": rail disappears, localStorage cleared

### 1.4 Cart `/cart`

(Standalone cart page, separate from the drawer):
- [ ] Empty state if no items: shows CTA to browse mattresses
- [ ] With items: lines render, qty controls work, total updates
- [ ] "Continue to checkout" link goes to Shopify checkout (verify the host changes to `checkout.shopify.com` or similar)

### 1.5 Compare `/compare`

- [ ] With 0 items: empty state explains how to add items + CTA to browse
- [ ] With 1 item: prompt to add at least one more
- [ ] With 2-4 items: table renders with images, vendors, titles, prices, specs (Price/Brand/Material/Firmness/Height/Sizes)
- [ ] Caption above table reads "Side-by-side comparison of N selected mattresses…" (Phase 192)
- [ ] Click X on a product header column: that product removes from compare, table re-renders with N-1
- [ ] Click "Clear" in the floating tray: all removed
- [ ] Mobile <640px: table scrolls horizontally (use arrow keys after tabbing to table region — Phase 192 sr-only hint)

### 1.6 Wishlist `/wishlist`

- [ ] Empty state: "Tap the heart on any mattress to save it here" + CTA
- [ ] With items: 4-col grid (2-col tablet, 1-col mobile), cards link to PDP
- [ ] Click X on a card: removes, toolbar count updates
- [ ] "Clear all" link: removes all

### 1.7 Sleep quiz `/sleep-quiz`

Quiz flow (Phase 190 a11y + Phase 210 dynamic Result):
- [ ] Question 1 renders with title, helper text (if any), 3-5 radio options
- [ ] Click an answer: brief pause (~250ms), then auto-advance to question 2 (first time only)
- [ ] On the same question, click a different answer: NO auto-advance (returning visitor protection)
- [ ] Progress bar fills as you advance, counter updates "2 / 8" → "3 / 8" etc.
- [ ] Press Back button: returns to previous question, answer preserved
- [ ] Press Next button: advances if answered, disabled if not
- [ ] Reload mid-quiz: progress restored from localStorage, lands on current step

Keyboard navigation:
- [ ] Tab to a radio option: focus ring visible on the OPTION CARD (Phase 189 `.quiz-option:focus-within`)
- [ ] Tab to question title (after step change): focus ring visible (Phase 189 — was previously invisible)
- [ ] ArrowDown / ArrowUp inside the radio group: native radio behavior moves selection
- [ ] Screen reader: hears question title, then helper text (Phase 190 `aria-describedby`), then radio options

Skip:
- [ ] "Skip to results" button on any question: jumps directly to Result page (uses partial answers)

Result page (Phase 210 dynamic import):
- [ ] First time reaching Result: brief Suspense flash (the dynamic chunk loads). Subsequent: cached.
- [ ] "Your match" heading is focused on mount (verify with screen reader)
- [ ] SR announces "Your match: <type>. We'd shortlist <label> first."
- [ ] Three section blocks: hero CTA → Why this match (rationale list) → Worth comparing (alts) → Your answers (expandable details)
- [ ] "Why this match" and "Worth comparing" labels are real h3 headings (visible to SR rotor — Phase 190)
- [ ] Click "Retake the quiz": reset, back to question 1

### 1.8 Search `/search?q=<term>`

- [ ] Empty `q`: prompt to enter a search term
- [ ] Real query: results render (products + collections + articles + showrooms sections)
- [ ] No results: friendly empty state, suggestion to browse mattresses
- [ ] Each product result has the same `<PlpCard>` shape as PLP

### 1.9 Blog index `/blogs/sleep-blog` (and any other blog)

- [ ] Hero with eyebrow + h1 + lede + meta tiles
- [ ] 4:3 cards in 3-col grid (2-col tablet, 1-col mobile)
- [ ] Each card: image, category · date, title, excerpt clamp, "By author"
- [ ] Pagination: "Load more" link advances `?after=cursor` (this is OK for blog — different from collection load-more)

### 1.10 Blog article `/blogs/sleep-blog/<article>`

- [ ] Hero image + title + meta (author, date)
- [ ] Article body renders with sanitized HTML
- [ ] Table of contents (if applicable): scroll-spies the current section
- [ ] Related articles or CTA at the bottom

### 1.11 CMS pages `/pages/<handle>`

- [ ] Default branch (e.g. `/pages/mattress-store-financing`): breadcrumbs, h1, body
- [ ] Locations index `/pages/mattress-store-locations`: 5 showroom cards
- [ ] Individual showroom (e.g. `/pages/best-mattress-store-west-la`): showroom card, hours with current-status badge, map embed (`<iframe>`)
- [ ] Empty CMS page (rare): fallback category grid renders (no "no content" dead end)

### 1.12 Account `/account`

- [ ] Currently a placeholder. Verify it doesn't 500.

### 1.13 Data sharing opt-out `/pages/data-sharing-opt-out`

- [ ] CCPA-style opt-out form renders with name, email, request-type radio
- [ ] Submit without filling: validation errors per field
- [ ] Submit valid: success state (verify form actually POSTs — network panel should show `/api/ccpa-request`)

### 1.14 Reviews `/pages/reviews`

- [ ] Reviews page renders (currently Judge.me or similar — depends on whether `JUDGEME_API_TOKEN` env var is set)

### 1.15 404 / Not found

- [ ] Visit a fake URL e.g. `/products/this-does-not-exist`: 404 page renders, NOT a 500
- [ ] 404 page has category tiles + "back to home" CTA
- [ ] Visit `/foobar`: 404 page

---

## Part 2 — Cross-page / global interactions

### 2.1 Cart drawer (rendered in layout, available everywhere)

- [ ] Click cart icon in nav (anywhere): drawer slides in from right
- [ ] First time: empty state with "Your cart is empty" + "Shop mattresses" CTA + recently-viewed promo (if any)
- [ ] With items: lines with images + qty steppers + remove buttons + subtotal at bottom
- [ ] Qty +/− buttons work; live region announces new qty
- [ ] Remove button: line disappears with a fade or just unmounts; subtotal updates
- [ ] "Continue to checkout" button takes user to Shopify checkout
- [ ] Esc closes drawer
- [ ] Click scrim closes drawer
- [ ] Focus returns to whatever triggered the open
- [ ] Screen reader hears "Shopping cart opened. N items." on open (Phase 193)
- [ ] Background page scroll is locked while drawer open

### 2.2 Search overlay (`/` key or Cmd/Ctrl+K)

- [ ] Anywhere on the site, press `/`: overlay opens, input focused
- [ ] Press Cmd+K (Mac) / Ctrl+K (Win/Linux): same
- [ ] While typing in another text field on the page, press `/`: nothing happens (overlay does NOT open)
- [ ] Empty query: see Trending pills + Recent searches (if any) + Quick links grid
- [ ] Type 2+ chars: predictive sections appear (Products / Collections / Showrooms / Articles)
- [ ] Each section has a visible label and is a `<group>` (Phase 193 — verify with SR)
- [ ] ArrowDown / ArrowUp navigate suggestions, Enter commits highlight (or navigate via Enter on the input itself)
- [ ] Esc closes overlay; focus returns to the trigger button (search icon in nav) (Phase 186)
- [ ] Click outside the panel: closes
- [ ] Clicking a result: navigates to the product / collection / page

### 2.3 Mega menu (desktop nav, hover)

- [ ] Hover over "Mattresses": mega panel slides down with By Type / By Size / Adjacent columns + 2 feature tiles
- [ ] Move mouse off: panel closes after a brief grace period
- [ ] Tab to "Mattresses" link with keyboard: focus ring visible
- [ ] Press ArrowDown or Space: panel opens, first link inside the panel is focused (Phase 191)
- [ ] Press Esc: panel closes, focus returns to "Mattresses" trigger
- [ ] Tab through panel links: works as standard navigation (no roving tabindex — we don't use role=menu)
- [ ] Same flow for "Brands" and "Guides" mega items

### 2.4 Mobile drawer (mobile nav, hamburger)

- [ ] Tap hamburger (mobile <880px): drawer slides in from left
- [ ] Logo + close button at top
- [ ] Full nav list with chevron arrows
- [ ] Tap a link: navigates + drawer closes
- [ ] Tap X / scrim / press Esc: drawer closes
- [ ] Focus returns to hamburger button after close
- [ ] Background scroll locked while open

### 2.5 Compare tray (floating pill)

- [ ] Add a product to compare from PLP or PDP: tray appears bottom-center on shopping routes (`/`, `/collections/*`, `/products/*`, `/search`)
- [ ] On non-shopping routes (`/sleep-quiz`, `/blogs/*`, `/account`, etc.): tray hides even if items are saved
- [ ] Scroll down toward footer: tray hides when footer is in view
- [ ] Tap "X" to dismiss tray: stays hidden until page change (selection preserved)
- [ ] Tap "Compare (N)": navigates to `/compare?ids=...`

### 2.6 Topbar trust strip

- [ ] Three trust items visible across viewports
- [ ] No layout shift on mobile (verify content fits without horizontal scroll)

---

## Part 3 — UI design / visual polish

### 3.1 Spacing & vertical rhythm

For each route, check:
- [ ] Generous breathing room between sections — no cramped feeling
- [ ] Section padding consistent across pages (use Inspector to compare actual computed padding values — should be `var(--s-7)` to `var(--s-9)` at section boundaries)
- [ ] Within sections, content has clear visual grouping (not jammed against edges)
- [ ] Cards within a grid have consistent gap (no off-by-one alignment)
- [ ] Hero copy has clear vertical hierarchy (eyebrow / h1 / lede / CTAs separated by `var(--s-3)`+)

**Concrete checks**:
- [ ] Homepage: gap between Hero → Trust → Categories → Brands → Quiz → Popular → Showrooms → Reviews → FAQ is visually consistent
- [ ] PLP: gap between hero / toolbar / grid is comfortable; cards have at least 24px gap on desktop
- [ ] PDP: gap between gallery and rail; gap between buy-box and editorial sections; sticky bar has a `box-shadow` separating it from page content
- [ ] Cart drawer: line items have at least 16px vertical space between each
- [ ] Mobile (375px): nothing touches viewport edges — there's always 16-20px inset

### 3.2 Typography

- [ ] All h1 / h2 / h3 sizes scale clearly (h1 > h2 > h3 visually)
- [ ] Body text is at least 14px on desktop, 15px on mobile (verify with Inspector)
- [ ] Line height is 1.4-1.6 on body, 1.0-1.2 on headings
- [ ] Long product titles (e.g. "Tempur-Pedic TEMPUR-LuxeAdapt® Firm Mattress 13") wrap cleanly — never overflow card, never sit on a single line crammed
- [ ] No "widow" words on hero h1 (single word on the last line)

### 3.3 Color contrast (WCAG AA minimum)

- [ ] Body text vs background: ratio ≥ 4.5:1 (use a contrast checker tool)
- [ ] Muted text (`var(--text-3)`) vs background: ratio ≥ 4.5:1 — flag if below
- [ ] Button text vs button background: ratio ≥ 4.5:1
- [ ] Link color vs surrounding text: distinct enough to spot
- [ ] Focus rings: visible against ALL backgrounds (white, surface-2, brand-navy)
- [ ] On hero (dark backgrounds): ensure all overlay text + CTAs have sufficient contrast

### 3.4 Mobile responsiveness

- [ ] Test at 375px, 412px, 768px, 1024px viewports
- [ ] No horizontal scroll on any page at any of those widths
- [ ] Mega menu becomes hamburger at 880px (verify the breakpoint feels natural)
- [ ] Hero text legible at 375px
- [ ] PLP cards: 1-col at <640px, 2-col at 640-1024px, 3-col at >1024px (or whatever the design specifies — just verify consistent)
- [ ] PDP gallery: full-width hero on mobile, thumbnails scroll horizontally if more than fit
- [ ] PDP rail stacks below gallery on mobile (not side-by-side)
- [ ] Tables (compare): horizontal scroll with clear visual affordance

### 3.5 Images & aspect ratios

- [ ] All product images preserve aspect ratio (no squishing, no cropping that loses the product)
- [ ] All hero / lifestyle images use `object-fit: cover` and frame well at the rendered aspect ratio
- [ ] Lazy-loaded images don't shift the layout when they load (Image always has explicit width/height)
- [ ] No `[Image coming]` placeholder visible on production (would indicate missing image data)

### 3.6 Button hit targets

- [ ] Mobile buttons are at least 44×44px (Apple) / 48×48px (Google) — touch targets adequate
- [ ] Buttons aren't crowded together (8px+ between adjacent tap targets)

### 3.7 Loading & empty states

- [ ] Every async surface has a loading state (PLP grid, predictive search, cart, …)
- [ ] Every empty state has a friendly message + action CTA (no "Loading…" stuck forever, no blank screens)
- [ ] Error states are user-friendly (not raw stack traces or "Error: 500")

### 3.8 Edge cases

- [ ] Very long product title (50+ chars): wraps cleanly on cards and PDP
- [ ] Very long collection name: doesn't break toolbar layout
- [ ] Single product in a collection: PLP still looks right
- [ ] Single review: "Reviews" section still composes well
- [ ] Localized number formats: currency renders as "$2,599.00" not "2599.0"

---

## Part 4 — Accessibility

### 4.1 Keyboard navigation (no mouse)

For each page, navigate using only Tab / Shift+Tab / Enter / Space / Arrow keys:
- [ ] Every interactive element is reachable
- [ ] Tab order matches visual order (top-to-bottom, left-to-right)
- [ ] Every focused element has a visible focus indicator (Phase 189)
- [ ] No focus trap on a non-modal element (focus can always escape via Tab)
- [ ] Modal dialogs (cart drawer, search overlay, mobile nav) DO trap focus while open; Esc breaks out

### 4.2 Screen reader (NVDA on Windows or VoiceOver on Mac)

- [ ] Page title and heading rotor make sense
- [ ] Every image has alt text (or `alt=""` for decorative)
- [ ] Every form field has a programmatic label
- [ ] Live regions announce dynamic content (cart open, search results count, variant change, "Saved" / "Added to compare")
- [ ] Buttons announce role + name + state (e.g. `aria-pressed=true` on toggled buttons)

### 4.3 Color blindness

- [ ] Test with a color-blindness simulator (Chrome DevTools → Rendering → Emulate vision deficiency)
- [ ] "On sale" red is distinguishable from neutral in deuteranopia / protanopia
- [ ] No status conveyed by color ALONE (always paired with text or icon)

---

## Part 5 — Performance perception

### 5.1 Initial paint (Fast 3G throttled)

- [ ] Homepage hero shows within 3s
- [ ] PLP first 3 cards visible within 4s
- [ ] PDP gallery hero image visible within 3s
- [ ] No "white screen of death" on any route

### 5.2 Lazy loading

- [ ] Scroll through PLP: cards 4+ load just before they enter viewport (no late blank-then-pop)
- [ ] Hero slides 2 and 3 only fetch their bg image AFTER the user interacts with the carousel or after autoplay reaches them
- [ ] Predictive search waits 180ms after typing stops (no per-keystroke fetch)

### 5.3 Interaction responsiveness

- [ ] Click "Load more": skeleton appears within 100ms
- [ ] Click "Add to cart": button shows "Adding…" within 100ms; drawer opens within 500ms
- [ ] Compare tray fades in within 200ms of clicking "Compare" on a card

---

## Part 6 — Cross-tab / persistence

- [ ] Open PDP in two tabs. Save in tab 1. Switch to tab 2. Heart is filled (Phase 213 cross-tab sync)
- [ ] Same for compare. Same for cart? (cart context — verify whether it syncs or not; if not, document)
- [ ] Clear all in tab 1 → tab 2 reflects empty state on next focus

---

## Reporting format

Group findings by severity, with reproduction info:

### P0 — Launch blockers

For each: route, viewport, step-by-step repro, screenshot, expected vs actual.

### P1 — Should fix before launch

Same format.

### P2 — Polish / nice-to-have

Same format.

### Notes (no action needed)

Anything notable but intentional (e.g. "/account is a placeholder by design").

---

## How this maps back to recent work

The codebase has shipped 27 phases of work since this session began (188-217). The test plan above implicitly verifies:

- Phases 188 / 207 (OG image fallback on coverless routes) — surfaces if any social-share preview is missing
- Phases 189 / 192 / 193 (a11y) — focus rings, compare caption, cart-drawer announce, search overlay groups
- Phase 191 (mega menu kbd entry) — desktop nav arrow-key behavior
- Phase 195 (Hero server-shell) — carousel rotation, pause-on-hover, image deferral
- Phases 196 / 197 (Compare split) — compare toggle / tray independence
- Phase 209 (PDP sticky ATC bar) — mobile sticky behavior
- Phase 210 (Sleep-quiz Result dynamic import) — result page loads correctly after quiz completion
- Phases 212 / 213 / 214 (localStorage stores) — cross-tab sync on save/compare/recently-viewed
- Phases 215-217 (PLP load-more fix) — the bug the user originally reported

If anything from the above doesn't behave as described in the source comments, that's a regression and should be P0 / P1.
