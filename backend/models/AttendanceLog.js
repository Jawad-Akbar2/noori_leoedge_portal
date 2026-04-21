// models/AttendanceLog.js
import mongoose from "mongoose";

const deductionDetailSchema = new mongoose.Schema(
  {
    amount:    { type: Number, required: true, min: 0 },
    reason:    { type: String, required: true, trim: true },
    type: {
      type:    String,
      enum:    ["late_login","early_logout","fixed_penalty","hourly_penalty","ncns_penalty","manual"],
      default: "manual",
    },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const otDetailSchema = new mongoose.Schema(
  {
    type:      { type: String, enum: ["manual", "calc"], default: "manual" },
    amount:    { type: Number, default: 0 },
    hours:     { type: Number, default: 0 },
    rate: {
      type:    Number,
      default: 1,
      validate: {
        validator: (v) => [1, 1.5, 2].includes(v),
        message:   "rate must be 1, 1.5, or 2",
      },
    },
    reason:    { type: String, required: true, trim: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const attendanceLogSchema = new mongoose.Schema(
  {
    date: {
      type:     Date,
      required: true,
      index:    true,
    },
    empId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      "Employee",
      required: true,
      index:    true,
    },
    empNumber: {
      type:     String,
      required: true,
      index:    true,
    },
    empName:    { type: String, required: true },
    department: { type: String, required: true },

    status: {
      type:    String,
      enum:    ["Present","Late","Leave","OffDay","NCNS"],
      default: "OffDay",
      index:   true,
    },

    inOut: {
      in: {
        type: String,
        validate: {
          validator: (v) => !v || /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(v),
          message:   "Invalid time format (HH:mm expected)",
        },
      },
      out: {
        type: String,
        validate: {
          validator: (v) => !v || /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(v),
          message:   "Invalid time format (HH:mm expected)",
        },
      },
      outNextDay: { type: Boolean, default: false },
    },

    shift: {
      start:       { type: String, required: true },
      end:         { type: String, required: true },
      isNightShift: { type: Boolean, default: false },
    },

    salaryType: { type: String, enum: ["hourly", "monthly"], required: true },
    hourlyRate:  { type: Number, required: true },

    financials: {
      hoursWorked:         { type: Number, default: 0 },
      scheduledHours:      { type: Number, default: 0 },
      lateMinutes:         { type: Number, default: 0, min: 0 },
      earlyLogoutMinutes:  { type: Number, default: 0, min: 0 },
      basePay:             { type: Number, default: 0 },
      deduction:           { type: Number, default: 0 },
      deductionDetails:    { type: [deductionDetailSchema], default: [] },
      otMultiplier:        { type: Number, default: 1, enum: [1, 1.5, 2] },
      otHours:             { type: Number, default: 0 },
      otAmount:            { type: Number, default: 0 },
      otDetails:           { type: [otDetailSchema], default: [] },
      finalDayEarning:     { type: Number, default: 0 },
    },

    manualOverride: { type: Boolean, default: false },

    metadata: {
      source: {
        type:    String,
        enum:    ["system","manual","csv","correction_approval","leave_approval"],
        default: "system",
      },
      notes:          String,
      lastUpdatedBy:  mongoose.Schema.Types.ObjectId,
      csvImportBatch: String,
      lastModifiedAt: { type: Date, default: Date.now },
    },

    isDeleted: { type: Boolean, default: false, index: true },
  },
  { timestamps: true },
);

// ─── Compound indexes ─────────────────────────────────────────────────────────

// Core uniqueness constraint: one log per employee per calendar date.
// Enforced at the DB level — prevents duplicates even if application logic has
// a bug. empId first (ObjectId = highest cardinality → fastest prune).
attendanceLogSchema.index(
  { empId: 1, date: 1 },
  { unique: true, name: "idx_empId_date_unique" },
);

// Employee history queries filtered by status — e.g. "all Late logs for emp X
// in March". Without this, MongoDB would hit the empId+date index then scan
// all docs for the employee to filter status.
attendanceLogSchema.index(
  { empId: 1, date: 1, status: 1 },
  { name: "idx_empId_date_status" },
);

// Already in schema — daily attendance reports, date-range scans by status.
attendanceLogSchema.index({ date: 1, status: 1 });

// Already in schema — HR lookups by employee number + date range.
attendanceLogSchema.index({ empNumber: 1, date: 1 });

// Department daily rollup for payroll: "all logs for dept IT on 2025-06-01".
// department has moderate cardinality (6 values in Employee) — still useful
// because it eliminates full collection scans for department-scoped reports.
attendanceLogSchema.index(
  { department: 1, date: 1 },
  { name: "idx_department_date" },
);

// Soft-delete safety prefix — every date-range scan should filter out deleted
// docs. isDeleted first because it's boolean (2 values) and most docs are false;
// the index quickly isolates the active set before scanning by date.
attendanceLogSchema.index(
  { isDeleted: 1, date: 1 },
  { name: "idx_isDeleted_date" },
);

// ─── Sparse indexes ───────────────────────────────────────────────────────────
// Sparse indexes skip documents where the field is null/missing/false, so they
// stay tiny for fields that are only set on a small subset of records.

// CSV import batch ID — only present on csv-sourced logs. Used for rollback
// ("delete all logs from batch X") and import audits.
attendanceLogSchema.index(
  { "metadata.csvImportBatch": 1 },
  { sparse: true, name: "idx_csvImportBatch_sparse" },
);

// Night shift flag — only true for a subset of employees. Payroll reports that
// compute overnight-crossing hours query this to narrow scope quickly.
attendanceLogSchema.index(
  { "shift.isNightShift": 1, date: 1 },
  { sparse: true, name: "idx_nightShift_date_sparse" },
);

// Manual overrides — only a small fraction of logs are manually corrected.
// Audit queries ("show me all manual overrides this month") are fast without
// a full collection scan.
attendanceLogSchema.index(
  { manualOverride: 1, date: 1 },
  { sparse: true, name: "idx_manualOverride_date_sparse" },
);

// ─── Pre-save: auto-detect night shift & recompute finalDayEarning ────────────
attendanceLogSchema.pre("save", function (next) {
  // 1. Detect night shift (shift end is earlier than shift start)
  if (this.shift?.start && this.shift?.end) {
    const [sh, sm] = this.shift.start.split(":").map(Number);
    const [eh, em] = this.shift.end.split(":").map(Number);
    this.shift.isNightShift = eh * 60 + em < sh * 60 + sm;
  }

  // 2. Recompute finalDayEarning so it's always consistent
  const f = this.financials;
  if (f) {
    f.finalDayEarning = Math.max(
      0,
      (f.basePay || 0) - (f.deduction || 0) + (f.otAmount || 0),
    );
  }

  // 3. Touch lastModifiedAt
  if (this.isModified() && this.metadata) {
    this.metadata.lastModifiedAt = new Date();
  }

  next();
});

const AttendanceLog = mongoose.model("AttendanceLog", attendanceLogSchema);
export default AttendanceLog;