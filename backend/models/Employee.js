// models/Employee.js

import mongoose from 'mongoose';
import bcryptjs from 'bcryptjs';

// Roles that are system accounts — not payroll employees.
// They don't need salary, shift, or hourlyRate.
const SYSTEM_ROLES = ['admin', 'superadmin'];

const employeeSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    index: true
  },
  employeeNumber: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  firstName:  { type: String, required: true },
  lastName:   { type: String, required: true },

  department: {
    type: String,
    enum: ['IT', 'Customer Support', 'Manager', 'Marketing', 'HR', 'Finance'],
    required: true
  },
  role: {
    type: String,
    enum: ['admin', 'superadmin', 'employee'],
    default: 'employee',
    index: true
  },

  joiningDate: { type: Date, required: true },

  // ── Shift ─────────────────────────────────────────────────────────────────
  // Optional for admin/superadmin — they are not scheduled employees.
  shift: {
    start: {
      type: String,
      default: null,
      validate: {
        validator: v => v === null || v === '' || /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(v),
        message: 'Shift time must be HH:mm (24-hour)'
      }
    },
    end: {
      type: String,
      default: null,
      validate: {
        validator: v => v === null || v === '' || /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(v),
        message: 'Shift time must be HH:mm (24-hour)'
      }
    }
  },

  // ── Salary ────────────────────────────────────────────────────────────────
  // All three fields are optional at the schema level.
  // A custom validator (below) enforces them only for 'employee' role.
  //
  // salaryType:
  //   'hourly'  — paid per hour worked (hourlyRate × hoursWorked)
  //   'monthly' — fixed monthly salary; deductions/OT still applied on top
  //
  // hourlyRate:
  //   Required for employees. For monthly employees it is derived automatically:
  //     hourlyRate = monthlySalary / (workingDaysPerMonth × scheduledHoursPerDay)
  //   but an explicit override is also accepted.
  //
  // monthlySalary:
  //   Required when salaryType === 'monthly'.
  salaryType: {
    type: String,
    enum: ['hourly', 'monthly', null],
    default: null
  },
  hourlyRate: {
    type: Number,
    min: 0,
    default: null
  },
  monthlySalary: {
    type: Number,
    min: 0,
    default: null
  },

  status: {
    type: String,
    enum: ['Active', 'Inactive', 'Frozen'],
    default: 'Inactive',
    index: true
  },
  isArchived: { type: Boolean, default: false },

  password:           String,
  tempPassword:       String,
  inviteToken:        String,
  inviteTokenExpires: Date,

  bank: {
    bankName:      String,
    accountName:   String,
    accountNumber: String
  },

  isDeleted: { type: Boolean, default: false }
}, { timestamps: true });

// ─── Cross-field validation ───────────────────────────────────────────────────
// Enforce salary + shift only for regular employees.

employeeSchema.pre('validate', function (next) {
  if (SYSTEM_ROLES.includes(this.role)) {
    // System accounts: clear any accidentally-set salary/shift data
    this.salaryType    = null;
    this.hourlyRate    = null;
    this.monthlySalary = null;
    if (this.shift) {
      this.shift.start = null;
      this.shift.end   = null;
    }
    return next();
  }

  // ── Regular employees must have valid salary + shift ──────────────────────
  const errors = [];

  if (!this.shift?.start) errors.push('shift.start is required for employees');
  if (!this.shift?.end)   errors.push('shift.end is required for employees');

  if (!this.salaryType) {
    errors.push('salaryType is required for employees');
  } else {
    if (!this.hourlyRate || this.hourlyRate <= 0) {
      errors.push('hourlyRate is required and must be > 0 for employees');
    }
    if (this.salaryType === 'monthly' && (!this.monthlySalary || this.monthlySalary <= 0)) {
      errors.push('monthlySalary is required and must be > 0 for monthly employees');
    }
  }

  if (errors.length) {
    return next(new mongoose.Error.ValidationError(
      Object.assign(new Error(errors.join('; ')), { name: 'ValidationError' })
    ));
  }

  next();
});

// ─── Password hashing ─────────────────────────────────────────────────────────

employeeSchema.pre('save', async function (next) {
  if (!this.isModified('password') && !this.isModified('tempPassword')) return next();

  try {
    if (this.isModified('password') && this.password) {
      const salt = await bcryptjs.genSalt(10);
      this.password = await bcryptjs.hash(this.password, salt);
    }
    if (this.isModified('tempPassword') && this.tempPassword) {
      const salt = await bcryptjs.genSalt(10);
      this.tempPassword = await bcryptjs.hash(this.tempPassword, salt);
    }
    next();
  } catch (err) {
    next(err);
  }
});

// ─── Instance methods ─────────────────────────────────────────────────────────

employeeSchema.methods.comparePassword = async function (entered) {
  return bcryptjs.compare(entered, this.password);
};

employeeSchema.methods.isLeaveEligible = function () {
  const days = Math.floor((Date.now() - new Date(this.joiningDate)) / 86_400_000);
  return days >= 90;
};

employeeSchema.methods.getDaysUntilLeaveEligible = function () {
  const days = Math.floor((Date.now() - new Date(this.joiningDate)) / 86_400_000);
  return Math.max(0, 90 - days);
};

/**
 * Compute effective hourly rate for payroll calculations.
 * Returns null for system accounts (admin/superadmin) — they are not on payroll.
 *
 * @param {number} workingDaysInPeriod  – actual working days in the payroll period
 * @param {number} scheduledHoursPerDay – hours per scheduled shift (default 8)
 */
employeeSchema.methods.getEffectiveHourlyRate = function (
  workingDaysInPeriod = 26,
  scheduledHoursPerDay = 8
) {
  if (SYSTEM_ROLES.includes(this.role)) return null;

  if (this.salaryType === 'monthly' && this.monthlySalary) {
    return this.monthlySalary / (workingDaysInPeriod * scheduledHoursPerDay);
  }
  return this.hourlyRate;
};

/**
 * Returns true if this account is a system/admin account with no payroll data.
 */
employeeSchema.methods.isSystemAccount = function () {
  return SYSTEM_ROLES.includes(this.role);
};

const Employee = mongoose.model('Employee', employeeSchema);
export default Employee;