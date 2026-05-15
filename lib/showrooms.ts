export type Showroom = {
  handle: string;
  name: string;
  area: string;
  street: string;
  city: string;
  region: string;
  postalCode: string;
  phone: string;
  hours: { day: string; open: string; close: string }[];
  geo?: { latitude: number; longitude: number };
  mapUrl: string;
  /** Shopify CDN URL for the storefront photo. */
  imageUrl?: string;
  /**
   * Canonical Google Business Profile / Maps URL for this showroom.
   * Emitted as JSON-LD `sameAs` on the per-showroom FurnitureStore and
   * on the homepage LocalBusiness `department[]` entry, so Google can
   * map our structured data to the verified GBP/Maps entity. Use the
   * Maps profile share link (maps.app.goo.gl/…) or the full
   * /maps/place/… URL — NOT the /r/…/review solicitation link.
   */
  gbpUrl?: string;
};

export const SHOWROOMS: Showroom[] = [
  {
    handle: 'koreatown-best-mattress-store',
    name: 'LA Mattress — Koreatown',
    area: 'Koreatown',
    street: '201 S Western Ave',
    city: 'Los Angeles',
    region: 'CA',
    postalCode: '90004',
    phone: '+1-213-984-4654',
    hours: [
      { day: 'Mon-Fri', open: '10:00', close: '21:00' },
      { day: 'Sat-Sun', open: '10:00', close: '20:00' },
    ],
    geo: { latitude: 34.0710, longitude: -118.3092 },
    mapUrl: 'https://maps.google.com/?q=LA+Mattress+Koreatown+201+S+Western+Ave',
    imageUrl: 'https://cdn.shopify.com/s/files/1/0684/1759/files/Koreatown.jpg?v=1734092287',
    gbpUrl: 'https://maps.app.goo.gl/3EHM8AEraMU1D8We8',
  },
  {
    handle: 'best-mattress-store-west-la',
    name: 'LA Mattress — West LA',
    area: 'West Los Angeles',
    street: '10861 W Pico Blvd',
    city: 'Los Angeles',
    region: 'CA',
    postalCode: '90064',
    phone: '+1-310-507-8024',
    hours: [
      { day: 'Mon-Fri', open: '10:00', close: '21:00' },
      { day: 'Sat-Sun', open: '10:00', close: '20:00' },
    ],
    geo: { latitude: 34.0489, longitude: -118.4275 },
    mapUrl: 'https://maps.google.com/?q=LA+Mattress+West+LA+10861+W+Pico+Blvd',
    imageUrl: 'https://cdn.shopify.com/s/files/1/0684/1759/files/West_LA.jpg?v=1734092103',
    gbpUrl: 'https://maps.app.goo.gl/aE23QJizSeuaZGcp9',
  },
  {
    handle: 'best-mattress-store-la-brea',
    name: 'LA Mattress — La Brea / Hancock Park',
    area: 'La Brea',
    street: '300 S La Brea Ave',
    city: 'Los Angeles',
    region: 'CA',
    postalCode: '90036',
    phone: '+1-323-275-4715',
    hours: [
      { day: 'Mon-Fri', open: '10:00', close: '21:00' },
      { day: 'Sat-Sun', open: '10:00', close: '20:00' },
    ],
    geo: { latitude: 34.0764, longitude: -118.3447 },
    mapUrl: 'https://maps.google.com/?q=LA+Mattress+La+Brea+300+S+La+Brea+Ave',
    imageUrl: 'https://cdn.shopify.com/s/files/1/0684/1759/files/hancock.jpg?v=1734095213',
    gbpUrl: 'https://maps.app.goo.gl/u5FLaDMQswWdhx8SA',
  },
  {
    handle: 'mattress-store-studio-city',
    name: 'LA Mattress — Studio City',
    area: 'Studio City',
    street: '12306 Ventura Blvd',
    city: 'Studio City',
    region: 'CA',
    postalCode: '91604',
    phone: '+1-818-247-7790',
    hours: [
      { day: 'Mon-Fri', open: '10:00', close: '21:00' },
      { day: 'Sat-Sun', open: '10:00', close: '20:00' },
    ],
    geo: { latitude: 34.1420, longitude: -118.4040 },
    mapUrl: 'https://maps.google.com/?q=LA+Mattress+Studio+City+12306+Ventura+Blvd',
    imageUrl: 'https://cdn.shopify.com/s/files/1/0684/1759/files/Studio_City.jpg?v=1734378534',
    gbpUrl: 'https://maps.app.goo.gl/yUc19KdUJaCK25jD6',
  },
  {
    handle: 'mattress-store-in-glendale',
    name: 'LA Mattress — Glendale',
    area: 'Glendale',
    street: '201 N Central Ave',
    city: 'Glendale',
    region: 'CA',
    postalCode: '91203',
    phone: '+1-818-275-6592',
    hours: [
      { day: 'Mon-Fri', open: '10:00', close: '21:00' },
      { day: 'Sat-Sun', open: '10:00', close: '20:00' },
    ],
    geo: { latitude: 34.1493, longitude: -118.2546 },
    mapUrl: 'https://maps.google.com/?q=LA+Mattress+Glendale+201+N+Central+Ave',
    imageUrl: 'https://cdn.shopify.com/s/files/1/0684/1759/files/Glendale.jpg?v=1734092279',
    gbpUrl: 'https://maps.app.goo.gl/ougR46TStjLaKX5u7',
  },
];

