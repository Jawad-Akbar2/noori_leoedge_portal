// models/PayrollRecord.js
import mongoose from 'mongoose';

const dailyBreakdownSchema = new mongoose.Schema(
  {
    date:            { type: Date,   required: true },
    status:          { type: String, enum: ['Present', 'Late', 'Leave', 'OffDay', 'NCNS'] },
    inTime:          String,
    outTime:         String,
    hoursWorked:     { type: Number, default: 0 },
    basePay:         { type: Number, default: 0 },
    deduction:       { type: Number, default: 0 },
    otHours:         { type: Number, default: 0 },
    otAmount:        { type: Number, default: 0 },
    finalDayEarning: { type: Number, default: 0 },
  },
  { _id: false },
);

const payrollRecordSchema = new mongoose.Schema(
  {
    // ── Identity ──────────────────────────────────────────────────────────────
    empId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'Employee',
      required: true,
      index:    true,
    },
    empNumber:  { type: String, required: true },
    empName:    { type: String, required: true },
    department: { type: String, required: true },

    // ── Pay period ────────────────────────────────────────────────────────────
    periodStart: { type: Date,   required: true, index: true },
    periodEnd:   { type: Date,   required: true, index: true },
    periodLabel: { type: String, index: true },

    // ── Attendance summary ────────────────────────────────────────────────────
    totalWorkingDays: { type: Number, default: 0 },
    presentDays:      { type: Number, default: 0 },
    lateDays:         { type: Number, default: 0 },
    OffDayDays:       { type: Number, default: 0 },
    leaveDays:        { type: Number, default: 0 },
    ncnsDays:         { type: Number, default: 0 },
    totalHoursWorked: { type: Number, default: 0 },

    // ── Salary components ────────────────────────────────────────────────────
    baseSalary:     { type: Number, default: 0, min: 0 },
    totalDeduction: { type: Number, default: 0, min: 0 },
    totalOtHours:   { type: Number, default: 0, min: 0 },
    totalOtAmount:  { type: Number, default: 0, min: 0 },
    totalBonus:     { type: Number, default: 0, min: 0 },
    bonusDetails: [
      {
         _id: { type: mongoose.Schema.Types.ObjectId, auto: true }, // ✅ IMPORTANT
        amount:    { type: Number, required: true, min: 0 },
        reason:    { type: String, required: true, trim: true },
        type: {
          type:    String,
          enum:    ['performance', 'attendance', 'manual'],
          default: 'manual',
        },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    netSalary: { type: Number, default: 0 },

    // ── Per-day breakdown ────────────────────────────────────────────────────
    dailyBreakdown: { type: [dailyBreakdownSchema], default: [] },

    // ── Status / workflow ─────────────────────────────────────────────────────
    status: {
      type:    String,
      enum:    ['draft', 'approved', 'paid'],
      default: 'draft',
      index:   true,
    },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    approvedAt: Date,
    paidAt:     Date,
    notes:      String,

    // ── Audit ─────────────────────────────────────────────────────────────────
    generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    isDeleted:   { type: Boolean, default: false, index: true },
  },
  { timestamps: true },
);

// ─── Existing compound unique index ──────────────────────────────────────────
// One payroll record per employee per period — enforced at the DB level.
payrollRecordSchema.index(
  { empId: 1, periodStart: 1, periodEnd: 1 },
  { unique: true },
);

// ─── New compound indexes ─────────────────────────────────────────────────────

// Employee salary history filtered by workflow state — e.g. the employee
// dashboard showing "your approved & paid payslips". The existing empId index
// alone fetches all records for that employee regardless of status, requiring
// an in-memory filter pass that grows with tenure.
payrollRecordSchema.index(
  { empId: 1, status: 1 },
  { name: 'idx_empId_status' },
);

// Department payroll run: "generate / fetch all records for dept HR in January."
// Used by both the payroll calculation job and the admin department-filter view.
// department first because it's the outer grouping; periodStart narrows within it.
payrollRecordSchema.index(
  { department: 1, periodStart: 1 },
  { name: 'idx_department_periodStart' },
);

// Admin payroll workflow: "show me all draft records for this pay period so I
// can review and approve them." status narrows to draft/approved/paid;
// periodStart isolates the current month's batch.
payrollRecordSchema.index(
  { status: 1, periodStart: 1 },
  { name: 'idx_status_periodStart' },
);

// Date-picker fast lookup: employee selects "January 2025" from a dropdown.
// periodLabel is already single-field indexed, but combining it with empId
// makes the query a single index seek rather than an index scan + filter.
payrollRecordSchema.index(
  { empId: 1, periodLabel: 1 },
  { name: 'idx_empId_periodLabel' },
);

// ─── Sparse indexes ───────────────────────────────────────────────────────────

// approvedBy + approvedAt: only set when status transitions draft → approved.
// Every draft document (the majority at any given time) stores null for both.
// Sparse keeps the index small; serves audit queries like
// "everything manager X approved this quarter."
payrollRecordSchema.index(
  { approvedBy: 1, approvedAt: 1 },
  { sparse: true, name: 'idx_approvedBy_approvedAt_sparse' },
);

// paidAt: only populated on the final status transition (approved → paid).
// Sparse means draft and approved records never appear in this index.
// Serves finance queries like "all records paid in March" and disbursement
// timeline reports without scanning the entire collection.
payrollRecordSchema.index(
  { paidAt: 1 },
  { sparse: true, name: 'idx_paidAt_sparse' },
);

// ─── Pre-save: recompute netSalary ───────────────────────────────────────────
payrollRecordSchema.pre('save', function (next) {
  this.netSalary =
    (this.baseSalary     || 0)
    - (this.totalDeduction || 0)
    + (this.totalOtAmount  || 0)
    + (this.totalBonus     || 0);
  next();
});

const PayrollRecord = mongoose.model('PayrollRecord', payrollRecordSchema);
export default PayrollRecord;