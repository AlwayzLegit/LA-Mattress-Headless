import Link from 'next/link';
import { SHOWROOMS } from '@/lib/showrooms';
import { ShowroomsMapClient, type MapShowroom } from './showrooms-map-client';

/**
 * Showroom locator — an INTERACTIVE map of our five LA-area showrooms
 * (#5 redesign). The drawn-SVG versions read as static scribbles; this
 * is a real pan/zoom Leaflet map on free CARTO light tiles, with our
 * five markers + popups (address, directions, call, showroom link) and
 * NO competitor pins (the reason the original Google embed was dropped).
 *
 * Split: this server component owns the data + the crawlable, tappable
 * legend (so the location links ship in SSR HTML for SEO and the no-JS
 * case), and delegates the interactive canvas to ShowroomsMapClient.
 * Authoritative address / hours / directions live in the LocationsFinder
 * directory below this on the page.
 */
export function ShowroomsMap() {
  const mapShowrooms: MapShowroom[] = SHOWROOMS.filter((s) => s.geo).map((s) => ({
    handle: s.handle,
    area: s.area,
    street: s.street,
    cityLine: `${s.city}, ${s.region} ${s.postalCode}`,
    phone: s.phone,
    lat: s.geo!.latitude,
    lng: s.geo!.longitude,
    directionsUrl: s.gbpUrl ?? s.mapUrl,
  }));

  return (
    <section className="locmap-section" aria-labelledby="showrooms-map-h">
      <h2 id="showrooms-map-h" className="sr-only">
        Our five Los Angeles showroom locations
      </h2>

      <ShowroomsMapClient showrooms={mapShowrooms} />

      {/* Minimal map-data credit required by the free OSM/CARTO tiles,
          relocated here so it isn't an overlay on the map face. */}
      <p className="locmap-credit">
        Map data ©{' '}
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>
        {' '}contributors, ©{' '}
        <a href="https://carto.com/attributions" target="_blank" rel="noopener noreferrer">CARTO</a>
      </p>

      {/* Crawlable, tappable legend, the authoritative navigation, in SSR
          HTML regardless of whether the map JS/tiles load. */}
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
