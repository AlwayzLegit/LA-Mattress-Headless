# Observability stack — Sentry + PostHog + GA4

**Status:** Code-side: shipped. Activation-side: pending env vars + dashboard curation (see §5 — user tasks).
**Date:** 2026-05-20.
**Scope:** Error tracking (Sentry), product analytics + session replay + funnels (PostHog), aggregate traffic / GSC keyword attribution (GA4). All three coexist; each covers what the others can't.

---

## 1. Why three tools

GA4 alone won't tell you _what individual users did before they bounced_. Sentry alone won't tell you _which step in the checkout funnel is leaking conversions_. PostHog alone won't get keyword data from Google Search Console. The three together cover the full observability surface for a headless commerce site:

| Tool | What it answers | Free-tier ceiling at our traffic |
|---|---|---|
| **Sentry** | "What broke?" — server + browser exceptions with stack traces + sourcemaps, slow API routes, release tracking. | 5k errors + 10k replays/mo. Easily fits. |
| **PostHog** | "What did people do?" — funnels (PLP→PDP→Cart→Checkout→Order), per-route LCP/INP/CLS, autocapture clicks, **session replay** (10% sampled), feature flags + A/B tests. | 1M events + 5k replays/mo. Fits comfortably. |
| **GA4** | "Where is traffic coming from and which keywords drove it?" — GSC link is the only way Google surfaces keyword attribution. | Free. Already wired. |
| **Vercel Speed Insights** | Real-user CWV per route (already wired). | Included with the Vercel project. |

---

## 2. Sentry — wired (Phase 166/185/187)

Code-side complete. Lives at:

- `instrumentation-client.ts` — browser SDK init + App Router router-transition hook
- `instrumentation.ts` — server runtime registration
- `sentry.server.config.ts` + `sentry.edge.config.ts` — Node + edge runtime init
- `next.config.mjs` — `withSentryConfig` wrapper (tunnel route at `/monitoring`, source-map upload, hidden source maps in prod)

**Configuration choices (already in code):**

- `tracesSampleRate: 0.1` — 10% of transactions sampled for performance traces.
- `respect_dnt: true` — visitors with Do Not Track header are excluded.
- Replay integration **intentionally NOT included** (Phase 166 decision — ~50KB bundle hit). PostHog session replay covers this gap with better product context.

**Activation gate:** five env vars in Vercel (see §5).

---

## 3. PostHog — wired (this PR)

Code-side complete. Lives at:

- `app/_components/analytics-posthog.tsx` — provider, mounted in `app/layout.tsx`. Initializes the SDK when `NEXT_PUBLIC_POSTHOG_KEY` is set, fires `$pageview` on every Next.js route change.
- `lib/analytics.ts` — typed `track()` dispatcher and event taxonomy. Single source of truth for what gets fired.

**Configuration choices (in `analytics-posthog.tsx`):**

- `api_host` defaults to `https://us.i.posthog.com`. Override with `NEXT_PUBLIC_POSTHOG_HOST` if using EU Cloud.
- `capture_pageview: false` — manual pageview firing on Next.js route changes (Next App Router uses client-side navigation that PostHog's auto-pageview doesn't see).
- `autocapture: true` — clicks + form submits + inputs (passwords masked by default). Add `data-ph-no-capture` to any element that should never be tracked.
- `session_recording` enabled, **10% session-level sample** (Math.random > 0.1 → `stopSessionRecording()`). Keeps storage free-tier-friendly while preserving "watch a real session" capability.
- `respect_dnt: true` — GDPR / DNT honored.
- `person_profiles: 'identified_only'` — anonymous visitors don't create person rows; lowers event-volume costs.

### 3.1 Event taxonomy (`lib/analytics.ts`)

Every event the storefront fires is enumerated in the `AnalyticsEvent` discriminated union. Adding a new event = adding to the union + handling the new key in `track()`. Intentional friction — events shouldn't multiply ad-hoc.

