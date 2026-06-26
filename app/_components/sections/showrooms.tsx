// Phase 165: server component. Open-now badges are a client island
// (ShowroomOpenNowBadge); the cards render purely on the server.
//
// Phase 296: the card image now uses the real Shopify-CDN storefront
// photo from lib/showrooms.ts (the canonical source — the per-showroom
// pages and JSON-LD already use it) instead of the generated phImg
// placeholder. The homepage was the only surface still showing a
// placeholder box. The curated display fields (idx, cross-street area,
// hours string, href) stay homepage-local — they have no 1:1 in
// lib/showrooms — but are keyed by the canonical handle so the photo +
// open-now status come from the single source of truth. New imagery is
// a pure data swap in lib/showrooms.ts; no code change here.

import Image from 'next/image';
import Link from 'next/link';
import { Icon } from '../icon';
import { findShowroom } from '@/lib/showrooms';
import { RailScrollButtons } from './rail-scroll-buttons';
import { ShowroomOpenNowBadge } from './showroom-open-now-badge';

type ShowroomCard = {
  idx: string;
  name: string;
  area: string;
  address: string;
  hours: string;
  href: string;
  /** Matches a handle in lib/showrooms.ts — source of photo + open-now. */
  canonicalHandle: string;
};

const SHOWROOMS: ShowroomCard[] = [
  { idx: '01', name: 'Koreatown',    area: 'Western & 2nd', address: '201 S Western Ave',  hours: 'Mon–Fri 10–9 · Sat–Sun 10–8', href: '/pages/koreatown-best-mattress-store',  canonicalHandle: 'koreatown-best-mattress-store' },
  { idx: '02', name: 'West LA',      area: 'Pico Blvd',     address: '10861 W Pico Blvd',  hours: 'Mon–Fri 10–9 · Sat–Sun 10–8', href: '/pages/best-mattress-store-west-la',    canonicalHandle: 'best-mattress-store-west-la' },
  { idx: '03', name: 'La Brea',      area: 'La Brea & 3rd', address: '300 S La Brea Ave',  hours: 'Mon–Fri 10–9 · Sat–Sun 10–8', href: '/pages/best-mattress-store-la-brea',    canonicalHandle: 'best-mattress-store-la-brea' },
  { idx: '04', name: 'Studio City',  area: 'Ventura Blvd',  address: '12306 Ventura Blvd', hours: 'Mon–Fri 10–9 · Sat–Sun 10–8', href: '/pages/mattress-store-studio-city',     canonicalHandle: 'mattress-store-studio-city' },
  { idx: '05', name: 'Glendale',     area: 'Central Ave',   address: '201 N Central Ave',  hours: 'Mon–Fri 10–9 · Sat–Sun 10–8', href: '/pages/mattress-store-in-glendale',     canonicalHandle: 'mattress-store-in-glendale' },
];

const RAIL_ID = 'showrooms-rail';

export function Showrooms() {
  return (
    <section className="section showrooms section-dark" id="showrooms">
      <div className="container showrooms-head">
        <div>
          <div className="eyebrow eyebrow-on-dark">Try before you buy</div>
          <h2 className="h2">Five mattress showrooms near you<br />across Los Angeles.</h2>
        </div>
        <div className="showrooms-head-right">
          <p className="muted showrooms-lede">
            Every mattress we sell is on the floor at one of our five Los Angeles
            showrooms. Lie down as long as you want — no appointments, no pressure.
          </p>
          <RailScrollButtons
            railId={RAIL_ID}
            leftLabel="Scroll showrooms left"
            rightLabel="Scroll showrooms right"
            step={720}
            variant="dark"
          />
        </div>
      </div>
      <div id={RAIL_ID} className="showroom-scroll no-scrollbar">
        <div className="showroom-spacer" />
        {SHOWROOMS.map((s) => {
          const imageUrl = findShowroom(s.canonicalHandle)?.imageUrl;
          return (
            <Link href={s.href} key={s.idx} className="showroom-card">
              <div className="showroom-img">
                {imageUrl ? (
                  <Image
                    src={imageUrl}
                    alt={`${s.name} mattress store showroom — ${s.address}, Los Angeles`}
                    fill
                    sizes="(max-width: 880px) 78vw, 360px"
                    style={{ objectFit: 'cover' }}
                  />
                ) : (
                  <span className="ph ph-dark" style={{ position: 'absolute', inset: 0 }} aria-hidden="true" />
                )}
              </div>
              <div className="showroom-meta">
                <div className="showroom-meta-top">
                  <span className="mono showroom-idx">{s.idx} / 05</span>
                  <ShowroomOpenNowBadge canonicalHandle={s.canonicalHandle} />
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
          );
        })}
        <div className="showroom-spacer" />
      </div>
    </section>
  );
}
