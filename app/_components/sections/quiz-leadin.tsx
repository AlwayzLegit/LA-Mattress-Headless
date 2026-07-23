import Link from 'next/link';
import { Icon } from '../icon';

/**
 * One-question homepage lead-in for the sleep quiz.
 *
 * The 8-question full quiz at /sleep-quiz converts at a measurable rate
 * once a shopper starts, but committing to "8 questions" cold is the
 * drop-off point most mattress retailers solve by surfacing question
 * #1 (sleep position) inline on the homepage. Helix, Casper, Nectar,
 * Purple all ship a variant of this — the shopper taps one button
 * (low-cost commitment) and is then 1-of-8 deep into the quiz with
 * sunk-cost bias working in our favour.
 *
 * Wired by passing the picked position as a `?position=<id>` URL param
 * to /sleep-quiz. The quiz client reads that param on hydration,
 * pre-fills answers.position, and advances to question 2. See
 * app/(storefront)/sleep-quiz/sleep-quiz.tsx.
 *
 * Server component — no client JS beyond the inert <Link> tags.
 * Analytics for the click happen on the quiz route once it loads (the
 * pre-filled answer fires the existing `quiz_step` event).
 *
 * Options mirror QUESTIONS[0].options in quiz-data.ts. Kept literal
 * here (instead of importing) so this component stays a pure server
 * RSC with zero client bundle.
 */
const POSITIONS = [
  { id: 'side',    label: 'Side',          sublabel: 'Most common' },
  { id: 'back',    label: 'Back',          sublabel: 'Steady support' },
  { id: 'stomach', label: 'Stomach',       sublabel: 'Wants firmer' },
  { id: 'combo',   label: 'Combo',         sublabel: 'I move around' },
] as const;

export function QuizLeadIn() {
  return (
    <section className="quiz-leadin" aria-labelledby="quiz-leadin-h">
      <div className="container quiz-leadin-inner">
        <div className="quiz-leadin-copy">
          <div className="eyebrow">Find your mattress in 2 minutes</div>
          <h2 id="quiz-leadin-h" className="h2 quiz-leadin-title">
            How do you usually fall asleep?
          </h2>
          <p className="muted quiz-leadin-lede">
            Pick a position and we&rsquo;ll match you to the right mattress
            in 7 more quick questions. No email required.
          </p>
        </div>
        <div className="quiz-leadin-grid" role="list">
          {POSITIONS.map((p) => (
            <Link
              key={p.id}
              role="listitem"
              href={`/sleep-quiz?position=${p.id}`}
              className="quiz-leadin-card"
              aria-label={`Start the sleep quiz, ${p.label.toLowerCase()} sleeper`}
            >
              <span className="quiz-leadin-card-label">{p.label}</span>
              <span className="quiz-leadin-card-sub muted">{p.sublabel}</span>
              <span className="quiz-leadin-card-arrow" aria-hidden="true">
                <Icon name="arrow-right" size={14} />
              </span>
            </Link>
          ))}
        </div>
        <div className="quiz-leadin-foot">
          <Link href="/sleep-quiz" className="link-arrow">
            Or start the full quiz <Icon name="arrow-right" size={14} />
          </Link>
        </div>
      </div>
    </section>
  );
}
