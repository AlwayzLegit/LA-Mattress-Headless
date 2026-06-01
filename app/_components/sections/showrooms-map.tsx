import Link from 'next/link';
import { SHOWROOMS } from '@/lib/showrooms';

/**
 * Showroom locator — a designed, self-contained map of our five LA-area
 * showrooms. No external tiles, no Maps API key, no third-party request,
 * and (unlike the old Google embed) no competitor pins.
 *
 * Redesign (#5 follow-up): the previous version drew abstract freeway
 * squiggles + a blob coast over a flat gradient, which read as random
 * scribbles. This version is a clean, modern locator:
 *   - a light gridded canvas (street-grid texture via an SVG pattern),
 *   - geographically meaningful backdrop: the Santa Monica Mountains
 *     band (which actually separates the Valley showrooms — Studio City,
 *     Glendale — to the north from the basin showrooms to the south) and
 *     the Santa Monica Bay coastline to the south-west,
 *   - faint orientation labels (PACIFIC / SANTA MONICA MTS / THE VALLEY),
 *   - crisp HTML pin markers (real DOM, so the labels render sharp at any
 *     size) with a soft brand halo, a pill label, and a smooth
 *     hover/focus lift to the red accent.
 *
 * Pins are positioned by each showroom's real lat/long (same projection
 * as before) and link to the showroom page. The legend below repeats the
 * links for tap targets + crawlability; authoritative address / hours /
 * directions live in the LocationsFinder directory below this.
 */

// Bounding box around the five LA-area showrooms, padded so no pin sits
// on the edge. Latitude north → top, longitude east → right.
const BBOX = { minLat: 34.02, maxLat: 34.17, minLon: -118.45, maxLon: -118.24 };

// Per-handle label side so pill labels point inward / don't collide with
// neighbouring pins (the five positions are fixed, so this is tuned once).
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
    <section className="locmap-section" aria-labelledby="showrooms-map-h">
      <h2 id="showrooms-map-h" className="sr-only">
        Our five Los Angeles showroom locations
      </h2>
      <div
        className="locmap"
        role="img"
        aria-label="Map of our five LA showrooms: Koreatown, West LA, La Brea, Studio City, and Glendale."
      >
        <svg className="locmap-bg" viewBox="0 0 100 64" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
          <defs>
            <linearGradient id="lm-land" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f5f7fb" />
              <stop offset="100%" stopColor="#e8edf5" />
            </linearGradient>
            <linearGradient id="lm-sea" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#cfe2f3" />
              <stop offset="100%" stopColor="#b6d2ea" />
            </linearGradient>
            <pattern id="lm-grid" width="6.5" height="6.5" patternUnits="userSpaceOnUse">
              <path d="M6.5 0 H0 V6.5" fill="none" stroke="#cad2e0" strokeWidth="0.18" opacity="0.7" />
            </pattern>
          </defs>

          {/* Land + street-grid texture */}
          <rect width="100" height="64" fill="url(#lm-land)" />
          <rect width="100" height="64" fill="url(#lm-grid)" />

          {/* Santa Monica Mountains band — the real divider between the
              San Fernando Valley (north) and the LA basin (south). */}
          <path
            className="locmap-mtns"
            d="M0 27 Q22 20 46 25 Q72 30 100 22 L100 32 Q72 39 46 34 Q22 29 0 36 Z"
          />

          {/* Santa Monica Bay — coastline tucked into the south-west
              corner (kept tight so the West LA pin stays on land). */}
          <path className="locmap-sea" d="M0 50 Q8 58 13 64 L0 64 Z" fill="url(#lm-sea)" />

          {/* Faint orientation labels (designed-map styling). */}
          <text className="locmap-geo" x="3.5" y="61.5" transform="rotate(-31 3.5 61.5)">PACIFIC</text>
          <text className="locmap-geo" x="50" y="30" textAnchor="middle">SANTA MONICA MTS</text>
          <text className="locmap-geo" x="55" y="8" textAnchor="middle">THE VALLEY</text>
        </svg>

        <div className="locmap-pins">
          {pins.map((p) => (
            <a
              key={p.handle}
              href={`/pages/${p.handle}`}
              className={`locmap-pin locmap-pin--${p.side}`}
              style={{ left: `${p.x}%`, top: `${p.y}%` }}
              aria-label={`${p.area} showroom`}
            >
              <span className="locmap-chip">{p.area}</span>
              <span className="locmap-marker" aria-hidden="true" />
            </a>
          ))}
        </div>
      </div>

      {/* Crawlable, tappable legend — the authoritative navigation. */}
      <ul className="locmap-legend">
        {SHOWROOMS.map((s) => (
          <li key={s.handle}>
            <Link href={`/pages/${s.handle}`} className="locmap-legend-link">
              <span className="locmap-legend-pin" aria-hidden="true" />
              <span className="locmap-legend-text">
                <span className="locmap-legend-area">{s.area}</span>
                <span className="locmap-legend-addr muted">{s.street}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
