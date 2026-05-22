/**
 * Blog-article JSON-LD, rendered by app/blogs/[blog]/[article]/layout.tsx
 * — OUTSIDE the in-page <Suspense fallback={ArticleSkeleton}> fast-path
 * in page.tsx. Same fix class as lib/page-jsonld.ts (#166): when the
 * id-bearing <script>s lived in the suspended subtree, React's hidden
 * streaming-source (#S:0) was left in the DOM on hard load, duplicating
 * BlogPosting + BreadcrumbList (cowork QA).
 *
 * Objects + derivations reproduced verbatim from ArticleView (page.tsx).
 * countWordsFromHtml is duplicated here (3 trivial pure lines) rather
 * than sharing a util — the page keeps its own copy for read-time.
 */
import type { getArticleByHandle } from '@/lib/shopify';

type Article = NonNullable<Awaited<ReturnType<typeof getArticleByHandle>>>;
export type ArticleLd = { key: string; data: unknown };

const SITE = 'https://www.mattressstoreslosangeles.com';

function countWordsFromHtml(html: string): number {
  if (!html) return 0;
  const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  if (!text) return 0;
  return text.split(' ').length;
}

// Inlined from lib/seo.ts so Node 22's experimental-strip-types test
// runner can import this file without the `@/` alias. Identical
// semantics — picks the first string in the list with non-empty content.
function firstNonEmpty(...candidates: (string | null | undefined)[]): string {
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim().length > 0) return c;
  }
  return '';
}

/**
 * Extract FAQ Q&A pairs from article body HTML.
 *
 * Matches the convention used in the new pillar articles (and many
 * existing buyer-guide posts): an FAQ section with each question as
 * an <h3> ending in `?`, followed immediately by a <p> answer.
 *
 *   <h3>What's the best mattress brand for hot sleepers?</h3>
 *   <p>For pure cooling, the Tempur-Pedic Breeze line...</p>
 *
 * The trailing-`?` check is the disambiguator: brand sections and
 * topic sections in the same articles also use <h3> but never end in
 * a question mark (e.g., `<h3>Tempur-Pedic</h3>`, `<h3>$500-$1,200 (queen)</h3>`).
 *
 * Returns an empty array if fewer than 3 FAQ pairs are found —
 * Google's FAQPage rich-result guidelines require multiple Q&A on
 * the same page for the schema to surface in SERP.
 *
 * Note: HTML tags inside the question text are stripped; HTML inside
 * the answer is preserved as text (HTML entities decoded) because
 * Google's FAQPage validator wants `acceptedAnswer.text` as plain text.
 */
function extractFaqFromHtml(html: string): Array<{ question: string; answer: string }> {
  if (!html) return [];
  const faqs: Array<{ question: string; answer: string }> = [];
  // <h3 [attrs]?>...?</h3> followed by zero/more whitespace and <p ...>...</p>.
  // The non-greedy [\s\S]*? matches across newlines (HTML body has lots of those).
  const re = /<h3\b[^>]*>([\s\S]*?)<\/h3>\s*<p\b[^>]*>([\s\S]*?)<\/p>/gi;
  const stripTags = (s: string) => s.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  // Cheap entity decode for the common ones — `&amp; &lt; &gt; &quot; &#39; &nbsp;`.
  // Google's validator runs HTML-aware comparison so light decoding is fine.
  const decodeEntities = (s: string) =>
    s
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&rsquo;/g, '’')
      .replace(/&lsquo;/g, '‘')
      .replace(/&nbsp;/g, ' ');
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const question = decodeEntities(stripTags(m[1]));
    const answer = decodeEntities(stripTags(m[2]));
    // Only count as FAQ if the question ends in `?` — filters out
    // brand/section/topic <h3>s like `<h3>Tempur-Pedic</h3>` or
    // `<h3>$500-$1,200 (queen)</h3>`.
    if (!/\?$/.test(question)) continue;
    if (!question || !answer) continue;
    // Google's rich-results validator caps answers around 5000 chars
    // per FAQPage entry. Trim defensively.
    faqs.push({ question, answer: answer.slice(0, 5000) });
  }
  return faqs.length >= 3 ? faqs : [];
}

