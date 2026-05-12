// Phase 165: server component. Open-now status badges extracted to
// ShowroomOpenNowBadge (client island) so the rest of the section —
// including the cards themselves — render purely on the server. Scroll
// buttons share the generic RailScrollButtons island from Phase 164.

import Link from 'next/link';
import { Icon } from '../icon';
import { phImg } from '../images';
import { RailScrollButtons } from './rail-scroll-buttons';
import { ShowroomOpenNowBadge } from './showroom-open-now-badge';

type Showroom = {
  idx: string;
  name: string;
  area: string;
  address: string;
  hours: string;
  img: string;
  label: string;
  href: string;
  /** Matches a handle in lib/showrooms.ts so we can derive open-now status. */
  canonicalHandle: string;
};

// Phase 237: addresses + areas + hours updated to match the canonical
// data in lib/showrooms.ts. Previously this section had hardcoded values
// independent from the source of truth, which drifted (all 5 addresses
// were wrong). A future cleanup should derive these cards from SHOWROOMS
// directly via `import { SHOWROOMS } from '@/lib/showrooms'`, but the
// homepage-specific display fields (idx, area cross-street, hours string,
// img key, label) don't have 1:1 counterparts in lib/showrooms yet, so
// for now they're hand-maintained but verified.
const SHOWROOMS: Showroom[] = [
  { idx: '01', name: 'Koreatown',    area: 'Western & 2nd',      address: '201 S Western Ave',   hours: 'Mon–Fri 10–9 · Sat–Sun 10–8', img: 'showroom-koreatown',    label: '[Koreatown storefront]',  href: '/pages/koreatown-best-mattress-store',  canonicalHandle: 'koreatown-best-mattress-store' },
  { idx: '02', name: 'West LA',      area: 'Pico Blvd',          address: '10861 W Pico Blvd',   hours: 'Mon–Fri 10–9 · Sat–Sun 10–8', img: 'showroom-west-la',      label: '[West LA interior]',      href: '/pages/best-mattress-store-west-la',    canonicalHandle: 'best-mattress-store-west-la' },
  { idx: '03', name: 'Hancock Park', area: 'La Brea & 3rd',      address: '300 S La Brea Ave',   hours: 'Mon–Fri 10–9 · Sat–Sun 10–8', img: 'showroom-hancock-park', label: '[Hancock Park entrance]', href: '/pages/best-mattress-store-la-brea',    canonicalHandle: 'best-mattress-store-la-brea' },
  { idx: '04', name: 'Studio City',  area: 'Ventura Blvd',       address: '12306 Ventura Blvd',  hours: 'Mon–Fri 10–9 · Sat–Sun 10–8', img: 'showroom-studio-city',  label: '[Studio City showroom]',  href: '/pages/mattress-store-studio-city',     canonicalHandle: 'mattress-store-studio-city' },
  { idx: '05', name: 'Glendale',     area: 'Central Ave',        address: '201 N Central Ave',   hours: 'Mon–Fri 10–9 · Sat–Sun 10–8', img: 'showroom-glendale',     label: '[Glendale exterior]',     href: '/pages/mattress-store-in-glendale',     canonicalHandle: 'mattress-store-in-glendale' },
];

const RAIL_ID = 'showrooms-rail';

export function Showrooms() {
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
        {SHOWROOMS.map((s) => (
          <Link href={s.href} key={s.idx} className="showroom-card">
            <div className="ph ph-dark showroom-img" {...phImg(s.img)}>
              <span className="ph-label">{s.label}</span>
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
        ))}
        <div className="showroom-spacer" />
      </div>
    </section>
  );
}
