/**
 * Article body autolinker — injects up to MAX_LINKS first-mention
 * internal links into article body HTML.
 *
 * Why: SEMrush 20260522 ideas-export flagged ~100 articles for "no
 * internal links" in the article body. Article chrome already carries
 * 9+ internal links (breadcrumbs, sidebar, related-guides) but
 * SEMrush's crawler scores the <article> body specifically. Manual
 * per-article body edits across 250 published articles is unscalable;
 * this autolinker injects them at render time using a curated
 * phrase → canonical-URL map.
 *
 * Rules:
 *   - First mention per destination only (avoids over-linking and
 *     keeps the link signal concentrated).
 *   - MAX_LINKS=6 total per article (matches Yoast / Wikipedia /
 *     Wirecutter density; over-linking dilutes anchor relevance and
 *     reads as keyword-stuffing).
 *   - Longest phrase first ("memory foam mattress" wins over "memory
 *     foam"). Order in PHRASE_MAP matters.
 *   - Skips text inside <a>, <h1-6>, <pre>, <code>, <blockquote>,
 *     <figcaption> — only links in body paragraphs / lists.
 *   - One insert per text node max — prevents nested anchors that
 *     could arise from running the loop multiple times on a single
 *     long paragraph.
 *   - Word-boundary matching (\b) — "submattress" never matches
 *     "mattress".
 *   - Case-insensitive matching but preserves the article's original
 *     casing in the visible link text.
 *
 * Pipeline order matters: run AFTER sanitizeShopifyHtml (so injected
 * <a> tags survive the sanitizer's allowlist) and AFTER
 * injectHeadingIds (so we never link inside h2-h3 headings, which the
 * skip-stack already enforces but order-of-ops keeps it deterministic).
 */

