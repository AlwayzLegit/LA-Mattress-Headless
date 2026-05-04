'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Icon } from './_components/icon';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') console.error(error);
  }, [error]);

  return (
    <main className="container" style={{ padding: 'var(--s-10) 0' }}>
      <div style={{ maxWidth: 640 }}>
        <div className="eyebrow">Something went wrong</div>
        <h1 className="h1" style={{ margin: 'var(--s-4) 0 var(--s-5)' }}>
          We hit a snag loading this page.
        </h1>
        <p className="muted" style={{ fontSize: 17, lineHeight: 1.55, maxWidth: '52ch', marginBottom: 'var(--s-5)' }}>
          This is usually temporary. Try again, or jump to one of our showrooms or the mattress
          collection — you can always reach us by phone at (213) 555-0142.
        </p>
        {error.digest ? (
          <p className="muted" style={{ fontSize: 12, marginBottom: 'var(--s-5)' }}>
            Reference: <span className="tnum">{error.digest}</span>
          </p>
        ) : null}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--s-3)' }}>
          <button type="button" className="btn btn-primary" onClick={() => reset()}>
            Try again <Icon name="arrow-right" size={14} />
          </button>
          <Link href="/" className="btn btn-ghost">Home</Link>
          <Link href="/collections/mattresses" className="btn btn-ghost">Shop mattresses</Link>
        </div>
      </div>
    </main>
  );
}
