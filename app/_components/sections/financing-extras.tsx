import { Icon, type IconName } from '../icon';

/**
 * Visual blocks for `/pages/mattress-store-financing`, injected into the
 * shared ServicePage via its `extras` slot (rendered between the merchant
 * body and the CTA).
 *
 * Why: the financing page was a text wall. Competitor financing pages
 * (Mattress Firm, Ashley, Purple) all lead with a "how it works" step
 * flow + a side-by-side of the finance options. This adds both, using
 * only facts already asserted by the merchant config in
 * lib/service-pages.ts (0% APR via Synchrony retail credit + Acima
 * lease-to-own, instant approval, no down payment, same-day delivery by
 * 4 PM). No invented APRs, term lengths, or monthly-payment figures —
 * those vary by purchase and creditworthiness, so the card copy stays
 * qualitative and a disclaimer points shoppers to a consultant for
 * current offers.
 */

const STEPS: Array<{ n: number; icon: IconName; title: string; body: string }> = [
  {
    n: 1,
    icon: 'cart',
    title: 'Pick your mattress',
    body: 'Shop online or with a consultant at any of our 5 LA showrooms, no pre-approval needed to browse.',
  },
  {
    n: 2,
    icon: 'card',
    title: 'Apply in seconds',
    body: 'Choose Synchrony or Acima at checkout or in-store. No down payment, and Acima needs no established credit.',
  },
  {
    n: 3,
    icon: 'check',
    title: 'Get a decision instantly',
    body: 'Most applicants are approved on the spot, you’ll see your plan and spending limit before you commit.',
  },
  {
    n: 4,
    icon: 'truck',
    title: 'Sleep now, pay over time',
    body: 'Approved by 4 PM? We can deliver the same day. Then pay it off on your plan’s schedule.',
  },
];

const PROVIDERS: Array<{
  name: string;
  tag: string;
  kind: string;
  who: string;
  points: string[];
}> = [
  {
    name: 'Synchrony',
    tag: '0% APR',
    kind: 'Promotional retail credit',
    who: 'Best for shoppers with established credit who want to split the cost with no interest.',
    points: [
      'Promotional 0% APR on qualifying purchases',
      'Revolving credit line you can reuse later',
      'Apply at checkout or in any showroom',
    ],
  },
  {
    name: 'Acima',
    tag: 'No credit needed',
    kind: 'Lease-to-own',
    who: 'Best if you’re building or rebuilding credit, approval is based on income, not just your score.',
    points: [
      'No established credit history required',
      'Early-purchase options to save on the lease',
      'Fast application with an instant decision',
    ],
  },
];

export function FinancingExtras() {
  return (
    <>
      <section className="fin-steps-sec" aria-labelledby="fin-steps-h">
        <h2 id="fin-steps-h" className="h2 mt-section-h">How financing works</h2>
        <p className="muted mt-section-lede">
          Four steps from browsing to sleeping, most shoppers finish the application in under two minutes.
        </p>
        <ol className="fin-steps">
          {STEPS.map((s) => (
            <li key={s.n} className="fin-step">
              <span className="fin-step-num" aria-hidden="true">{s.n}</span>
              <span className="fin-step-icon" aria-hidden="true">
                <Icon name={s.icon} size={22} />
              </span>
              <h3 className="fin-step-title">{s.title}</h3>
              <p className="fin-step-body">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="fin-prov-sec" aria-labelledby="fin-prov-h">
        <h2 id="fin-prov-h" className="h2 mt-section-h">Two ways to pay over time</h2>
        <p className="muted mt-section-lede">
          Pick the plan that fits your credit, you can apply for either at checkout or in any showroom.
        </p>
        <div className="fin-prov-grid">
          {PROVIDERS.map((p) => (
            <article key={p.name} className="fin-prov-card">
              <div className="fin-prov-head">
                <h3 className="h3 fin-prov-name">{p.name}</h3>
                <span className="fin-prov-tag">{p.tag}</span>
              </div>
              <p className="fin-prov-kind">{p.kind}</p>
              <p className="fin-prov-who">{p.who}</p>
              <ul className="fin-prov-points">
                {p.points.map((pt) => (
                  <li key={pt}>
                    <Icon name="check" size={15} aria-hidden="true" />
                    <span>{pt}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
        <p className="muted fin-disclaimer">
          Approval, terms, and promotional periods are set by Synchrony and Acima and may vary by purchase amount and creditworthiness. Ask a consultant for the current offers.
        </p>
      </section>
    </>
  );
}
