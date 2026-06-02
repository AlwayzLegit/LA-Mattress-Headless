import { Icon, type IconName } from '../icon';

/**
 * Visual blocks for `/pages/mattress-store-delivery`, injected into the
 * shared ServicePage via its `extras` slot (between merchant body and
 * CTA). Mirrors the financing page treatment: a "how it works" step
 * flow + a "what's included" checklist, so the delivery page leads with
 * scannable visuals instead of prose.
 *
 * Uses only facts already asserted in lib/service-pages.ts and the
 * sitewide delivery promise: free white-glove delivery on orders over
 * $499, same-day when ordered by 4 PM, in-bedroom setup, packaging
 * removed, stair carry included, old mattress hauled + recycled through
 * California's program. No invented timeframes or fees.
 */

const STEPS: Array<{ n: number; icon: IconName; title: string; body: string }> = [
  {
    n: 1,
    icon: 'cart',
    title: 'Choose your mattress',
    body: 'Order online or with a consultant in any of our 5 LA showrooms. Free white-glove delivery applies on orders over $499.',
  },
  {
    n: 2,
    icon: 'phone',
    title: 'We schedule your window',
    body: 'We confirm a delivery window that works for you — often the same day when you order by 4 PM on in-stock items.',
  },
  {
    n: 3,
    icon: 'home',
    title: 'White-glove delivery & setup',
    body: 'Our team carries it to your bedroom, sets it on your frame or base, and removes every bit of packaging.',
  },
  {
    n: 4,
    icon: 'shield',
    title: 'Free old-mattress haul-away',
    body: 'We take your old mattress and recycle it through California’s mattress recycling program — at no charge.',
  },
];

const INCLUDED: string[] = [
  'Free delivery on orders over $499',
  'Same-day available when you order by 4 PM',
  'In-bedroom placement and full setup',
  'All packaging unboxed and removed',
  'Stair carry-up at no extra charge',
  'Old mattress hauled away and recycled',
];

export function DeliveryExtras() {
  return (
    <>
      <section className="fin-steps-sec" aria-labelledby="del-steps-h">
        <h2 id="del-steps-h" className="h2 mt-section-h">How white-glove delivery works</h2>
        <p className="muted mt-section-lede">
          From checkout to a made-up bed in four steps — we handle the lifting, setup, and disposal.
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

      <section className="svc-included-sec" aria-labelledby="del-incl-h">
        <h2 id="del-incl-h" className="h2 mt-section-h">What’s included — every delivery</h2>
        <p className="muted mt-section-lede">
          White-glove service is the standard, not an upsell. Every qualifying order includes all of this.
        </p>
        <ul className="svc-included">
          {INCLUDED.map((item) => (
            <li key={item}>
              <Icon name="check" size={16} aria-hidden="true" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
