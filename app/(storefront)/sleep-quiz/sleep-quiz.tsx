'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import type { ProductSummary } from '@/lib/shopify';
import { Icon } from '@/app/_components/icon';
import { track } from '@/lib/analytics';
import { QUESTIONS, recommend, type Answers, type Recommendation } from './quiz-data';

// Phase 210: result-page rendering (~95 LOC including rationale list,
// alt collection links, <details> answer summary, restart button,
// announce() call, headingRef focus shift) is dynamic-imported so its
// JS doesn't ship in the initial /sleep-quiz bundle. Quiz abandoners
// don't pay for the result chunk. `ssr: false` because the result is
// conditional on client-side `step === 'result'` state that hasn't
// materialized at SSR time. Net bundle: -20 B on the initial route
// chunk vs static import (next/dynamic wrapper overhead ~equals the
// deferred bytes for a component this size). The deferral itself is
// still real — the Result chunk lives in a separate file that's only
// fetched once `setStep('result')` fires.
const SleepQuizResult = dynamic(
  () => import('./sleep-quiz-result').then((m) => m.SleepQuizResult),
  { ssr: false },
);

const PERSIST_KEY = 'la-mattress.sleep-quiz.v1';

export function SleepQuiz({ productPicks }: { productPicks: Record<string, ProductSummary> }) {
  // Step 0..QUESTIONS.length-1 = questions, then "result" = done.
  const [step, setStep] = useState<number | 'result'>(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [hydrated, setHydrated] = useState(false);
  // How the user reached the result page — populated by the handler
  // that triggered the transition. Consumed by the completion-event
  // effect below to distinguish "answered every question" from
  // "skipped to results". Ref (not state) because it doesn't drive
  // render and we don't want a stale-closure read.
  const completionPathRef = useRef<'answered_all' | 'skipped' | null>(null);

  // Restore prior progress so a navigation away + back doesn't lose answers.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(PERSIST_KEY);
      if (raw) {
        const data = JSON.parse(raw) as { step?: number | 'result'; answers?: Answers };
        if (data.answers && typeof data.answers === 'object') setAnswers(data.answers);
        if (data.step === 'result' || (typeof data.step === 'number' && data.step >= 0)) setStep(data.step);
      }
    } catch { /* ignore */ }
    setHydrated(true);
  }, []);

  // Persist on every change after hydration.
  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(PERSIST_KEY, JSON.stringify({ step, answers }));
    } catch { /* ignore quota */ }
  }, [step, answers, hydrated]);

  const total = QUESTIONS.length;
  const result = useMemo<Recommendation | null>(() => (step === 'result' ? recommend(answers) : null), [step, answers]);

  // Fire the terminal `quiz_completed` event the first time step
  // flips to 'result' for this mounted instance. Includes the
  // recommendation handles + how the user got here (answered_all vs
  // skipped). Restoring a prior session's 'result' from localStorage
  // also fires once on hydration — intentional, since for the funnel
  // a returning quiz-completer is still a completer impression.
  const completionFiredRef = useRef(false);
  useEffect(() => {
    if (step !== 'result' || !result || completionFiredRef.current) return;
    completionFiredRef.current = true;
    track('quiz_completed', {
      completion_path: completionPathRef.current ?? 'answered_all',
      answered_count: Object.keys(answers).length,
      total_steps: total,
      recommended_type: result.type,
      recommended_handle: result.primary.handle,
      recommended_product_handle: result.productPickHandle,
    });
  }, [step, result, answers, total]);

  // Each time the question changes, refocus the heading for screen readers.
  useEffect(() => {
    if (step === 'result') return;
    const heading = document.getElementById('quiz-question-title');
    heading?.focus();
  }, [step]);

  // Phase 235: track the auto-advance setTimeout so we can clear it on
  // unmount (user navigates away mid-quiz) or on a rapid second click
  // (prevents two pending advances racing). React 19 silently no-ops
  // setState after unmount, but the leak is still cheap to avoid and
  // the rapid-click race is a real UX risk.
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    };
  }, []);

  if (step === 'result' && result) return <SleepQuizResult result={result} answers={answers} productPicks={productPicks} onRestart={() => { completionFiredRef.current = false; completionPathRef.current = null; setStep(0); setAnswers({}); }} />;

  const idx = step as number;
  const q = QUESTIONS[idx];
  const answered = answers[q.id];

  // Cancel a pending auto-advance. MUST be called before any manual
  // navigation: otherwise a timer armed by a just-tapped option fires
  // ~½s later with a now-stale `idx` and yanks the user to the wrong
  // question (e.g. tap option → tap Back → the stale timer still jumps
  // forward). Manual navigation is always authoritative.
  const cancelAdvance = () => {
    if (advanceTimerRef.current) {
      clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }
  };

  const onSelect = (optId: string) => {
    const wasAnswered = !!answers[q.id];
    setAnswers((a) => ({ ...a, [q.id]: optId }));
    // Fire on every option-select (including re-selects on the way
    // back). PostHog's distinct_id + timestamp dedupe is fine; the
    // re-select carries information ("user changed their mind on Q3").
    track('quiz_step', {
      step: idx,
      question_id: q.id,
      choice: optId,
      total_steps: total,
    });
    // Auto-advance on first answer of a question. Re-selecting on a question
    // the user came back to (Back button) does NOT auto-advance — that would
    // be hostile behaviour.
    if (!wasAnswered) {
      cancelAdvance();
      // 450ms (was 250) so the selected state — accent border + check
      // tick — visibly registers before the step swaps. 250ms read as
      // an abrupt jump with no confirmation that the tap landed.
      advanceTimerRef.current = setTimeout(() => {
        advanceTimerRef.current = null;
        if (idx + 1 >= total) {
          completionPathRef.current = 'answered_all';
          setStep('result');
        } else {
          setStep(idx + 1);
        }
      }, 450);
    }
  };

  const onNext = () => {
    if (!answered) return;
    cancelAdvance();
    if (idx + 1 >= total) {
      completionPathRef.current = 'answered_all';
      setStep('result');
    } else {
      setStep(idx + 1);
    }
  };

  const onBack = () => {
    if (idx === 0) return;
    cancelAdvance();
    setStep(idx - 1);
  };

  const answeredCount = Object.keys(answers).length;

  return (
    <div className="quiz">
      <div className="quiz-progress" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={idx + 1} aria-label={`Question ${idx + 1} of ${total}`}>
        <div className="quiz-progress-fill" style={{ width: `${((idx + 1) / total) * 100}%` }} />
      </div>
      <div className="quiz-meta">
        <span className="muted tnum">{idx + 1} / {total}</span>
        {/* Only offer "skip" once there's at least one answer — skipping
            with zero input produces a meaningless generic match. */}
        {answeredCount > 0 ? (
          <button
            type="button"
            className="quiz-skip-link"
            onClick={() => { cancelAdvance(); completionPathRef.current = 'skipped'; setStep('result'); }}
            aria-label="Skip remaining questions and see the best match"
          >
            Skip to results
          </button>
        ) : null}
      </div>

      <fieldset
        key={q.id}
        className="quiz-step"
        aria-describedby={q.helper ? 'quiz-question-helper' : undefined}
      >
        <legend className="h2 quiz-step-title" id="quiz-question-title" tabIndex={-1}>
          {q.title}
        </legend>
        {q.helper ? (
          <p id="quiz-question-helper" className="muted quiz-step-helper">{q.helper}</p>
        ) : null}

        <div className="quiz-options" role="radiogroup" aria-labelledby="quiz-question-title">
          {q.options.map((o) => (
            <label
              key={o.id}
              className={`quiz-option ${answers[q.id] === o.id ? 'is-on' : ''}`}
            >
              <input
                type="radio"
                name={q.id}
                value={o.id}
                checked={answers[q.id] === o.id}
                onChange={() => onSelect(o.id)}
              />
              <span className="quiz-option-body">
                <span className="quiz-option-label">{o.label}</span>
                {o.sublabel ? <span className="quiz-option-sublabel muted">{o.sublabel}</span> : null}
              </span>
              <span className="quiz-option-tick" aria-hidden>
                <Icon name="check" size={14} />
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="quiz-nav">
        <button
          type="button"
          className="btn btn-ghost"
          onClick={onBack}
          disabled={idx === 0}
        >
          <Icon name="arrow-left" size={14} /> Back
        </button>
        <button
          type="button"
          className="btn btn-primary btn-lg"
          onClick={onNext}
          disabled={!answered}
        >
          {idx + 1 === total ? 'See my match' : 'Next'} <Icon name="arrow-right" size={14} />
        </button>
      </div>
    </div>
  );
}

