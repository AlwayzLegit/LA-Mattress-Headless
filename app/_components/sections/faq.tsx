'use client';

import { useId, useState } from 'react';
import Link from 'next/link';
import { Icon } from '../icon';
import { HOMEPAGE_FAQ } from '@/lib/faq';

export function FAQ() {
  const [open, setOpen] = useState<number>(0);
  // Stable id prefix so each FAQ button can reference its panel via
  // aria-controls and the panel can reference its button via
  // aria-labelledby. useId is per-component-instance.
  const idPrefix = useId();
  return (
    <section className="section faq">
      <div className="container faq-inner">
        <div className="faq-head">
          <div className="eyebrow">FAQ</div>
          <h2 className="h2">Questions, answered.</h2>
          <Link href="/pages/mattress-store-contact" className="link-arrow">
            Ask a question <Icon name="arrow-right" size={14} />
          </Link>
        </div>
        <div className="faq-list">
          {HOMEPAGE_FAQ.map((it, i) => {
            const isOpen = open === i;
            const buttonId = `${idPrefix}-q-${i}`;
            const panelId = `${idPrefix}-a-${i}`;
            return (
              <div key={i} className={`faq-item ${isOpen ? 'on' : ''}`}>
                <button
                  type="button"
                  id={buttonId}
                  className="faq-q"
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => setOpen(isOpen ? -1 : i)}
                >
                  <span>{it.q}</span>
                  <Icon name={isOpen ? 'minus' : 'plus'} size={18} />
                </button>
                {/* The hidden attribute removes the panel from the
                    accessibility tree when collapsed, so SR users
                    don't hear all answers regardless of state. The
                    earlier max-height:0 visual collapse left the
                    DOM content fully exposed to assistive tech.
                    Trade-off: the smooth slide animation no longer
                    runs. Reduced-motion users wouldn't have seen it
                    anyway, and sighted users get an instant snap
                    that's still recognisable as "opened/closed". */}
                <div
                  id={panelId}
                  role="region"
                  aria-labelledby={buttonId}
                  className="faq-a"
                  hidden={!isOpen}
                >
                  <p>{it.a}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
