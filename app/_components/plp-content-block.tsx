import Link from 'next/link';
import { Icon } from './icon';
import { categoryFaqFor, categoryGuidesFor } from '@/lib/plp-content';
import { categoryDeepContentFor } from '@/lib/plp-deep-content';
import { renderFaqAnswer } from '@/lib/faq-render';
import { resolveRedirectPath, sanitizeShopifyHtml } from '@/lib/sanitize';
import { autoLinkArticleBody } from '@/lib/article-autolink';

/**
 * Below-the-product-grid content block on every /collections/[handle].
 *
 * Phase 265: addresses the May SEMrush audit's 941 "Low text-to-HTML
 * ratio" flags. Three pieces (with a fourth added in PLP v2.1):
 *
 *   1. (PLP v2.1) The merchant-authored long-form descriptionHtml when
 *      present, rendered with the sanitizer's `demoteHeadings` option
 *      so merchant H1/H2 inside that body don't compete with the page
 *      <h1> or the section <h2> below.
 *   2. FAQ accordion (6 mattress-shopping questions, distinct from
 *      lib/faq.ts HOMEPAGE_FAQ to avoid duplicate-content overlap).
 *   3. Internal-link cluster to /pages/* policy pages and /sleep-quiz.
 *   4. Curated buying-guide cluster topically matched to this collection.
 *
 * The short intro paragraph that used to render here (the categoryIntroFor
 * output) moved UP to the hero in v2.1 — that slot is now sourced from
 * `collection.introShort` (custom.intro_short metafield) with the same
 * categoryIntroFor() template as the fallback.
 *
 * Also emits FAQPage JSON-LD so the FAQ becomes eligible for Google's
 * rich-result featured-snippet treatment on category searches.
 *
 * Server-rendered. The `<details>` accordion uses native browser open/
 * close (no JS needed). Rendered inside the collection page's <main>.
 */
