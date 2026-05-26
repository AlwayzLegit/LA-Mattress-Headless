import type { Metadata } from 'next';
import { Suspense } from 'react';
import { TopBar } from '../_components/topbar';
import { TrustStrip } from '../_components/trust-strip';
import { Nav } from '../_components/nav';
import { Footer } from '../_components/footer';
import { CartProvider } from '../_components/cart-context';
import { CartDrawer } from '../_components/cart-drawer';
import { CompareTray } from '../_components/compare-tray';
import { ChatWidget } from '../_components/chat/chat-widget';
import { Announcer } from '../_components/announcer';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { buildOrganizationLd, WEBSITE_LD } from '@/lib/structured-data';
import { composeBrandTitle } from '@/lib/seo';
import { getShopBrand, getActiveAnnouncement, getBrands } from '@/lib/shopify';
import { getShopAggregate } from '@/lib/judgeme';
import { AnnouncementBar } from '../_components/announcement-bar';
import { AnalyticsGa4 } from '../_components/analytics-ga4';
import { AnalyticsPostHog } from '../_components/analytics-posthog';

/**
 * Storefront layout — wraps everything customer-facing.
 *
 * Holds the bits the admin section doesn't want: the announcement bar /
 * TopBar, sitewide Nav with brand links, TrustStrip, Footer, cart UI
 * (CartProvider + CartDrawer), compare tray, screen-reader announcer,
 * the four analytics integrations (Vercel Analytics, Vercel Speed
 * Insights, GA4, PostHog), and the Organization + WEBSITE JSON-LD.
 *
 * Routing: this layout sits under the `(storefront)` route group, so
 * everything in app/(storefront)/* inherits it. The /admin/* tree is
 * outside the group and inherits only the bare root layout — that's
 * how we keep storefront chrome off the dashboard.
 *
 * generateMetadata lives here (not in the root layout) so admin pages
 * don't inherit the customer-facing brand-title template "%s · LA
 * Mattress Store". Each detail route (products, collections, etc.) can
 * still override title/description; this is the fallback.
 */

// Phase 268: homepage / site-wide title + description + OG default
// image now read from Shopify's built-in Brand assets (Settings →
// Store details → Brand) when the merchant has filled them in.
// Hardcoded fallbacks fire when Shopify isn't configured or Brand
// fields are blank, so unconfigured stores still render correctly.
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

export default async function StorefrontLayout({ children }: { children: React.ReactNode }) {
  // Phase 268: Organization JSON-LD logo + name now come from Shopify
  // Brand assets when available. buildOrganizationLd() handles the
  // fallback chain internally so this call is safe even when Shopify
  // is unconfigured.
  //
  // Phase 266: announcement bar fetched from a Shopify metaobject. When
  // active (enabled + in date window), it replaces the regular TopBar
  // sitewide. Three fetches run in parallel — all are fast Storefront
  // queries with 5min–1hr ISR caches.
  // SEO 20260521 batch 5: pull the sitewide Judge.me aggregate
  // (rating + count) here so the Organization JSON-LD emitted on EVERY
  // storefront page carries an aggregateRating. Single light fetch
  // (`/widgets/index_information`) with 1-hour ISR caching — same data
  // the homepage was previously fetching for its LocalBusiness card.
  // Surfacing it sitewide makes the brand-level review snippet eligible
  // on every URL (PLPs, PDPs, blogs, pages), not just homepage.
  const [shop, announcement, brands, shopAggregate] = await Promise.all([
    getShopBrand(),
    getActiveAnnouncement(),
    getBrands(),
    getShopAggregate(),
  ]);
  const organizationLd = buildOrganizationLd(shop, shopAggregate);

  return (
    <>
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <CartProvider>
        {announcement ? <AnnouncementBar data={announcement} /> : <TopBar />}
        <Nav brands={brands} />
        {/* Slim sitewide trust bar with interlinks, directly under
            the header (static — scrolls away). De-duped from TopBar. */}
        <TrustStrip />
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
        <ChatWidget />
        <Announcer />
      </CartProvider>
      <Analytics />
      <SpeedInsights />
      <AnalyticsGa4 />
      {/* AnalyticsPostHog reads useSearchParams() to fire $pageview
          on every route change. Next.js 15 requires that hook to live
          inside a <Suspense> boundary so static-generated pages
          (404, /_not-found, etc.) can prerender without bailing to
          client-side rendering. */}
      <Suspense fallback={null}>
        <AnalyticsPostHog />
      </Suspense>
      <script id="ld-organization" type="application/ld+json"
              dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationLd) }} />
      <script id="ld-website" type="application/ld+json"
              dangerouslySetInnerHTML={{ __html: JSON.stringify(WEBSITE_LD) }} />
    </>
  );
}
