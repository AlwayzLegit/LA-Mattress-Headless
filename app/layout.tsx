import type { Metadata, Viewport } from 'next';
import './globals.css';
import { TopBar } from './_components/topbar';
import { Nav } from './_components/nav';
import { Footer } from './_components/footer';

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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <TopBar />
        <Nav />
        {children}
        <Footer />
      </body>
    </html>
  );
}
