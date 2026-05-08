'use client';

import { useState } from 'react';
import { Icon } from '@/app/_components/icon';

type RequestKind = 'opt_out_sale' | 'access' | 'delete' | 'correct';

const REQUEST_LABELS: { kind: RequestKind; label: string; description: string }[] = [
  {
    kind: 'opt_out_sale',
    label: 'Do not sell or share my personal information',
    description: 'Stop sharing my data with third parties for advertising or analytics.',
  },
  {
    kind: 'access',
    label: 'Send me a copy of my data',
    description: 'Categories of personal information we hold about you, sources, and recipients.',
  },
  {
    kind: 'delete',
    label: 'Delete my personal information',
    description: 'Subject to legal exceptions (e.g. complete order records, warranty obligations).',
  },
  {
    kind: 'correct',
    label: 'Correct inaccurate information',
    description: 'Update something we have on file that&rsquo;s wrong.',
  },
];

type State = 'idle' | 'submitting' | 'success' | 'error';

export function OptOutForm() {
  const [state, setState] = useState<State>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [requests, setRequests] = useState<RequestKind[]>(['opt_out_sale']);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg(null);
    setState('submitting');
    const fd = new FormData(e.currentTarget);
    const payload = {
      name: String(fd.get('name') ?? '').trim(),
      email: String(fd.get('email') ?? '').trim(),
      zip: String(fd.get('zip') ?? '').trim(),
      notes: String(fd.get('notes') ?? '').trim(),
      requests,
    };
    try {
      const res = await fetch('/api/ccpa-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error ?? 'submit_failed');
      setState('success');
    } catch (err) {
      setState('error');
      setErrorMsg(err instanceof Error ? err.message : 'submit_failed');
    }
  };

  if (state === 'success') {
    return (
      <div className="ccpa-success" role="status">
        <Icon name="check" size={20} />
        <h2 className="h3" style={{ margin: '8px 0' }}>Request received</h2>
        <p className="muted" style={{ fontSize: 15, lineHeight: 1.55 }}>
          Thanks. We&rsquo;ve logged your request and you&rsquo;ll hear back from us within
          10 business days to confirm receipt and verify your identity. The full request
          will be completed within 45 days, as required by California law.
        </p>
      </div>
    );
  }

  const toggleRequest = (kind: RequestKind) => {
    setRequests((prev) => (prev.includes(kind) ? prev.filter((k) => k !== kind) : [...prev, kind]));
  };

  return (
    <form className="ccpa-form" onSubmit={onSubmit} noValidate>
      <fieldset className="ccpa-fieldset">
        <legend className="ccpa-legend">What would you like us to do?</legend>
        <div className="ccpa-options">
          {REQUEST_LABELS.map(({ kind, label, description }) => {
            const active = requests.includes(kind);
            return (
              <label key={kind} className={`ccpa-option ${active ? 'is-on' : ''}`}>
                <input
                  type="checkbox"
                  checked={active}
                  onChange={() => toggleRequest(kind)}
                />
                <span className="ccpa-option-body">
                  <span className="ccpa-option-label">{label}</span>
                  <span
                    className="ccpa-option-sub muted"
                    dangerouslySetInnerHTML={{ __html: description }}
                  />
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="ccpa-row">
        <label className="ccpa-field">
          <span className="ccpa-field-label">Full name</span>
          <input name="name" type="text" required autoComplete="name" />
        </label>
        <label className="ccpa-field">
          <span className="ccpa-field-label">Email address</span>
          <input name="email" type="email" required autoComplete="email" />
        </label>
      </div>

      <label className="ccpa-field">
        <span className="ccpa-field-label">California ZIP code</span>
        <input name="zip" type="text" required inputMode="numeric" pattern="[0-9]{5}" maxLength={5} autoComplete="postal-code" />
      </label>

      <label className="ccpa-field">
        <span className="ccpa-field-label">Anything else we should know? <span className="muted">(optional)</span></span>
        <textarea name="notes" rows={3} maxLength={1000} />
      </label>

      <p className="ccpa-disclaimer muted">
        Submitting this form does not require you to create an account. We&rsquo;ll only use
        the information you provide here to verify your identity and process this request.
      </p>

      {state === 'error' ? (
        <p className="ccpa-error" role="alert">
          We couldn&rsquo;t submit your request. Try again, or email
          {' '}
          <a href="mailto:privacy@mattressstoreslosangeles.com">privacy@mattressstoreslosangeles.com</a>
          {' '}directly.{errorMsg ? ` (${errorMsg})` : ''}
        </p>
      ) : null}

      <button
        type="submit"
        className="btn btn-primary btn-lg"
        disabled={state === 'submitting' || requests.length === 0}
      >
        {state === 'submitting' ? 'Submitting…' : 'Submit request'}
      </button>
    </form>
  );
}
