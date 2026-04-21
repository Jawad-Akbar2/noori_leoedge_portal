// models/LeaveRequest.js
import mongoose from "mongoose";

const leaveRequestSchema = new mongoose.Schema(
  {
    // ── Identity ──────────────────────────────────────────────────────────────
    empId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      "Employee",
      required: true,
      index:    true,
    },
    empNumber:  { type: String, required: true },
    empName:    { type: String, required: true },
    department: { type: String, required: true },

    // ── Leave details ─────────────────────────────────────────────────────────
    leaveType: {
      type:     String,
      enum:     ["Holiday Leave", "Sick Leave", "Casual Leave"],
      required: true,
    },
    fromDate:  { type: Date, required: true, index: true },
    toDate:    { type: Date, required: true, index: true },
    totalDays: { type: Number, default: 1, min: 1 },
    reason:    { type: String, required: true, trim: true },

    // ── Approval workflow ─────────────────────────────────────────────────────
    status: {
      type:    String,
      enum:    ["Pending", "Approved", "Rejected"],
      default: "Pending",
      index:   true,
    },
    approvedBy:      { type: mongoose.Schema.Types.ObjectId, ref: "Employee", default: null },
    approvedAt:      { type: Date, default: null },
    rejectionReason: { type: String, default: null },

    affectedAttendanceDates: { type: [String], default: [] },
    eligibilityChecked:      { type: Boolean,  default: false },
    isDeleted:               { type: Boolean,  default: false, index: true },
  },
  { timestamps: true },
);

// ─── Existing compound index ──────────────────────────────────────────────────
// Employee leave history with date range — e.g. "all leaves for emp X in Q1".
leaveRequestSchema.index({ empId: 1, fromDate: 1, toDate: 1 });

// ─── New compound indexes ─────────────────────────────────────────────────────

// Admin approval queue sorted oldest-first. Without createdAt in the index,
// MongoDB filters on status but sorts in memory. This index serves both in one
// B-tree pass — identical rationale to CorrectionRequest.
leaveRequestSchema.index(
  { status: 1, createdAt: 1 },
  { name: "idx_status_createdAt" },
);

// Department manager queue: "show me Pending leave requests for my department."
leaveRequestSchema.index(
  { department: 1, status: 1 },
  { name: "idx_department_status" },
);

// Employee self-service: "show me my own Pending / Approved leaves."
// The existing empId+fromDate+toDate index requires a date predicate to be
// useful. This one covers the very common statusless-date query — e.g. the
// employee dashboard that shows all current Pending requests without a date filter.
leaveRequestSchema.index(
  { empId: 1, status: 1 },
  { name: "idx_empId_status" },
);

// HR leave-type reports: "how many Sick Leave requests are Approved this year?"
// leaveType has only 3 values, but combined with status (3 values) it narrows
// the scan to ~1/9 of the collection before applying any date filter.
leaveRequestSchema.index(
  { leaveType: 1, status: 1 },
  { name: "idx_leaveType_status" },
);

// ─── Sparse index ─────────────────────────────────────────────────────────────

// approvedBy + approvedAt: both null on every Pending/Rejected document.
// Sparse keeps the index small and serves audit queries like
// "everything manager X approved in June" without scanning unapproved docs.
leaveRequestSchema.index(
  { approvedBy: 1, approvedAt: 1 },
  { sparse: true, name: "idx_approvedBy_approvedAt_sparse" },
);

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