| Event | Fired from | Props |
|---|---|---|
| `$pageview` | `AnalyticsPostHog` on every route change | `$current_url` |
| `plp_view` | `TrackPlpView` on `/collections/[handle]` mount | `handle`, `title`, `layout` (`v1`/`v2`), `intro_source` (`metafield`/`fallback`), `long_content_source` (`seo_content`/`description_html`/`none`), `product_count` |
| `pdp_view` | `TrackPdpView` on `/products/[handle]` mount | `handle`, `title`, `vendor`, `product_type`, `price`, `currency`, `in_stock` |
| `add_to_cart` | `CartProvider.addLine` after successful Shopify mutation | `product_handle`, `variant_id`, `product_title`, `quantity`, `price`, `currency` |
| `cart_view` | `TrackCartView` on `/cart` mount | `item_count`, `cart_value`, `currency` |
| `checkout_started` | Cart drawer + `/cart` checkout button onClick | `item_count`, `cart_value`, `currency` |
| `quiz_step` | (future) sleep-quiz step completions | `step`, `choice`, `is_final`, `recommended_handle` |
| `search` | (future) `/search` query submission | `query`, `result_count` |

**Funnel-critical events** (`add_to_cart`, `checkout_started`) also add a Sentry breadcrumb so any post-funnel error report includes the funnel position that preceded the failure.

**Server-side events not yet wired (next iteration):**

- `order_completed` — Shopify Order Paid webhook → posthog-node → closes the revenue funnel.
- `subscription_created`, `subscription_cancelled` — if Shopify Subscriptions are added.

### 3.2 Activation gate

Two env vars in Vercel (see §5). When unset, every `track()` call is a no-op (no errors, no warnings).

---

## 4. Recommended dashboard layout (PostHog)

Once activated, pin these charts into a single workspace named **"LA Mattress storefront"**. PostHog → Dashboards → New Dashboard.

### 4.1 Conversion funnel (the primary chart)

PostHog Funnels → New Funnel:

```
1. $pageview (entry — any URL)
2. plp_view
3. pdp_view
4. add_to_cart
5. cart_view OR checkout_started
6. checkout_started
```

Filters: 7-day window. Group by `intro_source` and `long_content_source` to see whether PLP variants drive conversion.

### 4.2 PLP performance split (v2.1 layout impact validation)

