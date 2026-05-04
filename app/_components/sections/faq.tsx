'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Icon } from '../icon';

const FAQ_ITEMS = [
  { q: 'Do you price match?',                  a: 'Yes — if you find the same mattress for less at any authorized retailer within 30 days, we’ll refund the difference plus 10%.' },
  { q: 'How fast is delivery?',                a: 'Same-day to most LA zip codes if ordered before 12pm. Otherwise next-day. Free white glove setup and old mattress haul-away on orders over $799.' },
  { q: 'What if I don’t like it?',         a: '120-night comfort exchange. Sleep on it for at least 30 nights, then if it’s not right, exchange for any other mattress — we credit the full original price.' },
  { q: 'Is financing actually 0%?',             a: 'Yes. 0% APR for up to 60 months on approved credit, with no prepayment penalty and no origination fees.' },
  { q: 'Can I see them in person first?',       a: 'Absolutely — that’s the whole point. Every mattress is on the floor at one of our 5 LA showrooms. No appointment needed.' },
  { q: 'Do you remove my old mattress?',        a: 'Free haul-away on every white glove delivery. We recycle responsibly through a local LA partner.' },
];

export function FAQ() {
  const [open, setOpen] = useState<number>(0);
  return (
    <section className="section faq">
      <div className="container faq-inner">
        <div className="faq-head">
          <div className="eyebrow">FAQ</div>
          <h2 className="h2">Questions, answered.</h2>
          <Link href="/pages/mattress-faq" className="link-arrow">
            Visit help center <Icon name="arrow-right" size={14} />
          </Link>
        </div>
        <div className="faq-list">
          {FAQ_ITEMS.map((it, i) => (
            <div key={i} className={`faq-item ${open === i ? 'on' : ''}`}>
              <button
                type="button"
                className="faq-q"
                aria-expanded={open === i}
                onClick={() => setOpen(open === i ? -1 : i)}
              >
                <span>{it.q}</span>
                <Icon name={open === i ? 'minus' : 'plus'} size={18} />
              </button>
              <div className="faq-a"><p>{it.a}</p></div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
