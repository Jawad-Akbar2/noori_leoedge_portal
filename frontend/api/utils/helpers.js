/**
 * utils/helpers.js
 * General-purpose utility functions.
 *
 * NOTE: Date formatting lives in utils/dateUtils.js — do NOT add date helpers here.
 * Import from dateUtils.js directly if you need formatDate / parseDDMMYYYY etc.
 */

// ─── currency ─────────────────────────────────────────────────────────────────

/**
 * Format a number as a currency string.
 * e.g. formatCurrency(1234.5) → "PKR 1,234.50"
 */
export function formatCurrency(amount, currency = 'PKR') {
  const n = parseFloat(amount) || 0;
  return `${currency} ${n.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ─── time ─────────────────────────────────────────────────────────────────────

/**
 * Build a "HH:mm" string from numeric hours and minutes.
 * e.g. formatTime(9, 5) → "09:05"
 */
export function formatTime(hours, minutes = 0) {
  return `${String(Math.floor(hours)).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/**
 * Format a decimal hour value as a human-readable string.
 * e.g. formatHours(8.5) → "8h 30m"
 *      formatHours(0)   → "0h 0m"
 */
export function formatHours(decimalHours) {
  const h = Math.floor(Math.abs(decimalHours));
  const m = Math.round((Math.abs(decimalHours) - h) * 60);
  return `${h}h ${m}m`;
}

// ─── payroll helpers ──────────────────────────────────────────────────────────

/**
 * Calculate net salary from components.
 * Always returns a non-negative value.
 *
 * @param {number} baseSalary
 * @param {number} totalDeduction
 * @param {number} totalOtAmount
 * @returns {number}
 */
export function calcNetSalary(baseSalary, totalDeduction = 0, totalOtAmount = 0) {
  return Math.max(0, (baseSalary || 0) - (totalDeduction || 0) + (totalOtAmount || 0));
}

/**
 * Pro-rate a monthly salary for a partial period.
 *
 * @param {number} monthlySalary    — full month salary
 * @param {number} workedDays       — days Present + Leave in the period
 * @param {number} totalWorkingDays — scheduled working days in the period
 * @returns {number}
 */
export function proRateSalary(monthlySalary, workedDays, totalWorkingDays) {
  if (!totalWorkingDays) return 0;
  return (monthlySalary / totalWorkingDays) * workedDays;
}

/**
 * Derive an effective hourly rate from a monthly salary.
 * Used when salaryType === 'monthly' and per-hour deduction/OT needs computing.
 *
 * @param {number} monthlySalary
 * @param {number} workingDaysPerMonth — default 26 (Mon–Sat, no holidays)
 * @param {number} hoursPerDay         — scheduled shift hours, default 8
 * @returns {number}
 */
export function monthlyToHourlyRate(monthlySalary, workingDaysPerMonth = 26, hoursPerDay = 8) {
  return monthlySalary / (workingDaysPerMonth * hoursPerDay);
}

/**
 * Count working days (Mon–Fri) between two Date objects, inclusive.
 * Pass skipWeekends=false to count all calendar days (e.g. for 6-day work weeks).
 */
export function countWorkingDays(start, end, skipWeekends = true) {
  let count = 0;
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const day = d.getDay();
    if (!skipWeekends || (day !== 0 && day !== 6)) count++;
  }
  return count;
}

// ─── validation ───────────────────────────────────────────────────────────────

/** Basic email format check */
export function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || ''));
}

// ─── security ─────────────────────────────────────────────────────────────────

/**
 * Generate a cryptographically stronger random password.
 * Guarantees at least one uppercase, one lowercase, one digit, one symbol.
 *
 * @param {number} length — minimum 8, default 12
 * @returns {string}
 */
export function generateRandomPassword(length = 12) {
  length = Math.max(8, length);

  const upper   = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lower   = 'abcdefghijklmnopqrstuvwxyz';
  const digits  = '0123456789';
  const symbols = '!@#$%^&*';
  const all     = upper + lower + digits + symbols;

  // Guarantee one of each required character class
  const required = [
    upper[Math.floor(Math.random() * upper.length)],
    lower[Math.floor(Math.random() * lower.length)],
    digits[Math.floor(Math.random() * digits.length)],
    symbols[Math.floor(Math.random() * symbols.length)]
  ];

  const rest = Array.from(
    { length: length - required.length },
    () => all[Math.floor(Math.random() * all.length)]
  );

  // Shuffle so the required chars aren't always at the start
  return [...required, ...rest]
    .sort(() => Math.random() - 0.5)
    .join('');
}

// ─── array / object utilities ─────────────────────────────────────────────────

/**
 * Paginate an in-memory array.
 * For DB pagination use Mongoose .skip()/.limit() instead.
 */
export function paginate(array, page = 1, limit = 20) {
  const p     = Math.max(1, Number(page));
  const l     = Math.max(1, Number(limit));
  const start = (p - 1) * l;
  return {
    data:  array.slice(start, start + l),
    total: array.length,
    page:  p,
    limit: l,
    pages: Math.ceil(array.length / l)
  };
}

/** Safe deep clone (primitives, plain objects, arrays — no functions/Dates) */
export function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/** Shallow merge — right-hand side wins on conflicts */
export function mergeObjects(target, source) {
  return { ...target, ...source };
}

/**
 * Group an array by a key or key-selector function.
 * e.g. groupBy(employees, 'department')
 *      groupBy(logs, r => r.date.toISOString().slice(0,10))
 */
export function groupBy(array, keyOrFn) {
  const fn = typeof keyOrFn === 'function' ? keyOrFn : (item) => item[keyOrFn];
  return array.reduce((acc, item) => {
    const k = fn(item);
    (acc[k] ??= []).push(item);
    return acc;
  }, {});
}

/** Sum a numeric field across an array of objects */
export function sumBy(array, keyOrFn) {
  const fn = typeof keyOrFn === 'function' ? keyOrFn : (item) => item[keyOrFn];
  return array.reduce((sum, item) => sum + (Number(fn(item)) || 0), 0);
}

// ─── default export ───────────────────────────────────────────────────────────
export default {
  formatCurrency,
  formatTime,
  formatHours,
  calcNetSalary,
  proRateSalary,
  monthlyToHourlyRate,
  countWorkingDays,
  validateEmail,
  generateRandomPassword,
  paginate,
  deepClone,
  mergeObjects,
  groupBy,
  sumBy
};