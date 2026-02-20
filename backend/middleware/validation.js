/**
 * Input Validation Middleware
 * Validates common input patterns
 */

import { body, validationResult } from 'express-validator';

// Validate time format (HH:mm)
const validateTime = (fieldName) => {
  return body(fieldName)
    .optional()
    .matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage(`${fieldName} must be in HH:mm format (24-hour)`);
};

// Validate email
const validateEmail = () => {
  return body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Invalid email format');
};

// Validate employee creation
const validateEmployeeCreation = [
  body('email').isEmail().withMessage('Valid email required'),
  body('employeeNumber').trim().notEmpty().withMessage('Employee number required'),
  body('firstName').trim().notEmpty().withMessage('First name required'),
  body('lastName').trim().notEmpty().withMessage('Last name required'),
  body('joiningDate').isISO8601().withMessage('Valid date required'),
  body('department').isIn(['IT', 'Customer Support', 'Manager', 'Marketing', 'HR', 'Finance']).withMessage('Valid department required'),
  body('shift.start').matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Valid shift start time required'),
  body('shift.end').matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Valid shift end time required'),
  body('hourlyRate').isFloat({ min: 0 }).withMessage('Hourly rate must be positive')
];

// Validate attendance update
const validateAttendanceUpdate = [
  body('status').isIn(['Present', 'Late', 'Leave', 'Absent']).withMessage('Valid status required'),
  body('inTime').optional().matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Valid in time required'),
  body('outTime').optional().matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Valid out time required'),
  body('otHours').optional().isFloat({ min: 0 }).withMessage('OT hours must be positive'),
  body('deduction').optional().isFloat({ min: 0 }).withMessage('Deduction must be positive')
];

// Validate leave request
const validateLeaveRequest = [
  body('fromDate').isISO8601().withMessage('Valid from date required'),
  body('toDate').isISO8601().withMessage('Valid to date required'),
  body('leaveType').isIn(['Holiday Leave', 'Sick Leave', 'Casual Leave']).withMessage('Valid leave type required'),
  body('reason').trim().notEmpty().withMessage('Reason required')
];

// Middleware to handle validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      message: 'Validation Error',
      errors: errors.array().map(e => ({ field: e.param, message: e.msg }))
    });
  }
  next();
};

export {
  validateTime,
  validateEmail,
  validateEmployeeCreation,
  validateAttendanceUpdate,
  validateLeaveRequest,
  handleValidationErrors
};

export default { validateTime, validateEmail, validateEmployeeCreation, validateAttendanceUpdate, validateLeaveRequest, handleValidationErrors };