/**
 * Display-format a stored RFC 3966 phone (`+1-213-984-4654`) into the
 * common North American visible form `(213) 984-4654`. Stored format
 * is preserved so `tel:` href construction and JSON-LD `telephone`
 * still consume the canonical string. Phase 236.
 */
export function formatPhone(phone: string): string {
  // Strip `+1-` prefix if present, then format the remaining digits.
  const digits = phone.replace(/^\+1-?/, '').replace(/[^\d]/g, '');
  if (digits.length !== 10) return phone; // unexpected — surface as-is
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export function findShowroom(handle: string): Showroom | undefined {
  return SHOWROOMS.find((s) => s.handle === handle);
}

/**
 * Showroom search — case-insensitive substring match across the fields
 * a visitor might type ("west la", "koreatown", "studio city",
 * "glendale", a street name, a zip). Cheap (the catalog is 5 entries)
 * so it runs in-process for both the header dropdown and the /search
 * Showrooms tab; no API call.
 */
export function searchShowrooms(query: string): Showroom[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return SHOWROOMS.filter((s) => {
    const hay = [s.name, s.area, s.street, s.city, s.region, s.postalCode]
      .join(' ')
      .toLowerCase();
    return hay.includes(q);
  });
}

/**
 * Computes whether the showroom is open at the given time and returns a
 * human-readable status. All five showrooms operate on America/Los_Angeles
 * time, so we ignore the server's zone and read the LA wall-clock instead
 * — that keeps the page consistent regardless of where it's rendered.
 *
 * Returns:
 *   { isOpen: true,  message: 'Open now · Closes at 8pm' }
 *   { isOpen: false, message: 'Opens at 10am' }
 *   { isOpen: false, message: 'Closed today · Opens Mon at 10am' } (rare)
 */
export type OpenStatus = { isOpen: boolean; message: string };

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

export function getOpenStatus(showroom: Showroom, now: Date = new Date()): OpenStatus {
  // Read LA wall clock no matter where this renders.
  const la = laParts(now);
  const todaysHours = matchHoursForDay(showroom.hours, la.dayIdx);
  const nowHM = la.hour * 60 + la.min;

  if (todaysHours) {
    const open = parseHM(todaysHours.open);
    const close = parseHM(todaysHours.close);
    if (open !== null && close !== null) {
      if (nowHM < open) return { isOpen: false, message: `Opens at ${formatHour(todaysHours.open)}` };
      if (nowHM < close) return { isOpen: true, message: `Open now · Closes at ${formatHour(todaysHours.close)}` };
      // Past close — fall through to find the next open day.
    }
  }

  // Walk forward up to 7 days to find the next opening time.
  for (let i = 1; i <= 7; i++) {
    const nextIdx = (la.dayIdx + i) % 7;
    const nextHours = matchHoursForDay(showroom.hours, nextIdx);
    if (nextHours) {
      const dayLabel = i === 1 ? 'tomorrow' : DAY_NAMES[nextIdx];
      return { isOpen: false, message: `Closed · Opens ${dayLabel} at ${formatHour(nextHours.open)}` };
    }
  }
  return { isOpen: false, message: 'Closed' };
}

function laParts(d: Date): { dayIdx: number; hour: number; min: number } {
  // Intl with timeZone gives us LA wall-clock without pulling moment/dayjs.
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = fmt.formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  const wd = get('weekday');
  const hour = Number.parseInt(get('hour'), 10);
  const min = Number.parseInt(get('minute'), 10);
  const dayIdx = (DAY_NAMES as readonly string[]).indexOf(wd);
  // 24h format with hour12=false sometimes returns "24" for midnight; clamp.
  return {
    dayIdx: dayIdx >= 0 ? dayIdx : 0,
    hour: Number.isFinite(hour) ? hour % 24 : 0,
    min: Number.isFinite(min) ? min : 0,
  };
}

function matchHoursForDay(
  hours: Showroom['hours'],
  dayIdx: number,
): { open: string; close: string } | null {
  for (const h of hours) {
    if (h.day === 'Mon-Sat' && dayIdx >= 1 && dayIdx <= 6) return h;
    if (h.day === 'Mon-Fri' && dayIdx >= 1 && dayIdx <= 5) return h;
    // Phase 236: weekend spans the boundary (Sat=6, Sun=0).
    if (h.day === 'Sat-Sun' && (dayIdx === 0 || dayIdx === 6)) return h;
    if (h.day === 'Sun' && dayIdx === 0) return h;
    if (h.day === 'Sat' && dayIdx === 6) return h;
    if (h.day === DAY_NAMES[dayIdx]) return h;
  }
  return null;
}

function parseHM(hm: string): number | null {
  const [h, m] = hm.split(':').map((n) => Number.parseInt(n, 10));
  return Number.isFinite(h) ? h * 60 + (Number.isFinite(m) ? m : 0) : null;
}

function formatHour(hhmm: string): string {
  const [h, m] = hhmm.split(':').map((n) => Number.parseInt(n, 10));
  if (!Number.isFinite(h)) return hhmm;
  const ampm = h >= 12 ? 'pm' : 'am';
  const h12 = ((h + 11) % 12) + 1;
  return m ? `${h12}:${String(m).padStart(2, '0')}${ampm}` : `${h12}${ampm}`;
}