/**
 * Extract HowTo steps from article body HTML.
 *
 * Targets the explicit step convention used by step-by-step guides
 * (e.g. how-to-choose-a-mattress): an <h2> or <h3> whose visible text
 * (after stripping inline tags) begins with "Step N:" or "Step N." or
 * "Step N -", followed by paragraph text until the next h2/h3. Example:
 *
 *   <h2>Step 1: Start with your sleep position</h2>
 *   <p>Your dominant sleep position is the single most important factor...</p>
 *   <ul><li>...</li></ul>
 *
 * Tag-tolerant: the step prefix check runs against the strip-tags'd
 * heading text, so `<h2>Step 1: <em>Choose</em> wisely</h2>` and
 * `<h2><strong>Step 1:</strong> Choose wisely</h2>` (common Shopify
 * WYSIWYG output) both match. The original regex required the literal
 * "Step N:" to appear adjacent to the opening `<h2>` with no inline
 * tags between — code review (Phase 5) flagged this as silently
 * dropping merchant-formatted step headings.
 *
 * Returns [] when fewer than 3 explicit steps are found. Articles
 * without the convention (most how-to-* articles use topical h2s
 * instead — e.g. how-to-choose-mattress-firmness) correctly return []
 * and stay on plain BlogPosting.
 *
 * Each step's `text` is the stripped, entity-decoded HTML between this
 * heading and the next h2/h3, capped at Google's 500-char soft
 * recommendation. `name` is the heading text minus the "Step N:"
 * prefix.
 */
function extractHowToStepsFromHtml(html: string): Array<{ name: string; text: string }> {
  if (!html) return [];
  const stripTags = (s: string) => s.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  // Entity decode — order matters: decode named/numeric refs FIRST,
  // then `&amp;` LAST, so doubly-encoded entities like `&amp;lt;`
  // survive as `&lt;` (visible angle-bracket text) instead of
  // collapsing all the way to `<`.
  const decodeEntities = (s: string) =>
    s
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&rsquo;/g, '’')
      .replace(/&lsquo;/g, '‘')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&');
  // First pass: find every h2/h3 heading with its inner HTML and the
  // body content that follows up to the next heading. We grab inner
  // HTML (rather than text directly) so the body capture isn't
  // confused by inline tags; the step-prefix check then runs against
  // the strip-tags'd text.
  const re = /<h[23]\b[^>]*>([\s\S]*?)<\/h[23]>([\s\S]*?)(?=<h[23]\b|$)/gi;
  // Strict separator class — `[:—–-]` only. `.` is intentionally
  // excluded so `<h2>Step 1.5 ...</h2>` doesn't false-match as "Step 1".
  const STEP_PREFIX = /^Step\s+(\d+)\s*[:—–-]\s*(.+)$/i;
  const steps: Array<{ name: string; text: string }> = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const headingText = decodeEntities(stripTags(m[1]));
    const prefixMatch = STEP_PREFIX.exec(headingText);
    if (!prefixMatch) continue;
    const name = prefixMatch[2].trim();
    const text = decodeEntities(stripTags(m[2])).slice(0, 500);
    if (!name || !text) continue;
    steps.push({ name, text });
  }
  return steps.length >= 3 ? steps : [];
}

