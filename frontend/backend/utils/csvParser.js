/**
 * CSV Parser Utility
 *
 * Expected CSV format (pipe or comma delimited, auto-detected):
 *   empid | firstname | lastname | date(dd/mm/yyyy) | time(HH:mm) | status(0=in, 1=out)
 *
 * Night-shift 14-hour rule (req #4):
 *   Given a shift start (e.g. 22:00) the system looks for the employee's
 *   check-IN as the first typed-IN punch >= shiftStart within a 14-hour
 *   window, then finds their check-OUT as the first typed-OUT punch that
 *   also falls within that same 14-hour window FROM SHIFT START (not from
 *   check-in time). If the raw out time is numerically less than the raw in
 *   time, outNextDay is set to true.
 */

// utils/csvParser.js

import { normalizeTime } from './timeNormalizer.js';
import { parseDate, formatDate } from './dateUtils.js';

// ─── delimiter detection ──────────────────────────────────────────────────────

function detectDelimiter(csvContent) {
  const first = csvContent.trim().split('\n')[0] || '';
  const pipes  = (first.match(/\|/g) || []).length;
  const commas = (first.match(/,/g)  || []).length;
  return pipes >= commas ? '|' : ',';
}

// ─── helpers ──────────────────────────────────────────────────────────────────

