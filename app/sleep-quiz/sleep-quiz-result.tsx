'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useLayoutEffect, useRef } from 'react';
import { Icon } from '@/app/_components/icon';
import { ReviewsBadge } from '@/app/_components/reviews-badge';
import { announce } from '@/app/_components/announcer';
import { formatPriceRange } from '@/lib/format';
import type { ProductSummary } from '@/lib/shopify';
import { QUESTIONS, type Answers, type Recommendation } from './quiz-data';

/**
 * Quiz result page — rendered when `step === 'result'` in the parent
 * `SleepQuiz` component.
 *
 * Phase 210 split: lifted out of `sleep-quiz.tsx` and dynamic-imported
 * from there so the result-rendering JS (rationale list, alt-collection
 * links, `<details>` answer summary, restart button, the announce()
 * call + headingRef focus shift) doesn't ship in the initial quiz
 * bundle. Quiz abandoners — historically a meaningful fraction of
 * quiz starters — never pay for it.
 *
 * When the result swaps in, focus has just been on a now-unmounted
 * button (Next / See my match / Skip to results / auto-advance timer).
 * The useEffect moves it to the result heading so keyboard + SR users
 * land on something meaningful instead of having focus dropped to
 * <body>. Same pattern as newsletter-form and opt-out-form. The
 * announce() also fires the polite live region so the transition isn't
 * silent.
 */
