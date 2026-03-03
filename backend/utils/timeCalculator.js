/**
 * utils/timeCalculator.js
 * All time and shift calculations for attendance and payroll.
 *
 * NOTE: Date-only helpers (startOfDay, endOfDay, buildDateRange) live in
 * utils/dateUtils.js. This file handles HH:mm time arithmetic only.
 */

// ─── validation ───────────────────────────────────────────────────────────────

/**
 * Returns true for any "HH:mm" string in 24-hour format.
 * Accepts single-digit hours/minutes: "9:00", "9:5", "09:05".
 */
export function isValidTime(time) {
  if (!time || typeof time !== 'string') return false;
  return /^([0-1]?[0-9]|2[0-3]):[0-5]?[0-9]$/.test(time.trim());
}

/**
 * Validate a shift pair: both times must be valid HH:mm strings.
 * Accepts night-shift (end < start) — that is legal.
 * Returns { valid, error }.
 */
export function validateShiftTimes(startTime, endTime) {
  if (!isValidTime(startTime)) {
    return { valid: false, error: `Invalid shift start time: "${startTime}"` };
  }
  if (!isValidTime(endTime)) {
    return { valid: false, error: `Invalid shift end time: "${endTime}"` };
  }
  // Identical start and end would mean a 0-hour or 24-hour shift — reject.
  if (startTime.trim() === endTime.trim()) {
    return { valid: false, error: 'Shift start and end times cannot be identical' };
  }
  return { valid: true, error: null };
}

// ─── conversion ───────────────────────────────────────────────────────────────

/** "HH:mm" → total minutes from midnight */
export function timeToMinutes(time) {
  if (!time) return 0;
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

/** Total minutes → "HH:mm" (does NOT wrap at 24 h — use for duration display) */
export function minutesToTime(totalMinutes) {
  const m = Math.max(0, totalMinutes);
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

// ─── calculations ─────────────────────────────────────────────────────────────

/**
 * Hours between two "HH:mm" strings.
 * Handles overnight (endTime < startTime) automatically.
 * Uses outNextDay flag when available for unambiguous calculation.
 *
 * @param {string}  startTime
 * @param {string}  endTime
 * @param {boolean} outNextDay — set true for night-shift out times
 * @returns {number} decimal hours, always >= 0
 */
export function calculateHours(startTime, endTime, outNextDay = false) {
  if (!startTime || !endTime) return 0;

  const startMin = timeToMinutes(startTime);
  let   endMin   = timeToMinutes(endTime);

  if (outNextDay || endMin < startMin) {
    endMin += 1440;  // add 24 h
  }

  return Math.max(0, (endMin - startMin) / 60);
}

/**
 * Scheduled shift duration in hours.
 * Convenience wrapper — always passes the shift pair so callers don't
 * need to think about night-shift detection.
 */
export function shiftDurationHours(shift) {
  return calculateHours(shift.start, shift.end);
}

/** True if inTime is strictly after shiftStart */
export function isLate(inTime, shiftStart) {
  if (!inTime || !shiftStart) return false;
  return timeToMinutes(inTime) > timeToMinutes(shiftStart);
}

/** Minutes an employee was late (0 if on time) */
export function calculateDelayMinutes(inTime, shiftStart) {
  if (!inTime || !shiftStart) return 0;
  return Math.max(0, timeToMinutes(inTime) - timeToMinutes(shiftStart));
}

/** Base pay for hours worked at a given hourly rate */
export function calculateEarning(hours, hourlyRate) {
  return Math.max(0, (hours || 0) * (hourlyRate || 0));
}

/**
 * Calculate OT amount.
 *
 * @param {number} otHours
 * @param {number} hourlyRate
 * @param {number} multiplier — 1 | 1.5 | 2
 * @returns {number}
 */
export function calculateOtAmount(otHours, hourlyRate, multiplier = 1) {
  const validMultiplier = [1, 1.5, 2].includes(multiplier) ? multiplier : 1;
  return Math.max(0, (otHours || 0) * (hourlyRate || 0) * validMultiplier);
}

/**
 * Full day earnings: base - deduction + OT, floored at 0.
 */
export function calculateFinalDayEarning(basePay, deduction = 0, otAmount = 0) {
  return Math.max(0, (basePay || 0) - (deduction || 0) + (otAmount || 0));
}

// ─── display ──────────────────────────────────────────────────────────────────

/** Returns the time string as-is, or "--:--" if falsy */
export function formatTimeDisplay(time) {
  return time || '--:--';
}

// ─── company pay period ───────────────────────────────────────────────────────

/**
 * Get the company pay-period boundaries for a given date.
 * Pay period runs from the 18th of one month to the 17th of the next.
 *
 *   e.g. if date is 2025-01-20  →  start: 2025-01-18, end: 2025-02-17
 *        if date is 2025-01-10  →  start: 2024-12-18, end: 2025-01-17
 *
 * Returns { startDate, endDate, periodLabel } where periodLabel is a
 * human-readable string like "18 Jan – 17 Feb 2025" for display in the
 * payroll page date picker.
 */
export function getCompanyMonthDates(date = new Date()) {
  const y   = date.getFullYear();
  const m   = date.getMonth();   // 0-based
  const day = date.getDate();

  let startDate, endDate;

  if (day >= 18) {
    startDate = new Date(y, m,     18, 0,  0,  0,   0);
    endDate   = new Date(y, m + 1, 17, 23, 59, 59, 999);
  } else {
    startDate = new Date(y, m - 1, 18, 0,  0,  0,   0);
    endDate   = new Date(y, m,     17, 23, 59, 59, 999);
  }

  const fmt = (d) => d.toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' });
  const periodLabel = `${fmt(startDate)} – ${fmt(endDate)}`;

  return { startDate, endDate, periodLabel };
}

/**
 * Get the last N complete pay periods ending before today.
 * Useful for populating the payroll page period selector.
 *
 * @param {number} count — how many periods to return (default 3)
 * @returns {Array<{ startDate, endDate, periodLabel }>}
 */
export function getRecentPayPeriods(count = 3) {
  const periods = [];
  // Start from the period BEFORE the current one
  let anchor = new Date();
  anchor.setDate(anchor.getDate() - 30);   // step back one period

  for (let i = 0; i < count; i++) {
    periods.push(getCompanyMonthDates(anchor));
    anchor.setDate(anchor.getDate() - 30); // step back another period
  }

  return periods;
}

// ─── default export ───────────────────────────────────────────────────────────
export default {
  isValidTime,
  validateShiftTimes,
  timeToMinutes,
  minutesToTime,
  calculateHours,
  shiftDurationHours,
  isLate,
  calculateDelayMinutes,
  calculateEarning,
  calculateOtAmount,
  calculateFinalDayEarning,
  formatTimeDisplay,
  getCompanyMonthDates,
  getRecentPayPeriods
};