// Sentry client-side init. Moved from sentry.client.config.ts in Phase 185
// to follow the @sentry/nextjs guidance (and the Turbopack requirement —
// sentry.client.config.ts will stop being picked up under Turbopack).
//
// The server / edge configs stay at sentry.server.config.ts and
// sentry.edge.config.ts, loaded via the existing register() hook in
// instrumentation.ts. Only the client config needed to relocate.

import * as Sentry from '@sentry/nextjs';

const DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

// No-op when DSN isn't set so dev/staging without a Sentry project just
// runs without telemetry. Set NEXT_PUBLIC_SENTRY_DSN in Vercel env vars
// (all 3 environments) to turn it on.
//
// Phase 166: Replay integration intentionally NOT included. Adds ~50KB
// to every page's First Load JS. Error capture via Sentry.captureException
// (in error.tsx + global-error.tsx) gives us the stack traces and
// breadcrumbs we need for triage; replay sessions are nice-to-have but
// not worth the bundle cost on a perf-sensitive commerce site.
if (DSN) {
  Sentry.init({
    dsn: DSN,
    tracesSampleRate: 0.1,
    debug: false,

    // Drop noise events Sentry surfaces from sources we don't control:
    // browser extensions, in-app webviews (Google Search App, FB
    // in-app browser), 3rd-party scripts injected by ad/translation
    // tools, and the classic anonymous "Script error" pattern.
    // Documented patterns: https://docs.sentry.io/platforms/javascript/configuration/filtering/
    ignoreErrors: [
      // Generic "Script error." emitted when a 3rd-party JS file
      // throws without proper CORS headers — no useful detail.
      'Script error.',
      'ResizeObserver loop limit exceeded',
      'ResizeObserver loop completed with undelivered notifications',
      // Browser extension noise (clipboard, autofill, translation).
      "Can't find variable: ZiteReader",
      'jigsaw is not defined',
      'ComboSearch is not defined',
      'http://loading.retry.widdit.com/',
      'atomicFindClose',
      // FB in-app browser (m.facebook.com webview) crashes
      'fb_xd_fragment',
      // Network errors (transient, not our code)
      'NetworkError when attempting to fetch resource',
      'Failed to fetch',
      'Load failed',
      // chrome.runtime.* errors fire from Chrome extensions injecting
      // into the page; we never call those APIs.
      'Invalid call to runtime.sendMessage',
      // Chunk-load errors from a stale CDN cache during deploys — the
      // page recovers on next navigation. Already noisy in Next.js
      // App Router and not actionable per-event.
      'ChunkLoadError',
      // React 19 streaming-render edge cases on interrupted page loads
      // (user navigates away mid-hydration). Surfaces as null parent /
      // removeChild against an unmounted node. We can't fix what's in
      // node_modules/next; filter the noise.
      "Cannot read properties of null (reading 'removeChild')",
      "null is not an object (evaluating 'b.parentNode')",
    ],

    // Drop URL-based noise from known sources of injection.
    denyUrls: [
      // Chrome / Firefox / Safari extensions
      /extensions\//i,
      /^chrome:\/\//i,
      /^chrome-extension:\/\//i,
      /^moz-extension:\/\//i,
      /^safari-extension:\/\//i,
      /^safari-web-extension:\/\//i,
      // Browser-injected (Google Translate, Microsoft Translator)
      /translate\.googleusercontent\.com/i,
      /translate\.google/i,
    ],

    // Final-defense filter: drop events whose entire stack lives in an
    // anonymous (no-frame) inline script or an extension URL. These are
    // virtually always noise.
    beforeSend(event, hint) {
      // Defense-in-depth PII scrub (audit secpriv-10): nothing should put
      // an email/phone into an event today, but adjacent code paths
      // (newsletter, CCPA, checkout handoff) handle both — redact from
      // free-text surfaces so a future breadcrumb/message can't leak.
      const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.]+/g;
      const PHONE_RE = /\+?1?[\s.-]?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g;
      const scrub = (v: string) => v.replace(EMAIL_RE, '[email]').replace(PHONE_RE, '[phone]');
      if (typeof event.message === 'string') event.message = scrub(event.message);
      if (event.request?.url) event.request.url = scrub(event.request.url);
      for (const crumb of event.breadcrumbs ?? []) {
        if (typeof crumb.message === 'string') crumb.message = scrub(crumb.message);
      }

      const frames = event.exception?.values?.[0]?.stacktrace?.frames ?? [];
      // No frames at all = synthetic "Script error." (handled above) or
      // an extension throw with stack stripped.
      if (frames.length === 0) {
        // Keep it if we have a real message that mentions our code
        // domain — otherwise drop.
        const msg = String(hint?.originalException ?? event.message ?? '');
        if (!msg.includes('mattressstoreslosangeles')) return null;
      }
      // If every frame is from anonymous inline (no filename) OR an
      // extension URL, it's not in our code — drop it.
      const ourFrames = frames.filter((f) => {
        const fn = f.filename ?? '';
        if (!fn) return false;
        if (/^chrome-extension:|^moz-extension:|^safari-(web-)?extension:/i.test(fn)) return false;
        return true;
      });
      if (frames.length > 0 && ourFrames.length === 0) return null;
      return event;
    },
  });
}

// Phase 187: required by @sentry/nextjs's client SDK for App Router
// navigation instrumentation. Without this export the build emits an
// ACTION REQUIRED notice ("To instrument navigations, the Sentry SDK
// requires you to export an `onRouterTransitionStart` hook from your
// `instrumentation-client.(js|ts)` file"). The hook is a no-op when
// Sentry isn't initialized (DSN unset) — the SDK guards internally —
// so it's safe to export unconditionally.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