export function getArticleJsonLd(article: Article): ArticleLd[] {
  const url = `${SITE}/blogs/${article.blog.handle}/${article.handle}`;
  const wordCount = countWordsFromHtml(article.contentHtml);
  const ldDescription = firstNonEmpty(
    article.seo.description,
    article.excerpt,
    article.title,
  );

  // Image — Google's BlogPosting validator wants this present. When the
  // article has no featured image (or has one with an empty url string),
  // fall back to the sitewide logo so the page still passes the
  // "has image" check. SEMrush 20260521_1 follow-up: was previously
  // emitting `image: undefined` / `image: []` which validators rejected.
  const imageUrls = article.image?.url
    ? [article.image.url]
    : [`${SITE}/assets/la-mattress-logo.png`];

  const articleLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    inLanguage: 'en-US',
    headline: article.title,
    // breadcrumb @id ties this BlogPosting to the BreadcrumbList
    // emitted alongside it. Same connection pattern as Product +
    // BreadcrumbList on PDP / CollectionPage + BreadcrumbList on PLP.
    breadcrumb: { '@id': `${url}#breadcrumb` },
    ...(ldDescription ? { description: ldDescription } : {}),
    datePublished: article.publishedAt,
    // Google's BlogPosting recommends `dateModified` alongside
    // `datePublished`. Storefront API doesn't expose article.updatedAt
    // (Admin API does), so fall back to publishedAt — accepted by
    // Google's validator and truthful for un-edited articles. Lossy
    // for articles edited post-publish; that's a Storefront limitation,
    // not a JSON-LD shape issue.
    dateModified: article.publishedAt,
    image: imageUrls,
    // Author is REQUIRED by Google for BlogPosting; emit a fallback
    // Organization-author when Storefront didn't include a person —
    // covers older articles that pre-date the merchant filling in
    // author metafields. The @id link ties the fallback to the
    // sitewide Organization (instead of creating a duplicate entity).
    author: article.author
      ? { '@type': 'Person', name: article.author.name }
      : { '@type': 'Organization', name: 'LA Mattress Store', '@id': `${SITE}/#organization` },
    publisher: {
      // @id link to the canonical Organization schema emitted from
      // app/layout.tsx (lib/structured-data.ts buildOrganizationLd).
      // Lets Google's entity graph treat the article publisher and the
      // sitewide Organization as the same entity instead of two
      // disconnected ones — strengthens E-E-A-T signals on every
      // article page.
      '@id': `${SITE}/#organization`,
      '@type': 'Organization',
      name: 'LA Mattress Store',
      // ImageObject with explicit width + height — Google's Article
      // validator rejects a logo missing dimensions even when the URL
      // is reachable. SEMrush 20260521_1 follow-up: without these the
      // validator tripped on every article page (~1,000 of the SDTT
      // error count). Dimensions reflect the actual logo asset
      // (public/assets/la-mattress-logo.png — 400×224); captured here
      // so it doesn't drift if the file is re-exported.
      logo: {
        '@type': 'ImageObject',
        url: `${SITE}/assets/la-mattress-logo.png`,
        width: 400,
        height: 224,
      },
    },
    articleSection: article.blog.title,
    ...(wordCount ? { wordCount } : {}),
    ...(article.tags.length ? { keywords: article.tags.join(', ') } : {}),
  };

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    '@id': `${url}#breadcrumb`,
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE}/` },
      { '@type': 'ListItem', position: 2, name: article.blog.title, item: `${SITE}/blogs/${article.blog.handle}` },
      { '@type': 'ListItem', position: 3, name: article.title, item: url },
    ],
  };

  const out: ArticleLd[] = [
    { key: 'ld-article', data: articleLd },
    { key: 'ld-breadcrumb-article', data: breadcrumbLd },
  ];

  // HowTo schema — only when the article body has 3+ explicit
  // "Step N:" headings. Articles like how-to-choose-a-mattress use this
  // convention (13 steps); articles like how-to-choose-mattress-
  // firmness use topical h2s and correctly fall through to plain
  // BlogPosting. Emits alongside BlogPosting (Google allows both on
  // the same page) — adds collapsible-step rich-result eligibility.
  const howToSteps = extractHowToStepsFromHtml(article.contentHtml);
  if (howToSteps.length > 0) {
    // Drop a trailing brand suffix from the HowTo name so SERP rich
    // results show the imperative title (e.g. "How to Choose a Mattress")
    // rather than the keyword-stuffed full <title>. Same rule the
    // existing visible H1 already applies via stripBrandSuffix.
    const howToName = article.title.replace(/\s*[|—–]\s*LA Mattress( Store)?\s*$/i, '').trim() || article.title;
    out.push({
      key: 'ld-article-howto',
      data: {
        '@context': 'https://schema.org',
        '@type': 'HowTo',
        // @id ties this HowTo to the same WebPage as the BlogPosting so
        // Google's entity graph can dedupe them as siblings, not orphans.
        '@id': `${url}#howto`,
        mainEntityOfPage: { '@type': 'WebPage', '@id': url },
        name: howToName,
        ...(ldDescription ? { description: ldDescription } : {}),
        // Image as an ImageObject (not a bare URL) so the validator gets
        // the contentUrl signal it expects. Bare-URL form is also accepted
        // by Google but the ImageObject form is the documented preferred.
        ...(article.image?.url
          ? { image: { '@type': 'ImageObject', url: article.image.url } }
          : {}),
        // Per-step `url` was removed: the extractor matches headings
        // whose visible text begins with "Step N:" but the rendered DOM
        // uses heading-slug ids (e.g. "step-1-start-with-your-sleep-
        // position"), not positional "#step-1". A fragment URL that
        // doesn't exist on the page is worse than no fragment URL —
        // Google's HowTo spec accepts steps without per-step URLs.
        step: howToSteps.map((s, i) => ({
          '@type': 'HowToStep',
          position: i + 1,
          name: s.name,
          text: s.text,
        })),
      },
    });
  }

  // FAQPage schema — only when the article body has 3+ Q&A pairs
  // matching the H3-question / P-answer convention. Surfaces as Rich
  // Results in SERP, dramatically expanding the listing's real estate.
  const faqs = extractFaqFromHtml(article.contentHtml);
  if (faqs.length > 0) {
    out.push({
      key: 'ld-article-faq',
      data: {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: faqs.map((f) => ({
          '@type': 'Question',
          name: f.question,
          acceptedAnswer: { '@type': 'Answer', text: f.answer },
        })),
      },
    });
  }

  return out;
}
