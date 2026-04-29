// utils/tz.js
export const PKT_OFFSET = 5 * 60 * 60 * 1000;

export function toPKTDate(date) {
  return new Date(date.getTime() + PKT_OFFSET);
}

export function pktDayKey(date) {
  return toPKTDate(date).toISOString().slice(0, 10); // "YYYY-MM-DD" in PKT
}

export function pktStartToUTC(date) {
  return new Date(date.getTime() - PKT_OFFSET);
}

export function pktEndToUTC(date) {
  return new Date(date.getTime() - PKT_OFFSET + 86400000 - 1);
}