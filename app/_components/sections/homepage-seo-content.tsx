import Link from 'next/link';
import Image from 'next/image';
import { SHOWROOMS } from '@/lib/showrooms';

// Real showroom photo for the section media (#13). Prefer the La Brea
// interior shot, fall back to the first showroom with an image — both are
// the same Shopify CDN photos already shown on the locations page, so they
// are known-good and need no new asset.
const FEATURE_IMG =
  SHOWROOMS.find((s) => s.handle === 'best-mattress-store-la-brea' && s.imageUrl)?.imageUrl ??
  SHOWROOMS.find((s) => s.imageUrl)?.imageUrl ??
  null;

/**
 * SEO-focused prose section for the homepage.
 *
 * Why this exists: Semrush 20260530 audit flagged the homepage `/` for
 * four content-quality issues on the four homepage target keywords
 * (mattress store / mattress stores / mattress sales / shop mattresses):
 *
 *   1. `body_missing_kw` — "mattress sales" never appeared in the body
 *      prose; was only in headings + CTA labels.
 *   2. `low_word_count` — relative to ranking competitors. The
 *      above-the-fold sections (hero, quiz lead-in, popular products,
 *      shop-by-category, showrooms, brand strip, featured guides,
 *      why-us, ways-to-find-match) carry visual and interactive
 *      content but almost no flowing prose Google can use to score the
 *      page's topical depth.
 *   3. `missing_related_words` — semantically related terms competitors
 *      have, that we didn't: `twin xl` and `mattress online`.
 *   4. `low_readability` — text-content readability score below
 *      competitors. Anything we add should read at ~Flesch 60+
 *      (lay-readable).
 *
 * What this renders: three short paragraphs (~220 words total) that
 * weave every target keyword + every flagged related word into natural
 * prose, with one contextually-placed internal link per paragraph
 * (which also lifts the page's internal-link graph, separate Semrush
 * flag on other URLs).
 *
 * Constraints baked into the copy:
 *   - Sentences kept short (~15-20 words). Flesch Reading Ease > 60.
 *   - Each target keyword appears 1-2 times only (no stuffing — that's
 *     a separate Semrush flag we don't want to trip).
 *   - Internal anchor text reads like a sentence, not "click here".
 *   - No marketing fluff ("perfect", "amazing"). Voice: a knowledgeable
 *     store associate, not a SaaS landing page.
 *
 * Placement: between <WaysToFindMatch /> and <Reviews /> on the
 * homepage. Well below the fold so it doesn't affect LCP. The H2 is
 * scoped to the section here; the planned PR C will promote a
 * keyword-loaded H1 elsewhere on the page (this stays an H2).
 */
export function HomepageSeoContent() {
  return (
    <section className="section hp-seo-content" aria-labelledby="hp-seo-heading">
      <div className="container">
        <div className="hp-seo-split">
          <div className="hp-seo-main">
        <div className="section-head">
          <div>
            <div className="eyebrow">Los Angeles mattress store</div>
            <h2 id="hp-seo-heading" className="h2">Shop Mattresses Across Los Angeles</h2>
          </div>
        </div>
        <div className="hp-seo-prose">
          <p>
            Family-owned since 2012, LA Mattress runs five showrooms across Los Angeles &mdash;
            {' '}Koreatown, West LA, La Brea, Studio City, and Glendale. We stock every major brand:
            {' '}<Link href="/collections/tempur-pedic-mattresses">Tempur-Pedic</Link>,
            {' '}<Link href="/collections/stearns-foster-mattresses">Stearns &amp; Foster</Link>,
            {' '}<Link href="/collections/helix-mattresses">Helix</Link>, Diamond, Southerland, Englander,
            {' '}and Eastman House. Lie down on any bed before you buy.
          </p>
          <p>
            Our <Link href="/collections/on-sale">mattress sales</Link> rotate weekly across memory foam, hybrid,
            {' '}and innerspring beds. Every size is on the floor &mdash; Twin, Twin XL, Full, Queen, King,
            {' '}and California King. Same-day delivery is available on most in-stock orders, and 0% APR
            {' '}financing is available on purchases of $1,500 or more.
          </p>
          <p>
            Prefer to shop mattresses online? Take our{' '}
            <Link href="/sleep-quiz">8-question sleep quiz</Link> to get a personalized recommendation in
            {' '}under two minutes, or chat with one of our LA-based mattress experts. Free white-glove
            {' '}delivery is included across Los Angeles County. Every bed ships with a 120-night exchange,
            {' '}so you have time to decide it&rsquo;s the right fit at home.
          </p>
          <p>
            Whether you&rsquo;re upgrading to a king-size bed, shopping for a Twin XL for a growing
            {' '}kid&rsquo;s room, or comparing organic latex options, our team can match you to the right
            {' '}bed. We carry mattresses from $499, with adjustable bases, mattress protectors, and pillow
            {' '}packages available at every location. Call, chat, or visit any of our five{' '}
            <Link href="/pages/mattress-store-locations">Los Angeles mattress stores</Link>{' '}
            &mdash; we&rsquo;re open seven days a week.
          </p>
        </div>
          </div>

          {FEATURE_IMG ? (
            <div className="hp-seo-media" aria-hidden="true">
              <div className="hp-seo-media-frame">
                <Image
                  src={FEATURE_IMG}
                  alt=""
                  fill
                  sizes="(max-width: 880px) 100vw, 42vw"
                  quality={60}
                  style={{ objectFit: 'cover' }}
                />
              </div>
              <div className="hp-seo-stat">
                <span className="hp-seo-stat-num">5</span>
                <span className="hp-seo-stat-label">showrooms across LA · open 7 days</span>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
