/**
 * utils/formatters.js
 * Display formatting helpers used throughout the UI.
 * Pure functions — no side effects, no imports from services.
 */

// ─── currency ─────────────────────────────────────────────────────────────────

/**
 * Format a number as PKR currency.
 * e.g. formatCurrency(1234.5) → "PKR 1,234.50"
 */
export function formatCurrency(amount, currency = 'PKR') {
  const n = parseFloat(amount) || 0;
  return `${currency} ${n.toLocaleString('en-PK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

/** Compact version — no currency symbol, 2dp */
export function formatAmount(amount) {
  return (parseFloat(amount) || 0).toLocaleString('en-PK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

// ─── hours ────────────────────────────────────────────────────────────────────

/**
 * Format decimal hours as "Xh Ym".
 * e.g. formatHours(8.5) → "8h 30m"
 */
export function formatHours(decimal) {
  const total = Math.abs(parseFloat(decimal) || 0);
  const h     = Math.floor(total);
  const m     = Math.round((total - h) * 60);
  return `${h}h ${m}m`;
}

/** Round to 2 decimal places */
export function round2(n) {
  return parseFloat((parseFloat(n) || 0).toFixed(2));
}

// ─── status display ───────────────────────────────────────────────────────────

/**
 * Get Tailwind class string for a status badge.
 * Covers: attendance statuses, request statuses, payroll statuses, employee statuses.
 */
export function getStatusClasses(status) {
  const map = {
    // Attendance
    Present:  'text-green-700  bg-green-50  border border-green-200',
    Late:     'text-yellow-700 bg-yellow-50 border border-yellow-200',
    Leave:    'text-blue-700   bg-blue-50   border border-blue-200',
    OffDay:   'text-red-700    bg-red-50    border border-red-200',
    ncns:     'text-gray-700   bg-gray-50   border border-gray-200',
    // Requests
    Pending:  'text-yellow-700 bg-yellow-50 border border-yellow-200',
    Approved: 'text-green-700  bg-green-50  border border-green-200',
    Rejected: 'text-red-700    bg-red-50    border border-red-200',
    // Payroll
    draft:    'text-gray-700   bg-gray-50   border border-gray-200',
    approved: 'text-green-700  bg-green-50  border border-green-200',
    paid:     'text-blue-700   bg-blue-50   border border-blue-200',
    // Employee
    Active:   'text-green-700  bg-green-50  border border-green-200',
    Inactive: 'text-gray-700   bg-gray-50   border border-gray-200',
    Frozen:   'text-red-700    bg-red-50    border border-red-200',
    // Performance
    Excellent:'text-purple-700 bg-purple-50 border border-purple-200',
    Good:     'text-green-700  bg-green-50  border border-green-200',
    Average:  'text-yellow-700 bg-yellow-50 border border-yellow-200',
    Poor:     'text-red-700    bg-red-50    border border-red-200'
  };
  return map[status] || 'text-gray-600 bg-gray-50 border border-gray-200';
}

// ─── name / text ──────────────────────────────────────────────────────────────

/** "john doe" → "John Doe" */
export function toTitleCase(str) {
  if (!str) return '';
  return String(str).replace(/\w\S*/g, w => w[0].toUpperCase() + w.slice(1).toLowerCase());
}

/** Truncate long strings with ellipsis */
export function truncate(str, maxLen = 30) {
  const s = String(str || '');
  return s.length > maxLen ? s.slice(0, maxLen - 1) + '…' : s;
}

/** "employee" → "Employee", "admin" → "Admin" */
export function formatRole(role) {
  return toTitleCase(role || '');
}

// ─── performance score ────────────────────────────────────────────────────────

/** Score 0–100 → Tailwind text color class */
export function scoreColor(score) {
  const n = Number(score) || 0;
  if (n >= 90) return 'text-purple-600';
  if (n >= 75) return 'text-green-600';
  if (n >= 60) return 'text-yellow-600';
  return 'text-red-600';
}

export default {
  formatCurrency,
  formatAmount,
  formatHours,
  round2,
  getStatusClasses,
  toTitleCase,
  truncate,
  formatRole,
  scoreColor
};