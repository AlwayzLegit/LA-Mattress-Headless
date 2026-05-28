/**
 * Haversine great-circle distance between two lat/lng points, in miles.
 *
 * Used by the locations finder to compute the shopper's distance to each
 * showroom after they enter a ZIP / grant geolocation. Driving distance
 * is always longer than straight-line, so we round generously (1 decimal)
 * and present the value as "≈ X miles away" rather than implying drive
 * distance. Anything within ~5 miles in LA is realistically a 15–25 min
 * drive depending on time of day; we let Google Maps compute the actual
 * route when the shopper taps Directions.
 *
 * No external dependencies (no need for geolib/turf for a one-off distance
 * calc against 5 known points).
 */
export type Coords = { lat: number; lng: number };

const EARTH_RADIUS_MILES = 3958.7613;

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function haversineMiles(a: Coords, b: Coords): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const sinHalfLat = Math.sin(dLat / 2);
  const sinHalfLng = Math.sin(dLng / 2);
  const h =
    sinHalfLat * sinHalfLat +
    Math.cos(lat1) * Math.cos(lat2) * sinHalfLng * sinHalfLng;
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Format a distance for display. <1 mi shows decimal, ≥1 mi rounds to
 * one decimal place, ≥100 mi rounds to whole miles (anything that far
 * isn't a same-day decision anyway).
 */
export function formatMiles(miles: number): string {
  if (miles < 1) return `${miles.toFixed(1)} mi`;
  if (miles < 100) return `${miles.toFixed(1)} mi`;
  return `${Math.round(miles)} mi`;
}
