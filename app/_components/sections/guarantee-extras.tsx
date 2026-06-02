import { Icon, type IconName } from '../icon';

/**
 * "How it works" step-flow visual for the guarantee / policy service
 * pages, injected via the shared ServicePage `extras` slot. Same
 * treatment as financing/delivery — reuses the `.fin-steps` step-card
 * CSS — but data-driven across the three handles.
 *
 * Every step is drawn from the page's own config facts in
 * lib/service-pages.ts (and the sitewide policy): no invented terms,
 * timeframes, or fees. Warranty defect language stays qualitative
 * because the exact sag threshold and coverage period vary by
 * manufacturer.
 */

type Step = { icon: IconName; title: string; body: string };
type FlowConfig = { heading: string; lede: string; steps: Step[] };

const FLOWS: Record<string, FlowConfig> = {
  'love-your-bed-guarantee': {
    heading: 'How the 120-night exchange works',
    lede: 'Choose with confidence — if the feel isn’t right after a fair trial, we make the swap easy.',
    steps: [
      {
        icon: 'home',
        title: 'Sleep on it 30 nights',
        body: 'Give your body at least 30 nights to adjust to a new mattress before deciding — break-in is real.',
      },
      {
        icon: 'phone',
        title: 'Tell us within 120 nights',
        body: 'Still not right? Contact us any time within 120 nights of delivery to start one comfort exchange.',
      },
      {
        icon: 'truck',
        title: 'We pick up & redeliver',
        body: 'We collect the original and bring your new pick — any in-stock mattress, any brand, any size. Pickup and redelivery included.',
      },
      {
        icon: 'card',
        title: 'Pay only the difference',
        body: 'No restocking fee. You pay only the price difference, if any. We recycle the original through California’s program.',
      },
    ],
  },
  'lowest-price-guarantee': {
    heading: 'How the price guarantee works',
    lede: 'Find it cheaper and we don’t just match — we beat it by 10%, before or after you buy.',
    steps: [
      {
        icon: 'search',
        title: 'Find a lower price',
        body: 'Spot the same mattress for less at an authorized retailer — in-store or online.',
      },
      {
        icon: 'mail',
        title: 'Send us the link or ad',
        body: 'Share it with us — no haggling and no paperwork on your end. Works up to 30 days after purchase too.',
      },
      {
        icon: 'shield',
        title: 'We verify it',
        body: 'We confirm it’s the same SKU from an authorized seller, then handle the rest.',
      },
      {
        icon: 'card',
        title: 'We beat it by 10%',
        body: 'Not just match — 10% below the competitor’s price. Already bought? We refund the difference plus 10%.',
      },
    ],
  },
  warranty: {
    heading: 'How a warranty claim works',
    lede: 'Every mattress is backed by the manufacturer’s warranty — and we file the claim for you.',
    steps: [
      {
        icon: 'alert',
        title: 'Spot a covered issue',
        body: 'A sag past the manufacturer’s threshold, or a material or workmanship defect within the coverage period.',
      },
      {
        icon: 'chat',
        title: 'Send us photos',
        body: 'Snap the issue and your mattress law tag. We’ll tell you exactly what the manufacturer needs.',
      },
      {
        icon: 'shield',
        title: 'We file the claim',
        body: 'We submit it to the manufacturer on your behalf, track it, and relay the decision back to you.',
      },
      {
        icon: 'check',
        title: 'Repair or replace',
        body: 'If approved, the manufacturer repairs or replaces the mattress under their warranty terms.',
      },
    ],
  },
};

export function GuaranteeExtras({ handle }: { handle: string }) {
  const flow = FLOWS[handle];
  if (!flow) return null;
  return (
    <section className="fin-steps-sec" aria-labelledby="gtee-steps-h">
      <h2 id="gtee-steps-h" className="h2 mt-section-h">{flow.heading}</h2>
      <p className="muted mt-section-lede">{flow.lede}</p>
      <ol className="fin-steps">
        {flow.steps.map((s, i) => (
          <li key={s.title} className="fin-step">
            <span className="fin-step-num" aria-hidden="true">{i + 1}</span>
            <span className="fin-step-icon" aria-hidden="true">
              <Icon name={s.icon} size={22} />
            </span>
            <h3 className="fin-step-title">{s.title}</h3>
            <p className="fin-step-body">{s.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
