/**
 * utils/validators.js
 * Form validation rule functions.
 * Each returns null (valid) or an error message string.
 */

import { isValidTime } from './timeUtils.js';
import { parseDate }   from './dateFormatter.js';

// ─── primitives ───────────────────────────────────────────────────────────────

export const required = (label = 'This field') =>
  (v) => (!v && v !== 0) ? `${label} is required` : null;

export const minLength = (min, label = 'This field') =>
  (v) => String(v || '').trim().length < min
    ? `${label} must be at least ${min} characters`
    : null;

export const maxLength = (max, label = 'This field') =>
  (v) => String(v || '').trim().length > max
    ? `${label} must be at most ${max} characters`
    : null;

export const minValue = (min, label = 'Value') =>
  (v) => (parseFloat(v) || 0) < min ? `${label} must be at least ${min}` : null;

export const maxValue = (max, label = 'Value') =>
  (v) => (parseFloat(v) || 0) > max ? `${label} must be at most ${max}` : null;

// ─── specific field validators ────────────────────────────────────────────────

export function validateEmail(email) {
  if (!email) return 'Email is required';
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())
    ? null
    : 'Enter a valid email address';
}

export function validatePassword(password) {
  if (!password) return 'Password is required';
  if (String(password).length < 8) return 'Password must be at least 8 characters';
  return null;
}

export function validateEmployeeNumber(empNo) {
  if (!empNo) return 'Employee number is required';
  return /^[A-Za-z0-9_-]+$/.test(String(empNo).trim())
    ? null
    : 'Employee number can only contain letters, numbers, _ and -';
}

export function validateTime(time, label = 'Time') {
  if (!time) return `${label} is required`;
  return isValidTime(time) ? null : `${label} must be in HH:mm format`;
}

export function validateDate(dateStr, label = 'Date') {
  if (!dateStr) return `${label} is required`;
  return parseDate(dateStr) ? null : `${label} must be in dd/mm/yyyy or YYYY-MM-DD format`;
}

export function validateDateRange(startStr, endStr) {
  const start = parseDate(startStr);
  const end   = parseDate(endStr);
  if (!start) return 'Start date is invalid';
  if (!end)   return 'End date is invalid';
  if (end < start) return 'End date must be on or after start date';
  return null;
}

export function validateHourlyRate(rate) {
  if (!rate && rate !== 0) return 'Hourly rate is required';
  const n = parseFloat(rate);
  if (isNaN(n) || n < 0)  return 'Hourly rate must be a positive number';
  return null;
}

export function validateMonthlySalary(salary, salaryType) {
  if (salaryType !== 'monthly') return null;
  if (!salary && salary !== 0)  return 'Monthly salary is required for monthly employees';
  const n = parseFloat(salary);
  if (isNaN(n) || n <= 0)       return 'Monthly salary must be a positive number';
  return null;
}

export function validateShift(shift) {
  if (!shift?.start) return 'Shift start time is required';
  if (!shift?.end)   return 'Shift end time is required';
  if (!isValidTime(shift.start)) return 'Shift start must be HH:mm';
  if (!isValidTime(shift.end))   return 'Shift end must be HH:mm';
  if (shift.start === shift.end) return 'Shift start and end cannot be the same';
  return null;
}

// ─── form-level validators ────────────────────────────────────────────────────

/**
 * Validate the Create Employee form.
 * Returns an object of { fieldName: errorMessage } — empty means valid.
 */
export function validateCreateEmployee(form) {
  const errors = {};
  const check  = (field, fn) => {
    const err = fn(form[field]);
    if (err) errors[field] = err;
  };

  check('firstName',      required('First name'));
  check('lastName',       required('Last name'));
  check('email',          validateEmail);
  check('employeeNumber', validateEmployeeNumber);
  check('department',     required('Department'));
  check('joiningDate',    (v) => validateDate(v, 'Joining date'));

  const shiftErr = validateShift(form.shift);
  if (shiftErr) errors.shift = shiftErr;

  if (form.salaryType === 'monthly') {
    const err = validateMonthlySalary(form.monthlySalary, 'monthly');
    if (err) errors.monthlySalary = err;
  } else {
    const err = validateHourlyRate(form.hourlyRate);
    if (err) errors.hourlyRate = err;
  }

  return errors;
}

/**
 * Validate the Leave Request form.
 */
export function validateLeaveRequest(form) {
  const errors = {};
  if (!form.fromDate) errors.fromDate = 'From date is required';
  if (!form.toDate)   errors.toDate   = 'To date is required';
  if (!form.leaveType) errors.leaveType = 'Leave type is required';
  if (!form.reason?.trim()) errors.reason = 'Reason is required';

  const rangeErr = validateDateRange(form.fromDate, form.toDate);
  if (rangeErr && !errors.fromDate && !errors.toDate) {
    errors.toDate = rangeErr;
  }

  return errors;
}

/**
 * Validate the Correction Request form.
 */
export function validateCorrectionRequest(form) {
  const errors = {};
  if (!form.date) {
    errors.date = 'Date is required';
  } else {
    const err = validateDate(form.date, 'Date');
    if (err) errors.date = err;
  }

  if (!form.correctedInTime && !form.correctedOutTime) {
    errors.correctedInTime = 'Provide at least one of corrected in time or out time';
  }
  if (form.correctedInTime) {
    const err = validateTime(form.correctedInTime, 'Corrected in time');
    if (err) errors.correctedInTime = err;
  }
  if (form.correctedOutTime) {
    const err = validateTime(form.correctedOutTime, 'Corrected out time');
    if (err) errors.correctedOutTime = err;
  }
  if (!form.reason?.trim()) errors.reason = 'Reason is required';

  return errors;
}

export default {
  required,
  minLength,
  maxLength,
  minValue,
  maxValue,
  validateEmail,
  validatePassword,
  validateEmployeeNumber,
  validateTime,
  validateDate,
  validateDateRange,
  validateHourlyRate,
  validateMonthlySalary,
  validateShift,
  validateCreateEmployee,
  validateLeaveRequest,
  validateCorrectionRequest
};