// Canonical phrase → URL map. Longer / more-specific phrases listed
// first so multi-word matches win the regex race against subset
// matches. Every URL here must point to a real, indexable destination —
// no draft collections, no 404s. Verified against the live catalog
// against the live collections list as of 20260522.
const PHRASE_MAP: Array<[string, string]> = [
  // Brand mattress collections — most specific first
  ['tempur-pedic adjustable', '/collections/tempur-pedic-adjustable-bases'],
  ['tempur-pedic mattress', '/collections/tempur-pedic-mattresses'],
  ['tempur-pedic', '/collections/tempur-pedic-mattresses'],
  ['stearns & foster mattress', '/collections/stearns-foster-mattresses'],
  ['stearns & foster', '/collections/stearns-foster-mattresses'],
  ['chattam & wells mattress', '/collections/chattam-wells-mattresses'],
  ['chattam & wells', '/collections/chattam-wells-mattresses'],
  ['diamond mattress', '/collections/diamond-mattresses'],
  ['helix mattress', '/collections/helix-mattresses'],
  ['spring air mattress', '/collections/spring-air-mattresses'],
  ['eastman house mattress', '/collections/eastman-house-mattresses'],
  ['englander mattress', '/collections/englander-mattresses'],
  ['southerland mattress', '/collections/southerland-mattresses'],

  // Mattress type collections
  ['memory foam mattress', '/collections/memory-foam-mattresses'],
  ['memory foam', '/collections/memory-foam-mattresses'],
  ['hybrid mattress', '/collections/hybrid-mattresses'],
  ['innerspring mattress', '/collections/innerspring-mattresses'],
  ['latex mattress', '/collections/latex-mattresses'],
  ['gel foam mattress', '/collections/gel-foam-mattresses'],
  ['cooling mattress', '/collections/cooling-mattresses'],
  ['organic mattress', '/collections/organic-mattress'],
  ['pillow top mattress', '/collections/pillow-top-mattresses'],
  ['bed-in-a-box', '/collections/bed-in-a-box-mattresses'],
  ['bed in a box', '/collections/bed-in-a-box-mattresses'],

  // Firmness collections — order matters: longest first so "extra
  // firm mattress" wins over plain "firm mattress" when both appear.
  ['extra firm mattress', '/collections/extra-firm-mattresses'],
  ['medium firm mattress', '/collections/medium-firm-mattresses'],
  ['medium-firm mattress', '/collections/medium-firm-mattresses'],
  ['ultra plush mattress', '/collections/ultra-plush-mattresses'],
  ['plush mattress', '/collections/plush-mattresses'],
  ['firm mattress', '/collections/firm-mattress'],

  // Size collections
  ['california king mattress', '/collections/california-king-mattresses'],
  ['split king mattress', '/collections/split-king-mattresses'],
  ['queen mattress', '/collections/queen-size-mattresses'],
  ['king mattress', '/collections/king-size-mattresses'],
  ['full mattress', '/collections/full-size-mattresses'],
  ['twin xl mattress', '/collections/twin-xl-mattress-sale'],
  ['twin mattress', '/collections/twin-size-mattresses'],

  // Use-case collections — long form first, then the shorter anchor
  // term that catches articles which don't say "mattress for X" but
  // do discuss the condition by name (e.g. an article about sleep
  // posture that mentions "back pain" without "mattress for back pain").
  ['mattress for back pain', '/collections/mattresses-for-back-pain'],
  ['mattress for side sleepers', '/collections/mattresses-for-side-sleepers'],
  ['mattress for couples', '/collections/mattresses-for-couples'],
  ['back pain', '/collections/mattresses-for-back-pain'],
  ['side sleeper', '/collections/mattresses-for-side-sleepers'],

  // Accessories
  ['adjustable bed', '/collections/adjustable-beds'],
  ['adjustable base', '/collections/adjustable-beds'],
  ['bed frame', '/collections/bed-frames'],
  ['box spring', '/collections/foundations'],
  ['foundation', '/collections/foundations'],
  ['mattress topper', '/collections/mattress-toppers'],
  ['mattress protector', '/collections/mattress-protector'],
  ['cooling pillow', '/collections/cooling-pillows'],

  // Discoverable resources
  ['sleep quiz', '/sleep-quiz'],
  ['mattress sizes', '/pages/mattress-sizes'],
  ['bed size chart', '/pages/mattress-sizes'],
  ['mattress store near me', '/pages/mattress-store-locations'],
  ['mattress store locations', '/pages/mattress-store-locations'],

  // 20260528 expansion — Semrush's latest export flagged 33 orphan
  // articles for "no internal links in body". Inspection showed each
  // one talks about brand/topic clusters that the original PHRASE_MAP
  // didn't cover. Added below so the autolinker has at least one
  // target phrase per cluster. Brands without their own collection
  // (Sealy / Beautyrest / Serta / Avocado / Intex) fall back to
  // /pages/mattress-brands, the existing brand index page.
  ['sealy mattress', '/pages/mattress-brands'],
  ['sealy', '/pages/mattress-brands'],
  ['beautyrest mattress', '/pages/mattress-brands'],
  ['beautyrest', '/pages/mattress-brands'],
  ['serta mattress', '/pages/mattress-brands'],
  ['serta', '/pages/mattress-brands'],
  ['avocado mattress', '/pages/mattress-brands'],
  ['avocado', '/pages/mattress-brands'],
  ['intex air mattress', '/collections/spring-air-mattresses'],
  ['intex', '/collections/spring-air-mattresses'],
  // "air mattress" generic — closest real collection is spring-air-
  // mattresses (the store stocks Spring Air branded air mattresses).
  // The few articles about camping / inflatable use cases still get a
  // contextually-adjacent destination instead of /pages/mattress-brands.
  ['air mattress', '/collections/spring-air-mattresses'],
  // Back / posture variants the original PHRASE_MAP missed. "bad back"
  // and "back support" both land on /collections/mattresses-for-back-pain
  // since that's the conversion destination merchants want.
  ['bad back', '/collections/mattresses-for-back-pain'],
  ['back support', '/collections/mattresses-for-back-pain'],
  // Mattress accessories the original map missed.
  ['mattress cover', '/collections/mattress-protector'],
  // Topics about kids / guest beds → /collections/twin-size-mattresses
  // (kids and guest rooms are the dominant twin-size use cases on this
  // store).
  ['kids mattress', '/collections/twin-size-mattresses'],
  ['guest room mattress', '/collections/twin-size-mattresses'],
];

