/**
 * utils/timeNormalizer.js
 * Normalizes flexible time input to strict "HH:mm" (24-hour) format.
 *
 * Accepts:
 *   "9:00"    "9:5"     "09:05"   — flexible HH:mm
 *   "900"     "0900"    "1800"    — no-colon compact
 *   "9:00 AM" "9:00 PM" "12:00AM" — 12-hour with AM/PM
 *   "9:00am"  "21:00"              — case-insensitive
 *
 * Always returns "HH:mm" or null if the input cannot be resolved.
 */

// utils/timeNormalizer.js

// ─── main export ──────────────────────────────────────────────────────────────

export function normalizeTime(timeInput) {
  if (!timeInput && timeInput !== 0) return null;

  const raw = String(timeInput).trim();
  if (!raw) return null;

  // ── strip AM/PM first so the rest of the logic stays clean ────────────────
  let s         = raw;
  let isPM      = false;
  let isAM      = false;
  const ampmMatch = s.match(/\s*(am|pm)$/i);

  if (ampmMatch) {
    isPM = ampmMatch[1].toLowerCase() === 'pm';
    isAM = ampmMatch[1].toLowerCase() === 'am';
    s    = s.slice(0, s.length - ampmMatch[0].length).trim();
  }

  let hours, minutes;

  // ── "HH:mm" or "H:mm" or "H:M" ───────────────────────────────────────────
  if (/^([0-1]?[0-9]|2[0-3]):[0-5]?[0-9]$/.test(s)) {
    const [h, m] = s.split(':').map(Number);
    hours   = h;
    minutes = m;

  // ── compact 3-digit: "900" → 9:00, "060" → invalid ───────────────────────
  } else if (/^\d{3}$/.test(s)) {
    hours   = parseInt(s[0],          10);
    minutes = parseInt(s.slice(1),    10);

  // ── compact 4-digit: "0900" → 09:00, "1845" → 18:45 ─────────────────────
  } else if (/^\d{4}$/.test(s)) {
    hours   = parseInt(s.slice(0, 2), 10);
    minutes = parseInt(s.slice(2),    10);

  } else {
    return null;
  }

  // ── apply AM/PM conversion ─────────────────────────────────────────────────
  if (isPM && hours !== 12) hours += 12;
  if (isAM && hours === 12) hours  = 0;   // 12:xx AM → 00:xx

  // ── final range check ─────────────────────────────────────────────────────
  if (
    isNaN(hours) || isNaN(minutes) ||
    hours   < 0  || hours   > 23  ||
    minutes < 0  || minutes > 59
  ) {
    return null;
  }

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

// ─── validation ───────────────────────────────────────────────────────────────

/**
 * Returns true only for a strict "HH:mm" 24-hour string.
 * Use this to validate already-normalised values before storing.
 */
export function isValidNormalizedTime(time) {
  if (!time) return false;
  return /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(time);
}

// ─── display ──────────────────────────────────────────────────────────────────

/** Returns the time string or "--:--" if falsy */
export function formatTimeForDisplay(time) {
  return time || '--:--';
}

// ─── batch helper ─────────────────────────────────────────────────────────────

/**
 * Normalize an array of raw time strings.
 * Filters out any values that couldn't be parsed.
 * Useful when processing all punches from a CSV group at once.
 *
 * @param {string[]} rawTimes
 * @returns {string[]} valid "HH:mm" strings only
 */
export function normalizeBatch(rawTimes) {
  if (!Array.isArray(rawTimes)) return [];
  return rawTimes
    .map(normalizeTime)
    .filter(Boolean);
}

// ─── default export ───────────────────────────────────────────────────────────
export default {
  normalizeTime,
  isValidNormalizedTime,
  formatTimeForDisplay,
  normalizeBatch
};