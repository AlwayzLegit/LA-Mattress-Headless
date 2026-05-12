'use client';

import { useState, useId, useRef } from 'react';
import { Icon } from './icon';
import { announce } from './announcer';

/**
 * Inline "Write a review" form on PDPs. Submits to /api/reviews which
 * proxies to Judge.me's public reviews API. Reviews land in Judge.me's
 * moderation queue — they don't appear instantly on the storefront. The
 * success message reflects this so users know to wait for approval.
 * Phase 238.
 */
type Props = {
  productId: string;
  productTitle: string;
};

const ERROR_LABELS: Record<string, string> = {
  invalid_rating: 'Please pick a star rating.',
  invalid_body: 'Your review needs to be at least 10 characters.',
  invalid_title: 'Title is too long (max 120 characters).',
  invalid_name: 'Please enter your name.',
  invalid_email: 'Please enter a valid email address.',
  missing_product: 'We couldn’t link this review to the product. Refresh and try again.',
  submit_failed: 'Something went wrong on our side. Try again in a moment.',
  judgeme_not_configured: 'Reviews are temporarily disabled. Try again later.',
};

export function PdpWriteReview({ productId, productTitle }: Props) {
  const formId = useId();
  const formRef = useRef<HTMLFormElement | null>(null);
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    const form = new FormData(e.currentTarget);
    const payload = {
      productId,
      rating,
      title: String(form.get('title') ?? ''),
      body: String(form.get('body') ?? ''),
      name: String(form.get('name') ?? ''),
      email: String(form.get('email') ?? ''),
      hp: String(form.get('hp') ?? ''),
    };
    setSubmitting(true);
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (data.ok) {
        setSuccess(true);
        announce('Your review was submitted. It will appear after our team approves it.');
        formRef.current?.reset();
        setRating(0);
      } else {
        const msg = data.error && ERROR_LABELS[data.error] ? ERROR_LABELS[data.error] : ERROR_LABELS.submit_failed;
        setError(msg);
        announce(`Review submission error: ${msg}`);
      }
    } catch {
      setError(ERROR_LABELS.submit_failed);
      announce(`Review submission error: ${ERROR_LABELS.submit_failed}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="pdp-review-form-success" role="status">
        <Icon name="check" size={18} />
        <div>
          <div className="pdp-review-form-success-title">Thanks for your review.</div>
          <p className="muted pdp-review-form-success-body">
            We’ll publish it as soon as our team approves it — usually within a day or two.
          </p>
        </div>
      </div>
    );
  }

  if (!open) {
    return (
      <div className="pdp-review-cta-row">
        <button
          type="button"
          className="btn btn-secondary pdp-review-cta-btn"
          onClick={() => setOpen(true)}
          aria-expanded="false"
          aria-controls={`${formId}-form`}
        >
          Write a review
        </button>
      </div>
    );
  }

  return (
    <form
      id={`${formId}-form`}
      ref={formRef}
      className="pdp-review-form"
      onSubmit={handleSubmit}
      aria-label={`Write a review for ${productTitle}`}
    >
      <div className="pdp-review-form-head">
        <h3 className="h3 pdp-review-form-title">Write your review</h3>
        <button
          type="button"
          className="pdp-review-form-cancel link-ghost"
          onClick={() => setOpen(false)}
          aria-label="Cancel review"
        >
          Cancel
        </button>
      </div>

      <fieldset className="pdp-review-form-stars">
        <legend className="pdp-review-form-label">Your rating</legend>
        <div
          className="pdp-review-form-stars-row"
          onMouseLeave={() => setHover(0)}
          role="radiogroup"
          aria-label="Your rating"
        >
          {[1, 2, 3, 4, 5].map((n) => {
            const filled = (hover || rating) >= n;
            return (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={rating === n}
                aria-label={`${n} star${n === 1 ? '' : 's'}`}
                className={`pdp-review-form-star ${filled ? 'is-on' : ''}`}
                onMouseEnter={() => setHover(n)}
                onFocus={() => setHover(n)}
                onClick={() => setRating(n)}
              >
                <Icon name="star" size={26} />
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="pdp-review-form-field">
        <label className="pdp-review-form-label" htmlFor={`${formId}-title`}>
          Title <span className="muted">(optional)</span>
        </label>
        <input
          id={`${formId}-title`}
          name="title"
          type="text"
          maxLength={120}
          autoComplete="off"
          placeholder="e.g. Great mattress, way cooler than my last one"
        />
      </div>

      <div className="pdp-review-form-field">
        <label className="pdp-review-form-label" htmlFor={`${formId}-body`}>
          Your review
        </label>
        <textarea
          id={`${formId}-body`}
          name="body"
          required
          minLength={10}
          maxLength={2000}
          rows={5}
          placeholder="What did you like? Did anything surprise you? How was the delivery experience?"
        />
      </div>

      <div className="pdp-review-form-row">
        <div className="pdp-review-form-field">
          <label className="pdp-review-form-label" htmlFor={`${formId}-name`}>
            Your name
          </label>
          <input
            id={`${formId}-name`}
            name="name"
            type="text"
            required
            maxLength={80}
            autoComplete="name"
          />
        </div>
        <div className="pdp-review-form-field">
          <label className="pdp-review-form-label" htmlFor={`${formId}-email`}>
            Email <span className="muted">(not published)</span>
          </label>
          <input
            id={`${formId}-email`}
            name="email"
            type="email"
            required
            autoComplete="email"
          />
        </div>
      </div>

      {/* Honeypot — hidden from real users via inline style + autocomplete=off. */}
      <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px' }}>
        <label htmlFor={`${formId}-hp`}>Leave this field empty</label>
        <input id={`${formId}-hp`} name="hp" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      {error ? (
        <div className="pdp-review-form-error" role="alert">
          <Icon name="alert" size={14} /> {error}
        </div>
      ) : null}

      <div className="pdp-review-form-foot">
        <p className="muted pdp-review-form-fine">
          We moderate reviews — yours will appear once approved.
        </p>
        <button
          type="submit"
          className="btn btn-primary"
          disabled={submitting || rating === 0}
        >
          {submitting ? 'Submitting…' : 'Submit review'}
        </button>
      </div>
    </form>
  );
}