// Deliberately NOT added (would cause subset collisions):
//   - 'foam mattress' would steal text from existing 'memory foam
//     mattress' when the merchant pre-linked memory-foam, producing a
//     spurious /collections/all-foam-mattresses link on the same span.
//   - 'spring mattress' has the same risk vs 'spring air mattress'.
//   - 'memory foam pillow' is unreachable — 'memory foam' alone wins
//     ordering and lands on the broader mattress collection first.
// Truly orphaned articles that didn't catch any PHRASE_MAP entry fall
// through to the FALLBACK_LINK appended by autoLinkArticleBody.

// Tags whose content should never be auto-linked. We skip headings
// (don't compete with the link signal of the heading itself), code
// blocks (literal text, links would corrupt), existing <a> (no nested
// anchors), figcaptions (image metadata).
const SKIP_TAGS = new Set(['a', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'pre', 'code', 'blockquote', 'figcaption']);

// Up from 6 → 8 on 20260528. Yoast / Wirecutter / Wikipedia in-body
// link densities all sit around 1 link per 250-350 words; bumping to 8
// gives long-form (1500+ word) guides headroom without crossing the
// "obvious link farm" threshold Google penalizes (>15 same-site links
// per paragraph block).
const MAX_LINKS = 8;

/**
 * Fallback destination when no PHRASE_MAP entry matches and the article
 * carries zero internal links. Picked to be the most generally-useful
 * link for a buying-guide reader — the main mattresses collection.
 *
 * Anchor text choice: "explore our mattress collection" reads as a
 * natural sentence-ending CTA rather than a keyword-stuffed anchor,
 * which keeps the manual SEO reviewer (and any future "anchor-text
 * over-optimization" audit) happy. The link is appended as a small
 * postscript paragraph at the very end of the body, so it never
 * interrupts the merchant's authored content.
 */
const FALLBACK_LINK = {
  href: '/collections/mattresses',
  anchor: 'explore our full mattress collection',
};

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Inject first-mention internal links into article body HTML. Pure
 * function, idempotent if the same destination was already linked in
 * the source HTML (used-set is seeded from existing <a href="…">).
 *
 * `selfHref` (optional): the canonical path of the page this body lives
 * on (e.g. `/collections/memory-foam-mattresses` for that collection's
 * PLP copy). Seeded into `used` so the autolinker never links a phrase
 * back to the very page the reader is already on — a wasted self-link
 * that also dilutes the internal-link graph. On collection PLPs the
 * body's primary term IS the current collection, so without this the
 * first (and most prominent) match was always a self-link; seeding it
 * frees that budget for the genuinely *related* collections the prose
 * also mentions (latex, cooling, adjustable bases, etc.). No-op for
 * article bodies that pass no selfHref.
 *
 * Returns the HTML with injected links plus a stats object for
 * observability (currently unused by callers but useful for debugging
 * / future analytics).
 */
