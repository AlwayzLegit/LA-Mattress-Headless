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
];

// Tags whose content should never be auto-linked. We skip headings
// (don't compete with the link signal of the heading itself), code
// blocks (literal text, links would corrupt), existing <a> (no nested
// anchors), figcaptions (image metadata).
const SKIP_TAGS = new Set(['a', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'pre', 'code', 'blockquote', 'figcaption']);

const MAX_LINKS = 6;

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Inject first-mention internal links into article body HTML. Pure
 * function, idempotent if the same destination was already linked in
 * the source HTML (used-set is seeded from existing <a href="…">).
 *
 * Returns the HTML with injected links plus a stats object for
 * observability (currently unused by callers but useful for debugging
 * / future analytics).
 */
export function autoLinkArticleBody(html: string): string {
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

  return tokens.map((t) => t.content).join('');
}
