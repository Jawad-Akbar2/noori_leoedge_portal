// models/Employee.js

import mongoose from 'mongoose';
import bcryptjs from 'bcryptjs';

// Roles that are login-only system accounts (no shift / salary / payroll).
// All other roles — admin, employee, hybrid — are full payroll employees.
const SYSTEM_ROLES = ['superadmin'];

// Roles that require shift + salary validation (i.e. everyone except system roles)
const PAYROLL_ROLES = ['admin', 'employee', 'hybrid'];

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
    // superadmin — login-only system account, no payroll
    // admin      — full employee with shift + salary + admin panel access
    // employee   — standard employee
    // hybrid     — employee with extra admin modules (attendance + notifications)
    enum: ['superadmin', 'admin', 'employee', 'hybrid'],
    default: 'employee',
    index: true
  },

  joiningDate: { type: Date, required: true },

  // ── Shift ─────────────────────────────────────────────────────────────────
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
  passwordChangedAt: { type: Date },

  password:           String,
  tempPassword:       String,
  inviteToken:        String,
  inviteTokenExpires: Date,

  bank: {
    bankName:      String,
    accountName:   String,
    accountNumber: String
  },

  // ── Emergency contact ──────────────────────────────────────────────────────
  // Self-reported by the employee via PUT /me.
  emergencyContact: {
    name:         { type: String, default: '' },
    relationship: { type: String, default: '' },  // e.g. "Spouse", "Parent", "Sibling"
    phone:        { type: String, default: '' },
  },

  // ── Residential address ───────────────────────────────────────────────────
  // Self-reported by the employee via PUT /me.
  address: {
    street:  { type: String, default: '' },
    city:    { type: String, default: '' },
    state:   { type: String, default: '' },
    zip:     { type: String, default: '' },
    country: { type: String, default: '' },
  },

  // ── ID card ───────────────────────────────────────────────────────────────
  // Stores the URL / storage path returned by your upload middleware
  // (Multer → S3, Cloudinary, local disk, etc.).
  // The actual file upload is handled outside this model — the route receives
  // the resolved URL and persists it here.
  idCard: {
    url:        { type: String, default: null },  // publicly accessible URL or storage key
    fileName:   { type: String, default: null },  // original file name for display
    uploadedAt: { type: Date,   default: null },
  },

  isDeleted: { type: Boolean, default: false }

}, { timestamps: true });

// ─── Cross-field validation ───────────────────────────────────────────────────

employeeSchema.pre('validate', function (next) {

  // ── System accounts (superadmin) ──
  // Strip all payroll fields — they don't have a shift or salary.
  if (SYSTEM_ROLES.includes(this.role)) {
    this.salaryType    = null;
    this.hourlyRate    = null;
    this.monthlySalary = null;
    if (this.shift) {
      this.shift.start = null;
      this.shift.end   = null;
    }
    return next();
  }

  // ── Payroll accounts (admin, employee, hybrid) ──
  // All three require shift + salaryType + hourlyRate.
  // hybrid is intentionally identical to employee in payroll terms —
  // the only difference is which UI modules they can access.
  if (PAYROLL_ROLES.includes(this.role)) {
    const errors = [];

    if (!this.shift?.start) errors.push('shift.start is required');
    if (!this.shift?.end)   errors.push('shift.end is required');

    if (!this.salaryType) {
      errors.push('salaryType is required');
    } else {
      if (!this.hourlyRate || this.hourlyRate <= 0) {
        errors.push('hourlyRate is required and must be > 0');
      }
      if (this.salaryType === 'monthly' && (!this.monthlySalary || this.monthlySalary <= 0)) {
        errors.push('monthlySalary is required and must be > 0 for monthly salary type');
      }
    }

    if (errors.length) {
      return next(new mongoose.Error.ValidationError(
        Object.assign(new Error(errors.join('; ')), { name: 'ValidationError' })
      ));
    }
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
      this.passwordChangedAt = new Date();
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

/** True only for login-only accounts that have no payroll record */
employeeSchema.methods.isSystemAccount = function () {
  return SYSTEM_ROLES.includes(this.role);
};

/** True for any role that appears in attendance + payroll reports */
employeeSchema.methods.isPayrollAccount = function () {
  return PAYROLL_ROLES.includes(this.role);
};

const Employee = mongoose.model('Employee', employeeSchema);
export default Employee;