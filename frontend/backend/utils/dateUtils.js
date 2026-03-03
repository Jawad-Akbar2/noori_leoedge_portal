/**
 * utils/dateUtils.js
 * Centralized date utility functions.
 * All API inputs and CSV dates flow through here for consistent parsing.
 */

// ─── parseDDMMYYYY ────────────────────────────────────────────────────────────
/**
 * Parse a date string to a Date object at 00:00:00 local time.
 *
 * Accepts:
 *   dd/mm/yyyy          — primary format (API inputs, CSV dates)
 *   YYYY-MM-DD          — ISO 8601 fallback (HTML date inputs, query params)
 *   YYYY-MM-DDTHH:mm:ss — ISO datetime (MongoDB returns, JSON payloads)
 *
 * Returns null for any invalid or unparseable input.
 */
export function parseDDMMYYYY(dateStr) {
  if (!dateStr) return null;

  const s = String(dateStr).trim();

  // ── dd/mm/yyyy ────────────────────────────────────────────────────────────
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) {
    const [d, m, y] = s.split('/').map(Number);
    const month = m - 1;  // 0-based
    if (y < 1900 || y > 2100) return null;
    const date = new Date(y, month, d, 0, 0, 0, 0);
    // Validate: guards against 31/02/2024 etc.
    if (date.getFullYear() !== y || date.getMonth() !== month || date.getDate() !== d) {
      return null;
    }
    return date;
  }

  // ── YYYY-MM-DD  or  YYYY-MM-DDTHH:mm… ────────────────────────────────────
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const [y, m, d] = s.slice(0, 10).split('-').map(Number);
    const month = m - 1;
    if (y < 1900 || y > 2100) return null;
    const date = new Date(y, month, d, 0, 0, 0, 0);
    if (date.getFullYear() !== y || date.getMonth() !== month || date.getDate() !== d) {
      return null;
    }
    return date;
  }

  return null;
}

/** Alias used by csvParser.js */
export const parseDate = parseDDMMYYYY;

// ─── formatDate ───────────────────────────────────────────────────────────────
/**
 * Format a Date (or date string) to "dd/mm/yyyy".
 * Used for grid display, CSV export, and API responses.
 */
export function formatDate(date) {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  return [
    String(d.getDate()).padStart(2, '0'),
    String(d.getMonth() + 1).padStart(2, '0'),
    d.getFullYear()
  ].join('/');
}

// ─── formatDateTimeForDisplay ─────────────────────────────────────────────────
/**
 * Format a Date to "dd/mm/yyyy HH:mm".
 * Used for "Last Modified" and "Created At" columns.
 */
export function formatDateTimeForDisplay(date) {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  return [
    String(d.getDate()).padStart(2, '0'),
    String(d.getMonth() + 1).padStart(2, '0'),
    d.getFullYear()
  ].join('/') + ' ' + [
    String(d.getHours()).padStart(2, '0'),
    String(d.getMinutes()).padStart(2, '0')
  ].join(':');
}

// ─── startOfDay / endOfDay ────────────────────────────────────────────────────
/**
 * Return a copy of the date with time set to 00:00:00.000.
 * Use this before storing dates in MongoDB to keep the compound index
 * { empId, date } consistent.
 */
export function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Return a copy of the date with time set to 23:59:59.999.
 * Use this as the upper bound in date-range queries.
 */
export function endOfDay(date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

// ─── buildDateRange ───────────────────────────────────────────────────────────
/**
 * Parse a start/end pair (any supported format) and return a MongoDB-ready
 * range object: { $gte: startOfDay, $lte: endOfDay }.
 *
 * Returns null if either date is invalid.
 *
 * Usage in routes:
 *   const range = buildDateRange(req.query.startDate, req.query.endDate);
 *   if (!range) return res.status(400).json({ message: 'Invalid date range' });
 *   AttendanceLog.find({ date: range });
 */
export function buildDateRange(startStr, endStr) {
  const start = parseDDMMYYYY(startStr);
  const end   = parseDDMMYYYY(endStr);
  if (!start || !end) return null;
  if (end < start)    return null;
  return { $gte: startOfDay(start), $lte: endOfDay(end) };
}

// ─── convenience helpers ──────────────────────────────────────────────────────

/** Today's date as "dd/mm/yyyy" */
export function getTodayDate() {
  return formatDate(new Date());
}

/**
 * Date N days before today as "dd/mm/yyyy".
 * Useful for default "From" values in date-range pickers.
 */
export function getDateMinusDays(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return formatDate(d);
}

/** Alias kept for backward compatibility */
export function formatLastModified(dateString) {
  return dateString ? formatDateTimeForDisplay(dateString) : '--';
}

// ─── default export ───────────────────────────────────────────────────────────
export default {
  parseDDMMYYYY,
  parseDate,
  formatDate,
  formatDateTimeForDisplay,
  startOfDay,
  endOfDay,
  buildDateRange,
  getTodayDate,
  getDateMinusDays,
  formatLastModified
};