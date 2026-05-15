import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { TopBar } from './_components/topbar';

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
import { Nav } from './_components/nav';
import { Footer } from './_components/footer';
import { CartProvider } from './_components/cart-context';
import { CartDrawer } from './_components/cart-drawer';
import { CompareTray } from './_components/compare-tray';
import { Announcer } from './_components/announcer';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { buildOrganizationLd, WEBSITE_LD } from '@/lib/structured-data';
import { composeBrandTitle } from '@/lib/seo';
import { getShopBrand, getActiveAnnouncement, getBrands } from '@/lib/shopify';
import { AnnouncementBar } from './_components/announcement-bar';
import { AnalyticsGa4 } from './_components/analytics-ga4';

// Phase 268: homepage / site-wide title + description + OG default
// image now read from Shopify's built-in Brand assets (Settings →
// Store details → Brand) when the merchant has filled them in. Hardcoded
// fallbacks fire when Shopify isn't configured or Brand fields are
// blank, so unconfigured stores still render correctly.
//
// `generateMetadata` is used instead of static `metadata` so the
// Shopify fetch can be awaited. Each detail route (products, collections,
// pages, blog, articles) overrides title + description from its own
// metadata, so this layout-level value only applies to routes that don't
// declare their own.
const FALLBACK_TITLE = 'LA Mattress — Sleep, engineered in Los Angeles.';
const FALLBACK_DESCRIPTION =
  'Family-owned LA mattress store with 5 showrooms. Tempur-Pedic, Stearns & Foster, Helix, Diamond — white-glove delivery & 0% APR financing.';
const FALLBACK_OG_DESCRIPTION =
  'Five LA showrooms. Premium mattress brands, same-day delivery, 0% APR financing. Family-owned since 2012.';

export async function generateMetadata(): Promise<Metadata> {
  const shop = await getShopBrand();
  const siteName = shop?.name ?? 'LA Mattress Store';
  // cowork LOW#12: don't double the brand when the merchant's Brand
  // slogan already leads with "LA Mattress …".
  const defaultTitle = composeBrandTitle(siteName, shop?.brand?.slogan, FALLBACK_TITLE);
  const description = shop?.brand?.shortDescription ?? shop?.description ?? FALLBACK_DESCRIPTION;
  const ogImage = shop?.brand?.coverImage?.url;
  // Phase 277: Search Console + Bing Webmaster verification meta tags.
  // Gated on env vars so unconfigured deploys don't emit empty
  // <meta name="google-site-verification" content="">, which would
  // silently mark the site as un-verifiable.
  const googleVerification = process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION;
  const bingVerification = process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION;
  const verification =
    googleVerification || bingVerification
      ? {
          ...(googleVerification ? { google: googleVerification } : {}),
          ...(bingVerification ? { other: { 'msvalidate.01': bingVerification } } : {}),
        }
      : undefined;
  return {
    metadataBase: new URL('https://www.mattressstoreslosangeles.com'),
    title: {
      default: defaultTitle,
      template: `%s · ${siteName}`,
    },
    description,
    applicationName: siteName,
    authors: [{ name: siteName }],
    category: 'shopping',
    openGraph: {
      type: 'website',
      locale: 'en_US',
      url: 'https://www.mattressstoreslosangeles.com/',
      siteName,
      title: defaultTitle,
      description: shop?.brand?.shortDescription ?? FALLBACK_OG_DESCRIPTION,
      ...(ogImage ? { images: [{ url: ogImage }] } : {}),
    },
    twitter: { card: 'summary_large_image' },
    ...(verification ? { verification } : {}),
  };
}

export const viewport: Viewport = {
  themeColor: '#1B2C5E',
  width: 'device-width',
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Phase 268: Organization JSON-LD logo + name now come from Shopify
  // Brand assets when available. buildOrganizationLd() handles the
  // fallback chain internally so this call is safe even when Shopify
  // is unconfigured.
  //
  // Phase 266: announcement bar fetched from a Shopify metaobject. When
  // active (enabled + in date window), it replaces the regular TopBar
  // sitewide. Two fetches run in parallel — both are fast Storefront
  // queries with 5min–1hr ISR caches.
  const [shop, announcement, brands] = await Promise.all([
    getShopBrand(),
    getActiveAnnouncement(),
    getBrands(),
  ]);
  const organizationLd = buildOrganizationLd(shop);

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
          {announcement ? <AnnouncementBar data={announcement} /> : <TopBar />}
          <Nav brands={brands} />
          {/*
            Skip-link target. tabIndex={-1} is required: without it, the
            browser scrolls to #main-content on activation but keyboard
            focus stays on the skip link itself, so the next Tab starts
            from the link/body rather than from inside the content. With
            tabindex set, .focus() (browser-native on hash nav) actually
            lands focus here. Pages then provide their own <main>.
          */}
          <div id="main-content" tabIndex={-1}>{children}</div>
          <Footer />
          <CartDrawer />
          <CompareTray />
          <Announcer />
        </CartProvider>
        <Analytics />
        <SpeedInsights />
        <AnalyticsGa4 />
        <script id="ld-organization" type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationLd) }} />
        <script id="ld-website" type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(WEBSITE_LD) }} />
      </body>
    </html>
  );
}
