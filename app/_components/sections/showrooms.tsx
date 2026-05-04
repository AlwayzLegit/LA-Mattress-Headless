'use client';

import { useRef } from 'react';
import Link from 'next/link';
import { Icon } from '../icon';
import { phImg } from '../images';

type Showroom = {
  idx: string;
  name: string;
  area: string;
  address: string;
  hours: string;
  rating: string;
  reviews: string;
  img: string;
  label: string;
  href: string;
};

const SHOWROOMS: Showroom[] = [
  { idx: '01', name: 'Koreatown',    area: 'Wilshire & Western', address: '3550 Wilshire Blvd',  hours: 'Open daily · 10–8', rating: '4.9', reviews: '1,240', img: 'showroom-koreatown',    label: '[Koreatown storefront]',  href: '/pages/koreatown-best-mattress-store' },
  { idx: '02', name: 'West LA',      area: 'Sawtelle / Pico',    address: '11456 W Pico Blvd',   hours: 'Open daily · 10–8', rating: '4.9', reviews: '780',   img: 'showroom-west-la',      label: '[West LA interior]',       href: '/pages/best-mattress-store-west-la' },
  { idx: '03', name: 'Hancock Park', area: 'La Brea & 3rd',      address: '500 N La Brea Ave',   hours: 'Open daily · 10–7', rating: '4.8', reviews: '510',   img: 'showroom-hancock-park', label: '[Hancock Park entrance]',  href: '/pages/best-mattress-store-la-brea' },
  { idx: '04', name: 'Studio City',  area: 'Ventura Blvd',       address: '12450 Ventura Blvd',  hours: 'Open daily · 10–8', rating: '4.9', reviews: '430',   img: 'showroom-studio-city',  label: '[Studio City showroom]',   href: '/pages/mattress-store-studio-city' },
  { idx: '05', name: 'Glendale',     area: 'Brand Blvd',         address: '230 N Brand Blvd',    hours: 'Open daily · 10–8', rating: '4.8', reviews: '340',   img: 'showroom-glendale',     label: '[Glendale exterior]',      href: '/pages/mattress-store-in-glendale' },
];

export function Showrooms() {
  const scroller = useRef<HTMLDivElement>(null);
  const scroll = (dir: -1 | 1) => scroller.current?.scrollBy({ left: dir * 720, behavior: 'smooth' });

  return (
    <section className="section showrooms section-dark" id="showrooms">
      <div className="container showrooms-head">
        <div>
          <div className="eyebrow eyebrow-on-dark">Try before you buy</div>
          <h2 className="h-display">Five showrooms.<br />One Los Angeles.</h2>
        </div>
        <div className="showrooms-head-right">
          <p className="muted showrooms-lede">
            Every mattress on this site is on the floor at one of our locations. Lie down for as long as
            you want — no appointments, no pressure.
          </p>
          <div className="scroll-controls scroll-controls-dark">
            <button className="round-btn round-btn-dark" type="button" onClick={() => scroll(-1)} aria-label="Previous">
              <Icon name="arrow-left" size={16} />
            </button>
            <button className="round-btn round-btn-dark" type="button" onClick={() => scroll(1)} aria-label="Next">
              <Icon name="arrow-right" size={16} />
            </button>
          </div>
        </div>
      </div>
      <div ref={scroller} className="showroom-scroll no-scrollbar">
        <div className="showroom-spacer" />
        {SHOWROOMS.map((s) => (
          <Link href={s.href} key={s.idx} className="showroom-card">
            <div className="ph ph-dark showroom-img" {...phImg(s.img)}>
              <span className="ph-label">{s.label}</span>
            </div>
            <div className="showroom-meta">
              <div className="showroom-meta-top">
                <span className="mono showroom-idx">{s.idx} / 05</span>
                <span className="showroom-rating">
                  <Icon name="star" size={12} /> {s.rating} <span className="muted">({s.reviews})</span>
                </span>
              </div>
              <h3 className="showroom-name">{s.name}</h3>
              <div className="showroom-area muted">{s.area}</div>
              <div className="showroom-line">
                <span className="muted">{s.address}</span>
                <span className="muted">{s.hours}</span>
              </div>
              <div className="showroom-cta">View store <Icon name="arrow-up-right" size={14} /></div>
            </div>
          </Link>
        ))}
        <div className="showroom-spacer" />
      </div>
    </section>
  );
}
