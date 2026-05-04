'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/app/_components/icon';
import { QUESTIONS, recommend, type Answers, type Recommendation } from './quiz-data';

export function SleepQuiz() {
  // Step 0..QUESTIONS.length-1 = questions, then "result" = done.
  const [step, setStep] = useState<number | 'result'>(0);
  const [answers, setAnswers] = useState<Answers>({});

  const total = QUESTIONS.length;
  const result = useMemo<Recommendation | null>(() => (step === 'result' ? recommend(answers) : null), [step, answers]);

  // Each time the question changes, refocus the heading for screen readers.
  useEffect(() => {
    if (step === 'result') return;
    const heading = document.getElementById('quiz-question-title');
    heading?.focus();
  }, [step]);

  if (step === 'result' && result) return <Result result={result} answers={answers} onRestart={() => { setStep(0); setAnswers({}); }} />;

  const idx = step as number;
  const q = QUESTIONS[idx];
  const answered = answers[q.id];

  const onSelect = (optId: string) => {
    setAnswers((a) => ({ ...a, [q.id]: optId }));
  };

  const onNext = () => {
    if (!answered) return;
    if (idx + 1 >= total) setStep('result');
    else setStep(idx + 1);
  };

  const onBack = () => {
    if (idx === 0) return;
    setStep(idx - 1);
  };

  return (
    <div className="quiz">
      <div className="quiz-progress" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={idx + 1} aria-label={`Question ${idx + 1} of ${total}`}>
        <div className="quiz-progress-fill" style={{ width: `${((idx + 1) / total) * 100}%` }} />
      </div>
      <div className="quiz-meta">
        <span className="muted tnum">{idx + 1} / {total}</span>
        <button type="button" className="quiz-skip-link" onClick={() => setStep('result')} aria-label="Skip remaining questions and see the best match">
          Skip to results
        </button>
      </div>

      <fieldset className="quiz-step">
        <legend className="h2 quiz-step-title" id="quiz-question-title" tabIndex={-1}>
          {q.title}
        </legend>
        {q.helper ? <p className="muted quiz-step-helper">{q.helper}</p> : null}

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

function Result({
  result,
  answers,
  onRestart,
}: {
  result: Recommendation;
  answers: Answers;
  onRestart: () => void;
}) {
  return (
    <div className="quiz quiz-result">
      <div className="quiz-result-head">
        <div className="eyebrow">Your match</div>
        <h2 className="h1" style={{ margin: 'var(--s-3) 0 var(--s-3)' }}>{result.type}</h2>
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
          <div className="eyebrow">Why this match</div>
          <ul>
            {result.rationale.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        </div>
      ) : null}

      <div className="quiz-result-alts">
        <div className="eyebrow">Worth comparing</div>
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
