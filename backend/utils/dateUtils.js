/**
 * E:\hr-employee-portal\backend\utils\dateUtils.js
 * Date Utility Functions
 * Centralized logic for dd/mm/yyyy consistency across the project.
 */

/**
 * Standard Parser: Converts dd/mm/yyyy string to a Date object at 00:00:00 local time.
 * Use this for API inputs and processing CSV dates.
 * Alias 'parseDate' provided for compatibility with csvParser.js
 */
export function parseDDMMYYYY(dateStr) {
  if (!dateStr) return null;

  const trimmed = String(dateStr).trim();
  const parts = trimmed.split('/');

  if (parts.length !== 3) return null;

  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1; // 0-based index
  const year = parseInt(parts[2], 10);

  if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
  if (year < 1900 || year > 2100) return null;

  const date = new Date(year, month, day);

  // Validation: Ensure the date is real (e.g., stops 31/02/2024)
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month ||
    date.getDate() !== day
  ) {
    return null;
  }

  date.setHours(0, 0, 0, 0);
  return date;
}

// Alias for csvParser.js compatibility
export const parseDate = parseDDMMYYYY;

/**
 * Standard Formatter: Converts Date object to dd/mm/yyyy string.
 * Use this for displaying dates in grids, lists, and calendar inputs.
 */
export function formatDate(date) {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';

  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();

  return `${day}/${month}/${year}`;
}

/**
 * DateTime Formatter: Converts Date object to dd/mm/yyyy HH:mm string.
 * Use this for "Last Modified" or "Created At" columns in your grids.
 */
export function formatDateTimeForDisplay(date) {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';

  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');

  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

/**
 * Get Today's Date as a string in dd/mm/yyyy format.
 */
export function getTodayDate() {
  return formatDate(new Date());
}

/**
 * Get a past or future date relative to today in dd/mm/yyyy format.
 * Useful for default "From" values in date range calendars.
 */
export function getDateMinusDays(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return formatDate(date);
}

/**
 * Format timestamp for last modified display
 */
export function formatLastModified(dateString) {
  if (!dateString) return '--';
  return formatDateTimeForDisplay(dateString);
}

// Export object for compatibility with existing imports:
export default {
  parseDDMMYYYY,
  parseDate,
  formatDate,
  formatDateTimeForDisplay,
  getTodayDate,
  getDateMinusDays,
  formatLastModified
};