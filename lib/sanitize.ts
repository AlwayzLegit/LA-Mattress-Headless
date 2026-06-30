/**
 * Sanitize Shopify-stored HTML before rendering.
 *
 * Shopify's page editor lets merchants paste hostnames into URLs. When the
 * site was authored, content sometimes references throwaway dev hosts (e.g.
 * `*.trycloudflare.com` quick tunnels) or absolute URLs to the production
 * domain. Both are wrong for our headless storefront:
 *
 *   - Tunnel URLs go offline as soon as the dev session ends → broken images
 *     and dead links on /pages/mattress-store-locations etc.
 *   - Absolute production URLs cause unnecessary cross-origin requests when
 *     the same content can resolve relative to whatever host the page is on.
 *
 * Phase 229: also strips Google Maps `<iframe>` embeds. Merchants pasted
 * map iframes into several showroom page bodies in Shopify, but the
 * showroom template (`app/pages/[handle]/page.tsx`) already renders its
 * own canonical map sourced from geo coordinates in `lib/showrooms.ts`.
 * The result was 2-3 maps side-by-side on Studio City / West LA / La Brea.
 * This pass removes the merchant-pasted iframes so only the canonical
 * map renders. Other iframes (YouTube, Vimeo, future widgets) pass
 * through untouched.
 *
 * This helper rewrites both to root-relative URLs in `href` and `src`
 * attributes. Idempotent. Cheap (single regex pass).
 *
 * The merchant should also clean up the source HTML in Shopify Admin, but
 * this guard prevents a stale leak from breaking the live site.
 */

// Relative path (not '@/data/...') so the unit-test suite can import
// this file via Node 22's experimental-strip-types without a TS path-
// alias resolver. The `@/` alias still works inside Next.js builds via
// tsconfig + webpack — both forms resolve to the same file at compile
// time. Tests run outside Next, hence the relative path.
import redirectsJson from '../data/url-inventory/redirects.json' with { type: 'json' };
import redirectsManualJson from '../data/url-inventory/redirects-manual.json' with { type: 'json' };
import { canonicalizeRouteParams } from './route-canonicalization.ts';
import sanitizeHtml from 'sanitize-html';

// Parser-based XSS pass (hardening, session 2026-06-10 audit). The
// regex passes below are content *repairs* tuned to known Shopify
// artifacts; they were never a structural XSS guarantee — malformed
// markup that a regex misses, a real HTML parser normalizes. This
// allowlist runs first so everything downstream (and the page) only
// ever sees parsed, well-formed, script-free markup.
//
// The allowlist is deliberately permissive about PRESENTATION (style/
// class/id/data-* attrs, tables, figures) because the input is the
// merchant's own TinyMCE-authored content and visual fidelity matters.
// It is strict about EXECUTION: no script/event-handler attrs survive
// the parse (not allowlisted), URL schemes are pinned, and iframes are
// host-pinned to the embed providers article bodies actually use
// (YouTube/Vimeo pass through by design — see Phase 229 note above;
// Google Maps iframes are additionally stripped by a later pass).
const SANITIZE_CONFIG: sanitizeHtml.IOptions = {
  allowedTags: [
    'a', 'abbr', 'address', 'b', 'blockquote', 'br', 'caption', 'code',
    'col', 'colgroup', 'dd', 'del', 'details', 'div', 'dl', 'dt', 'em',
    'figcaption', 'figure', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr',
    'i', 'iframe', 'img', 'ins', 'li', 'mark', 'ol', 'p', 'picture',
    'pre', 'q', 's', 'small', 'source', 'span', 'strong', 'sub',
    'summary', 'sup', 'table', 'tbody', 'td', 'tfoot', 'th', 'thead',
    'tr', 'u', 'ul',
  ],
  allowedAttributes: {
    '*': ['class', 'id', 'style', 'title', 'dir', 'lang', 'align', 'data-*'],
    a: ['href', 'name', 'target', 'rel'],
    img: ['src', 'srcset', 'sizes', 'alt', 'width', 'height', 'loading', 'decoding'],
    source: ['src', 'srcset', 'sizes', 'media', 'type'],
    iframe: ['src', 'width', 'height', 'allow', 'allowfullscreen', 'frameborder', 'loading', 'referrerpolicy', 'title'],
    td: ['colspan', 'rowspan'],
    th: ['colspan', 'rowspan', 'scope'],
    col: ['span'],
    colgroup: ['span'],
    details: ['open'],
  },
  // Relative URLs stay allowed (sanitize-html only checks scheme'd URLs).
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  allowedIframeHostnames: [
    'www.youtube.com', 'www.youtube-nocookie.com', 'player.vimeo.com',
    // Maps iframes survive this pass but are stripped wholesale by the
    // GOOGLE_MAPS_IFRAME pass below (Phase 229) — listed here so the
    // host-pinning isn't what removes them, keeping that pass's
    // behavior (and its docstring) authoritative.
    'maps.google.com', 'www.google.com',
  ],
  // Drop <script>/<style> CONTENT too, not just the tags (default keeps
  // inner text, which would render raw JS/CSS as visible prose).
  nonTextTags: ['script', 'style', 'textarea', 'option', 'noscript'],
};

