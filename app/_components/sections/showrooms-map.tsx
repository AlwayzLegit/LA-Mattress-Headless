import Link from 'next/link';
import { SHOWROOMS } from '@/lib/showrooms';

/**
 * Static, custom showroom map — replaces the old Google Maps iframe
 * (`?q=LA+Mattress+Store+Los+Angeles&output=embed`) on the locations
 * page. The generic Google embed surfaced nearby businesses, including
 * competitor mattress stores, in its live UI. This shows ONLY our five
 * showrooms.
 *
 * Implementation: an inline SVG that plots each showroom by its real
 * lat/long (projected into the viewBox below), so the relative geography
 * is accurate, with no external map tiles, no API key, no competitor
 * pins, and no third-party request. Each pin + legend row links to that
 * showroom's page. Purely presentational geography — the authoritative
 * address/hours/directions live in the directory (LocationsFinder)
 * below it on the page.
 */

// Bounding box around the five LA-area showrooms, with a little padding
// so no pin sits on the edge. Latitude north → top, longitude east → right.
const BBOX = { minLat: 34.02, maxLat: 34.17, minLon: -118.45, maxLon: -118.24 };

function project(lat: number, lon: number): { x: number; y: number } {
  const x = ((lon - BBOX.minLon) / (BBOX.maxLon - BBOX.minLon)) * 100;
  // Invert Y so larger latitude (further north) is nearer the top.
  const y = (1 - (lat - BBOX.minLat) / (BBOX.maxLat - BBOX.minLat)) * 100;
  return { x: Math.max(4, Math.min(96, x)), y: Math.max(6, Math.min(94, y)) };
}

export function ShowroomsMap() {
  const pins = SHOWROOMS.filter((s) => s.geo).map((s) => ({
    handle: s.handle,
    area: s.area,
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
          viewBox="0 0 100 100"
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label="Map showing the approximate locations of our five LA showrooms: Koreatown, West LA, La Brea, Studio City, and Glendale."
        >
          {/* Soft background + a couple of abstract guide lines so the
              pins read as a map, not dots in a void. Decorative only. */}
          <rect x="0" y="0" width="100" height="100" className="showrooms-map-bg" />
          <line x1="0" y1="52" x2="100" y2="46" className="showrooms-map-line" />
          <line x1="40" y1="0" x2="46" y2="100" className="showrooms-map-line" />
          {pins.map((p) => (
            <g key={p.handle} transform={`translate(${p.x} ${p.y})`}>
              <circle r="3.2" className="showrooms-map-pin" />
              <circle r="1.2" className="showrooms-map-pin-dot" />
            </g>
          ))}
        </svg>
      </div>

      {/* Accessible, crawlable legend — the real navigation. Each row
          links to the showroom page (matches the directory below). */}
      <ul className="showrooms-map-legend">
        {SHOWROOMS.map((s) => (
          <li key={s.handle}>
            <Link href={`/pages/${s.handle}`} className="showrooms-map-legend-link">
              <span className="showrooms-map-legend-pin" aria-hidden="true" />
              <span className="showrooms-map-legend-area">{s.area}</span>
              <span className="showrooms-map-legend-addr muted">{s.street}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
