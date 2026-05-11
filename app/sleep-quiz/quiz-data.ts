// Quiz schema + recommendation logic.
// Pure functions only — no React, safe to import from server or client.

export type Option = { id: string; label: string; sublabel?: string };
export type Question = {
  id: string;
  title: string;
  helper?: string;
  options: Option[];
};

export type Answers = Record<string, string>;

export const QUESTIONS: Question[] = [
  {
    id: 'position',
    title: 'How do you usually fall asleep?',
    helper: 'Your dominant position drives how much contour you need at the shoulders and hips.',
    options: [
      { id: 'side',    label: 'On my side',         sublabel: 'Most common — needs contour' },
      { id: 'back',    label: 'On my back',         sublabel: 'Wants steady support' },
      { id: 'stomach', label: 'On my stomach',      sublabel: 'Best on firmer surfaces' },
      { id: 'combo',   label: 'I move around — combo', sublabel: 'Wants responsiveness' },
    ],
  },
  {
    id: 'weight',
    title: 'Roughly how much do you weigh?',
    helper: 'Body weight changes how much support and pushback a mattress needs to give back.',
    options: [
      { id: 'light', label: 'Under 130 lbs',     sublabel: 'Wants a softer feel for pressure relief' },
      { id: 'mid',   label: '130 – 230 lbs',     sublabel: 'Most mattresses balance well here' },
      { id: 'heavy', label: 'Over 230 lbs',      sublabel: 'Needs stronger support and edge stability' },
      { id: 'skip',  label: 'Prefer not to say', sublabel: "We'll use a balanced default" },
    ],
  },
  {
    id: 'temp',
    title: 'Do you sleep hot or cold?',
    options: [
      { id: 'hot',     label: 'I sleep hot',     sublabel: 'I kick off the blanket overnight' },
      { id: 'neutral', label: 'Neither',         sublabel: 'I run pretty neutral' },
      { id: 'cold',    label: 'I sleep cold',    sublabel: 'I bundle up' },
    ],
  },
  {
    id: 'firmness',
    title: 'What firmness usually feels best?',
    options: [
      { id: 'soft',   label: 'Soft',         sublabel: 'Sink-in plush' },
      { id: 'medium', label: 'Medium',       sublabel: 'Balanced — most popular' },
      { id: 'firm',   label: 'Firm',         sublabel: 'Supportive top' },
      { id: 'unsure', label: 'Not sure',     sublabel: 'Show me a balanced default' },
    ],
  },
  {
    id: 'pain',
    title: 'Do you wake up with any chronic pain?',
    options: [
      { id: 'back',  label: 'Lower-back stiffness' },
      { id: 'joint', label: 'Hips, shoulders, joints' },
      { id: 'neck',  label: 'Neck or upper back' },
      { id: 'none',  label: 'No regular pain' },
    ],
  },
  {
    id: 'material',
    title: "Any preference on what it's made of?",
    helper: 'Skip if you’re open — we’ll match based on the rest.',
    options: [
      { id: 'foam',         label: 'Memory foam',        sublabel: 'Contour, motion isolation' },
      { id: 'hybrid',       label: 'Hybrid (foam + coils)', sublabel: 'Bounce + contour' },
      { id: 'innerspring',  label: 'Traditional innerspring', sublabel: 'Classic spring feel' },
      { id: 'latex',        label: 'Latex',              sublabel: 'Cool, durable, responsive' },
      { id: 'any',          label: "I'm open",           sublabel: 'Best match wins' },
    ],
  },
  {
    id: 'partner',
    title: 'How do you sleep?',
    options: [
      { id: 'solo',         label: 'I sleep solo' },
      { id: 'partner',      label: 'I sleep with a partner' },
      { id: 'partner-move', label: 'My partner moves a lot — motion matters' },
    ],
  },
  {
    id: 'budget',
    title: "What's your budget for a queen?",
    helper: 'Most LA Mattress queens fall between $1,000 and $5,000.',
    options: [
      { id: 'value',   label: 'Under $1,500' },
      { id: 'mid',     label: '$1,500 – $3,000' },
      { id: 'premium', label: '$3,000+' },
      { id: 'open',    label: "I'm open" },
    ],
  },
];

