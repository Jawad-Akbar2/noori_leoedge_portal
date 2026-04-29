/**
 * utils/excelExporter.js
 * Excel (XLSX) export helpers.
 * Requires: npm install xlsx
 */

import { PAYROLL_CSV_COLUMNS } from './constants.js';

// ─── generic exporter ────────────────────────────────────────────────────────

/**
 * Export any array of objects to a downloadable .xlsx file.
 *
 * @param {Object[]} data
 * @param {string}   sheetName
 * @param {string}   fileName
 */
export async function exportToExcel(data, sheetName = 'Sheet1', fileName = 'export.xlsx') {
  if (!data?.length) {
    console.warn('exportToExcel: no data');
    return;
  }

  try {
    // Dynamic import — works in Vite/ESM (no require())
    const XLSX = await import('xlsx').then(m => m.default || m);

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);

    // Bold headers + background
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r: 0, c });
      if (!ws[addr]) continue;
      ws[addr].s = {
        fill:      { fgColor: { rgb: 'FFD9D9D9' } },
        font:      { bold: true },
        alignment: { horizontal: 'center', vertical: 'center' }
      };
    }

    // Auto-width columns
    ws['!cols'] = Object.keys(data[0]).map(key => ({
      wch: Math.max(key.length, ...data.map(r => String(r[key] ?? '').length)) + 2
    }));

    XLSX.writeFile(wb, fileName);
  } catch (err) {
    console.error('exportToExcel error:', err);
    throw new Error('Excel export failed. Run: npm install xlsx');
  }
}

// ─── payroll export ───────────────────────────────────────────────────────────

/**
 * Export payroll summary to Excel.
 * Uses PAYROLL_CSV_COLUMNS from constants.js — correct backend field names.
 *
 * @param {Object[]} summary — employee payroll rows from backend
 */
export async function exportPayrollToExcel(summary) {
  if (!summary?.length) return;

  const rows = summary.map(emp =>
    Object.fromEntries(
      PAYROLL_CSV_COLUMNS.map(({ key, label }) => [label, emp[key] ?? ''])
    )
  );

  await exportToExcel(rows, 'Payroll', `payroll-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

// ─── attendance export ────────────────────────────────────────────────────────

export async function exportAttendanceToExcel(attendance, filename = 'attendance.xlsx') {
  if (!attendance?.length) return;

  const rows = attendance.map(r => ({
    'Date':       r.dateFormatted || r.date,
    'Emp Number': r.empNumber,
    'Name':       r.empName,
    'Department': r.department,
    'Status':     r.status,
    'In Time':    r.inTime  || '--',
    'Out Time':   r.outTime || '--',
    'Hours':      r.financials?.hoursWorked    ?? 0,  // correct field
    'Base Pay':   r.financials?.basePay         ?? 0,
    'Deduction':  r.financials?.deduction       ?? 0,
    'OT Amount':  r.financials?.otAmount        ?? 0,
    'Final Pay':  r.financials?.finalDayEarning ?? 0
  }));

  await exportToExcel(rows, 'Attendance', filename);
}