/**
 * utils/dateFormatter.js
 *
 * Frontend date utilities.
 * All API dates arrive as ISO strings or dd/mm/yyyy — this file converts both.
 *
 * Rule: display always uses dd/mm/yyyy.
 *       <input type="date"> always uses yyyy-mm-dd (HTML spec).
 *       API query params accept both (backend's buildDateRange handles it).
 */

// ─── parsing ──────────────────────────────────────────────────────────────────

/**
 * Parse a date string to a JS Date at midnight local time.
 * Accepts:
 *   dd/mm/yyyy           — display format
 *   yyyy-mm-dd           — HTML input format / API format
 *   ISO datetime string  — from JSON payloads / MongoDB
 * Returns null for invalid input.
 */
export function parseDate(dateStr) {
  if (!dateStr) return null;
  const s = String(dateStr).trim();

  // dd/mm/yyyy
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) {
    const [d, m, y] = s.split('/').map(Number);
    if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1900 || y > 2100) return null;
    const date = new Date(y, m - 1, d);
    if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
    return date;
  }

  // yyyy-mm-dd  or  ISO datetime
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const [y, m, d] = s.slice(0, 10).split('-').map(Number);
    if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1900 || y > 2100) return null;
    const date = new Date(y, m - 1, d);
    if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
    return date;
  }

  return null;
}

// ─── formatting ───────────────────────────────────────────────────────────────

/** Date → "dd/mm/yyyy" (display) */
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

/** Date → "dd/mm/yyyy HH:mm" (display with time) */
export function formatDateTime(date) {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  return formatDate(d) + ' ' + [
    String(d.getHours()).padStart(2, '0'),
    String(d.getMinutes()).padStart(2, '0')
  ].join(':');
}

/**
 * "dd/mm/yyyy" → "yyyy-mm-dd"
 * Use for <input type="date" value={...}> — HTML date inputs require yyyy-mm-dd.
 */
export function formatToYYYYMMDD(dateStr) {
  if (!dateStr) return '';
  // If already yyyy-mm-dd just return it
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  const parts = dateStr.split('/');
  if (parts.length !== 3) return '';
  return `${parts[2]}-${parts[1]}-${parts[0]}`;
}

/**
 * "yyyy-mm-dd" or ISO → "dd/mm/yyyy"
 * Use when displaying backend data in the UI.
 */
export function formatToDDMMYYYY(dateStr) {
  if (!dateStr) return '';
  return formatDate(new Date(dateStr));
}

// ─── convenience ─────────────────────────────────────────────────────────────

/** Today as "dd/mm/yyyy" */
export function getTodayDate() {
  return formatDate(new Date());
}

/** Today as "yyyy-mm-dd" (for <input type="date" max={...}>) */
export function getTodayISO() {
  return new Date().toISOString().slice(0, 10);
}

/** N days before today as "dd/mm/yyyy" */
export function getDateMinusDays(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return formatDate(d);
}

/** N days before today as "yyyy-mm-dd" */
export function getDateMinusDaysISO(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

/** Date → ISO string, null if invalid */
export function toISO(date) {
  if (!date) return null;
  const d = new Date(date);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * Build a default date range object for API calls.
 * @param {number} daysBack - how far back from today (default 30)
 * @returns {{ startDate: string, endDate: string }} in dd/mm/yyyy
 */
export function defaultDateRange(daysBack = 30) {
  return {
    startDate: getDateMinusDays(daysBack),
    endDate:   getTodayDate()
  };
}

const dateFormatter = {
  parseDate,
  formatDate,
  formatDateTime,
  formatToYYYYMMDD,
  formatToDDMMYYYY,
  getTodayDate,
  getTodayISO,
  getDateMinusDays,
  getDateMinusDaysISO,
  toISO,
  defaultDateRange
};
export default dateFormatter;