'use client';

import Link from 'next/link';
import { Icon } from '../icon';
import { track } from '@/lib/analytics';
import type { ChatProductCard as ChatProductCardData } from '@/lib/chat/types';

/**
 * Compact product card rendered inline inside a chat message bubble.
 *
 * Deliberately smaller than PlpCard — the chat panel is narrow on
 * mobile and we surface up to 6 cards per tool call. Trades the full
 * card's hover affordances + comparison checkbox + review badges for
 * a tighter, more-scannable horizontal layout.
 *
 * Tap-target: the entire card is the link to the PDP. The same path
 * is used by every search/get_product result so the click feels
 * predictable across cards rendered by different tool calls.
 */

const USD = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

function formatPriceRange(min: number, max: number, currency: string): string {
  // Storefront prices are always USD for us; fall back to numeric if
  // somehow a different currency comes through.
  const fmt =
    currency === 'USD'
      ? USD
      : new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency,
          maximumFractionDigits: 0,
        });
  if (min === max || max === 0) return fmt.format(min);
  return `${fmt.format(min)} – ${fmt.format(max)}`;
}

export function ChatProductCard({ card }: { card: ChatProductCardData }) {
  const priceLabel = formatPriceRange(
    card.priceRange.minPrice,
    card.priceRange.maxPrice,
    card.priceRange.currency,
  );
  const ratingLabel =
    card.rating != null && card.ratingCount != null
      ? `${card.rating.toFixed(1)} (${card.ratingCount})`
      : null;

  return (
    <Link
      href={card.url}
      className="chat-card"
      prefetch={false}
      // The chat equivalent of quiz_recommendation_clicked — the
      // assistant's recommendations had no click signal at all, so the
      // admin dashboard's chat section couldn't say whether surfaced
      // products get acted on. Person + $session_id scoped (client
      // event), so it joins with order_completed for attribution.
      onClick={() => track('chat_product_clicked', {
        product_url: card.url,
        vendor: card.vendor,
      })}
    >
      {card.imageUrl ? (
        <div className="chat-card-img">
          {/* Plain <img> intentionally — the chat panel isn't a hot
              path for the image optimizer, and next/image inside a
              fixed-width card here over-complicates the sizing. The
              Shopify CDN serves WebP by default with cache headers. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={card.imageUrl}
            alt={card.imageAlt ?? card.title}
            loading="lazy"
            decoding="async"
            width={96}
            height={96}
          />
        </div>
      ) : (
        <div className="chat-card-img chat-card-img-placeholder" aria-hidden="true">
          <Icon name="bed" size={28} />
        </div>
      )}
      <div className="chat-card-body">
        <div className="chat-card-vendor">{card.vendor}</div>
        <div className="chat-card-title">{card.title}</div>
        <div className="chat-card-meta">
          <span className="chat-card-price">{priceLabel}</span>
          {ratingLabel && card.rating != null && card.ratingCount != null ? (
            <span
              className="chat-card-rating"
              aria-label={`Rated ${card.rating.toFixed(1)} out of 5, ${card.ratingCount} ${card.ratingCount === 1 ? 'review' : 'reviews'}`}
            >
              <Icon name="star" size={11} aria-hidden="true" />{' '}
              <span aria-hidden="true">{ratingLabel}</span>
            </span>
          ) : null}
        </div>
        {card.firmness || card.material ? (
          <div className="chat-card-specs muted">
            {[card.firmness, card.material].filter(Boolean).join(' · ')}
          </div>
        ) : null}
      </div>
      <span className="chat-card-arrow" aria-hidden="true">
        <Icon name="arrow-right" size={14} />
      </span>
    </Link>
  );
}
