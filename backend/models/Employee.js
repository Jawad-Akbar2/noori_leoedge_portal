// models/Employee.js

import mongoose from "mongoose";
import bcryptjs from "bcryptjs";

const SYSTEM_ROLES = ["superadmin"];
const PAYROLL_ROLES = ["admin", "employee", "hybrid"];

// ─── Reusable sub-schema for a single uploaded file ───────────────────────────
const uploadedFileSchema = {
  url: { type: String, default: null },
  fileName: { type: String, default: null },
  uploadedAt: { type: Date, default: null },
};

const employeeSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      index: true,
    },

    profilePicture: {
      data: {
        type: String,
        default: null,
        validate: {
          validator: function (v) {
            if (!v) return true;
            const base64Regex = /^data:image\/(jpeg|jpg|png|gif|webp);base64,/;
            if (!base64Regex.test(v)) return false;
            const base64Size = v.length * 0.75;
            return base64Size <= 2 * 1024 * 1024;
          },
          message: "Invalid image format or size exceeds 2MB",
        },
      },
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
      enum: ["superadmin", "admin", "employee", "hybrid"],
      default: "employee",
      index: true,
    },

    joiningDate: { type: Date, required: true },

    // ── Shift ─────────────────────────────────────────────────────────────────
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
    },

    leftBusiness: {
      isLeft: { type: Boolean, default: false, index: true },
      leftDate: { type: Date, default: null },
      // Exact timestamp at which the cron job is allowed to delete the document.
      scheduledDeletion: { type: Date, default: null, index: true },
      // Free-text reason stored for audit trail (optional, max 500 chars).
      reason: { type: String, default: "", maxlength: 500 },
      // Who performed the action (employee _id of the acting admin/superadmin).
      markedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Employee",
        default: null,
      },
      // When the employee was reinstated (if applicable).
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
    hourlyRate: { type: Number, min: 0, default: null },
    monthlySalary: { type: Number, min: 0, default: null },

    status: {
      type: String,
      enum: ["Active", "Inactive", "Frozen"],
      default: "Inactive",
      index: true,
    },
    isArchived: { type: Boolean, default: false },

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

    // ── Emergency contact (optional, self-reported) ───────────────────────────
    emergencyContact: {
      name: { type: String, default: "" },
      relationship: { type: String, default: "" },
      phone: { type: String, default: "" },
    },

    // ── Residential address (optional, self-reported) ─────────────────────────
    address: {
      street: { type: String, default: "" },
      city: { type: String, default: "" },
      state: { type: String, default: "" },
      zip: { type: String, default: "" },
      country: { type: String, default: "" },
    },

    // ── ID card — front AND back images (both optional individually) ──────────
    // URLs / storage paths resolved by upload middleware.
    // Both sides are stored independently; neither is strictly required by the
    // schema — validation of "both required" is enforced at the route level.
    idCard: {
      front: uploadedFileSchema,
      back: uploadedFileSchema,
    },

    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true },
);

// ─── Cross-field validation ───────────────────────────────────────────────────

employeeSchema.pre("validate", function (next) {
  if (SYSTEM_ROLES.includes(this.role)) {
    this.salaryType = null;
    this.hourlyRate = null;
    this.monthlySalary = null;
    if (this.shift) {
      this.shift.start = null;
      this.shift.end = null;
    }
    return next();
  }

  if (PAYROLL_ROLES.includes(this.role)) {
    const errors = [];
    if (!this.shift?.start) errors.push("shift.start is required");
    if (!this.shift?.end) errors.push("shift.end is required");
    if (!this.salaryType) {
      errors.push("salaryType is required");
    } else {
      if (!this.hourlyRate || this.hourlyRate <= 0)
        errors.push("hourlyRate is required and must be > 0");
      if (
        this.salaryType === "monthly" &&
        (!this.monthlySalary || this.monthlySalary <= 0)
      ) {
        errors.push(
          "monthlySalary is required and must be > 0 for monthly salary type",
        );
      }
    }
    if (errors.length) {
      return next(
        new mongoose.Error.ValidationError(
          Object.assign(new Error(errors.join("; ")), {
            name: "ValidationError",
          }),
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
      this.passwordChangedAt = new Date();
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
  const days = Math.floor(
    (Date.now() - new Date(this.joiningDate)) / 86_400_000,
  );
  return days >= 90;
};

employeeSchema.methods.getDaysUntilLeaveEligible = function () {
  const days = Math.floor(
    (Date.now() - new Date(this.joiningDate)) / 86_400_000,
  );
  return Math.max(0, 90 - days);
};

employeeSchema.methods.getEffectiveHourlyRate = function (
  workingDaysInPeriod = 26,
  scheduledHoursPerDay = 8,
) {
  if (SYSTEM_ROLES.includes(this.role)) return null;
  if (this.salaryType === "monthly" && this.monthlySalary) {
    return this.monthlySalary / (workingDaysInPeriod * scheduledHoursPerDay);
  }
  return this.hourlyRate;
};

employeeSchema.methods.isSystemAccount = function () {
  return SYSTEM_ROLES.includes(this.role);
};
employeeSchema.methods.isPayrollAccount = function () {
  return PAYROLL_ROLES.includes(this.role);
};

/** True if both front and back of ID card have been uploaded */
employeeSchema.methods.hasCompleteIdCard = function () {
  return !!(this.idCard?.front?.url && this.idCard?.back?.url);
};

const Employee = mongoose.model("Employee", employeeSchema);
export default Employee;
