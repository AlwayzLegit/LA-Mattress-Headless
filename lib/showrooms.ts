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
};

export const SHOWROOMS: Showroom[] = [
  {
    handle: 'koreatown-best-mattress-store',
    name: 'LA Mattress — Koreatown',
    area: 'Koreatown',
    street: '3624 W 6th St',
    city: 'Los Angeles',
    region: 'CA',
    postalCode: '90020',
    phone: '+1-213-555-0142',
    hours: [
      { day: 'Mon-Sat', open: '10:00', close: '20:00' },
      { day: 'Sun',     open: '11:00', close: '19:00' },
    ],
    geo: { latitude: 34.0639, longitude: -118.3046 },
    mapUrl: 'https://maps.google.com/?q=LA+Mattress+Koreatown',
  },
  {
    handle: 'best-mattress-store-west-la',
    name: 'LA Mattress — West LA',
    area: 'West Los Angeles',
    street: '11340 W Pico Blvd',
    city: 'Los Angeles',
    region: 'CA',
    postalCode: '90064',
    phone: '+1-310-555-0188',
    hours: [
      { day: 'Mon-Sat', open: '10:00', close: '20:00' },
      { day: 'Sun',     open: '11:00', close: '19:00' },
    ],
    geo: { latitude: 34.0407, longitude: -118.4499 },
    mapUrl: 'https://maps.google.com/?q=LA+Mattress+West+LA',
  },
  {
    handle: 'best-mattress-store-la-brea',
    name: 'LA Mattress — La Brea / Hancock Park',
    area: 'La Brea',
    street: '700 N La Brea Ave',
    city: 'Los Angeles',
    region: 'CA',
    postalCode: '90038',
    phone: '+1-323-555-0196',
    hours: [
      { day: 'Mon-Sat', open: '10:00', close: '20:00' },
      { day: 'Sun',     open: '11:00', close: '19:00' },
    ],
    geo: { latitude: 34.0830, longitude: -118.3441 },
    mapUrl: 'https://maps.google.com/?q=LA+Mattress+La+Brea',
  },
  {
    handle: 'mattress-store-studio-city',
    name: 'LA Mattress — Studio City',
    area: 'Studio City',
    street: '12136 Ventura Blvd',
    city: 'Studio City',
    region: 'CA',
    postalCode: '91604',
    phone: '+1-818-555-0173',
    hours: [
      { day: 'Mon-Sat', open: '10:00', close: '20:00' },
      { day: 'Sun',     open: '11:00', close: '19:00' },
    ],
    geo: { latitude: 34.1426, longitude: -118.4014 },
    mapUrl: 'https://maps.google.com/?q=LA+Mattress+Studio+City',
  },
  {
    handle: 'mattress-store-in-glendale',
    name: 'LA Mattress — Glendale',
    area: 'Glendale',
    street: '344 N Brand Blvd',
    city: 'Glendale',
    region: 'CA',
    postalCode: '91203',
    phone: '+1-818-555-0211',
    hours: [
      { day: 'Mon-Sat', open: '10:00', close: '20:00' },
      { day: 'Sun',     open: '11:00', close: '19:00' },
    ],
    geo: { latitude: 34.1502, longitude: -118.2551 },
    mapUrl: 'https://maps.google.com/?q=LA+Mattress+Glendale',
  },
];

export function findShowroom(handle: string): Showroom | undefined {
  return SHOWROOMS.find((s) => s.handle === handle);
}
