'use client';

import { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';

export type MapShowroom = {
  handle: string;
  area: string;
  street: string;
  cityLine: string;
  phone: string;
  lat: number;
  lng: number;
  directionsUrl: string;
};

/**
 * Interactive showroom map (#5 redesign). Vanilla Leaflet + free CARTO
 * "Positron" light tiles (OpenStreetMap data) — no API key, no Google
 * embed, so no competitor business pins; only our five markers. Tiles
 * load in the visitor's browser, so there's no server-side/CDN
 * dependency on our end.
 *
 * Why vanilla Leaflet (not react-leaflet): avoids the peer-dependency
 * churn and lets us code-split the library into an async chunk loaded
 * only after this client component mounts (the `import('leaflet')` in
 * the effect), keeping it off the initial route bundle.
 *
 * Markers are L.divIcon (styled DOM), so we don't hit Leaflet's
 * well-known bundler issue with its default PNG marker image paths.
 * The crawlable <ul> legend lives in the server component around this,
 * so the location links are in the SSR HTML even before the map (or with
 * JS off) — this map is the visual layer, not the source of truth.
 */
export function ShowroomsMapClient({ showrooms }: { showrooms: MapShowroom[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current || !ref.current) return;
    started.current = true;
    let map: import('leaflet').Map | null = null;
    let cancelled = false;

    (async () => {
      const L = (await import('leaflet')).default;
      if (cancelled || !ref.current) return;

      map = L.map(ref.current, {
        scrollWheelZoom: false, // don't hijack page scroll; pinch/buttons still zoom
        attributionControl: true,
      });

      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        subdomains: 'abcd',
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      }).addTo(map);

      const pin = L.divIcon({
        className: 'locmap-pinicon',
        html: '<span class="locmap-pinicon-dot"></span>',
        iconSize: [22, 22],
        iconAnchor: [11, 11],
        popupAnchor: [0, -11],
      });

      const latlngs: [number, number][] = [];
      for (const s of showrooms) {
        latlngs.push([s.lat, s.lng]);
        const popup = `
          <div class="locmap-pop">
            <strong class="locmap-pop-area">${s.area}</strong>
            <span class="locmap-pop-addr">${s.street}<br>${s.cityLine}</span>
            <span class="locmap-pop-links">
              <a href="/pages/${s.handle}">View showroom</a>
              <a href="${s.directionsUrl}" target="_blank" rel="noopener">Directions</a>
              <a href="tel:${s.phone}">Call</a>
            </span>
          </div>`;
        L.marker([s.lat, s.lng], { icon: pin, title: s.area, alt: `${s.area} showroom` })
          .addTo(map)
          .bindPopup(popup);
      }

      if (latlngs.length > 0) {
        map.fitBounds(L.latLngBounds(latlngs), { padding: [48, 48], maxZoom: 12 });
      }
    })();

    return () => {
      cancelled = true;
      if (map) map.remove();
      started.current = false;
    };
  }, [showrooms]);

  return <div ref={ref} className="locmap-canvas" role="application" aria-label="Interactive map of our Los Angeles showrooms" />;
}
