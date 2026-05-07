import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { TopBar } from './_components/topbar';

const geistSans = Geist({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-geist-sans',
  weight: ['300', '400', '500', '600', '700', '800', '900'],
  preload: true,
});

const geistMono = Geist_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-geist-mono',
  weight: ['400', '500'],
  preload: false,
});
import { Nav } from './_components/nav';
import { TrustStrip } from './_components/trust-strip';
import { Footer } from './_components/footer';
import { CartProvider } from './_components/cart-context';
import { CartDrawer } from './_components/cart-drawer';
import { CompareTray } from './_components/compare';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { ORGANIZATION_LD, WEBSITE_LD } from '@/lib/structured-data';

export const metadata: Metadata = {
  metadataBase: new URL('https://mattressstoreslosangeles.com'),
  title: {
    default: 'LA Mattress — Sleep, engineered in Los Angeles.',
    template: '%s · LA Mattress',
  },
  description:
    'Family-owned LA mattress store with 5 showrooms. Tempur-Pedic, Stearns & Foster, Helix, Diamond — white glove delivery & 0% APR financing.',
  applicationName: 'LA Mattress Store',
  authors: [{ name: 'LA Mattress Store' }],
  category: 'shopping',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://mattressstoreslosangeles.com/',
    siteName: 'LA Mattress Store',
    title: 'LA Mattress — Sleep, engineered in Los Angeles.',
    description:
      'Five LA showrooms. Premium mattress brands, same-day delivery, 0% APR financing. Family-owned since 2012.',
  },
  twitter: { card: 'summary_large_image', title: 'LA Mattress', description: 'Family-owned mattress store with 5 showrooms across Los Angeles.' },
  // No `robots:` declaration here — search engines index by default. An
  // explicit `{ index:true, follow:true }` was leaking through to 404
  // responses as a second `<meta name="robots" content="index, follow">`
  // alongside Next.js's automatic `noindex` injection.
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
        <link rel="preconnect" href="https://images.unsplash.com" crossOrigin="" />
      </head>
      <body>
        <a href="#main-content" className="skip-link">Skip to main content</a>
        <CartProvider>
          <TopBar />
          <Nav />
          <TrustStrip />
          <div id="main-content">{children}</div>
          <Footer />
          <CartDrawer />
          <CompareTray />
        </CartProvider>
        <Analytics />
        <SpeedInsights />
        <script id="ld-organization" type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(ORGANIZATION_LD) }} />
        <script id="ld-website" type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(WEBSITE_LD) }} />
      </body>
    </html>
  );
}