export function PlpContentBlock({
  handle,
  title,
  descriptionHtml,
}: {
  handle: string;
  title: string;
  descriptionHtml?: string | null;
}) {
  // Phase 294: curated cornerstone buying-guide links, topically matched
  // to this collection — contextual inbound link equity to high-value
  // guide articles SEMrush flagged as under-linked. [] for unmatched
  // collections so it stays contextual, not boilerplate.
  const guides = categoryGuidesFor(handle);
  // Phase 276: per-category FAQ so each PLP has unique Q&A relevant to
  // its material/brand instead of the prior shared PLP_FAQ block.
  const faqItems = categoryFaqFor(handle);
  // PLP v2.1: sanitize the merchant body with demoteHeadings so any
  // <h1>/<h2> inside become <h3>, sitting one level below the section
  // <h2> that wraps them.
  //
  // Phase 308 SEO PR: when the merchant body is empty/missing,
  // fall back to the code-side per-handle deep-content prose in
  // lib/plp-deep-content.ts. Semrush 20260530 flagged the
  // highest-traffic collection PLPs for low_word_count +
  // low_readability + missing_related_words — the merchant body slot
  // was the gap, since the merchant hadn't filled descriptionHtml on
  // those handles. Code-side fallback runs autolinker AND emits ~350
  // words of structured prose targeting the flagged related terms.
  // Merchant content (when present) still wins; this is fallback-only.
  const merchantHtml = descriptionHtml ? descriptionHtml.trim() : '';
  // Word count of the merchant body's visible text — decides whether the
  // body alone is substantial or needs the deep-content block appended.
  const merchantWords = merchantHtml
    ? merchantHtml.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean).length
    : 0;
  // Phase 308 SEO PR: when the merchant body is empty/missing, fall back
  // to the code-side per-handle deep-content prose in lib/plp-deep-content.ts.
  //
  // Semrush 20260601 follow-up: this `descriptionHtml` prop is the route's
  // `seoContentHtml || collection.descriptionHtml` — i.e. the custom.
  // seo_content metafield when present, else the merchant body. Measured
  // across all PLPs, that prose splits cleanly into two groups: the
  // handles with a real seo_content metafield render 1,200–1,500 words,
  // while bed-frames (339w, no metafield) and mattress-toppers (183w,
  // stub metafield) sit 3–4× thinner — the genuine low_word_count cases.
  // When the body is below ~700 words, append the well-written per-
  // category deep-content block (lib/plp-deep-content.ts) after it so the
  // thin PLPs clear the threshold; merchant copy still leads. Above 700
  // the body stands alone unchanged, so the rich seo_content PLPs are
  // untouched. The 700 cut sits in the wide gap between the two groups
  // (471 ↔ 1229), so it's robust to small content edits either side.
  const SHORT_BODY_WORDS = 700;
  const merchantRendered = merchantHtml
    ? autoLinkArticleBody(sanitizeShopifyHtml(merchantHtml, { demoteHeadings: true }))
    : '';
  const deepContent = autoLinkArticleBody(categoryDeepContentFor(handle, title));
  const longHtml = !merchantHtml
    ? deepContent
    : merchantWords < SHORT_BODY_WORDS
      ? `${merchantRendered}\n${deepContent}`
      : merchantRendered;
  return (
    <section className="plp-content" aria-labelledby={`plp-content-h-${handle}`}>
      <div className="plp-content-intro">
        <h2 id={`plp-content-h-${handle}`} className="h2 plp-content-title">
          About {title.toLowerCase()} at LA Mattress
        </h2>
        {longHtml ? (
          <div className="plp-long-content rte" dangerouslySetInnerHTML={{ __html: longHtml }} />
        ) : null}
      </div>

      <div className="plp-content-grid">
        <div className="plp-content-faq">
          <h3 className="eyebrow plp-content-eyebrow">Common questions</h3>
          {faqItems.map((item) => (
            <details key={item.q} className="plp-content-faq-item">
              <summary>
                <span className="plp-content-faq-q">{item.q}</span>
                <Icon name="chevron-down" size={14} aria-hidden />
              </summary>
              <p className="plp-content-faq-a">{renderFaqAnswer(item.a)}</p>
            </details>
          ))}
        </div>

        <aside className="plp-content-links">
          <h3 className="eyebrow plp-content-eyebrow">Helpful pages</h3>
          <ul className="plp-content-link-list">
            <li><Link href="/sleep-quiz" className="link-arrow">Take the 2-minute sleep quiz <Icon name="arrow-right" size={14} /></Link></li>
            <li><Link href="/pages/mattress-store-locations" className="link-arrow">All 5 LA showrooms <Icon name="arrow-right" size={14} /></Link></li>
            <li><Link href="/pages/mattress-store-delivery" className="link-arrow">Delivery in Los Angeles <Icon name="arrow-right" size={14} /></Link></li>
            <li><Link href="/pages/mattress-store-financing" className="link-arrow">0% APR financing <Icon name="arrow-right" size={14} /></Link></li>
            <li><Link href="/pages/love-your-bed-guarantee" className="link-arrow">120-night exchange <Icon name="arrow-right" size={14} /></Link></li>
            <li><Link href="/pages/mattress-sizes" className="link-arrow">Mattress sizes guide <Icon name="arrow-right" size={14} /></Link></li>
            <li><Link href="/pages/mattress-types" className="link-arrow">Mattress types compared <Icon name="arrow-right" size={14} /></Link></li>
            <li><Link href="/pages/mattress-brands" className="link-arrow">Brands we carry <Icon name="arrow-right" size={14} /></Link></li>
          </ul>
          {guides.length > 0 ? (
            <>
              <h3 className="eyebrow plp-content-eyebrow">Buying guides</h3>
              <ul className="plp-content-link-list">
                {guides.map((g) => (
                  <li key={g.href}>
                    <Link href={resolveRedirectPath(g.href)} className="link-arrow">
                      {g.label} <Icon name="arrow-right" size={14} />
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </aside>
      </div>
    </section>
  );
}
