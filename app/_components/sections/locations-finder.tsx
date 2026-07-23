'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Icon } from '../icon';
import { ShowroomOpenStatus } from '../showroom-open-status';
import { formatPhone, type Showroom } from '@/lib/showrooms';
import { haversineMiles, formatMiles, type Coords } from '@/lib/distance';

/**
 * Locations finder — ZIP / geolocation distance lookup over the showroom
 * directory. Client component (manages input state + browser APIs) that
 * owns the showroom list rendering so it can re-sort + annotate cards
 * with distance when the shopper provides coordinates.
 *
 * UX flow:
 *   1. Server renders the directory in canonical order (Koreatown, West
 *      LA, La Brea, Studio City, Glendale). Component shows a finder
 *      bar above with two inputs: ZIP form + "Use my location" button.
 *   2. Shopper enters ZIP → fetch api.zippopotam.us (free, no key,
 *      CORS-friendly) → coords → haversine each showroom → sort by
 *      distance, prepend "≈ X miles away" badge.
 *   3. Shopper clicks Use My Location → navigator.geolocation → same.
 *   4. Error states: ZIP not found, geolocation denied, network down.
 *      All graceful — original list stays, inline message under inputs.
 *
 * Industry-standard pattern (Mattress Firm, Sleep Number, Casper all
 * carry a ZIP-or-geolocation widget on their store locators).
 *
 * Why client and not server: ZIP geocoding could be server-side, but
 * geolocation is browser-only. Mixing the two paths into one component
 * with one consistent UX is cleaner than splitting them across a
 * server form action + a separate client widget.
 */
type Props = { showrooms: Showroom[] };

type FinderStatus = 'idle' | 'loading' | 'error';

const ZIP_RE = /^[0-9]{5}$/;