Filter `plp_view` events by `intro_source`. Compare engagement: PLP→PDP clickthrough rate split by metafield-source vs fallback-source. Expectation: comparable (the metafield-driven path was designed to match the fallback's per-handle copy quality).

### 4.3 CWV per route

PostHog auto-captures Web Vitals when the `posthog.capture('$web_vitals')` event fires. Already wired by the SDK. Pin a chart: median LCP / INP / CLS by `$pathname` (last 7 days), highlight the 5 long-body collections we relocated content from.

### 4.4 Top-exit pages

PostHog Insights → Retention → users who landed on each PLP and didn't reach a PDP. Identifies dead-end PLPs the merchant should refresh.

### 4.5 Session replays — sorted by friction

PostHog Replay → filter `event = checkout_started AND order_completed = null` to find sessions that started checkout but didn't complete. Watch a sample to find UX friction.

### 4.6 Error rate (Sentry-side)

Sentry → Dashboard → "Issues by release" chart. Pin alongside Replay for one-click watch-the-broken-session triage.

---

## 5. User tasks — what activates this

| # | Task | Where | What |
|---|---|---|---|
| 1 | Set Sentry env vars in Vercel | Vercel → Project → Settings → Environment Variables (all 3 environments) | `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_DSN`, `SENTRY_ORG=jetnine`, `SENTRY_PROJECT=la-mattress-headless`, `SENTRY_AUTH_TOKEN` (generate at https://jetnine.sentry.io/settings/account/api/auth-tokens/ with `project:releases` + `org:read`). |
| 2 | Set PostHog env vars in Vercel | Vercel → Project → Settings → Environment Variables | `NEXT_PUBLIC_POSTHOG_KEY=<your key>`, `NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com` (or EU URL if applicable). |
| 3 | Redeploy | Vercel | Push any commit or click Redeploy. Both Sentry and PostHog SDKs flip on. |
| 4 | Verify Sentry capture | Sentry → jetnine/la-mattress-headless → Issues | Open the production site, deliberately trigger an error (e.g., navigate to a 500 URL via dev), confirm Sentry receives it within ~30s. |
| 5 | Verify PostHog capture | PostHog → Activity → Live events | Open the production site, browse 1 PLP, 1 PDP, add to cart. Confirm `plp_view`, `pdp_view`, `add_to_cart` appear within ~30s. |
| 6 | Curate the dashboard | PostHog → Dashboards | Build the 6 charts from §4 above. ~30 min of UI work; nothing to commit. |
| 7 | Set up Slack alerts | Sentry → Project Settings → Alerts | "When error rate > 0.5% of sessions, message #engineering Slack channel". PostHog has similar alert routes for funnel drop-off thresholds. |
| 8 | (Optional, future) `order_completed` server-side event | Shopify Admin → Settings → Notifications → Webhooks → Add `Order paid` webhook → URL → a Vercel-deployed serverless function that calls `posthog-node`'s `capture()`. | Closes the revenue funnel. ~30 LOC. Out of scope for this PR. |

---

## 6. Privacy + GDPR

- **DNT respected** — both Sentry and PostHog `respect_dnt: true` configured.
- **Password fields masked** by both SDKs by default.
- **Add `data-ph-no-capture`** to any element that should never be tracked (e.g., promo code inputs, internal staff debug panels).
- **`person_profiles: 'identified_only'`** in PostHog means anonymous visitors don't create persistent profiles; only identified users (via `identify()` in `lib/analytics.ts`) get person rows.
- **No PII collected by default.** Email, name, phone never enter `track()` payloads automatically. If we ever add login, `identify(email)` would be the only place PII enters PostHog.
- **Sentry source maps hidden from prod** via `hideSourceMaps: true` in `next.config.mjs` — only Sentry can read them, not random viewers of `/_next/static/`.

---

## 7. Cost model

At LA Mattress's current traffic (~10K monthly sessions estimated), all three services fit comfortably inside their free tiers:

- **Sentry Developer plan:** free for 1 team, 5k errors + 10k replays/mo. We'll likely use 100-1k errors/mo at most.
- **PostHog Free plan:** 1M events + 5k replays/mo. With ~10 events/session × 10K sessions = 100K events/mo + ~1K replays (10% sample). Headroom: 10×.
- **GA4 + Vercel Speed Insights:** included.

If traffic 10×s and we exceed any free tier, the upgrade is incremental ($0.0001/event for PostHog overage, $26/mo Team plan for Sentry).

---

## 8. Files touched / created

| File | Status |
|---|---|
| `app/_components/analytics-posthog.tsx` | NEW — PostHog provider + autocapture config |
| `lib/analytics.ts` | NEW — typed event taxonomy + dispatcher |
| `app/_components/track-plp-view.tsx` | NEW — fires `plp_view` |
| `app/_components/track-pdp-view.tsx` | NEW — fires `pdp_view` |
| `app/cart/track-cart-view.tsx` | NEW — fires `cart_view` |
| `app/cart/checkout-link.tsx` | NEW — fires `checkout_started` (replaces a plain `<a>`) |
| `app/_components/cart-context.tsx` | MOD — fires `add_to_cart` on successful add |
| `app/_components/cart-drawer.tsx` | MOD — fires `checkout_started` on drawer-button click |
| `app/layout.tsx` | MOD — mounts `<AnalyticsPostHog />` |
| `app/collections/[handle]/page.tsx` | MOD — mounts `<TrackPlpView />` with the resolved source dimensions |
| `app/products/[handle]/page.tsx` | MOD — mounts `<TrackPdpView />` |
| `app/cart/page.tsx` | MOD — mounts `<TrackCartView />` + swaps checkout `<a>` for `<CheckoutLink>` |
| `package.json` | MOD — adds `posthog-js` dep |
