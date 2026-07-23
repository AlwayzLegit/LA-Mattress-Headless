import type { Product, SleepPositionFit } from '@/lib/shopify';

/**
 * PDP Firmness section — design handoff §Firmness.
 *
 * Renders ONLY when firmnessScore (1-10) is populated. Position fit
 * (back / side / stomach) is independently optional — if not set, the
 * fit bars row is omitted but the scale still renders.
 *
 * Layout:
 *   .firmness-scale     gradient track + accent dot at score position
 *   .pdp-positions      3-col grid (back / side / stomach), each with
 *                       a label + great/good/poor pill + progress bar
 */
export function PdpFirmness({ product }: { product: Product }) {
  const { editorial } = product;
  if (editorial.firmnessScore === null) return null;

  const score = editorial.firmnessScore;
  const fits = editorial.positionFit;
  const hasFits = fits && (fits.back || fits.side || fits.stomach);

  return (
    <section className="pdp-section pdp-firmness">
      <div className="pdp-section-head">
        <div>
          <div className="eyebrow">Firmness</div>
          <h2 className="h2">{firmnessHeadline(score)}</h2>
        </div>
        <p className="muted pdp-section-lede">{firmnessLede(score)}</p>
      </div>

      <div className="firmness-scale">
        <div className="firmness-track">
          <div
            className="firmness-marker"
            style={{ left: `${((score - 1) / 9) * 100}%` }}
          >
            <span className="firmness-marker-dot" aria-hidden />
            <span className="mono firmness-marker-val">{score}/10</span>
          </div>
        </div>
        <div className="firmness-labels">
          <span>Soft</span>
          <span>Medium</span>
          <span>Firm</span>
        </div>
      </div>

      {hasFits ? (
        <div className="pdp-positions">
          {(['back', 'side', 'stomach'] as const).map((pos) => {
            const fit = fits?.[pos];
            if (!fit) return null;
            return (
              <div key={pos} className="pdp-position">
                <div className="pdp-position-head">
                  <span className="pdp-position-name">
                    {pos.charAt(0).toUpperCase() + pos.slice(1)} sleeper
                  </span>
                  <span className={`pdp-fit pdp-fit-${fit}`}>{fitLabel(fit)}</span>
                </div>
                <div className="pdp-position-bar">
                  <div
                    className="pdp-position-fill"
                    style={{ width: fit === 'great' ? '92%' : fit === 'good' ? '74%' : '40%' }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}

function firmnessHeadline(score: number): string {
  if (score <= 3) return 'Engineered for plush comfort.';
  if (score <= 5) return 'Engineered for medium support.';
  if (score <= 7) return 'Engineered for medium-firm support.';
  return 'Engineered for firm support.';
}

function firmnessLede(score: number): string {
  if (score <= 3)
    return `A ${score}/10 firmness, soft enough to cradle hips and shoulders. Best for side sleepers under 200 lb.`;
  if (score <= 5)
    return `A ${score}/10 firmness, soft enough to relieve pressure on shoulders and hips, firm enough to keep your spine in line. Most-recommended firmness for combination sleepers.`;
  if (score <= 7)
    return `A ${score}/10 firmness, gentle support without sinking. Good for back and combination sleepers, plus side sleepers over 200 lb.`;
  return `A ${score}/10 firmness, supportive top with minimal contour. Best for back and stomach sleepers, plus heavier sleepers who want less hug.`;
}

function fitLabel(fit: SleepPositionFit): string {
  if (fit === 'great') return 'Great fit';
  if (fit === 'good') return 'Good fit';
  return 'Try a firmer model';
}
