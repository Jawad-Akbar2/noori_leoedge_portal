/**
 * CSV Parser Utility - FINAL VERSION
 * Format: empid | firstname | lastname | date(dd/mm/yyyy) | time(HH:mm) | status(0=in, 1=out)
 * Supports both pipe (|) and comma (,) delimiters — auto-detected per file
 */

import { normalizeTime, isValidNormalizedTime } from './timeNormalizer.js';
import { parseDate, formatDate } from './dateUtils.js';

/**
 * Detect delimiter used in CSV content (pipe or comma)
 */
function detectDelimiter(csvContent) {
  const firstLine = csvContent.trim().split('\n')[0] || '';
  const pipeCount = (firstLine.match(/\|/g) || []).length;
  const commaCount = (firstLine.match(/,/g) || []).length;
  return pipeCount >= commaCount ? '|' : ',';
}

export function parseCSV(csvContent) {
  const lines = csvContent.trim().split('\n');
  const parsed = [];
  const errors = [];

  // Auto-detect delimiter
  const delimiter = detectDelimiter(csvContent);

  // Skip header line if present
  let startIndex = 0;
  if (lines[0] && lines[0].toLowerCase().includes('empid')) {
    startIndex = 1;
  }

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const rowNumber = i + 1; // 1-based for user display
    const parts = line.split(delimiter).map(p => p.trim());

    // Validate columns
    if (parts.length < 6) {
      errors.push({
        rowNumber,
        error: `Invalid format. Expected 6 columns separated by "${delimiter}", got ${parts.length}`,
        rawLine: line
      });
      continue;
    }

    const [empId, firstName, lastName, dateStr, timeStr, statusStr] = parts;

    // Validate empId
    if (!empId) {
      errors.push({
        rowNumber,
        error: 'Employee ID cannot be empty',
        rawLine: line
      });
      continue;
    }

    // Validate date format (dd/mm/yyyy)
    const parsedDate = parseDate(dateStr);
    if (!parsedDate) {
      errors.push({
        rowNumber,
        error: `Invalid date format. Expected dd/mm/yyyy, got "${dateStr}"`,
        rawLine: line
      });
      continue;
    }

    // Validate and normalize time
    const normalizedTime = normalizeTime(timeStr);
    if (!normalizedTime) {
      errors.push({
        rowNumber,
        error: `Invalid time format. Expected HH:mm or flexible format (9:00, 900, etc.), got "${timeStr}"`,
        rawLine: line
      });
      continue;
    }

    // Validate status (0 or 1)
    const status = parseInt(statusStr);
    if (isNaN(status) || (status !== 0 && status !== 1)) {
      errors.push({
        rowNumber,
        error: `Invalid status. Expected 0 (check-in) or 1 (check-out), got "${statusStr}"`,
        rawLine: line
      });
      continue;
    }

    parsed.push({
      rowNumber,
      empId: empId.trim().toUpperCase(),
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      date: parsedDate,
      dateStr: formatDate(parsedDate), // Normalized to dd/mm/yyyy
      time: normalizedTime,
      status: status, // 0 = check-in, 1 = check-out
      isCheckIn: status === 0,
      isCheckOut: status === 1,
      rawLine: line
    });
  }

  return { parsed, errors };
}

/**
 * Group parsed rows by employee and date for processing
 * All rows for same employee on same date are grouped together
 */
export function groupByEmployeeAndDate(parsedRows) {
  const grouped = {};

  for (const row of parsedRows) {
    const key = `${row.empId}|${row.dateStr}`;
    if (!grouped[key]) {
      grouped[key] = {
        empId: row.empId,
        firstName: row.firstName,
        lastName: row.lastName,
        dateStr: row.dateStr,
        date: row.date,
        rows: []
      };
    }
    grouped[key].rows.push({
      rowNumber: row.rowNumber,
      time: row.time,
      isCheckIn: row.isCheckIn,
      isCheckOut: row.isCheckOut,
      rawLine: row.rawLine
    });
  }

  return grouped;
}

/**
 * Apply 14-hour rule to determine if times should be paired
 * If difference is more than 14 hours, they're treated as separate events
 */
export function applyPairingRule(inTime, outTime) {
  if (!inTime || !outTime) return false;

  const [inH, inM] = inTime.split(':').map(Number);
  const [outH, outM] = outTime.split(':').map(Number);

  const inMinutes = inH * 60 + inM;
  let outMinutes = outH * 60 + outM;

  // Handle overnight shift
  if (outMinutes < inMinutes) {
    outMinutes += 24 * 60;
  }

  const diffHours = (outMinutes - inMinutes) / 60;
  return diffHours <= 14; // 14-hour rule
}

/**
 * Merge times: take earliest check-in and latest check-out
 */
export function mergeTimes(times) {
  const checkIns = times.filter(t => t.isCheckIn).map(t => t.time).sort();
  const checkOuts = times.filter(t => t.isCheckOut).map(t => t.time).sort();

  return {
    inTime: checkIns.length > 0 ? checkIns[0] : null,
    outTime: checkOuts.length > 0 ? checkOuts[checkOuts.length - 1] : null
  };
}

export default {
  parseCSV,
  groupByEmployeeAndDate,
  applyPairingRule,
  mergeTimes
};