export function LocationsFinder({ showrooms }: Props) {
  const [zip, setZip] = useState('');
  const [coords, setCoords] = useState<Coords | null>(null);
  const [origin, setOrigin] = useState<string | null>(null); // "ZIP 90064" or "your location"
  const [status, setStatus] = useState<FinderStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const annotated = useMemo(() => {
    if (!coords) return showrooms.map((s) => ({ showroom: s, miles: null as number | null }));
    return showrooms
      .map((s) => {
        const miles = s.geo
          ? haversineMiles(coords, { lat: s.geo.latitude, lng: s.geo.longitude })
          : null;
        return { showroom: s, miles };
      })
      .sort((a, b) => {
        // Showrooms without geo (shouldn't happen for real data) sort
        // to the end so they don't bubble to the top of the list with
        // an "Infinity miles" comparison.
        if (a.miles == null && b.miles == null) return 0;
        if (a.miles == null) return 1;
        if (b.miles == null) return -1;
        return a.miles - b.miles;
      });
  }, [showrooms, coords]);

  const onSubmitZip = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = zip.trim();
    if (!ZIP_RE.test(cleaned)) {
      setStatus('error');
      setError('Enter a 5-digit US ZIP code.');
      return;
    }
    setStatus('loading');
    setError(null);
    try {
      // api.zippopotam.us — free public ZIP geocoder, no API key, CORS-
      // friendly. ~99.9% uptime per their status page; we catch errors
      // anyway and fall back to keeping the canonical list visible.
      const res = await fetch(`https://api.zippopotam.us/us/${cleaned}`);
      if (!res.ok) {
        throw new Error('not-found');
      }
      const data = (await res.json()) as {
        places?: Array<{ latitude: string; longitude: string; 'place name'?: string }>;
      };
      const place = data.places?.[0];
      if (!place) throw new Error('not-found');
      const lat = parseFloat(place.latitude);
      const lng = parseFloat(place.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new Error('not-found');
      setCoords({ lat, lng });
      setOrigin(`ZIP ${cleaned}`);
      setStatus('idle');
    } catch {
      setStatus('error');
      setError("Couldn't find that ZIP code. Double-check the digits and try again.");
    }
  };

  const onUseLocation = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setStatus('error');
      setError('Your browser doesn\'t support geolocation. Try entering your ZIP instead.');
      return;
    }
    setStatus('loading');
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setOrigin('your location');
        setStatus('idle');
      },
      (err) => {
        setStatus('error');
        // PERMISSION_DENIED is the common case — give the alternative
        // path explicitly. Other errors (position unavailable, timeout)
        // are rare; same fallback message.
        const denied = err.code === err.PERMISSION_DENIED;
        setError(
          denied
            ? 'Location access denied. Enter your ZIP code below instead.'
            : 'Could not get your location. Try entering your ZIP code instead.',
        );
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 5 * 60 * 1000 },
    );
  };

  const clearLookup = () => {
    setCoords(null);
    setOrigin(null);
    setZip('');
    setError(null);
    setStatus('idle');
  };

  return (
    <>
      <div className="locations-finder" aria-label="Find your closest showroom">
        <form className="locations-finder-form" onSubmit={onSubmitZip}>
          <label className="locations-finder-label" htmlFor="locations-finder-zip">
            Find your closest showroom
          </label>
          <div className="locations-finder-row">
            <input
              id="locations-finder-zip"
              type="text"
              inputMode="numeric"
              autoComplete="postal-code"
              pattern="[0-9]{5}"
              maxLength={5}
              placeholder="ZIP code"
              className="locations-finder-input"
              value={zip}
              onChange={(e) => setZip(e.target.value.replace(/[^0-9]/g, '').slice(0, 5))}
              disabled={status === 'loading'}
            />
            <button
              type="submit"
              className="locations-finder-submit"
              disabled={status === 'loading' || zip.length !== 5}
            >
              {status === 'loading' ? 'Locating…' : 'Find'}
            </button>
            <button
              type="button"
              className="locations-finder-geo"
              onClick={onUseLocation}
              disabled={status === 'loading'}
              aria-label="Use my current location"
            >
              <Icon name="pin" size={14} /> Use my location
            </button>
          </div>
          {error ? (
            <p className="locations-finder-error" role="alert">
              {error}
            </p>
          ) : null}
          {coords && origin ? (
            <p className="locations-finder-success">
              Showrooms sorted by distance from {origin}.{' '}
              <button type="button" className="link-inline" onClick={clearLookup}>
                Clear
              </button>
            </p>
          ) : null}
        </form>
      </div>

      <section className="locations-grid" aria-label="Showroom directory">
        {annotated.map(({ showroom: s, miles }) => {
          const directionsHref = s.gbpUrl ?? s.mapUrl;
          return (
            <article key={s.handle} className="location-card location-card-rich">
              {s.imageUrl ? (
                <Link
                  href={`/pages/${s.handle}`}
                  className="location-card-photo"
                  aria-label={`${s.name}, view details`}
                >
                  <Image
                    src={s.imageUrl}
                    alt={`${s.name} storefront`}
                    width={520}
                    height={400}
                    sizes="(max-width: 768px) 100vw, 260px"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </Link>
              ) : null}
              <div className="location-card-meta">
                <div className="location-card-eyebrow-row">
                  <span className="eyebrow">{s.area}</span>
                  {miles != null ? (
                    <span className="location-card-distance" aria-label={`${formatMiles(miles)} from ${origin}`}>
                      ≈ {formatMiles(miles)}
                    </span>
                  ) : null}
                </div>
                <h2 className="location-card-name">
                  <Link href={`/pages/${s.handle}`}>{s.name}</Link>
                </h2>
                <ShowroomOpenStatus showroom={s} />
                <address className="location-card-addr">
                  <div>{s.street}</div>
                  <div>
                    {s.city}, {s.region} {s.postalCode}
                  </div>
                  {s.crossStreet ? (
                    <div className="muted" style={{ fontSize: 13, marginTop: 'var(--s-1)' }}>
                      Near {s.crossStreet}
                    </div>
                  ) : null}
                </address>
                <div className="location-card-hours muted" style={{ fontSize: 13 }}>
                  {summarizeHours(s.hours)}
                </div>
                {s.nearbyAreas.length > 0 ? (
                  <div
                    className="location-card-areas muted"
                    style={{ fontSize: 13, marginTop: 'var(--s-2)' }}
                  >
                    Serving {s.nearbyAreas.slice(0, 3).join(', ')}
                    {s.nearbyAreas.length > 3 ? ` + ${s.nearbyAreas.length - 3} more` : ''}
                  </div>
                ) : null}
                <div className="location-card-actions">
                  <a
                    href={`tel:${s.phone}`}
                    className="location-action location-action-primary tnum"
                    aria-label={`Call ${s.name} at ${formatPhone(s.phone)}`}
                  >
                    <Icon name="phone" size={14} /> Call
                  </a>
                  <a
                    href={directionsHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="location-action"
                    aria-label={`Get directions to ${s.name}`}
                  >
                    <Icon name="pin" size={14} /> Directions
                  </a>
                  <Link
                    href={`/pages/${s.handle}`}
                    className="location-action"
                    aria-label={`${s.name} store details`}
                  >
                    <Icon name="arrow-right" size={14} /> Details
                  </Link>
                </div>
              </div>
            </article>
          );
        })}
      </section>
    </>
  );
}

/**
 * Compact hours summary for the card. Mirrors the server-side helper of
 * the same name in app/(storefront)/pages/[handle]/page.tsx — duplicated
 * here so this client component has zero server-import dependencies.
 * The Showroom data shape is small + stable, so a copy is cheaper than
 * factoring a shared helper.
 */
function summarizeHours(hours: Showroom['hours']): string {
  if (hours.length === 0) return 'Hours vary';
  // Common case: one entry covering Mon–Fri + another covering Sat–Sun
  // with the same close time → "10 AM – 9 PM daily" if all match.
  const allSameOpen = hours.every((h) => h.open === hours[0].open);
  const allSameClose = hours.every((h) => h.close === hours[0].close);
  if (allSameOpen && allSameClose) {
    return `${humanTime(hours[0].open)}–${humanTime(hours[0].close)} daily`;
  }
  // Otherwise list each band.
  return hours.map((h) => `${h.day} ${humanTime(h.open)}–${humanTime(h.close)}`).join(' · ');
}

function humanTime(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  if (!Number.isFinite(h)) return hhmm;
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return m === 0 ? `${hour12} ${period}` : `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}
