import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

/**
 * Root layout — bare shell that wraps every page in the app.
 *
 * Intentionally minimal: just html/body, fonts, global CSS, generic
 * metadata, and the sitewide preconnects. Storefront chrome (Nav,
 * TopBar, Footer, CartProvider, Analytics, structured data) lives in
 * app/(storefront)/layout.tsx so it only renders on customer-facing
 * pages. Admin pages (/admin/*) inherit just this bare shell — no
 * navigation, no cart UI, no PostHog / GA4 tracking polluting the
 * very dashboard data /admin reports on.
 *
 * Per-page metadata (titles, OG images) still inherits from the
 * storefront layout's generateMetadata for storefront pages; admin
 * pages declare their own and bypass the brand title template.
 *
 * Note: this layout is a pure RSC with no async work, so the storefront
 * routes that were SSG/ISR stay statically generated. Putting Shopify
 * fetches or headers() here would force the whole app dynamic.
 */

const geistSans = Geist({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-geist-sans',
  // Globals.css only references font-weight 500 / 600 / 700. The other
  // weights Next/Font would request (300, 400, 800, 900) were unused
  // ballast — dropping them trims the preloaded font subset.
  weight: ['500', '600', '700'],
  preload: true,
});

const geistMono = Geist_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-geist-mono',
  weight: ['400', '500'],
  preload: false,
});

export const metadata: Metadata = {
  metadataBase: new URL('https://www.mattressstoreslosangeles.com'),
};

export const viewport: Viewport = {
  themeColor: '#1B2C5E',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <head>
        <link rel="preconnect" href="https://cdn.shopify.com" crossOrigin="" />
        <link rel="dns-prefetch" href="https://cdn.shopify.com" />
      </head>
      <body>{children}</body>
    </html>
  );
}
