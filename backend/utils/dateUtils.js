
export function parseDDMMYYYY(dateStr) {
  if (!dateStr) return null;
  const s = String(dateStr).trim();

  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) {
    const [d, m, y] = s.split('/').map(Number);
    const month = m - 1;

    return new Date(Date.UTC(y, month, d)); // ✅ FIX
  }

  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const [y, m, d] = s.slice(0, 10).split('-').map(Number);
    const month = m - 1;

    return new Date(Date.UTC(y, month, d)); // ✅ FIX
  }

  return null;
}

export const parseDate = parseDDMMYYYY;

export function startOfDay(date) {
  const d = new Date(date);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function endOfDay(date) {
  const d = new Date(date);
  return new Date(Date.UTC(
    d.getUTCFullYear(),
    d.getUTCMonth(),
    d.getUTCDate(),
    23, 59, 59, 999
  ));
}

export function addDaysUTC(date, days) {
  const d = startOfDay(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function formatDate(date) {
  if (!date) return '';

  const d = new Date(date);

  return d.toLocaleDateString('en-GB', {
    timeZone: 'Asia/Karachi'
  });
}

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

export function buildDateRange(startStr, endStr) {
  const start = parseDDMMYYYY(startStr);
  const end = parseDDMMYYYY(endStr);
  if (!start || !end) return null;
  if (end < start) return null;
  return { $gte: startOfDay(start), $lte: endOfDay(end) };
}

export function getTodayDate() {
  return formatDate(new Date());
}

export function getDateMinusDays(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return formatDate(d);
}

export function formatLastModified(dateString) {
  return dateString ? formatDateTimeForDisplay(dateString) : "--";
}

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
  formatLastModified,
};
