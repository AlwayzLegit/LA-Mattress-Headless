'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { Icon } from '@/app/_components/icon';
import { announce } from '@/app/_components/announcer';
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
  onRestart,
}: {
  result: Recommendation;
  answers: Answers;
  onRestart: () => void;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    announce(`Your match: ${result.type}. We'd shortlist ${result.primary.label} first.`);
    const id = requestAnimationFrame(() => headingRef.current?.focus());
    return () => cancelAnimationFrame(id);
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
