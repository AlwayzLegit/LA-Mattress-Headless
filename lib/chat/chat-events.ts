/**
 * Cross-component event channel for opening the chat widget from
 * anywhere on the storefront. Used by the homepage "Three ways to
 * find your match" tri-card (its Chat card dispatches the event) and
 * could be reused by future surfaces (cart empty state, exit-intent
 * popup, etc.) without prop-drilling.
 *
 * Event detail can carry an optional `prompt` — when set, the chat
 * panel opens with that text pre-filled into the input so the
 * shopper just has to tap Send. Used by entry points that already
 * know what the shopper wants to ask.
 */

export const CHAT_OPEN_EVENT = 'la-mattress-chat:open';

export type ChatOpenDetail = { prompt?: string };

/**
 * Dispatch the open-chat event. No-op on the server.
 */
export function openChat(detail: ChatOpenDetail = {}) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<ChatOpenDetail>(CHAT_OPEN_EVENT, { detail }));
}
