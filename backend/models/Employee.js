// models/Employee.js
import mongoose from "mongoose";
import bcryptjs from "bcryptjs";

const SYSTEM_ROLES = ["owner", "superadmin"];
const PAYROLL_ROLES = ["admin", "employee", "hybrid"];

const uploadedFileSchema = {
  fileId: { type: mongoose.Schema.Types.ObjectId, default: null }, // was: url
  fileName: { type: String, default: null },
  uploadedAt: { type: Date, default: null },
};

const employeeSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true, // unique index already implies a B-tree index
      lowercase: true,
      index: true,
    },

    profilePicture: {
      fileId: { type: mongoose.Schema.Types.ObjectId, default: null }, // GridFS file _id
      fileName: { type: String, default: null },
      mimeType: {
        type: String,
        default: null,
        enum: [
          "image/jpeg",
          "image/jpg",
          "image/png",
          "image/gif",
          "image/webp",
          null,
        ],
      },
      uploadedAt: { type: Date, default: null },
    },

    employeeNumber: { type: String, required: true, unique: true, index: true },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },

    department: {
      type: String,
      enum: ["IT", "Customer Support", "Manager", "Marketing", "HR", "Finance"],
      required: true,
    },

    role: {
      type: String,
      enum: ["superadmin", "admin", "employee", "hybrid", "owner"],
      default: "employee",
      index: true,
    },

    joiningDate: { type: Date, required: true },

    shift: {
      start: {
        type: String,
        default: null,
        validate: {
          validator: (v) =>
            v === null ||
            v === "" ||
            /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(v),
          message: "Shift time must be HH:mm (24-hour)",
        },
      },
      end: {
        type: String,
        default: null,
        validate: {
          validator: (v) =>
            v === null ||
            v === "" ||
            /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(v),
          message: "Shift time must be HH:mm (24-hour)",
        },
      },
      break: { type: Number, default: 60 }, // in minutes
    },
    leftBusiness: {
      isLeft: { type: Boolean, default: false, index: true },
      leftDate: { type: Date, default: null },
      scheduledDeletion: { type: Date, default: null, index: true },
      reason: { type: String, default: "", maxlength: 500 },
      markedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Employee",
        default: null,
      },
      reinstatedAt: { type: Date, default: null },
      reinstatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Employee",
        default: null,
      },
    },

    salaryType: {
      type: String,
      enum: ["hourly", "monthly", null],
      default: null,
    },
    hourlyRate: { type: Number, default: null },
    monthlySalary: { type: Number, default: null },

    status: {
      type: String,
      enum: ["Active", "Inactive", "Frozen"],
      default: "Inactive",
      index: true,
    },

    isArchived: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false },

    passwordChangedAt: { type: Date },
    password: String,
    tempPassword: String,
    inviteToken: String,
    inviteTokenExpires: Date,

    bank: {
      bankName: String,
      accountName: String,
      accountNumber: String,
    },

    emergencyContact: {
      name: { type: String, default: "" },
      relationship: { type: String, default: "" },
      phone: { type: String, default: "" },
    },

    address: {
      street: { type: String, default: "" },
      city: { type: String, default: "" },
      state: { type: String, default: "" },
      zip: { type: String, default: "" },
      country: { type: String, default: "" },
    },

    idCard: {
      front: uploadedFileSchema,
      back: uploadedFileSchema,
    },
  },
  { timestamps: true },
);

// ─── Compound indexes ─────────────────────────────────────────────────────────
//
// Rule of thumb: put the highest-cardinality / most-selective field first.
// These cover the three most common cross-field query patterns:

// 1. "Give me all active admins" — dashboard, permission guards
employeeSchema.index({ status: 1, role: 1 });

// 2. "Give me active employees in department X" — department head views, HR
employeeSchema.index({ department: 1, status: 1 });

// 3. Soft-delete safety: almost every query should add isDeleted: false.
//    Putting it first means every other query can prepend it cheaply.
employeeSchema.index({ isDeleted: 1, status: 1 });

// ─── Sparse indexes ───────────────────────────────────────────────────────────
//
// Sparse indexes skip documents where the field is null/missing, keeping the
// index small for fields that are only populated on a subset of documents.

// inviteToken: only set during onboarding; sparse avoids indexing every null.
employeeSchema.index(
  { inviteToken: 1 },
  { sparse: true, name: "idx_inviteToken_sparse" },
);

// inviteTokenExpires: pair with the token — cron cleanup + expiry checks.
employeeSchema.index(
  { inviteTokenExpires: 1 },
  { sparse: true, name: "idx_inviteTokenExpires_sparse" },
);

// scheduledDeletion: only populated for departing employees; sparse keeps the
// index tiny and cron lookups ($lte: now) near-instant.
employeeSchema.index(
  { "leftBusiness.scheduledDeletion": 1 },
  { sparse: true, name: "idx_scheduledDeletion_sparse" },
);

// ─── Cross-field validation ───────────────────────────────────────────────────
employeeSchema.pre("validate", function (next) {
  if (PAYROLL_ROLES.includes(this.role)) {
    const errors = [];
    if (!this.shift?.start) errors.push("shift.start is required");
    if (!this.shift?.end)   errors.push("shift.end is required");
    if (!this.salaryType) {
      errors.push("salaryType is required");
    } else {
      if (this.salaryType === "hourly") {
        if (!this.hourlyRate || this.hourlyRate <= 0)
          errors.push("hourlyRate is required and must be > 0");
      }
      if (this.salaryType === "monthly") {
        if (!this.monthlySalary || this.monthlySalary <= 0)
          errors.push("monthlySalary is required and must be > 0 for monthly salary type");
      }
    }
    if (errors.length) {
      return next(
        new mongoose.Error.ValidationError(
          Object.assign(new Error(errors.join("; ")), { name: "ValidationError" }),
        ),
      );
    }
  }
  next();
});

// ─── Password hashing ─────────────────────────────────────────────────────────
employeeSchema.pre("save", async function (next) {
  if (!this.isModified("password") && !this.isModified("tempPassword"))
    return next();
  try {
    if (this.isModified("password") && this.password) {
      const salt = await bcryptjs.genSalt(10);
      this.password = await bcryptjs.hash(this.password, salt);
      this.passwordChangedAt = new Date().toLocaleString("en-US", {timeZone: "Asia/Karachi"});
    }
    if (this.isModified("tempPassword") && this.tempPassword) {
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
  return (
    Math.floor((Date.now() - new Date(this.joiningDate)) / 86_400_000) >= 90
  );
};

employeeSchema.methods.getDaysUntilLeaveEligible = function () {
  return Math.max(
    0,
    90 - Math.floor((Date.now() - new Date(this.joiningDate)) / 86_400_000),
  );
};

employeeSchema.methods.getEffectiveHourlyRate = function (
  workingDaysInPeriod = 21,
  scheduledHoursPerDay = 8,
) {
  if (SYSTEM_ROLES.includes(this.role)) return null;
  if (this.salaryType === "monthly" && this.monthlySalary)
    return this.monthlySalary / (workingDaysInPeriod * scheduledHoursPerDay);
  return this.hourlyRate;
};

employeeSchema.methods.isSystemAccount = function () {
  return SYSTEM_ROLES.includes(this.role);
};
employeeSchema.methods.isPayrollAccount = function () {
  return PAYROLL_ROLES.includes(this.role);
};
employeeSchema.methods.hasCompleteIdCard = function () {
  return !!(this.idCard?.front?.fileId && this.idCard?.back?.fileId);
};

const Employee = mongoose.model("Employee", employeeSchema);
export default Employee;
