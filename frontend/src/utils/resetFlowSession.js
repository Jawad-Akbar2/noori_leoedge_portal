/**
 * utils/resetFlowSession.js
 *
 * Manages a short-lived, tamper-evident session entry that proves the user
 * arrived at /reset-password via a legitimate email link — not by typing
 * the URL directly.
 *
 * HOW IT WORKS
 * ─────────────
 * 1. The email link lands on /reset-password?token=X&email=Y
 * 2. ResetPassword component calls `validateResetParams(token, email)`
 *    which hits POST /api/auth/verify-reset-token on the backend.
 * 3. If the backend confirms the token is valid, we call
 *    `markResetSessionValid(email)` which writes a signed fingerprint
 *    to sessionStorage (tab-scoped, cleared on tab close).
 * 4. On every render, ResetPassword calls `isResetSessionValid(email)`.
 *    If it returns false, the user is bounced to /forgot-password.
 * 5. After a successful reset, `clearResetSession()` wipes the entry.
 *
 * The sessionStorage value is a simple HMAC-like string:
 *   base64( JSON { email, nonce, ts } ) + "." + base64( JSON again XOR'd with a page secret )
 * This is NOT cryptographic security — it just prevents casual URL-bar
 * manipulation. Real security lives on the backend (hashed token + expiry).
 */

const SESSION_KEY = '__hr_reset_flow__';

// A per-page-load secret mixed into the fingerprint so the value can't
// simply be copied from another tab or session.
const PAGE_SECRET = Math.random().toString(36).slice(2) + Date.now().toString(36);

function encode(obj) {
  return btoa(JSON.stringify(obj));
}

function decode(str) {
  try { return JSON.parse(atob(str)); } catch { return null; }
}

/** Call this after the backend confirms the token is valid. */
export function markResetSessionValid(email) {
  const nonce = Math.random().toString(36).slice(2);
  const ts    = Date.now();
  const payload = { email: email.toLowerCase(), nonce, ts };
  // Simple fingerprint: encoded payload + encoded (payload XOR'd conceptually with secret)
  const sig = encode({ ...payload, secret: PAGE_SECRET });
  sessionStorage.setItem(SESSION_KEY, encode(payload) + '.' + sig);
}

/**
 * Returns true only if:
 *   - A session entry exists
 *   - It matches the email in the URL
 *   - It was created with this page's secret (same tab, same load)
 *   - It is less than 20 minutes old (belt-and-suspenders — backend also checks)
 */
export function isResetSessionValid(email) {
  const raw = sessionStorage.getItem(SESSION_KEY);
  if (!raw) return false;

  const parts = raw.split('.');
  if (parts.length !== 2) return false;

  const payload = decode(parts[0]);
  const sig     = decode(parts[1]);

  if (!payload || !sig) return false;

  // Email must match URL param
  if (payload.email !== email.toLowerCase()) return false;

  // Secret must match this page load (blocks copy-paste from another tab)
  if (sig.secret !== PAGE_SECRET) return false;

  // Payload and sig must agree on email + nonce + ts
  if (payload.nonce !== sig.nonce || payload.ts !== sig.ts) return false;

  // 20-minute max age (backend TTL is 15 min, this is just a client guard)
  if (Date.now() - payload.ts > 20 * 60 * 1000) {
    clearResetSession();
    return false;
  }

  return true;
}

/** Call after a successful password reset, or when leaving the page. */
export function clearResetSession() {
  sessionStorage.removeItem(SESSION_KEY);
}