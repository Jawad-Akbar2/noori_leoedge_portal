// models/AttendanceLog.js
import mongoose from "mongoose";

const deductionDetailSchema = new mongoose.Schema(
  {
    amount: { type: Number, required: true, min: 0 },
    reason: { type: String, required: true, trim: true },
    type: {
      type: String,
      // late_login / early_logout kept for historical records & manual admin use.
      // hourly_penalty kept for manual admin deductions.
      // ncns_penalty is now the primary system-generated type.
      enum: [
        "late_login",
        "early_logout",
        "fixed_penalty",
        "hourly_penalty",
        "ncns_penalty",
        "manual",
        "early_insufficient",
        "late_penalty",
        "late_excess",
        "early_leave",
        "missing_punch",
      ],
      default: "manual",
    },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const otDetailSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["manual", "calc"], default: "manual" },
    amount: { type: Number, default: 0 },
    hours: { type: Number, default: 0 },
    rate: {
      type: Number,
      default: 1,
      validate: {
        validator: (v) => [1, 1.5, 2].includes(v),
        message: "rate must be 1, 1.5, or 2",
      },
    },
    reason: { type: String, required: true, trim: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const attendanceLogSchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      required: true,
      index: true,
    },
    empId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
      index: true,
    },
    empNumber: {
      type: String,
      required: true,
      index: true,
    },
    empName: { type: String, required: true },
    department: { type: String, required: true },
    status: {
      type: String,
      enum: ["Present", "Late", "Leave", "OffDay", "NCNS"],
      default: "OffDay",
      index: true,
    },
    inOut: {
      in: {
        type: String,
        validate: {
          validator: (v) => !v || /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(v),
          message: "Invalid time format (HH:mm expected)",
        },
      },
      out: {
        type: String,
        validate: {
          validator: (v) => !v || /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(v),
          message: "Invalid time format (HH:mm expected)",
        },
      },
      outNextDay: { type: Boolean, default: false },
    },
    shift: {
      start: { type: String, required: true },
      end: { type: String, required: true },
      isNightShift: { type: Boolean, default: false },
    },
    salaryType: { type: String, enum: ["hourly", "monthly"], required: true },
    // For monthly employees this stores perDaySalary (monthlySalary / daysInMonth).
    // For hourly employees this stores the raw hourly rate.
    // Field name kept as hourlyRate for backwards compatibility.
    hourlyRate: { type: Number, required: true },
    financials: {
      hoursWorked: { type: Number, default: 0 },
      scheduledHours: { type: Number, default: 0 },
      lateMinutes: { type: Number, default: 0, min: 0 },
      earlyLogoutMinutes: { type: Number, default: 0, min: 0 },
      basePay: { type: Number, default: 0 },
      deduction: { type: Number, default: 0 },
      deductionDetails: { type: [deductionDetailSchema], default: [] },
      otMultiplier: { type: Number, default: 1, enum: [1, 1.5, 2] },
      otHours: { type: Number, default: 0 },
      otAmount: { type: Number, default: 0 },
      otDetails: { type: [otDetailSchema], default: [] },
      finalDayEarning: { type: Number, default: 0 },
    },
    manualOverride: { type: Boolean, default: false },
    metadata: {
      source: {
        type: String,
        enum: [
          "system",
          "manual",
          "csv",
          "correction_approval",
          "leave_approval",
        ],
        default: "system",
      },
      notes: String,
      lastUpdatedBy: mongoose.Schema.Types.ObjectId,
      csvImportBatch: String,
      lastModifiedAt: { type: Date, default: Date.now },
    },
    isDeleted: { type: Boolean, default: false, index: true },
  },
  { timestamps: true },
);

// ─── Compound indexes ──────────────────────────────────────────────────────────
attendanceLogSchema.index(
  { empId: 1, date: 1 },
  { unique: true, name: "idx_empId_date_unique" },
);
attendanceLogSchema.index(
  { empId: 1, date: 1, status: 1 },
  { name: "idx_empId_date_status" },
);
attendanceLogSchema.index({ date: 1, status: 1 });
attendanceLogSchema.index({ empNumber: 1, date: 1 });
attendanceLogSchema.index(
  { department: 1, date: 1 },
  { name: "idx_department_date" },
);
attendanceLogSchema.index(
  { isDeleted: 1, date: 1 },
  { name: "idx_isDeleted_date" },
);

// ─── Sparse indexes ────────────────────────────────────────────────────────────
attendanceLogSchema.index(
  { "metadata.csvImportBatch": 1 },
  { sparse: true, name: "idx_csvImportBatch_sparse" },
);
attendanceLogSchema.index(
  { "shift.isNightShift": 1, date: 1 },
  { sparse: true, name: "idx_nightShift_date_sparse" },
);
attendanceLogSchema.index(
  { manualOverride: 1, date: 1 },
  { sparse: true, name: "idx_manualOverride_date_sparse" },
);

// ─── Pre-save: auto-detect night shift & recompute finalDayEarning ─────────────
attendanceLogSchema.pre("save", function (next) {
  // 1. Detect night shift
  if (this.shift?.start && this.shift?.end) {
    const [sh, sm] = this.shift.start.split(":").map(Number);
    const [eh, em] = this.shift.end.split(":").map(Number);
    this.shift.isNightShift = eh * 60 + em < sh * 60 + sm;
  }
  // 2. Recompute finalDayEarning for consistency
  const f = this.financials;
  if (f) {
    f.finalDayEarning =
      (f.basePay || 0) - (f.deduction || 0) + (f.otAmount || 0);
  }
  // 3. Touch lastModifiedAt
  if (this.isModified() && this.metadata) {
    this.metadata.lastModifiedAt = new Date().toLocaleString("en-US", {timeZone: "Asia/Karachi"});
  }
  next();
});

const AttendanceLog = mongoose.model("AttendanceLog", attendanceLogSchema);
export default AttendanceLog;