type Material = 'foam' | 'hybrid' | 'innerspring' | 'latex';
type Tier = 'value' | 'mid' | 'premium' | 'open';

export type Recommendation = {
  type: string;                 // human label, e.g. "Tempur-Pedic memory foam"
  primary: { handle: string; label: string };
  rationale: string[];
  alternates: { handle: string; label: string }[];
};

/**
 * Phase 231: deterministic answer-keyed tie-break order.
 *
 * The original recommend() used a hard-coded preference order
 * `['hybrid', 'foam', 'latex', 'innerspring']` for breaking score ties.
 * Combined with hybrid being able to accumulate +2 points from position,
 * weight, temperature, firmness, and pain (basically every signal),
 * hybrid won ~60-70% of answer paths regardless of inputs. Three very
 * different sleeper profiles all funneled into "Mid-tier hybrid /
 * Helix," which made the quiz feel "completely bogus."
 *
 * Fix: pick the tie-break order from a small set of permutations,
 * keyed on the answers themselves. Same answers → same order (UX is
 * stable on retry) but different answers → different ties resolve
 * differently, so no single material structurally dominates.
 *
 * Each permutation puts a different material at the front position so
 * that a true tie between two materials no longer always resolves the
 * same way globally.
 */
const TIE_BREAK_ORDERS: Material[][] = [
  ['hybrid',      'foam',        'latex',       'innerspring'],
  ['foam',        'hybrid',      'innerspring', 'latex'],
  ['latex',       'foam',        'hybrid',      'innerspring'],
  ['innerspring', 'hybrid',      'latex',       'foam'],
];

function tieBreakOrder(answers: Answers): Material[] {
  const seed = Object.entries(answers)
    .filter(([, v]) => v && v !== 'skip')
    .map(([k, v]) => `${k}:${v}`)
    .sort()
    .join('|');
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
  }
  return TIE_BREAK_ORDERS[Math.abs(h) % TIE_BREAK_ORDERS.length];
}

export function recommend(answers: Answers): Recommendation {
  const score: Record<Material, number> = { foam: 0, hybrid: 0, innerspring: 0, latex: 0 };

  // Strong preference influences but no longer dominates. Phase 231:
  // reduced from +5 to +3 — still meaningful (a user who picks latex
  // gets latex if it's at all competitive) but no longer guaranteed to
  // flatten the algorithm when a much-better fit exists.
  const matPref = answers.material as Material | 'any' | undefined;
  if (matPref && matPref !== 'any') score[matPref] += 3;

  // Position
  if (answers.position === 'side')    { score.foam += 2; score.hybrid += 1; }
  if (answers.position === 'back')    { score.hybrid += 2; score.innerspring += 1; }
  if (answers.position === 'stomach') { score.innerspring += 2; score.hybrid += 1; }
  if (answers.position === 'combo')   { score.hybrid += 2; score.latex += 1; }

  // Weight
  if (answers.weight === 'heavy') { score.hybrid += 2; score.innerspring += 1; }
  if (answers.weight === 'light') { score.foam += 1; }

  // Temperature — foam runs hotter without cooling tech; hybrids /
  // innerspring / latex breathe better. Phase 231: bumped latex +1→+2
  // on hot because latex is a legitimately strong fit for hot sleepers
  // and was underweighted relative to its real-world performance.
  if (answers.temp === 'hot')  { score.hybrid += 2; score.innerspring += 1; score.latex += 2; score.foam -= 1; }
  if (answers.temp === 'cold') { score.foam += 1; }

  // Firmness. Phase 231: bumped from +1 to +2 each. The previous
  // weighting let position (+2) outrank firmness (+1), so a side
  // sleeper who picked "firm" still got contour-foam-leaning
  // recommendations. Firmness is a stated preference and should
  // weigh as much as position.
  if (answers.firmness === 'soft') { score.foam += 2; }
  if (answers.firmness === 'firm') { score.innerspring += 2; score.hybrid += 2; }

  // Pain. Phase 231: added latex +1 for back and joint pain — latex
  // contours like foam without retaining heat, a real benefit for
  // joint-pain sleepers that the original weighting ignored.
  if (answers.pain === 'back')  { score.hybrid += 1; score.innerspring += 1; score.latex += 1; }
  if (answers.pain === 'joint') { score.foam += 2; score.latex += 1; }
  if (answers.pain === 'neck')  { score.foam += 1; }

  // Partner motion
  if (answers.partner === 'partner-move') { score.foam += 2; score.hybrid += 1; score.innerspring -= 1; }

  // Pick the winner. Tie-break is answers-keyed (see tieBreakOrder).
  const order = tieBreakOrder(answers);
  const winner = order.reduce<{ m: Material; s: number }>(
    (best, m) => (score[m] > best.s ? { m, s: score[m] } : best),
    { m: order[0], s: -Infinity },
  ).m;

  const tier = (answers.budget ?? 'open') as Tier;
  const primary = collectionFor(winner, tier);

  const alternates: { handle: string; label: string }[] = [];
  // Suggest the runner-up material at the same tier as a comparison.
  const runner = order.filter((m) => m !== winner).reduce<{ m: Material; s: number }>(
    (best, m) => (score[m] > best.s ? { m, s: score[m] } : best),
    { m: order[0], s: -Infinity },
  ).m;
  alternates.push(collectionFor(runner, tier));
  if (tier === 'value' || tier === 'open') {
    alternates.push({ handle: 'on-sale', label: 'See current deals' });
  }
  alternates.push({ handle: 'mattresses', label: 'Browse all mattresses' });

  return {
    type: typeLabel(winner, tier),
    primary,
    rationale: rationaleFor(answers, winner),
    alternates,
  };
}

