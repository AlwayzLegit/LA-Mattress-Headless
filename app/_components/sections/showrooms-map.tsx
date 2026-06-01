import Link from 'next/link';
import { SHOWROOMS } from '@/lib/showrooms';

/**
 * Custom showroom locator map — replaces the old Google Maps iframe
 * (`?q=LA+Mattress+Store+Los+Angeles&output=embed`) whose live UI
 * surfaced competitor mattress stores. Shows ONLY our five showrooms.
 *
 * A designed inline-SVG locator (no external tiles, no API key, no
 * third-party request, no competitor pins): each showroom is plotted by
 * its real lat/long, drawn as a labeled teardrop pin over a stylized LA
 * backdrop (coast sliver + freeway reference lines for orientation).
 * Pins are links to the showroom page; the legend below repeats the
 * links for tap targets + crawlability. Authoritative address / hours /
 * directions live in the LocationsFinder directory below this on the page.
 */

// Bounding box around the five LA-area showrooms, padded so no pin sits
// on the edge. Latitude north → top, longitude east → right.
const BBOX = { minLat: 34.02, maxLat: 34.17, minLon: -118.45, maxLon: -118.24 };

// Per-handle label placement so labels don't collide with neighbouring
// pins (the five positions are fixed, so this is hand-tuned once).
const LABEL_SIDE: Record<string, 'left' | 'right' | 'above'> = {
  'koreatown-best-mattress-store': 'right',
  'best-mattress-store-west-la': 'right',
  'best-mattress-store-la-brea': 'above',
  'mattress-store-studio-city': 'right',
  'mattress-store-in-glendale': 'left',
};

function project(lat: number, lon: number): { x: number; y: number } {
  const x = ((lon - BBOX.minLon) / (BBOX.maxLon - BBOX.minLon)) * 100;
  const y = (1 - (lat - BBOX.minLat) / (BBOX.maxLat - BBOX.minLat)) * 100;
  return { x: Math.max(7, Math.min(93, x)), y: Math.max(12, Math.min(82, y)) };
}

export function ShowroomsMap() {
  const pins = SHOWROOMS.filter((s) => s.geo).map((s) => ({
    handle: s.handle,
    area: s.area,
    side: LABEL_SIDE[s.handle] ?? 'right',
    ...project(s.geo!.latitude, s.geo!.longitude),
  }));

  return (
    <section className="showrooms-map-wrap" aria-labelledby="showrooms-map-h">
      <h2 id="showrooms-map-h" className="sr-only">
        Our five Los Angeles showroom locations
      </h2>
      <div className="showrooms-map">
        <svg
          className="showrooms-map-svg"
          viewBox="0 0 100 64"
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label="Map of our five LA showrooms: Koreatown, West LA, La Brea, Studio City, and Glendale."
        >
          <defs>
            <linearGradient id="sm-land" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--sm-land-top, #eef1f6)" />
              <stop offset="100%" stopColor="var(--sm-land-bot, #e3e8f0)" />
            </linearGradient>
            <filter id="sm-pin-shadow" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="0.5" stdDeviation="0.6" floodOpacity="0.35" />
            </filter>
          </defs>

          {/* Land */}
          <rect x="0" y="0" width="100" height="64" fill="url(#sm-land)" />

          {/* Coast sliver (Santa Monica Bay is off to the SW — hint only) */}
          <path d="M0 40 Q5 52 3.5 64 L0 64 Z" className="showrooms-map-ocean" />

          {/* Freeway reference lines (decorative orientation cues) */}
          <g className="showrooms-map-fwy" fill="none">
            <path d="M-2 30 Q35 26 64 30 T102 22" />
            <path d="M14 -2 Q20 25 12 66" />
            <path d="M2 46 Q45 40 100 44" />
          </g>

          {/* Pins */}
          {pins.map((p) => {
            const labelDx = p.side === 'left' ? -3.2 : p.side === 'right' ? 3.2 : 0;
            const labelDy = p.side === 'above' ? -7.4 : -2.4;
            const anchor = p.side === 'left' ? 'end' : p.side === 'above' ? 'middle' : 'start';
            // Project the 0..100 (×0..64) pin into the actual viewBox.
            const px = p.x;
            const py = (p.y / 100) * 64;
            return (
              <a key={p.handle} href={`/pages/${p.handle}`} className="showrooms-map-pinlink">
                <g transform={`translate(${px} ${py})`}>
                  {/* Teardrop pin (tip at the projected point). */}
                  <path
                    className="showrooms-map-pin"
                    filter="url(#sm-pin-shadow)"
                    d="M0 0 C-2.4 -3.6 -4 -5 -4 -7.6 a4 4 0 1 1 8 0 C4 -5 2.4 -3.6 0 0 Z"
                  />
                  <circle cx="0" cy="-7.6" r="1.5" className="showrooms-map-pin-dot" />
                  <text
                    className="showrooms-map-label"
                    x={labelDx}
                    y={labelDy}
                    textAnchor={anchor}
                  >
                    {p.area}
                  </text>
                </g>
              </a>
            );
          })}
        </svg>
      </div>

      {/* Crawlable, tappable legend — the authoritative navigation. */}
      <ul className="showrooms-map-legend">
        {SHOWROOMS.map((s) => (
          <li key={s.handle}>
            <Link href={`/pages/${s.handle}`} className="showrooms-map-legend-link">
              <span className="showrooms-map-legend-pin" aria-hidden="true" />
              <span className="showrooms-map-legend-text">
                <span className="showrooms-map-legend-area">{s.area}</span>
                <span className="showrooms-map-legend-addr muted">{s.street}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
