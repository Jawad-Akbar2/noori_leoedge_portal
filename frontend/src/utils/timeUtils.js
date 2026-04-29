/**
 * utils/timeUtils.js
 *
 * Single source of truth for all frontend time helpers.
 * Consolidates timeNormalizer.js + timeValidator.js — do NOT duplicate logic
 * in those files; they re-export from here for backward compatibility.
 */

// ─── validation ───────────────────────────────────────────────────────────────

/** True for any strict "HH:mm" 24-hour string */
export function isValidTime(time) {
  if (!time) return false;
  return /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(String(time).trim());
}

/**
 * Validate a time range.
 * Both times must be valid HH:mm — same-day AND overnight shifts are allowed.
 */
export function isValidTimeRange(startTime, endTime) {
  return isValidTime(startTime) && isValidTime(endTime);
}

// ─── normalisation ────────────────────────────────────────────────────────────

/**
 * Normalise flexible time input to "HH:mm".
 * Accepts: "9:00" "9:5" "09:05" "900" "0900" "9:00 AM" "9:00 PM"
 * Returns null for unrecognised input.
 */
export function normalizeTime(timeInput) {
  if (!timeInput && timeInput !== 0) return null;
  let s = String(timeInput).trim();
  if (!s) return null;

  let isPM = false, isAM = false;
  const ampm = s.match(/\s*(am|pm)$/i);
  if (ampm) {
    isPM = ampm[1].toLowerCase() === 'pm';
    isAM = ampm[1].toLowerCase() === 'am';
    s    = s.slice(0, s.length - ampm[0].length).trim();
  }

  let h, m;

  if (/^([0-1]?[0-9]|2[0-3]):[0-5]?[0-9]$/.test(s)) {
    [h, m] = s.split(':').map(Number);
  } else if (/^\d{3}$/.test(s)) {
    h = parseInt(s[0]);
    m = parseInt(s.slice(1));
  } else if (/^\d{4}$/.test(s)) {
    h = parseInt(s.slice(0, 2));
    m = parseInt(s.slice(2));
  } else {
    return null;
  }

  if (isPM && h !== 12) h += 12;
  if (isAM && h === 12) h  = 0;

  if (isNaN(h) || isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// ─── sanitization ─────────────────────────────────────────────────────────────

/**
 * Sanitize time input — auto-formats then validates.
 * Returns the formatted "HH:mm" string, or "" if invalid.
 */
export function sanitizeTime(time) {
  if (!time) return '';
  const formatted = formatTimeInput(String(time));
  return isValidTime(formatted) ? formatted : '';
}

// ─── formatting ───────────────────────────────────────────────────────────────

/** Returns the time string or "--:--" for falsy values */
export function formatTimeDisplay(time) {
  return time || '--:--';
}

/**
 * Auto-format as user types into a time input.
 * Strips non-numeric/colon characters and inserts colon after 2 digits.
 */
export function formatTimeInput(raw) {
  let s = String(raw || '').replace(/[^\d:]/g, '');
  if (!s.includes(':') && s.length > 2) {
    s = s.slice(0, 2) + ':' + s.slice(2);
  }
  return s.slice(0, 5);
}

// ─── arithmetic ───────────────────────────────────────────────────────────────

/** "HH:mm" → minutes from midnight */
export function timeToMinutes(time) {
  if (!time) return 0;
  const [h, m] = String(time).split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/**
 * Hours worked between two "HH:mm" strings.
 * Handles overnight (end < start) automatically.
 * Pass outNextDay=true for explicit night-shift crossing.
 */
export function calcHoursBetween(startTime, endTime, outNextDay = false) {
  if (!startTime || !endTime) return 0;
  let diff = timeToMinutes(endTime) - timeToMinutes(startTime);
  if (outNextDay || diff < 0) diff += 1440;
  return Math.max(0, diff / 60);
}

/** Alias for calcHoursBetween — matches timeValidator.js API */
export const calculateHoursBetween = calcHoursBetween;

/** True if inTime is strictly after shiftStart */
export function isLate(inTime, shiftStart) {
  if (!inTime || !shiftStart) return false;
  return timeToMinutes(inTime) > timeToMinutes(shiftStart);
}

/** Minutes an employee arrived late (0 if on time) */
export function delayMinutes(inTime, shiftStart) {
  return Math.max(0, timeToMinutes(inTime) - timeToMinutes(shiftStart));
}

/** Alias for delayMinutes — matches timeValidator.js API */
export const calculateDelayMinutes = delayMinutes;

// ─── default export ───────────────────────────────────────────────────────────

export default {
  isValidTime,
  isValidTimeRange,
  normalizeTime,
  sanitizeTime,
  formatTimeDisplay,
  formatTimeInput,
  timeToMinutes,
  calcHoursBetween,
  calculateHoursBetween,
  isLate,
  delayMinutes,
  calculateDelayMinutes,
};