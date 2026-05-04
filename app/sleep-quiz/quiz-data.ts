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
      { id: 'light', label: 'Under 130 lbs' },
      { id: 'mid',   label: '130 – 230 lbs' },
      { id: 'heavy', label: 'Over 230 lbs' },
      { id: 'skip',  label: 'Prefer not to say' },
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

export function recommend(answers: Answers): Recommendation {
  const score: Record<Material, number> = { foam: 0, hybrid: 0, innerspring: 0, latex: 0 };

  // Strong preference dominates if expressed.
  const matPref = answers.material as Material | 'any' | undefined;
  if (matPref && matPref !== 'any') score[matPref] += 5;

  // Position
  if (answers.position === 'side')    { score.foam += 2; score.hybrid += 1; }
  if (answers.position === 'back')    { score.hybrid += 2; score.innerspring += 1; }
  if (answers.position === 'stomach') { score.innerspring += 2; score.hybrid += 1; }
  if (answers.position === 'combo')   { score.hybrid += 2; score.latex += 1; }

  // Weight
  if (answers.weight === 'heavy') { score.hybrid += 2; score.innerspring += 1; }
  if (answers.weight === 'light') { score.foam += 1; }

  // Temperature — foam runs hotter without cooling tech; hybrids/innerspring/latex breathe better.
  if (answers.temp === 'hot')  { score.hybrid += 2; score.innerspring += 1; score.latex += 1; score.foam -= 1; }
  if (answers.temp === 'cold') { score.foam += 1; }

  // Firmness
  if (answers.firmness === 'soft') { score.foam += 1; }
  if (answers.firmness === 'firm') { score.innerspring += 1; score.hybrid += 1; }

  // Pain
  if (answers.pain === 'back')  { score.hybrid += 1; score.innerspring += 1; }
  if (answers.pain === 'joint') { score.foam += 2; }
  if (answers.pain === 'neck')  { score.foam += 1; }

  // Partner motion
  if (answers.partner === 'partner-move') { score.foam += 2; score.hybrid += 1; score.innerspring -= 1; }

  // Pick the winner. In case of a tie, the order below decides:
  // hybrid > foam > latex > innerspring (most universally recommended first).
  const order: Material[] = ['hybrid', 'foam', 'latex', 'innerspring'];
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