/** "HH:mm" → total minutes from midnight */
const toMin = (t) => {
  if (!t) return 0;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

// ─── parseCSV ─────────────────────────────────────────────────────────────────

export function parseCSV(csvContent) {
  const lines     = csvContent.trim().split('\n');
  const parsed    = [];
  const errors    = [];
  const delimiter = detectDelimiter(csvContent);

  // Skip header row if present
  let startIndex = 0;
  if (lines[0]?.toLowerCase().includes('empid')) startIndex = 1;

  for (let i = startIndex; i < lines.length; i++) {
    const line      = lines[i].trim();
    if (!line) continue;

    const rowNumber = i + 1;
    const parts     = line.split(delimiter).map(p => p.trim());

    if (parts.length < 6) {
      errors.push({
        rowNumber,
        error:   `Expected 6 columns (delimiter "${delimiter}"), got ${parts.length}`,
        rawLine: line
      });
      continue;
    }

    const [empId, firstName, lastName, dateStr, timeStr, statusStr] = parts;

    if (!empId) {
      errors.push({ rowNumber, error: 'Employee ID is empty', rawLine: line });
      continue;
    }

    const parsedDate = parseDate(dateStr);
    if (!parsedDate) {
      errors.push({ rowNumber, error: `Invalid date "${dateStr}" (expected dd/mm/yyyy)`, rawLine: line });
      continue;
    }

    const normalizedTime = normalizeTime(timeStr);
    if (!normalizedTime) {
      errors.push({ rowNumber, error: `Invalid time "${timeStr}"`, rawLine: line });
      continue;
    }

    const status = parseInt(statusStr, 10);
    if (isNaN(status) || (status !== 0 && status !== 1)) {
      errors.push({ rowNumber, error: `Invalid status "${statusStr}" (0=in, 1=out)`, rawLine: line });
      continue;
    }

    parsed.push({
      rowNumber,
      empId:      empId.trim().toUpperCase(),
      firstName:  firstName.trim(),
      lastName:   lastName.trim(),
      date:       parsedDate,
      dateStr:    formatDate(parsedDate),
      time:       normalizedTime,
      status,
      isCheckIn:  status === 0,
      isCheckOut: status === 1,
      rawLine:    line
    });
  }

  return { parsed, errors };
}

// ─── groupByEmployeeAndDate ───────────────────────────────────────────────────
//
// Groups all punches for the same employee on the same calendar date.
// NOTE: for night-shift employees, all punches for a shift belong to the
// shift-start date even if the out punch occurs the next calendar day.
// That resolution happens in mergeTimes / applyNightShiftPairing — here we
// simply group by the date column as written in the CSV.

export function groupByEmployeeAndDate(parsedRows) {
  const grouped = {};

  for (const row of parsedRows) {
    const key = `${row.empId}|${row.dateStr}`;

    if (!grouped[key]) {
      grouped[key] = {
        empId:     row.empId,
        firstName: row.firstName,
        lastName:  row.lastName,
        dateStr:   row.dateStr,
        date:      row.date,
        rows:      []
      };
    }

    grouped[key].rows.push({
      rowNumber:  row.rowNumber,
      time:       row.time,
      isCheckIn:  row.isCheckIn,
      isCheckOut: row.isCheckOut,
      rawLine:    row.rawLine
    });
  }

  return grouped;
}

// ─── mergeTimes ───────────────────────────────────────────────────────────────
//
// Used when the CSV rows already carry typed IN/OUT status (status 0/1).
// Takes the earliest check-in and latest check-out from the group.
//
// Returns { inTime, outTime, outNextDay }
//   outNextDay = true when the raw outTime is numerically before inTime
//   (i.e. the check-out crossed midnight).

export function mergeTimes(rows) {
  const ins  = rows.filter(r => r.isCheckIn).map(r => r.time).sort();
  const outs = rows.filter(r => r.isCheckOut).map(r => r.time).sort();

  const inTime  = ins.length  > 0 ? ins[0]               : null;
  const outTime = outs.length > 0 ? outs[outs.length - 1] : null;

  // Detect midnight crossing: raw out time is numerically less than in time
  const outNextDay = !!(inTime && outTime && toMin(outTime) < toMin(inTime));

  return { inTime, outTime, outNextDay };
}

// ─── applyNightShiftPairing ───────────────────────────────────────────────────
//
// The 14-hour pairing rule for raw (untyped) punch lists or when the CSV
// carries only a single status column that is unreliable.
//
// Algorithm (req #4):
//   1. Build a "shift timeline" — any punch whose raw minute value is less
//      than shiftStart is assumed to be next-day, so add 1440 to normalise it.
//   2. Sort all punches on this normalised timeline.
//   3. inTime  = first punch whose normalised value is in [shiftStart, shiftStart+14h]
//   4. outTime = first punch AFTER inTime whose normalised value is
//                still within shiftStart + 14h  (window is from SHIFT START,
//                not from check-in — this is the key fix vs the old version)
//   5. outNextDay = raw out minute < raw in minute (crossed midnight)
//
// Returns { inTime, outTime, outNextDay }

export function applyNightShiftPairing(shiftStart, punchTimes) {
  if (!punchTimes || punchTimes.length === 0) {
    return { inTime: null, outTime: null, outNextDay: false };
  }

  const shiftStartMin = toMin(shiftStart);
  const windowEnd     = shiftStartMin + 14 * 60;   // 14 h from shift start

  // Normalise: punches that appear before shift start are next-day
  const normalised = punchTimes
    .filter(Boolean)
    .map(t => {
      let m = toMin(t);
      if (m < shiftStartMin) m += 1440;
      return { time: t, norm: m };
    })
    .sort((a, b) => a.norm - b.norm);

  // inTime: first punch inside the 14-h window
  const inEntry = normalised.find(p => p.norm >= shiftStartMin && p.norm <= windowEnd);
  if (!inEntry) return { inTime: null, outTime: null, outNextDay: false };

  // outTime: first punch strictly after inEntry and still within window
  // Window is measured from SHIFT START (not from inEntry) — req #4 spec
  const outEntry = normalised.find(p => p.norm > inEntry.norm && p.norm <= windowEnd);
  if (!outEntry) return { inTime: inEntry.time, outTime: null, outNextDay: false };

  const outNextDay = toMin(outEntry.time) < toMin(inEntry.time);

  return { inTime: inEntry.time, outTime: outEntry.time, outNextDay };
}

/**
 * applyPairingRule — kept for backward compatibility.
 * Returns true if inTime and outTime are within 14 hours of each other.
 * @deprecated Use applyNightShiftPairing for actual time resolution.
 */
export function applyPairingRule(inTime, outTime) {
  if (!inTime || !outTime) return false;
  let diff = toMin(outTime) - toMin(inTime);
  if (diff < 0) diff += 1440;
  return diff / 60 <= 14;
}

export default {
  parseCSV,
  groupByEmployeeAndDate,
  mergeTimes,
  applyNightShiftPairing,
  applyPairingRule
};