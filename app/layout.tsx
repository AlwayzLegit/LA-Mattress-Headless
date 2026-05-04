import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import './globals.css';
import { TopBar } from './_components/topbar';
import { Nav } from './_components/nav';
import { Footer } from './_components/footer';
import { CartProvider } from './_components/cart-context';
import { CartDrawer } from './_components/cart-drawer';
import { readCart } from './_actions/cart';
import { ORGANIZATION_LD, LOCAL_BUSINESS_LD, WEBSITE_LD } from '@/lib/structured-data';

export const metadata: Metadata = {
  metadataBase: new URL('https://mattressstoreslosangeles.com'),
  title: {
    default: 'LA Mattress — Sleep, engineered in Los Angeles.',
    template: '%s · LA Mattress',
  },
  description:
    'Family-owned LA mattress store with 5 showrooms across Los Angeles. Tempur-Pedic, Stearns & Foster, Helix, Diamond and more — same-day white glove delivery, 120-night comfort exchange, 0% APR financing.',
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
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: '#1B2C5E',
  width: 'device-width',
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const initialCart = await readCart();
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="preconnect" href="https://cdn.shopify.com" crossOrigin="" />
        <link rel="dns-prefetch" href="https://cdn.shopify.com" />
      </head>
      <body>
        <CartProvider initialCart={initialCart}>
          <TopBar />
          <Nav />
          {children}
          <Footer />
          <CartDrawer />
        </CartProvider>
        <Script id="ld-organization" type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(ORGANIZATION_LD) }} />
        <Script id="ld-localbusiness" type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(LOCAL_BUSINESS_LD) }} />
        <Script id="ld-website" type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(WEBSITE_LD) }} />
      </body>
    </html>
  );
}
