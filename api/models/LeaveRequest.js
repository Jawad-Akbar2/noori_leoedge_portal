// models/LeaveRequest.js

import mongoose from "mongoose";

const leaveRequestSchema = new mongoose.Schema(
  {
    // ── Identity ──────────────────────────────────────────────────────────────
    empId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
      index: true,
    },
    empNumber: { type: String, required: true },
    empName: { type: String, required: true },
    department: { type: String, required: true }, // added for payroll/reporting consistency

    // ── Leave details ─────────────────────────────────────────────────────────
    leaveType: {
      type: String,
      enum: ["Holiday Leave", "Sick Leave", "Casual Leave"],
      required: true,
    },

    fromDate: { type: Date, required: true, index: true },
    toDate: { type: Date, required: true, index: true },

    /**
     * totalDays: inclusive calendar days covered by this leave request.
     * Auto-computed on save — do NOT set manually.
     * Formula: Math.floor((toDate - fromDate) / 86_400_000) + 1
     */
    totalDays: { type: Number, default: 1, min: 1 },

    reason: { type: String, required: true, trim: true },

    // ── Approval workflow ─────────────────────────────────────────────────────
    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected"],
      default: "Pending",
      index: true,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      default: null,
    },
    approvedAt: { type: Date, default: null },
    rejectionReason: { type: String, default: null },

    /**
     * affectedAttendanceDates: array of ISO date strings for every calendar day
     * in [fromDate, toDate] that falls within the employee's working schedule.
     *
     * Populated by the approval handler BEFORE it bulk-upserts AttendanceLog rows.
     * Stored here so a rollback (rejection after approval) knows exactly which
     * AttendanceLog documents need to be reverted.
     *
     * Example: ['2026-03-03', '2026-03-04', '2026-03-05']
     */
    affectedAttendanceDates: {
      type: [String],
      default: [],
    },

    // ── Eligibility snapshot (captured at submission time) ────────────────────
    /**
     * eligibilityChecked: true once the backend has verified the employee has
     * worked ≥ 90 days (Employee.isLeaveEligible()) at submission time.
     * Prevents a race condition where eligibility changes between submission
     * and approval.
     */
    eligibilityChecked: { type: Boolean, default: false },

    isDeleted: { type: Boolean, default: false, index: true },
  },
  { timestamps: true },
); // provides createdAt + updatedAt automatically

// ─── Compound index: fast lookup of an employee's leave history ───────────────
leaveRequestSchema.index({ empId: 1, fromDate: 1, toDate: 1 });

// ─── Pre-validate: toDate must be ≥ fromDate ──────────────────────────────────
leaveRequestSchema.pre("validate", function (next) {
  if (this.fromDate && this.toDate && this.toDate < this.fromDate) {
    return next(
      new mongoose.Error.ValidationError(
        Object.assign(
          new Error("toDate must be greater than or equal to fromDate"),
          { name: "ValidationError" },
        ),
      ),
    );
  }
  next();
});

// ─── Pre-save: auto-compute totalDays ────────────────────────────────────────
leaveRequestSchema.pre("save", function (next) {
  if (this.fromDate && this.toDate) {
    this.totalDays = Math.max(
      1,
      Math.floor((this.toDate - this.fromDate) / 86_400_000) + 1,
    );
  }
  next();
});

const LeaveRequest = mongoose.model("LeaveRequest", leaveRequestSchema);
export default LeaveRequest;
