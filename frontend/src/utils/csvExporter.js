/**
 * utils/csvExporter.js
 * Frontend CSV export helpers.
 *
 * Field names MUST match what the backend actually returns.
 * Backend payroll routes return: baseSalary, totalOt, totalDeduction, netPayable
 * NOT: basicEarned, otTotal, deductionTotal
 */

import { PAYROLL_CSV_COLUMNS } from './constants.js';

// ─── generic exporter ────────────────────────────────────────────────────────

/**
 * Export any array of objects to a downloadable CSV file.
 * Values containing commas or quotes are properly escaped.
 *
 * @param {Object[]} data
 * @param {string}   filename
 */
export function exportToCSV(data, filename = 'export.csv') {
  if (!data?.length) {
    console.warn('exportToCSV: no data');
    return;
  }

  const headers = Object.keys(data[0]);

  const escape = (v) => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };

  const lines = [
    headers.map(escape).join(','),
    ...data.map(row => headers.map(h => escape(row[h])).join(','))
  ];

  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), {
    href:     url,
    download: filename,
    style:    'display:none'
  });
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── payroll export ───────────────────────────────────────────────────────────

/**
 * Export payroll summary to CSV.
 * Uses PAYROLL_CSV_COLUMNS from constants.js to guarantee column order and
 * correct field names (baseSalary / totalOt — NOT basicEarned / otTotal).
 *
 * @param {Object[]} summary — array of employee payroll rows from backend
 */
export function exportPayrollToCSV(summary) {
  if (!summary?.length) return;

  const rows = summary.map(emp =>
    Object.fromEntries(
      PAYROLL_CSV_COLUMNS.map(({ key, label }) => [label, emp[key] ?? ''])
    )
  );

  const d       = new Date();
  const dateStr = [
    String(d.getDate()).padStart(2, '0'),
    String(d.getMonth() + 1).padStart(2, '0'),
    d.getFullYear()
  ].join('-');

  exportToCSV(rows, `payroll-${dateStr}.csv`);
}

// ─── attendance export ────────────────────────────────────────────────────────

/**
 * Export attendance records to CSV.
 * Uses hoursWorked (correct field name — NOT hoursPerDay).
 *
 * @param {Object[]} attendance — records from GET /api/attendance/range
 * @param {string}   filename
 */
export function exportAttendanceToCSV(attendance, filename = 'attendance.csv') {
  if (!attendance?.length) return;

  const rows = attendance.map(r => ({
    'Date':       r.dateFormatted || r.date,
    'Emp Number': r.empNumber,
    'Name':       r.empName,
    'Department': r.department,
    'Status':     r.status,
    'In Time':    r.inTime  || '--',
    'Out Time':   r.outTime || '--',
    'Hours':      r.financials?.hoursWorked   ?? 0,   // correct field (not hoursPerDay)
    'Base Pay':   r.financials?.basePay        ?? 0,
    'Deduction':  r.financials?.deduction      ?? 0,
    'OT Amount':  r.financials?.otAmount       ?? 0,
    'Final Pay':  r.financials?.finalDayEarning ?? 0
  }));

  exportToCSV(rows, filename);
}

// ─── employee list export ─────────────────────────────────────────────────────

export function exportEmployeesToCSV(employees) {
  if (!employees?.length) return;

  const rows = employees.map(e => ({
    'Employee Number': e.employeeNumber,
    'First Name':      e.firstName,
    'Last Name':       e.lastName,
    'Email':           e.email,
    'Department':      e.department,
    'Role':            e.role,
    'Salary Type':     e.salaryType,
    'Hourly Rate':     e.hourlyRate,
    'Monthly Salary':  e.monthlySalary || '',
    'Status':          e.status,
    'Joining Date':    e.joiningDate
      ? new Date(e.joiningDate).toLocaleDateString('en-GB')
      : ''
  }));

  exportToCSV(rows, `employees-${new Date().toISOString().slice(0, 10)}.csv`);
}