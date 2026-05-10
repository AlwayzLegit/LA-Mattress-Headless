'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';
import { SITE_PHONE_DISPLAY } from '@/lib/site-config';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // global-error catches root-layout errors too — these are the
    // most-critical errors to capture (the full layout chrome failed
    // to render). Sentry.init no-ops without DSN so safe in any env.
    Sentry.captureException(error);
    if (process.env.NODE_ENV !== 'production') console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          padding: '64px 24px',
          fontFamily:
            'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
          color: '#0F172A',
          background: '#FAFAF7',
          minHeight: '100vh',
        }}
      >
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          <p style={{ fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#64748B' }}>
            Something went wrong
          </p>
          <h1 style={{ fontSize: 32, lineHeight: 1.2, margin: '12px 0 16px', color: '#1B2C5E' }}>
            The site couldn&rsquo;t load.
          </h1>
          <p style={{ fontSize: 16, lineHeight: 1.55, color: '#475569', marginBottom: 24 }}>
            This is unusual. Please refresh in a moment, or reach us by phone at {SITE_PHONE_DISPLAY}.
          </p>
          {error.digest ? (
            <p style={{ fontSize: 12, color: '#94A3B8', marginBottom: 24 }}>
              Reference: {error.digest}
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => reset()}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '10px 20px',
              border: 0,
              borderRadius: 999,
              background: '#1428A0',
              color: '#fff',
              fontSize: 14,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
