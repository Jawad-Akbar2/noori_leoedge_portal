/**
 * CSV Parser Utility
 * Handles parsing and validation of attendance CSV files
 * Format: EmpID | Name | DateTime (MM/DD/YYYY HH:mm) | Type (0=In, 1=Out)
 */

// Validate time format (HH:mm)
export function isValidTime(time) {
  const regex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
  return regex.test(time);
}

// Parse CSV content
export function parseCSV(csvContent) {
  const lines = csvContent.trim().split('\n');
  const parsed = [];

  // Skip header
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const parts = line.split('|').map(p => p.trim());
    
    if (parts.length < 4) continue;

    const [empId, name, dateTime, typeStr] = parts;
    
    // Parse date and time
    const [datePart, timePart] = dateTime.split(' ');
    if (!datePart || !timePart) continue;

    const [month, day, year] = datePart.split('/');
    
    if (!isValidTime(timePart)) continue;

    const type = parseInt(typeStr);
    if (isNaN(type) || (type !== 0 && type !== 1)) continue;

    // Create date object (UTC midnight)
    const date = new Date(Date.UTC(
      parseInt(year),
      parseInt(month) - 1,
      parseInt(day),
      0, 0, 0, 0
    ));

    parsed.push({
      empId: empId.trim().toUpperCase(),
      name: name.trim(),
      date,
      time: timePart.trim(),
      type // 0 = In, 1 = Out
    });
  }

  return parsed;
}

// Sort CSV rows (Deterministic)
export function sortCSVRows(rows) {
  return rows.sort((a, b) => {
    // Primary: Date ascending
    const dateCompare = a.date - b.date;
    if (dateCompare !== 0) return dateCompare;

    // Secondary: EmpID ascending
    const empCompare = a.empId.localeCompare(b.empId);
    if (empCompare !== 0) return empCompare;

    // Tertiary: Type (In before Out)
    if (a.type !== b.type) return a.type - b.type;

    // Quaternary: Time ascending
    return a.time.localeCompare(b.time);
  });
}

// Apply 14-hour pairing rule
export function applyPairingRule(inTime, outTime, shiftStartTime) {
  const [inH, inM] = inTime.split(':').map(Number);
  const [outH, outM] = outTime.split(':').map(Number);
  const [shiftH, shiftM] = shiftStartTime.split(':').map(Number);

  const inMinutes = inH * 60 + inM;
  const outMinutes = outH * 60 + outM;
  const shiftMinutes = shiftH * 60 + shiftM;

  // Calculate difference (handles overnight)
  let diffMinutes = outMinutes - shiftMinutes;
  if (diffMinutes < 0) diffMinutes += 24 * 60;

  // 14-hour rule
  return diffMinutes <= 14 * 60;
}

// Merge CSV with database (Progressive completion)
export function mergeWithDatabase(csvIn, csvOut, dbIn, dbOut, manualOverride) {
  // If manual override, don't change anything
  if (manualOverride) {
    return { in: dbIn, out: dbOut };
  }

  // Take earlier In
  let finalIn = csvIn || dbIn;
  if (csvIn && dbIn) {
    finalIn = csvIn < dbIn ? csvIn : dbIn;
  }

  // Take later Out
  let finalOut = csvOut || dbOut;
  if (csvOut && dbOut) {
    finalOut = csvOut > dbOut ? csvOut : dbOut;
  }

  return { in: finalIn, out: finalOut };
}

export default {
  parseCSV,
  sortCSVRows,
  applyPairingRule,
  mergeWithDatabase,
  isValidTime
};