function collectionFor(material: Material, tier: Tier): { handle: string; label: string } {
  if (material === 'foam') {
    if (tier === 'premium') return { handle: 'tempur-pedic-mattresses', label: 'Tempur-Pedic memory foam' };
    return { handle: 'memory-foam-mattresses', label: 'Memory foam mattresses' };
  }
  if (material === 'hybrid') {
    if (tier === 'premium') return { handle: 'stearns-foster-mattresses', label: 'Stearns & Foster hybrids' };
    if (tier === 'mid')     return { handle: 'helix-mattresses', label: 'Helix hybrids' };
    return { handle: 'hybrid-mattresses', label: 'Hybrid mattresses' };
  }
  if (material === 'innerspring') {
    return { handle: 'innerspring-mattresses', label: 'Innerspring mattresses' };
  }
  return { handle: 'latex-mattresses', label: 'Latex mattresses' };
}

function typeLabel(material: Material, tier: Tier): string {
  const m = material === 'foam'        ? 'memory foam'
          : material === 'hybrid'      ? 'hybrid'
          : material === 'innerspring' ? 'innerspring'
          :                              'latex';
  if (tier === 'premium') return `Premium ${m}`;
  if (tier === 'mid')     return `Mid-tier ${m}`;
  if (tier === 'value')   return `Value ${m}`;
  return m.charAt(0).toUpperCase() + m.slice(1);
}

function rationaleFor(a: Answers, m: Material): string[] {
  const out: string[] = [];
  if (a.position === 'side')                   out.push('Side sleepers benefit from contour around shoulders and hips.');
  if (a.position === 'back')                   out.push('Back sleepers want steady support that holds the lumbar curve.');
  if (a.position === 'stomach')                out.push('Stomach sleepers do best on firmer surfaces that keep hips from sinking.');
  if (a.temp === 'hot')                        out.push('You sleep hot — we leaned toward builds that breathe.');
  if (a.partner === 'partner-move')            out.push('Foam and hybrid layers absorb motion well for partner sleep.');
  if (a.pain === 'back')                       out.push('Lower-back relief comes from a supportive transition layer under the comfort foams.');
  if (a.pain === 'joint')                      out.push('Joint pressure eases with deeper contour at the shoulders and hips.');
  if (a.pain === 'neck')                       out.push('Neck pain often improves with consistent surface tension and the right pillow.');
  if (a.weight === 'heavy' && m !== 'foam')    out.push('Hybrid and innerspring builds give better long-term support for heavier bodies.');
  if (a.firmness === 'soft' && m === 'foam')   out.push('You like a plush feel — memory foam gives that hug.');
  if (a.firmness === 'firm' && m !== 'foam')   out.push('You like firmer support — coils and latex push back instead of sinking.');
  // Cap at 3 for a tidy result block.
  return out.slice(0, 3);
}
