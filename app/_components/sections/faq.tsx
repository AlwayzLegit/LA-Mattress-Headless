'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Icon } from '../icon';
import { HOMEPAGE_FAQ } from '@/lib/faq';

export function FAQ() {
  const [open, setOpen] = useState<number>(0);
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
          {HOMEPAGE_FAQ.map((it, i) => (
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
