'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { track } from '@/lib/analytics';

type Status = 'idle' | 'submitting' | 'success' | 'error';
type Source = 'footer' | 'popup' | 'cart' | 'unknown';

/**
 * Newsletter signup form with inline submit/success/error states.
 *
 * Falls back to a plain <form action="/api/newsletter" method="post">
 * for non-JS users — they get a JSON response on submission, which is
 * less polished but functional. JS-enabled users (the vast majority)
 * get the inline ack without losing their place on the page.
 *
 * On success, the input is unmounted and the success message takes
 * its place. Focus is moved to the success element (tabindex=-1)
 * so keyboard + SR users land on the confirmation instead of having
 * focus dropped to <body>.
 */
export function NewsletterForm({ source = 'footer' }: { source?: Source } = {}) {
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const successRef = useRef<HTMLDivElement>(null);

  // After transitioning to success, send focus to the message so the
  // SR re-announces it in addition to the live region fire — and the
  // keyboard user's focus has somewhere meaningful to land.
  useEffect(() => {
    if (status === 'success') {
      const id = requestAnimationFrame(() => successRef.current?.focus());
      return () => cancelAnimationFrame(id);
    }
  }, [status]);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get('email') ?? '').trim();
    if (!email) {
      setStatus('error');
      setError('Email is required.');
      return;
    }
    setStatus('submitting');
    setError(null);
    try {
      const res = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (res.ok && data.ok) {
        setStatus('success');
        track('newsletter_signup', { source });
      } else {
        setStatus('error');
        setError(data.error === 'invalid_email' ? 'That email looks off — try again.' : 'Something went wrong. Try again later.');
      }
    } catch {
      setStatus('error');
      setError('Network error. Try again.');
    }
  };

  if (status === 'success') {
    return (
      <div
        ref={successRef}
        className="footer-form footer-form-success"
        role="status"
        aria-live="polite"
        tabIndex={-1}
      >
        Thanks — we&rsquo;ll be in touch when the next markdown drops.
      </div>
    );
  }

  return (
    <form className="footer-form" action="/api/newsletter" method="post" onSubmit={onSubmit} noValidate>
      <input
        className="footer-input"
        type="email"
        name="email"
        placeholder="you@email.com"
        required
        autoComplete="email"
        disabled={status === 'submitting'}
        aria-label="Email address for newsletter"
        aria-invalid={status === 'error' || undefined}
        aria-describedby={error ? 'newsletter-form-error' : undefined}
      />
      <button className="btn btn-secondary" type="submit" disabled={status === 'submitting'}>
        {status === 'submitting' ? 'Subscribing…' : 'Subscribe'}
      </button>
      {error ? <div id="newsletter-form-error" className="footer-form-error" role="alert">{error}</div> : null}
    </form>
  );
}
