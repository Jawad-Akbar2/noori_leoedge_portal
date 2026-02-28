// utils/constants.js

// ─── API ──────────────────────────────────────────────────────────────────────

export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
export const API_TIMEOUT  = 30_000;   // 30 s

// ─── pagination / UI ─────────────────────────────────────────────────────────

export const PAGINATION_LIMIT = 20;
export const TOAST_DURATION   = 3_000;  // ms

// ─── date / time formats ──────────────────────────────────────────────────────

export const DATE_FORMAT     = 'dd/mm/yyyy';   // display format used everywhere
export const TIME_FORMAT     = 'HH:mm';
export const DATETIME_FORMAT = 'dd/mm/yyyy HH:mm';

// ─── domain constants ─────────────────────────────────────────────────────────

export const DEPARTMENTS = [
  'IT',
  'Customer Support',
  'Manager',
  'Marketing',
  'HR',
  'Finance'
];

export const LEAVE_TYPES = [
  'Holiday Leave',
  'Sick Leave',
  'Casual Leave'
];

export const ATTENDANCE_STATUSES = ['Present', 'Late', 'Leave', 'Absent'];

export const OT_MULTIPLIERS = [
  { value: 1,   label: '1×  (Regular)' },
  { value: 1.5, label: '1.5× (Time & Half)' },
  { value: 2,   label: '2×  (Double Time)' }
];

export const SALARY_TYPES = [
  { value: 'hourly',  label: 'Hourly' },
  { value: 'monthly', label: 'Monthly' }
];

export const EMPLOYEE_STATUSES = ['Active', 'Inactive', 'Frozen'];

export const REQUEST_STATUSES  = ['Pending', 'Approved', 'Rejected'];

export const PAYROLL_STATUSES  = ['draft', 'approved', 'paid'];

// ─── roles ────────────────────────────────────────────────────────────────────

export const ROLES = {
  SUPERADMIN: 'superadmin',
  ADMIN:    'admin',
  EMPLOYEE: 'employee'
};

// ─── status → colour mapping (Tailwind classes) ───────────────────────────────

export const STATUS_COLORS = {
  // Attendance
  Present: 'text-green-600  bg-green-50  border-green-200',
  Late:    'text-yellow-600 bg-yellow-50 border-yellow-200',
  Leave:   'text-blue-600   bg-blue-50   border-blue-200',
  Absent:  'text-red-600    bg-red-50    border-red-200',

  // Requests
  Pending:  'text-yellow-600 bg-yellow-50 border-yellow-200',
  Approved: 'text-green-600  bg-green-50  border-green-200',
  Rejected: 'text-red-600    bg-red-50    border-red-200',

  // Payroll
  draft:    'text-gray-600   bg-gray-50   border-gray-200',
  approved: 'text-green-600  bg-green-50  border-green-200',
  paid:     'text-blue-600   bg-blue-50   border-blue-200',

  // Employee
  Active:   'text-green-600  bg-green-50  border-green-200',
  Inactive: 'text-gray-600   bg-gray-50   border-gray-200',
  Frozen:   'text-red-600    bg-red-50    border-red-200'
};

// ─── messages ─────────────────────────────────────────────────────────────────

export const MESSAGES = {
  SUCCESS: {
    LOGIN:  'Logged in successfully',
    SAVE:   'Saved successfully',
    CREATE: 'Created successfully',
    UPDATE: 'Updated successfully',
    DELETE: 'Deleted successfully'
  },
  ERROR: {
    NETWORK:      'Network error. Please try again.',
    UNAUTHORIZED: 'You are not authorized to perform this action.',
    NOT_FOUND:    'The requested resource was not found.',
    VALIDATION:   'Please check your input and try again.',
    SERVER:       'Something went wrong. Please try again later.'
  },
  INFO: {
    LOADING:    'Loading…',
    PROCESSING: 'Processing…',
    NO_DATA:    'No records found.'
  }
};

// ─── payroll CSV export column order ─────────────────────────────────────────
// Must match the field names returned by the backend (payroll.js routes).
// Do NOT use basicEarned / otTotal — backend returns baseSalary / totalOt.

export const PAYROLL_CSV_COLUMNS = [
  { key: 'empNumber',      label: 'Employee Number' },
  { key: 'name',           label: 'Name' },
  { key: 'department',     label: 'Department' },
  { key: 'salaryType',     label: 'Salary Type' },
  { key: 'workingDays',    label: 'Working Days' },
  { key: 'presentDays',    label: 'Present Days' },
  { key: 'leaveDays',      label: 'Leave Days' },
  { key: 'absentDays',     label: 'Absent Days' },
  { key: 'lateDays',       label: 'Late Days' },
  { key: 'baseSalary',     label: 'Base Salary' },
  { key: 'totalOtHours',   label: 'OT Hours' },
  { key: 'totalOt',        label: 'OT Amount' },
  { key: 'totalDeduction', label: 'Deductions' },
  { key: 'netPayable',     label: 'Net Payable' }
];