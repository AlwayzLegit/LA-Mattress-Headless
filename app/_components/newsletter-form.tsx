'use client';

import { useState, type FormEvent } from 'react';

type Status = 'idle' | 'submitting' | 'success' | 'error';

/**
 * Newsletter signup form with inline submit/success/error states.
 *
 * Falls back to a plain <form action="/api/newsletter" method="post">
 * for non-JS users — they get a JSON response on submission, which is
 * less polished but functional. JS-enabled users (the vast majority)
 * get the inline ack without losing their place on the page.
 */
export function NewsletterForm() {
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get('email') ?? '').trim();
    if (!email) return;
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
      <div className="footer-form footer-form-success" role="status" aria-live="polite">
        Thanks — we&rsquo;ll be in touch when the next markdown drops.
      </div>
    );
  }

  return (
    <form className="footer-form" action="/api/newsletter" method="post" onSubmit={onSubmit}>
      <input
        className="footer-input"
        type="email"
        name="email"
        placeholder="you@email.com"
        required
        autoComplete="email"
        disabled={status === 'submitting'}
      />
      <button className="btn btn-secondary" type="submit" disabled={status === 'submitting'}>
        {status === 'submitting' ? 'Subscribing…' : 'Subscribe'}
      </button>
      {error ? <div className="footer-form-error" role="alert">{error}</div> : null}
    </form>
  );
}
