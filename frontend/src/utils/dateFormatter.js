/**
 * Date Formatter Utility
 * All dates use dd/mm/yyyy format consistently
 */

/**
 * Parse dd/mm/yyyy string to Date object
 */
export function parseDate(dateStr) {
  if (!dateStr) return null;

  const trimmed = String(dateStr).trim();
  const parts = trimmed.split('/');

  if (parts.length !== 3) return null;

  const day = parseInt(parts[0]);
  const month = parseInt(parts[1]);
  const year = parseInt(parts[2]);

  if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
  if (day < 1 || day > 31 || month < 1 || month > 12) return null;
  if (year < 1900 || year > 2100) return null;

  const date = new Date(year, month - 1, day);
  
  // Validate date is real
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }

  return date;
}

/**
 * Format Date object to dd/mm/yyyy
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
 * Format Date object to dd/mm/yyyy HH:mm for display
 */
export function formatDateTime(date) {
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
 * Get today's date in dd/mm/yyyy
 */
export function getTodayDate() {
  return formatDate(new Date());
}

/**
 * Get date minus days in dd/mm/yyyy
 */
export function getDateMinusDays(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return formatDate(date);
}

/**
 * Convert JavaScript Date to ISO string
 */
export function toISO(date) {
  if (!date) return null;
  const d = new Date(date);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * Convert YYYY-MM-DD or ISO string to dd/mm/yyyy
 * Used for displaying backend data in the UI
 */
export function formatToDDMMYYYY(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return formatDate(d);
}

/**
 * Convert dd/mm/yyyy string to yyyy-mm-dd
 * Used specifically to set the value of <input type="date"> calendar pickers
 */
export function formatToYYYYMMDD(dateStr) {
  if (!dateStr) return "";
  const parts = dateStr.split('/');
  if (parts.length !== 3) return dateStr; // Return original if not in dd/mm/yyyy
  return `${parts[2]}-${parts[1]}-${parts[0]}`;
}

const dateUtils = {
  parseDate,
  formatDate,
  formatDateTime,
  getTodayDate,
  getDateMinusDays,
  toISO,
  formatToDDMMYYYY,
  formatToYYYYMMDD
};

export default dateUtils;