export function SleepQuizResult({
  result,
  answers,
  productPicks,
  onRestart,
}: {
  result: Recommendation;
  answers: Answers;
  productPicks: Record<string, ProductSummary>;
  onRestart: () => void;
}) {
  // Phase 255: hero product card. Pre-fetched server-side in
  // /sleep-quiz/page.tsx; lookup is keyed by the recommend()-chosen
  // handle. Falls back to null when the catalog has shifted out from
  // under the static mapping — the category CTA below covers that
  // case so the result page is never empty-handed.
  const pick: ProductSummary | null = productPicks[result.productPickHandle] ?? null;
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Phase 220: focus the result heading synchronously after the DOM
  // commits, before paint. The Phase 210 dynamic import means this
  // component mounts asynchronously after `step === 'result'` (the
  // dynamic chunk has to load + execute), so the previous
  // `useEffect` + `requestAnimationFrame` chain was racing the
  // browser's own focus fallback to BODY — the pre-launch Cowork
  // audit caught the heading never receiving focus on mount.
  // `useLayoutEffect` runs after refs are attached but before the
  // user sees the page, which lands focus reliably for both
  // keyboard and SR users. Safe inside this file because the parent
  // dynamic-imports with `ssr: false`, so this component never runs
  // on the server.
  useLayoutEffect(() => {
    headingRef.current?.focus();
  }, []);

  // Announce in a separate post-paint effect — the polite live region
  // doesn't need to fire synchronously with focus.
  useEffect(() => {
    announce(`Your match: ${result.type}. We'd shortlist ${result.primary.label} first.`);
  }, [result.type, result.primary.label]);

  return (
    <div className="quiz quiz-result">
      <div className="quiz-result-head">
        <div className="eyebrow">Your match</div>
        <h2
          ref={headingRef}
          className="h1"
          style={{ margin: 'var(--s-3) 0 var(--s-3)' }}
          tabIndex={-1}
        >
          {result.type}
        </h2>
        <p className="lp-hero-lede" style={{ marginBottom: 'var(--s-5)' }}>
          Based on how you sleep, we&rsquo;d shortlist <strong>{result.primary.label.toLowerCase()}</strong> first. You can come try them at any LA showroom.
        </p>
        <div className="quiz-result-cta">
          <Link href={`/collections/${result.primary.handle}`} className="btn btn-primary btn-lg">
            See {result.primary.label} <Icon name="arrow-right" size={14} />
          </Link>
          <Link href="/pages/mattress-store-locations" className="btn btn-ghost">
            Find a showroom
          </Link>
        </div>
      </div>

      {pick ? <QuizProductHero pick={pick} /> : null}

      {result.rationale.length ? (
        <div className="quiz-result-rationale">
          <h3 className="eyebrow" style={{ margin: 0 }}>Why this match</h3>
          <ul>
            {result.rationale.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        </div>
      ) : null}

      <div className="quiz-result-alts">
        <h3 className="eyebrow" style={{ margin: 0 }}>Worth comparing</h3>
        <ul>
          {result.alternates.map((a) => (
            <li key={a.handle}>
              <Link href={`/collections/${a.handle}`} className="link-arrow">
                {a.label} <Icon name="arrow-right" size={14} />
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <details className="quiz-result-answers">
        <summary>Your answers ({Object.keys(answers).length})</summary>
        <dl>
          {QUESTIONS.map((q) => {
            const ans = answers[q.id];
            if (!ans) return null;
            const opt = q.options.find((o) => o.id === ans);
            return (
              <div key={q.id} className="quiz-result-answer-row">
                <dt>{q.title}</dt>
                <dd>{opt?.label ?? ans}</dd>
              </div>
            );
          })}
        </dl>
      </details>

      <div className="quiz-result-foot">
        <button type="button" className="btn btn-ghost" onClick={onRestart}>
          <Icon name="arrow-left" size={14} /> Retake the quiz
        </button>
      </div>
    </div>
  );
}

/**
 * Phase 255: hero product card on the quiz result.
 *
 * Visual is a wider-than-PLP horizontal layout: image on the left,
 * brand / title / reviews / price / CTA on the right. Lives below the
 * existing category recommendation so the user sees a concrete pick
 * before scrolling — but still has the category CTA + collection
 * alternates as fallbacks if the specific product doesn't fit.
 */
function QuizProductHero({ pick }: { pick: ProductSummary }) {
  const minPrice = Number.parseFloat(pick.priceRange.minVariantPrice.amount);
  const minCompare = Number.parseFloat(pick.compareAtPriceRange.minVariantPrice.amount);
  const onSale = minCompare > 0 && minCompare > minPrice;
  const pctOff = onSale ? Math.round((1 - minPrice / minCompare) * 100) : 0;

  return (
    <Link
      href={`/products/${pick.handle}`}
      className="quiz-result-product"
      aria-label={`Shop ${pick.vendor} ${pick.title} — our top pick for you`}
    >
      <div className="quiz-result-product-img ph" style={{ aspectRatio: '1' }}>
        {onSale ? <span className="pcard-tag pcard-tag-sale">−{pctOff}%</span> : null}
        {pick.featuredImage ? (
          <Image
            src={pick.featuredImage.url}
            alt={pick.featuredImage.altText ?? pick.title}
            width={600}
            height={600}
            sizes="(max-width: 760px) 100vw, 360px"
            style={{ objectFit: 'contain', width: '100%', height: '100%' }}
          />
        ) : (
          <span className="ph-label">[Image coming]</span>
        )}
      </div>
      <div className="quiz-result-product-meta">
        <div className="eyebrow">Our top pick for you</div>
        <div className="quiz-result-product-brand">{pick.vendor}</div>
        <div className="quiz-result-product-title">{pick.title}</div>
        {pick.reviews ? (
          <div className="quiz-result-product-reviews">
            <ReviewsBadge reviews={pick.reviews} size="inline" />
          </div>
        ) : null}
        <div className="quiz-result-product-price">
          {onSale ? (
            <span className="pcard-was tnum">
              {formatPriceRange(pick.compareAtPriceRange.minVariantPrice, pick.compareAtPriceRange.maxVariantPrice)}
            </span>
          ) : null}
          <span className="pcard-now tnum">
            {formatPriceRange(pick.priceRange.minVariantPrice, pick.priceRange.maxVariantPrice)}
          </span>
        </div>
        <div className="quiz-result-product-cta">
          <span className="btn btn-primary btn-lg">
            See this mattress <Icon name="arrow-right" size={14} />
          </span>
        </div>
      </div>
    </Link>
  );
}
