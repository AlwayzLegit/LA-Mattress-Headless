import type { MetadataRoute } from 'next';

/**
 * PWA manifest. Lets visitors "Add to Home Screen" / install on mobile,
 * gives a Lighthouse PWA score boost, and ensures consistent theme
 * colors on the iOS / Android / Edge address bars.
 *
 * No service worker yet — that's a heavier lift and the app already has
 * good caching via Vercel + ISR. The bare manifest still earns the
 * install prompt on supported browsers.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'LA Mattress Store',
    short_name: 'LA Mattress',
    description:
      'Family-owned LA mattress store with 5 showrooms. Tempur-Pedic, Stearns & Foster, Helix, Diamond — white glove delivery & 0% APR financing.',
    start_url: '/',
    display: 'standalone',
    theme_color: '#1B2C5E',
    background_color: '#FFFFFF',
    icons: [
      {
        src: '/assets/la-mattress-logo.png',
        sizes: '400x224',
        type: 'image/png',
        purpose: 'any',
      },
    ],
    categories: ['shopping', 'home', 'lifestyle'],
  };
}