// Phase 293: resolve internal links that 301-redirect.
//
// The SEMrush 20260518 re-crawl (crawler now unblocked) flagged 1297 /
// 1919 pages under "Broken internal links" — identical, 1:1, to
// "Permanent redirects" on every row: SEMrush counts an internal link
// that hits a 301 as a broken link. The dominant source is
// merchant-authored blog / page / product HTML (rendered via
// dangerouslySetInnerHTML) containing thousands of hardcoded old
// /collections/*, /blogs/beds-mattresses/*, /pages/* hrefs that
// data/url-inventory/redirects.json now 301s to canonical URLs.
//
// Rather than editing 1000+ Shopify bodies, rewrite the href at render
// time to the FINAL destination (chain-resolved), reusing the exact
// same redirects.json that feeds next.config's redirects() — single
// source of truth, can never drift. The crawler then sees a direct 200
// link with no hop. Idempotent (a resolved dest is never itself a
// source, by construction). Map is built once at module init (~1097
// rules; cheap) with cycle + depth guards.
export type RedirectRule = { source: string; destination: string };

function normRedirectPath(p: string): string {
  const x = p.split('#')[0].split('?')[0];
  return x.length > 1 && x.endsWith('/') ? x.slice(0, -1) : x;
}

// Shopify Admin stores ~900 of the export's redirect DESTINATIONS as
// absolute apex-host URLs (https://mattressstoreslosangeles.com/…).
// Left raw, the Phase 293 href rewrite replaces a relative in-body link
// with that absolute apex URL — re-introducing the exact 301 hop
// (apex → www) the rewrite exists to remove, and doing it AFTER the
// host-strip pass has already run, so nothing downstream repairs it.
// That's the SEMrush 20260611 "Permanent redirects" tail: 967 hits on
// 375 pages, concentrated in the glossary articles' Index of Materials
// links. Normalizing destinations to root-relative paths also lets the
// chain-collapse below see THROUGH a hop whose stored destination was
// absolute, and strips Shopify session/tracking params (_fid/_pos/_sid/
// _ss/srsltid) a few stored targets carry — legitimate params (sort_by,
// filter.*) are preserved. scripts/build-redirects-table.mjs#cleanDest
// applies the same normalization to the middleware table; this is its
// render-time twin.
const OWN_ORIGIN = /^https?:\/\/(?:www\.|checkout\.)?(?:mattressstoreslosangeles\.com|la-mattress\.myshopify\.com)(?=[/?#]|$)/i;
const TRACKING_KEY = /^(?:amp;)?(?:_fid|_pos|_sid|_ss|srsltid)=/i;

function normRedirectDest(d: string): string {
  let dest = d.trim();
  const stripped = dest.replace(OWN_ORIGIN, '');
  if (stripped !== dest) {
    dest = stripped === '' || stripped.startsWith('?') || stripped.startsWith('#')
      ? '/' + stripped
      : stripped;
  }
  // Tracking params: internal destinations only — a (hypothetical)
  // external destination's query string is not ours to rewrite.
  if (dest.startsWith('/')) {
    const qi = dest.indexOf('?');
    if (qi !== -1) {
      const hi = dest.indexOf('#', qi);
      const query = hi === -1 ? dest.slice(qi + 1) : dest.slice(qi + 1, hi);
      const hash = hi === -1 ? '' : dest.slice(hi);
      const kept = query.split('&').filter((kv) => kv && !TRACKING_KEY.test(kv));
      dest = dest.slice(0, qi) + (kept.length ? '?' + kept.join('&') : '') + hash;
    }
  }
  return dest;
}

/**
 * Build a flat source → terminal-destination map from a list of
 * redirect rules, collapsing chains and tolerating cycles.
 *
 * Pure function — extracted from the module-init IIFE so the unit-test
 * suite can exercise the chain-collapse + cycle-guard against
 * synthesised fixtures (cowork 20260521 follow-up).
 *
 * Behavior:
 *   - Drops malformed rules (non-string source or destination).
 *   - Drops self-redirects (source === destination).
 *   - Strips query / hash + trailing slash from each source key.
 *   - Chain-collapses up to 12 hops; bails on cycle (seen-set guard)
 *     or when the destination is no longer a redirect source.
 *
 * The 12-hop cap is a defensive ceiling — `redirects.json` has never
 * had a chain longer than 3 in practice, but a future merchant adding
 * 20 layered redirects via Shopify Admin shouldn't be able to make
 * this loop forever.
 */
export function buildRedirectTarget(rules: ReadonlyArray<RedirectRule>): Map<string, string> {
  const direct = new Map<string, string>();
  for (const r of rules) {
    if (typeof r?.source !== 'string' || typeof r?.destination !== 'string') continue;
    const s = normRedirectPath(r.source);
    const d = normRedirectDest(r.destination);
    if (s && s !== d) direct.set(s, d);
  }
  // Collapse chains (A→B, B→C ⇒ A→C) so a single rewrite lands on the
  // terminal URL — no residual hop for the crawler to follow.
  //
  // Cycle handling (cowork 20260521): if the chain loops back on
  // itself (A→B→A), DROP the entry from the output. The previous
  // collapse landed at A which is a self-redirect — runtime
  // Next.js would then redirect /a → /a forever. Dropping leaves
  // the path serving a 404 instead, which is recoverable. The
  // depth cap is a separate safeguard for runaway-but-not-cyclic
  // chains (>12 hops); those keep their last reachable destination
  // since they don't necessarily loop, they just go deeper than
  // we want to walk.
  const out = new Map<string, string>();
  for (const start of direct.keys()) {
    let dest = direct.get(start) as string;
    const seen = new Set<string>([start]);
    let isCycle = false;
    for (let i = 0; i < 12; i += 1) {
      const key = normRedirectPath(dest);
      if (seen.has(key)) {
        // Walking forward from `dest`'s key would re-enter a node we
        // already passed → cycle. Mark + bail without writing the
        // entry.
        isCycle = true;
        break;
      }
      const next = direct.get(key);
      if (next === undefined) break;  // dest is terminal — no further hop
      seen.add(key);
      dest = next;
    }
    if (!isCycle) out.set(start, dest);
  }
  return out;
}

// Cast via `unknown` because data/url-inventory/redirects.json can
// transiently carry Shopify's raw GraphQL shape (`{ id, path, target }`)
// between an inventory-action run and the next deploy that fixes the
// shape via scripts/pull-inventory.mjs. Direct cast fails TS-build at
// /lib/sanitize.ts when the shapes don't overlap (which is why prod
// builds went red after PR #273). buildRedirectTarget already filters
// out malformed rules (non-string source / destination) so wrong-shape
// data yields an empty map without crashing.
const REDIRECT_TARGET: Map<string, string> = buildRedirectTarget([
  ...(((redirectsJson as unknown) as { redirects?: RedirectRule[] }).redirects ?? []),
  // Manual layer (redirects-manual.json) LAST: buildRedirectTarget's
  // direct-map build is last-writer-wins, so a hand-maintained entry
  // overrides a stale Shopify rule for the same source. (Mirror of
  // build-redirects-table.mjs, which lists manual FIRST because its
  // dedup is first-writer-wins — same precedence, opposite mechanics.)
  ...(((redirectsManualJson as unknown) as { redirects?: RedirectRule[] }).redirects ?? []),
]);

// Root-relative hrefs only (leading "/"; never protocol-relative "//"
// or external http(s)). Lookbehind on whitespace so `data-href=` /
// other `*href=` attributes aren't matched. Path is captured up to the
// first ?/# so any query/hash is preserved verbatim on rewrite.
const HREF_INTERNAL = /(?<=\s)href=("|')(\/[^"'?#]*)([^"']*)\1/gi;

function resolveRedirectHrefs(html: string): string {
  if (REDIRECT_TARGET.size === 0) return html;
  return html.replace(HREF_INTERNAL, (full, q: string, path: string, suffix: string) => {
    if (path.startsWith('//')) return full;
    const dest = REDIRECT_TARGET.get(normRedirectPath(path));
    return dest ? `href=${q}${dest}${suffix}${q}` : full;
  });
}

// SEMrush 20260630 audit: ~85% of issue #214 ("Permanent redirects",
// 212 instances) are decorated query params baked into article body
// hrefs (e.g. `?amp;_fid=…&_ss=c&variant=…`, `?_psq=…`, `?_sid=…` —
// Shopify URL-decoration artifacts from copy-pasting from the legacy
// storefront). Each one passes `canonicalizeRouteParams` in the edge
// middleware and 301s to the clean canonical, costing an extra hop.
// Pre-stripping the same params at render time means crawlers and
// internal-link followers land on the canonical URL directly.
// Mirrors the middleware allow-list so the two stay in lock-step.
function stripNoiseParams(html: string): string {
  return html.replace(HREF_INTERNAL, (full, q: string, path: string, suffix: string) => {
    if (path.startsWith('//')) return full;
    if (!suffix) return full;
    const search = suffix.startsWith('?') ? suffix.slice(1).split('#')[0] : '';
    const hashIdx = suffix.indexOf('#');
    const hash = hashIdx >= 0 ? suffix.slice(hashIdx) : '';
    if (!search) return full;
    // Repair `?amp;foo=bar` → `?foo=bar` first (Shopify HTML-entity
    // encoding artifact: `&amp;` between params survives a copy-paste
    // and pollutes the first param name as `amp;<name>`).
    const repaired = search.replace(/(^|&)amp;/g, '$1');
    const params = new URLSearchParams(repaired);
    const { shouldRedirect, cleanSearch } = canonicalizeRouteParams(path, params);
    if (!shouldRedirect) return full;
    const qs = cleanSearch.toString();
    const cleanSuffix = (qs ? `?${qs}` : '') + hash;
    return `href=${q}${path}${cleanSuffix}${q}`;
  });
}

/**
 * Resolve a single internal path through the redirects table. Returns
 * the chain-collapsed terminal destination if `path` is a known
 * redirect source; otherwise returns the input unchanged.
 *
 * Used by the HTML sitemap page (and any other coded route that renders
 * `<Link href={…}>` from an inventory snapshot) so the rendered hrefs
 * point at canonical URLs, not the stale handles `redirects.json`
 * already 301s away. SEMrush counts a hardcoded link to a redirect
 * source as a "Permanent redirect in internal links" hit even when the
 * 301 itself works correctly — same data, single source of truth.
 *
 * Query strings + hash fragments are preserved on the destination.
 */
export function resolveRedirectPath(path: string): string {
  if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//')) return path;
  const [base, ...rest] = path.split(/(?=[?#])/);
  const dest = REDIRECT_TARGET.get(normRedirectPath(base));
  return dest ? dest + rest.join('') : path;
}

const HOSTS_TO_REWRITE = [
  // Dev tunnels. Add more as they show up.
  /https?:\/\/[a-z0-9-]+\.trycloudflare\.com/gi,
  // Our own production domain — should be relative when we serve from
  // it. Also catches the `checkout.` subdomain: merchant bodies link
  // e.g. https://checkout.mattressstoreslosangeles.com/collections/…
  // (SEMrush 20260518 flagged a checkout-subdomain link leak); the path
  // resolves on our storefront once the host is stripped.
  /https?:\/\/(?:www\.|checkout\.)?mattressstoreslosangeles\.com/gi,
  // Shopify legacy / mirror hosts that should always be relative paths in
  // our storefront.
  /https?:\/\/la-mattress\.myshopify\.com/gi,
];

// Phase 262: rewrite Hydrogen-era CDN URLs to the canonical Shopify CDN.
// Merchant-authored article bodies (imported from the old Hydrogen site)
// contain `<a href="https://mattressstoreslosangeles.com/cdn/shop/files/…">`
// link wrappers around `<img>` tags. The host-strip pass below would turn
// these into `/cdn/shop/files/…` — a path our headless storefront doesn't
// serve, so it 404s and SEMrush flagged it under "Broken internal images."
// Rewriting to `cdn.shopify.com/s/files/<shop-id>/{files,products}/…`
// points the link at the original full-resolution asset (the merchant's
// intent: click an article image to view it bigger).
//
// Shop ID `1/0684/1759` matches the IDs already used in product
// `featuredImage.url` payloads from the Storefront API.
const HYDROGEN_CDN_REWRITE = /https?:\/\/(?:www\.)?mattressstoreslosangeles\.com\/cdn\/shop\/(files|products)\//gi;
const SHOPIFY_CDN_PREFIX = 'https://cdn.shopify.com/s/files/1/0684/1759/';

// Matches an entire `<iframe …></iframe>` (and self-closing variants) when
// the `src` attribute references Google Maps. Single-line `s` flag covers
// merchant-pasted markup that often spans multiple lines with embedded
// width / height / allowfullscreen attrs.
const GOOGLE_MAPS_IFRAME = /<iframe\b[^>]*\bsrc=["'][^"']*(?:google\.com\/maps|maps\.google\.com)[^"']*["'][^>]*>[\s\S]*?<\/iframe>/gi;

// Phase 264: strip `<a>` tags whose inner HTML has no visible anchor text
// and no `<img>` (so links wrapping images stay intact). Several merchant
// articles imported from the old Hydrogen site have empty link wrappers
// like `<a href="X"><strong></strong></a>` or `<a href="X"><span class="15"></span></a>`
// — invisible zero-width links that SEMrush flags under "Links with no
// anchor text." Removing them is safe: a link with no visible content
// can't be clicked or read by a screen reader anyway.
const EMPTY_ANCHOR = /<a\b[^>]*>([\s\S]*?)<\/a>/gi;
function stripEmptyAnchors(html: string): string {
  return html.replace(EMPTY_ANCHOR, (match, inner: string) => {
    if (/<img\b/i.test(inner)) return match; // image-only link → keep
    const text = inner.replace(/<[^>]+>/g, '').replace(/&nbsp;|\s+/g, '').trim();
    return text === '' ? '' : match;
  });
}

// Phase 295: unwrap anchors whose href is malformed. Several legacy
// imported article bodies have hrefs that are not URLs at all —
// product names or phrases (`href="Best Affordable Queen Mattress"`),
// bare domain text (`href="MattressStoresLosAngeles.com"`) — which the
// browser/crawler resolves relative to the current path and 404s
// (SEMrush 20260518 "4xx errors" on /blogs/.../<phrase>). Runs AFTER
// host-strip + redirect resolution, so a valid (even redirecting)
// internal href is never treated as malformed. Keeps the visible text,
// drops only the broken link — same philosophy as stripEmptyAnchors
// (an unfollowable 404 link is worse than no link). Also incidentally
// neutralizes javascript:/data: hrefs (no allowed prefix).
const ANCHOR_TAG = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
const HREF_VALUE = /\bhref\s*=\s*("|')(.*?)\1/i;
const VALID_HREF_PREFIX = /^(?:\/|#|https?:\/\/|mailto:|tel:|\?)/i;
function stripMalformedHrefAnchors(html: string): string {
  return html.replace(ANCHOR_TAG, (match, attrs: string, inner: string) => {
    const hm = HREF_VALUE.exec(attrs);
    if (!hm) return match; // no href attr — not our concern here
    const href = hm[2].trim();
    if (href === '') return match; // empty href handled by stripEmptyAnchors
    const ok = VALID_HREF_PREFIX.test(href) && !/\s/.test(href);
    return ok ? match : inner; // malformed → unwrap, keep text
  });
}

// Phase 296: strip nofollow/sponsored/ugc from anchors whose href is
// INTERNAL. Merchant product/blog bodies (esp. ~PDP descriptions: the
// "Read More" → /pages/warranty pattern + other in-body links) carry
// rel="nofollow" on same-site links. Once Phase 293 resolves those
// hrefs to clean root-relative internal URLs, SEMrush correctly
// reclassifies them as "Nofollow attributes in internal links" (347
// PDPs in the 20260518 _2 re-crawl). You should never nofollow your
// own internal links — it blocks internal PageRank flow for no
// benefit (Google's crawl-budget rationale for nofollow ended in
// 2019). EXTERNAL nofollow is often intentional and is left intact.
// Runs AFTER host-strip + redirect resolution so "starts with /" is a
// reliable internal-link test. Other rel tokens (noopener, noreferrer)
// are preserved; an emptied rel attribute is dropped. Idempotent.
const REL_ATTR = /\s+rel\s*=\s*("|')(.*?)\1/i;
const REL_DROP = /^(?:nofollow|sponsored|ugc)$/i;
function stripInternalLinkNofollow(html: string): string {
  return html.replace(ANCHOR_TAG, (match, attrs: string, inner: string) => {
    const hm = HREF_VALUE.exec(attrs);
    if (!hm) return match;
    const href = hm[2].trim();
    // Internal = root-relative, not protocol-relative "//host".
    if (!href.startsWith('/') || href.startsWith('//')) return match;
    const rm = REL_ATTR.exec(attrs);
    if (!rm) return match;
    const kept = rm[2].split(/\s+/).filter((t) => t && !REL_DROP.test(t));
    if (kept.length === rm[2].trim().split(/\s+/).filter(Boolean).length) {
      return match; // nothing to drop
    }
    const newAttrs =
      kept.length === 0
        ? attrs.replace(REL_ATTR, '')
        : attrs.replace(REL_ATTR, ` rel=${rm[1]}${kept.join(' ')}${rm[1]}`);
    return `<a${newAttrs}>${inner}</a>`;
  });
}

// Phase 271b: rewrite the boilerplate "Read More" anchor text on
// /pages/mattress-warranty links. ~18 product description templates
// share this exact link pattern in their Warranty row:
//   <a href="/pages/mattress-warranty">Read More</a>
// SEMrush flags "Read More" as non-descriptive anchor text. Rather than
// mutating 18 product descriptions individually, we transform the
// anchor text at render time so any product (current or future) with
// this boilerplate gets the descriptive replacement automatically.
//
// Pattern is narrowly scoped to mattress-warranty hrefs so we don't
// accidentally rewrite other "Read More" links that may be legitimate.
const WARRANTY_READ_MORE = /(<a\b[^>]*\bhref="\/pages\/mattress-warranty"[^>]*>)\s*Read More\s*(<\/a>)/gi;

// Phase 281: downgrade merchant-authored <h1> tags to <h2> inside
// rendered Shopify body content. The route templates already emit a
// single <h1> for the page title (article title on /blogs/*/*, product
// title on /products/*, page title on /pages/*) — but the merchant body
// rendered via dangerouslySetInnerHTML often contains its own <h1>
// (Word/Docs paste artifact or merchant convention). Result: two h1s on
// the same page, which SEMrush flags as "Multiple h1 tags" (295 URLs in
// the May 14 audit, mostly blog articles + 22 PDPs).
//
// Downgrading to h2 fixes the SEO issue and gives a sensible visual
// hierarchy (page title h1 → first-level section h2). No content lost.
const MERCHANT_H1_OPEN  = /<h1(\b[^>]*)>/gi;
const MERCHANT_H1_CLOSE = /<\/h1>/gi;

// PLP v2 / stress-test S1: when the merchant's collection
// descriptionHtml is moved BELOW the product grid (via PlpContentBlock),
// it lives inside a region that already has its own <h2> title
// ("About {collection.title}"). If the merchant body contains its own
// <h1> or <h2>, those would compete with both the page <h1> and that
// region's <h2>. The "demoteHeadings" option flattens both H1 and H2 in
// merchant content down to H3 so the hierarchy reads:
//   <h1>     collection title (page)
//   <h2>     About {collection.title} (PlpContentBlock)
//   <h3>     merchant section heading
//   <h3>     FAQ "Common questions" eyebrow
const MERCHANT_H2_OPEN  = /<h2(\b[^>]*)>/gi;
const MERCHANT_H2_CLOSE = /<\/h2>/gi;

// Phase 290: strip click-tracking query parameters from links in
// merchant-authored article bodies. The May 15 SEMrush re-audit
// flagged 64 articles with 89 "broken external links" instances.
// Inspection of a sample showed most are URLs ending in
// `?srsltid=AfmBOop...` — Google Shopping click-through tracking
// tokens that merchants accidentally paste when copy-linking from
// Google search / Shopping results. Google's tracker returns
// non-200 status codes for non-browser User-Agents (SEMrush,
// Bingbot, etc.), so the link counts as broken in audits.
//
// Stripping the param leaves the bare destination URL which works
// for both end users (they just lose Google's tracking, which they
// shouldn't be sending anyway) and crawlers.
//
// Also covers Shopify's session-tracking params (`_pos`, `_sid`,
// `_ss`) which can appear on internal links pasted from a browser
// session. Those are already disallowed in robots.txt (Phase 273)
// but stripping them from rendered hrefs reduces wasted crawl
// budget and avoids leaking session IDs into the public site.
//
// Idempotent — running the regex twice yields the same result. Safe
// to call on already-clean URLs.
const TRACKING_PARAM_LEADING = /\?(?:srsltid|_pos|_sid|_ss)=[^&"'#\s]*(&[^"'\s]*)?/g;
const TRACKING_PARAM_FOLLOWING = /&(?:srsltid|_pos|_sid|_ss)=[^&"'#\s]*/g;

function stripTrackingParams(html: string): string {
  // Loop until stable — handles the multi-tracker case
  // `?_pos=X&_sid=Y&_ss=Z` where one pass only strips one param. 5
  // iterations is more than enough (longest real-world chain is 3-4).
  let out = html;
  for (let i = 0; i < 5; i += 1) {
    const before = out;
    // Strip "?<tracker>=X" or "?<tracker>=X&other=Y" — preserve "?other=Y" when other params follow.
    out = out.replace(TRACKING_PARAM_LEADING, (_, rest) => (rest ? '?' + rest.slice(1) : ''));
    // Strip "&<tracker>=X" — drop the param + its leading ampersand.
    out = out.replace(TRACKING_PARAM_FOLLOWING, '');
    if (out === before) break;
  }
  return out;
}

export type SanitizeOptions = {
  /**
   * When true, merchant <h1> and <h2> in the source HTML are both
   * downgraded to <h3>. Use this when rendering merchant body content
   * inside a region that already has its own <h2> (e.g. PlpContentBlock
   * below the collection product grid). Default false (preserves the
   * existing Phase 281 behavior — H1 → H2, H2 untouched).
   */
  demoteHeadings?: boolean;
};

/**
 * Repair U+FFFD (�) mojibake from the old Shopify export's bad UTF-8
 * transcode. Order matters — recover known characters before treating
 * the rest as a lost space / stray garbage:
 *   1. `TEMPUR-ES�`  → `TEMPUR-ES®`   (lost registered-trademark)
 *   2. `20�C` / `�F` → `20°C` / `°F`  (lost degree sign)
 *   3. `…>�` / `�<…`  → drop           (garbage hugging a tag boundary)
 *   4. remaining `�+` → single space   (the char was a word/sentence gap,
 *                                       e.g. "5 Ways�to" → "5 Ways to")
 * Tag-structure-safe: only operates on the text payload, never on
 * `< > = "` so HTML markup is untouched. Idempotent (no � left to match).
 * Exported for unit testing.
 */
export function repairMojibake(html: string): string {
  if (!html || html.indexOf('�') === -1) return html;
  let s = html;
  s = s.split('TEMPUR-ES�').join('TEMPUR-ES®');
  s = s.replace(/(\d)\s*�\s*([CF])\b/g, '$1°$2');
  s = s.replace(/�([CF])\b/g, '°$1');
  s = s.replace(/>�+/g, '>');
  s = s.replace(/�+</g, '<');
  s = s.replace(/�+/g, ' ');
  s = s.replace(/[ \t]{2,}/g, ' ');
  return s;
}

/**
 * Strip TinyMCE / Word editor cruft that Shopify's rich-text editor bakes
 * into saved HTML — it has zero rendering or semantic value but bloats the
 * markup, the single largest driver of the Semrush "Low text-to-HTML ratio"
 * flag (1,071 pages). A single imported article carries 800+ `data-mce-*`
 * attributes plus thousands of inert `<span>` wrappers and Word `mso-*`
 * styles. Cleans, in order:
 *   1. `data-mce-*` editor attributes
 *   2. inside `style=""` — drop Word `mso-*` declarations and redundant
 *      `font-weight:400|normal`; remove the attribute if nothing's left
 *   3. empty `<span>…</span>` (now that their attrs may be gone)
 *   4. unwrap attribute-less `<span>flat text</span>` → its text (two
 *      passes for adjacency; only matches spans with no nested tags, so
 *      nesting is never broken)
 * Validated content-preserving: across a 50-article sample the text
 * character stream is byte-identical before/after — only markup is removed.
 * Tag-structure-safe; exported for unit testing.
 */
export function stripEditorCruft(html: string): string {
  if (!html) return html;
  let s = html;
  // 1) editor-only data-mce-* attributes
  s = s.replace(/\s+data-mce-[\w-]+="[^"]*"/g, '').replace(/\s+data-mce-[\w-]+='[^']*'/g, '');
  // 2) prune Word/redundant declarations inside style="" (drop attr if empty)
  s = s.replace(/\s+style="([^"]*)"/g, (_m, body: string) => {
    const keep = body
      .split(';')
      .map((d) => d.trim())
      .filter(Boolean)
      .filter((d) => {
        const prop = d.split(':')[0].trim().toLowerCase();
        const val = (d.split(':')[1] ?? '').trim().toLowerCase();
        if (prop.startsWith('mso-')) return false;
        if (prop === 'font-weight' && (val === '400' || val === 'normal')) return false;
        return true;
      });
    return keep.length ? ` style="${keep.join('; ')}"` : '';
  });
  // 3) empty spans (with or without remaining attrs)
  s = s.replace(/<span\b[^>]*>\s*<\/span>/g, '');
  // 4) unwrap inert attribute-less spans around flat text (no nested tags)
  for (let i = 0; i < 2; i += 1) s = s.replace(/<span>([^<>]*)<\/span>/g, '$1');
  s = s.replace(/[ \t]{2,}/g, ' ');
  return s;
}

/**
 * Drop <img> tags that hotlink the former parent brand's site
 * (restonic.com). Dozens of legacy imported blog posts embed images from
 * `restonic.com/wp-content/uploads/...` — third-party hotlinks that have
 * since 404'd (SEMrush 20260603 "broken external images": e.g. the
 * memory-foam post's two 2014 NASA/sleep images, the presidential-sleep
 * post's three 2017 portraits). They render as broken-image icons and we
 * can't re-host what's gone, so remove the <img> entirely and collapse
 * any paragraph it leaves empty. Scoped to the single dead host so
 * legitimate (Shopify-CDN and other) images are untouched; fixing at
 * render time clears every affected post in one place without per-article
 * Shopify edits. Tag-structure-safe; exported for unit testing.
 */
export function stripDeadHotlinks(html: string): string {
  if (!html) return html;
  let s = html;
  // Any <img …> whose attributes reference restonic.com (src or srcset).
  s = s.replace(/<img\b[^>]*\brestonic\.com[^>]*>/gi, '');
  // Collapse paragraphs left empty by the removal.
  s = s.replace(/<p>\s*<\/p>/gi, '');
  return s;
}

/**
 * Confirmed-dead external links — anchors whose href permanently 404s.
 * SEMrush "Broken external links" warning (12) flags links in merchant
 * article bodies; these are the genuinely-dead ones (a competitor blog
 * URL that no longer exists), distinct from transient 429/503 rate-limit
 * responses on live research citations (which we keep — removing valid
 * sources would weaken E-E-A-T). Unwraps the anchor, preserving its
 * visible text so the sentence still reads. Tag-safe; exported for tests.
 */
const DEAD_EXTERNAL_LINK_HREFS: ReadonlyArray<RegExp> = [
  // mattressland.com/blog/allergy-symptoms → permanent 404.
  /mattressland\.com\/blog\/allergy-symptoms/i,
  // melbourneherniasurgery.com.au/after-hernia-repair.html → permanent 404
  // (SEMrush audit 20260626, broken external links id 12). Linked from the
  // can-i-sleep-on-my-side-after-hernia-repair-surgery article.
  /melbourneherniasurgery\.com\.au\/after-hernia-repair/i,
  // aditicorporation.in/blog/sleep-joint-replacement-surgery/ → HTTP 500
  // (SEMrush audit 20260627, broken external links id 12). Linked from the
  // when-can-you-sleep-on-your-back-after-hip-replacement article.
  /aditicorporation\.in\/blog\/sleep-joint-replacement-surgery/i,
  // zimlin.com/how-to-pack-a-mattress-in-a-box/ → HTTP 500
  // (SEMrush audit 20260627, broken external links id 12). Linked from the
  // how-to-price-a-used-purple-mattress article.
  /zimlin\.com\/how-to-pack-a-mattress-in-a-box/i,
  // healthline.com/health/healthy-sleep/memory-foam-vs-hybrid → HTTP 502
  // (SEMrush audit 20260630, broken external links id 12). Linked from the
  // what-is-the-best-mattress-for-fibromyalgia-pain-relief article. Healthline
  // removed the article without setting up a 301 — likely consolidated.
  /healthline\.com\/health\/healthy-sleep\/memory-foam-vs-hybrid/i,
  // ariaprene.com/blog/what-is-foam-core/ → HTTP 503
  // (SEMrush audit 20260630, broken external links id 12). Linked from the
  // best-mattress-for-sacroiliac-joint-pain article. Ariaprene's blog has
  // been intermittent — flagged as broken here regardless of whether
  // it later recovers; the link is replaceable, the article isn't.
  /ariaprene\.com\/blog\/what-is-foam-core/i,
];

export function unwrapDeadExternalLinks(html: string): string {
  if (!html) return html;
  let s = html;
  for (const pat of DEAD_EXTERNAL_LINK_HREFS) {
    const re = new RegExp(
      `<a\\b[^>]*\\bhref=["'][^"']*(?:${pat.source})[^"']*["'][^>]*>([\\s\\S]*?)<\\/a>`,
      'gi',
    );
    s = s.replace(re, '$1');
  }
  return s;
}

/**
 * Normalize the business's stale contact info to the current canonical
 * values across all merchant HTML. Many merchant-authored page bodies
 * hardcode the Studio City showroom's local number (818) 247-7790 as if
 * it were the generic business phone (a leftover from when the site
 * treated the Studio City line as the catch-all). The current canonical
 * sitewide contact (matching the merchant account + the site_config
 * metaobject) is (800) 218-3578 / lamattressplus@gmail.com. Rewriting
 * at render keeps NAP consistent sitewide without per-page Shopify edits
 * and self-heals future imports. The Studio City showroom detail surfaces
 * render their 818 number from lib/showrooms.ts (not sanitized HTML), so
 * those are unaffected — only stale 818-as-business strings in merchant
 * body HTML get rewritten. The legacy orders.lamattress email is also
 * redirected to the canonical lamattressplus address. Order matters:
 * rewrite `tel:` hrefs (need digits) before the visible formatted number
 * (need the display form). Tag-safe — only the specific stale strings
 * are touched. Exported for unit testing.
 */
export function normalizeContactInfo(html: string): string {
  if (!html) return html;
  let s = html;
  // Legacy email → canonical (case-insensitive).
  s = s.replace(/orders\.lamattress@gmail\.com/gi, 'lamattressplus@gmail.com');
  // `tel:` hrefs in any form (tel:+18182477790, tel:8182477790,
  // tel:+1-818-247-7790, etc.) → canonical RFC 3966 of the 800 number.
  s = s.replace(/tel:\+?1?[-.\s]?\(?818\)?[-.\s]?247[-.\s]?7790/gi, 'tel:+18002183578');
  // Visible formatted number in any common separator style → new display.
  s = s.replace(/\(?818\)?[-.\s]?247[-.\s]?7790/g, '(800) 218-3578');
  return s;
}

export function sanitizeShopifyHtml(
  html: string | null | undefined,
  options: SanitizeOptions = {},
): string {
  if (!html) return '';
  let out = html;
  // Repair mojibake FIRST so every downstream pass (and the rendered
  // page) sees clean text. ~26% of the imported blog bodies carry U+FFFD
  // replacement chars (�) from a bad UTF-8 transcode in the old Shopify
  // export — "20�C", "5 Ways�to", "TEMPUR-ES�", and stray � at tag/
  // sentence boundaries. Rendering these is unprofessional and dings the
  // readability/quality signals Semrush flags. Fixing at render time
  // cleans all affected articles/pages/collection bodies in one place,
  // no per-article Shopify edits, and covers any future bad import.
  out = repairMojibake(out);
  // Parser-based allowlist pass (see SANITIZE_CONFIG) — after the text-
  // level mojibake repair, before every markup-level pass, so the regex
  // passes below only ever operate on well-formed, script-free HTML.
  out = sanitizeHtml(out, SANITIZE_CONFIG);
  // Strip TinyMCE editor cruft (data-mce-*) — big text-to-HTML-ratio win.
  out = stripEditorCruft(out);
  // Remove dead restonic.com hotlinked images (broken-image renders).
  out = stripDeadHotlinks(out);
  // Unwrap confirmed-dead external anchors (permanent 404s) — keeps the
  // text, drops the broken link (SEMrush broken-external-links warning 12).
  out = unwrapDeadExternalLinks(out);
  // Normalize the business's old phone/email to the current contact (NAP).
  out = normalizeContactInfo(out);
  // Phase 262: rewrite Hydrogen-era CDN URLs FIRST, before the generic
  // host-strip below — otherwise the host gets stripped to a dead
  // root-relative path before we get a chance to redirect to cdn.shopify.com.
  out = out.replace(HYDROGEN_CDN_REWRITE, SHOPIFY_CDN_PREFIX + '$1/');
  for (const re of HOSTS_TO_REWRITE) out = out.replace(re, '');
  out = out.replace(GOOGLE_MAPS_IFRAME, '');
  // Phase 290: strip srsltid + Shopify session-tracking params from
  // hrefs (see TRACKING_PARAM_* docstring above for rationale).
  out = stripTrackingParams(out);
  out = stripEmptyAnchors(out);
  out = out.replace(WARRANTY_READ_MORE, '$1Mattress warranty details$2');
  // Phase 293: resolve internal links that 301-redirect → final
  // destination. AFTER WARRANTY_READ_MORE so that anchor-text rewrite
  // still keys off the original /pages/mattress-warranty href; this
  // pass then also collapses that href to its terminal /pages/warranty.
  out = resolveRedirectHrefs(out);
  // After path-level redirects collapse, also strip Shopify URL-
  // decoration query params (?amp;_fid=, ?_ss=, ?_sid=, ?_psq=, etc.)
  // so internal hrefs land on the middleware's canonical form without
  // the 301 hop. SEMrush 20260630.
  out = stripNoiseParams(out);
  // Phase 295: AFTER redirect resolution so a valid (even redirecting)
  // href is never misjudged as malformed — only genuine non-URL hrefs
  // (phrases, bare domain text) get unwrapped.
  out = stripMalformedHrefAnchors(out);
  // Phase 296: drop nofollow/sponsored/ugc on now-internal links.
  out = stripInternalLinkNofollow(out);
  if (options.demoteHeadings) {
    out = out.replace(MERCHANT_H1_OPEN, '<h3$1>').replace(MERCHANT_H1_CLOSE, '</h3>');
    out = out.replace(MERCHANT_H2_OPEN, '<h3$1>').replace(MERCHANT_H2_CLOSE, '</h3>');
  } else {
    out = out.replace(MERCHANT_H1_OPEN, '<h2$1>').replace(MERCHANT_H1_CLOSE, '</h2>');
  }
  // Some legacy article bodies were imported with bad encoding and contain
  // U+FFFD (the � replacement char). Drop them — they only ever render as
  // visible glyphs that look broken.
  out = out.replace(/�/g, '');
  // Performance pass — defer to lazy-loading + Shopify-CDN width hints.
  // Body images are always below the fold (the hero/cover image is
  // rendered separately by the article page template via next/image with
  // priority). SEMrush audit 20260627 flagged best-black-bedroom-sets at
  // 5,274ms — an old auto-published article serving full-resolution
  // Shopify CDN images. This pass applies to every Shopify-content body
  // (articles, pages, collection descriptions), so the win is site-wide.
  out = optimizeBodyImages(out);
  return out;
}

/**
 * Defer body images and constrain Shopify-CDN payload size at render
 * time. Two cheap, idempotent rewrites:
 *
 *   1. Add `loading="lazy" decoding="async"` to every `<img>` that
 *      doesn't already have those attributes. Safe because body images
 *      are always below the fold here (page templates render the cover/
 *      hero via next/image separately).
 *
 *   2. For Shopify-CDN `<img src>` URLs (cdn.shopify.com / cdn.shopifycdn.com)
 *      that have NO `srcset` (so they're not already responsive) and NO
 *      explicit `width` URL parameter, append `?width=1200` (or `&width=…`
 *      if the URL already carries a query string). Shopify's CDN honors
 *      this and re-encodes the image at that width on the fly — typical
 *      savings on a full-res hero image are 70–90% of payload.
 *
 * Tag-safe: only matches `<img …>` open tags, leaves quoted attribute
 * values alone, and short-circuits when the attribute is already present.
 */
function optimizeBodyImages(html: string): string {
  if (!html) return html;
  const SHOPIFY_CDN_HOST = /(?:cdn\.shopify\.com|cdn\.shopifycdn\.com)/i;
  return html.replace(/<img\b([^>]*)>/gi, (full, attrs: string) => {
    let next = attrs;
    if (!/\bloading\s*=/i.test(next)) next += ' loading="lazy"';
    if (!/\bdecoding\s*=/i.test(next)) next += ' decoding="async"';
    if (!/\bsrcset\s*=/i.test(next)) {
      next = next.replace(/\bsrc\s*=\s*("|')([^"']+)\1/i, (m: string, q: string, src: string) => {
        if (!SHOPIFY_CDN_HOST.test(src)) return m;
        if (/[?&]width=\d+/i.test(src)) return m;
        const sep = src.includes('?') ? '&' : '?';
        return `src=${q}${src}${sep}width=1200${q}`;
      });
    }
    return `<img${next}>`;
  });
}
