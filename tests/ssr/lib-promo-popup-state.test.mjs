/**
 * Unit tests for lib/promo-popup-state.ts — the cookie+localStorage
 * suppression flags behind the email-capture promo popup (Round 13).
 *
 * The module reads `window.localStorage` and `document.cookie` at call
 * time and SSR-guards on `typeof document`. Node has neither, so each
 * test installs a small in-memory browser jar and the module picks it up
 * dynamically (it holds no captured state of its own).
 */
import test from 'node:test';
import assert from 'node:assert/strict';

const { shouldSuppressPopup, markSignedUp, markDismissed } = await import(
  '../../lib/promo-popup-state.ts'
);

function installBrowser() {
  const store = new Map();
  const cookies = new Map();
  globalThis.window = {
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
    },
  };
  globalThis.document = {
    get cookie() {
      return [...cookies.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
    },
    set cookie(str) {
      const [pair] = str.split(';');
      const eq = pair.indexOf('=');
      const key = pair.slice(0, eq).trim();
      const val = pair.slice(eq + 1).trim();
      if (/max-age=0/.test(str) || val === '') cookies.delete(key);
      else cookies.set(key, val);
    },
  };
  return { store, cookies };
}

function clearBrowser() {
  delete globalThis.window;
  delete globalThis.document;
}

test('shouldSuppressPopup: false on a fresh browser', () => {
  installBrowser();
  try {
    assert.equal(shouldSuppressPopup(), false);
  } finally {
    clearBrowser();
  }
});

test('markSignedUp suppresses and writes both cookie + localStorage', () => {
  const { store, cookies } = installBrowser();
  try {
    markSignedUp();
    assert.equal(shouldSuppressPopup(), true);
    assert.equal(store.get('lam-promo-signup'), '1');
    assert.equal(cookies.get('lam_promo_signup'), '1');
  } finally {
    clearBrowser();
  }
});

test('markDismissed suppresses and writes both cookie + localStorage', () => {
  const { store, cookies } = installBrowser();
  try {
    markDismissed();
    assert.equal(shouldSuppressPopup(), true);
    assert.equal(store.get('lam-promo-dismissed'), '1');
    assert.equal(cookies.get('lam_promo_dismissed'), '1');
  } finally {
    clearBrowser();
  }
});

test('localStorage-only signal still suppresses (cookie cleared)', () => {
  const { store } = installBrowser();
  try {
    store.set('lam-promo-dismissed', '1');
    assert.equal(shouldSuppressPopup(), true);
  } finally {
    clearBrowser();
  }
});

test('cookie-only signal still suppresses (localStorage empty)', () => {
  installBrowser();
  try {
    globalThis.document.cookie = 'lam_promo_signup=1; path=/; max-age=31536000';
    assert.equal(shouldSuppressPopup(), true);
  } finally {
    clearBrowser();
  }
});

test('SSR-safe: no throw and false when document is undefined', () => {
  clearBrowser();
  assert.equal(shouldSuppressPopup(), false);
  assert.doesNotThrow(() => {
    markSignedUp();
    markDismissed();
  });
});
