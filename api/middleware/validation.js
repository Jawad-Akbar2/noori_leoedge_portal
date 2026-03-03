// middleware/validation.js

import { body, query, validationResult } from 'express-validator';

// ─── reusable field validators ────────────────────────────────────────────────

export const validateTime = (fieldName) =>
  body(fieldName)
    .optional()
    .matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage(`${fieldName} must be in HH:mm format (24-hour)`);

export const validateEmail = () =>
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Invalid email format');

// ─── employee creation ────────────────────────────────────────────────────────

export const validateEmployeeCreation = [
  body('email')
    .isEmail().withMessage('Valid email required')
    .normalizeEmail(),

  body('employeeNumber')
    .trim().notEmpty().withMessage('Employee number required'),

  body('firstName')
    .trim().notEmpty().withMessage('First name required'),

  body('lastName')
    .trim().notEmpty().withMessage('Last name required'),

  body('department')
    .isIn(['IT', 'Customer Support', 'Manager', 'Marketing', 'HR', 'Finance'])
    .withMessage('Valid department required'),

  body('joiningDate')
    .notEmpty().withMessage('Joining date required')
    .isISO8601().withMessage('Joining date must be a valid date (ISO 8601 or YYYY-MM-DD)'),

  body('shift.start')
    .matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Shift start must be HH:mm'),

  body('shift.end')
    .matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Shift end must be HH:mm'),

  // salaryType is optional on creation (defaults to 'hourly')
  body('salaryType')
    .optional()
    .isIn(['hourly', 'monthly'])
    .withMessage("salaryType must be 'hourly' or 'monthly'"),

  body('hourlyRate')
    .isFloat({ min: 0 })
    .withMessage('Hourly rate must be 0 or greater'),

  // monthlySalary only required when salaryType === 'monthly'
  body('monthlySalary')
    .optional({ nullable: true })
    .isFloat({ min: 0 })
    .withMessage('Monthly salary must be 0 or greater')
];

// ─── attendance update ────────────────────────────────────────────────────────
// Used by the admin attendance edit endpoint (req #3).

export const validateAttendanceUpdate = [
  body('status')
    .isIn(['Present', 'Late', 'Leave', 'Absent'])
    .withMessage('status must be Present | Late | Leave | Absent'),

  body('inTime')
    .optional({ nullable: true })
    .matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('inTime must be HH:mm'),

  body('outTime')
    .optional({ nullable: true })
    .matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('outTime must be HH:mm'),

  body('outNextDay')
    .optional()
    .isBoolean()
    .withMessage('outNextDay must be a boolean'),

  body('otHours')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('otHours must be 0 or greater'),

  body('otMultiplier')
    .optional()
    .isIn([1, 1.5, 2])
    .withMessage('otMultiplier must be 1, 1.5, or 2'),

  body('otReason')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('otReason cannot be blank when provided'),

  body('deduction')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('deduction must be 0 or greater'),

  body('deductionReason')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('deductionReason cannot be blank when provided')
];

// ─── leave request ────────────────────────────────────────────────────────────

export const validateLeaveRequest = [
  body('fromDate')
    .notEmpty().withMessage('fromDate required')
    .isISO8601().withMessage('fromDate must be a valid date'),

  body('toDate')
    .notEmpty().withMessage('toDate required')
    .isISO8601().withMessage('toDate must be a valid date')
    .custom((toDate, { req }) => {
      if (new Date(toDate) < new Date(req.body.fromDate)) {
        throw new Error('toDate must be on or after fromDate');
      }
      return true;
    }),

  body('leaveType')
    .isIn(['Holiday Leave', 'Sick Leave', 'Casual Leave'])
    .withMessage('leaveType must be Holiday Leave | Sick Leave | Casual Leave'),

  body('reason')
    .trim().notEmpty().withMessage('reason required')
];

// ─── payroll / salary date-range query ───────────────────────────────────────
// Used by admin payroll page and employee salary page (req #1, #7).

export const validateDateRangeQuery = [
  query('startDate')
    .notEmpty().withMessage('startDate query param required')
    .isISO8601().withMessage('startDate must be a valid date (YYYY-MM-DD)'),

  query('endDate')
    .notEmpty().withMessage('endDate query param required')
    .isISO8601().withMessage('endDate must be a valid date (YYYY-MM-DD)')
    .custom((endDate, { req }) => {
      if (new Date(endDate) < new Date(req.query.startDate)) {
        throw new Error('endDate must be on or after startDate');
      }
      return true;
    })
];

// ─── error collector middleware ───────────────────────────────────────────────

export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation Error',
      // e.path is the correct field in express-validator v7+ (e.param is deprecated)
      errors: errors.array().map(e => ({ field: e.path ?? e.param, message: e.msg }))
    });
  }
  next();
};

// default export for convenience
export default {
  validateTime,
  validateEmail,
  validateEmployeeCreation,
  validateAttendanceUpdate,
  validateLeaveRequest,
  validateDateRangeQuery,
  handleValidationErrors
};