export function autoLinkArticleBody(html: string, selfHref?: string): string {
  if (!html) return html;

  // Tokenize: alternating tag / text chunks. Cheap regex tokenizer —
  // good enough for sanitized Shopify article HTML (no <script>,
  // no <style>, no inline event handlers).
  type Token = { kind: 'tag' | 'text'; content: string };
  const tokens: Token[] = [];
  const tagRe = /<\/?[^>]+>/g;
  let lastIdx = 0;
  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(html)) !== null) {
    if (m.index > lastIdx) tokens.push({ kind: 'text', content: html.slice(lastIdx, m.index) });
    tokens.push({ kind: 'tag', content: m[0] });
    lastIdx = m.index + m[0].length;
  }
  if (lastIdx < html.length) tokens.push({ kind: 'text', content: html.slice(lastIdx) });

  // Seed `used` from existing anchors in the source HTML — so if the
  // merchant has already linked to /collections/memory-foam-mattresses
  // somewhere in the body, the autolinker doesn't add a second link
  // to the same destination.
  const used = new Set<string>();
  // Seed the current page's own path so the body never self-links (see
  // the selfHref note in the doc comment). Normalized to match the
  // trailing-slash handling used for existing-anchor dedup below.
  if (selfHref) used.add(selfHref.replace(/\/$/, ''));
  const existingHrefRe = /<a\b[^>]*\bhref=["']([^"']+)["'][^>]*>/gi;
  let am: RegExpExecArray | null;
  while ((am = existingHrefRe.exec(html)) !== null) {
    const href = am[1];
    // Normalize trailing slashes so /collections/foo and /collections/foo/
    // are treated as the same destination.
    used.add(href.replace(/\/$/, ''));
  }

  // Walk tokens with a skip-tag stack. When the stack is non-empty,
  // we're inside a SKIP_TAG region (e.g., inside an h2 or an existing
  // anchor), so leave text tokens untouched.
  const stack: string[] = [];
  let linkCount = 0;
  for (const tok of tokens) {
    if (tok.kind === 'tag') {
      // Self-closing void tags don't affect the stack — Shopify HTML
      // uses <br>, <img>, <hr> without the XHTML "/>". Match opening
      // and closing forms separately rather than relying on syntax.
      const openMatch = tok.content.match(/^<(\w+)/);
      const closeMatch = tok.content.match(/^<\/(\w+)/);
      if (closeMatch) {
        const tag = closeMatch[1].toLowerCase();
        if (SKIP_TAGS.has(tag) && stack[stack.length - 1] === tag) {
          stack.pop();
        }
      } else if (openMatch) {
        const tag = openMatch[1].toLowerCase();
        if (SKIP_TAGS.has(tag)) {
          stack.push(tag);
        }
      }
      continue;
    }

    // Text token. Skip if inside a SKIP_TAG or budget exhausted.
    if (stack.length > 0 || linkCount >= MAX_LINKS) continue;
    if (!tok.content.trim()) continue;

    // Try phrases in order until one matches. One insert per text
    // token max — prevents two phrases from overlapping inside the
    // same paragraph and creating nested anchors.
    for (const [phrase, href] of PHRASE_MAP) {
      const dest = href.replace(/\/$/, '');
      if (used.has(dest)) continue;
      // \b is ASCII-only — fine for English mattress copy. The trailing
      // suffix lets the same key catch the plural form ("memory foam
      // mattresses" matches "memory foam mattress") — without it, a
      // large share of body copy that uses plural phrasing slips past
      // the linker. For phrases ending in 's' the plural takes 'es'
      // (mattress → mattresses); for everything else, plain 's' (foam
      // → foams). Optional/non-capturing so longer-phrase-wins ordering
      // still holds: each candidate tries match-or-skip in map order.
      const pluralSuffix = phrase.endsWith('s') ? '(?:es)?' : 's?';
      const re = new RegExp(`\\b${escapeRegExp(phrase)}${pluralSuffix}\\b`, 'i');
      const match = tok.content.match(re);
      if (!match || match.index === undefined) continue;
      // Wrap the matched text. Preserve original case (match[0])
      // rather than the canonical phrase (PHRASE_MAP key) so the link
      // text reads naturally inline with the surrounding sentence.
      tok.content =
        tok.content.slice(0, match.index) +
        `<a href="${href}" data-internal="auto">${match[0]}</a>` +
        tok.content.slice(match.index + match[0].length);
      used.add(dest);
      linkCount++;
      break;
    }
  }

  let out = tokens.map((t) => t.content).join('');

  // Safety net (20260528): if neither the PHRASE_MAP nor the merchant's
  // own copy left any internal links in the article body, append a
  // single CTA paragraph linking to the main mattresses collection.
  // Without this, Semrush's "no internal links in body" audit flags
  // the article — a recurring complaint across the 33 orphan articles
  // in the 20260528 ideas export. Caveat-free: the link only appends
  // when truly zero internal links exist, so any article the PHRASE_MAP
  // already linked (or that the merchant hand-linked) is untouched.
  const hadInternalLink = linkCount > 0 || [...used].some((u) => u.startsWith('/'));
  if (!hadInternalLink) {
    out += `\n<p class="article-autolink-fallback"><a href="${FALLBACK_LINK.href}" data-internal="auto-fallback">${FALLBACK_LINK.anchor}</a>.</p>`;
  }

  return out;
}
