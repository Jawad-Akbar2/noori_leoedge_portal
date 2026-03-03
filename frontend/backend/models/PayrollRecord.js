// models/PayrollRecord.js
//
// One document = one employee's payroll for one pay period (e.g. a month).
// Created/updated by the payroll calculation API; read by both admin and employee.

import mongoose from 'mongoose';

/**
 * A lightweight daily snapshot stored inside the PayrollRecord.
 * Mirrors the key fields from AttendanceLog.financials so the admin
 * detail view (requirement #1 — "see attendance per day") doesn't need
 * a second DB round-trip.
 */
const dailyBreakdownSchema = new mongoose.Schema({
  date:           { type: Date,   required: true },
  status:         { type: String, enum: ['Present', 'Late', 'Leave', 'Absent'] },
  inTime:         String,   // HH:mm
  outTime:        String,   // HH:mm
  hoursWorked:    { type: Number, default: 0 },
  basePay:        { type: Number, default: 0 },
  deduction:      { type: Number, default: 0 },
  otHours:        { type: Number, default: 0 },
  otAmount:       { type: Number, default: 0 },
  finalDayEarning:{ type: Number, default: 0 }
}, { _id: false });

const payrollRecordSchema = new mongoose.Schema({

  // ── Identity ──────────────────────────────────────────────────────────────
  empId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true,
    index: true
  },
  empNumber:  { type: String, required: true },
  empName:    { type: String, required: true },
  department: { type: String, required: true },

  // ── Pay period ────────────────────────────────────────────────────────────
  periodStart: { type: Date, required: true, index: true },
  periodEnd:   { type: Date, required: true, index: true },

  /**
   * Human-readable label, e.g. "January 2025" or "2025-01".
   * Indexed for quick lookup by the frontend date-range picker.
   */
  periodLabel: { type: String, index: true },

  // ── Attendance summary ────────────────────────────────────────────────────
  totalWorkingDays:  { type: Number, default: 0 },  // scheduled days in period
  presentDays:       { type: Number, default: 0 },
  lateDays:          { type: Number, default: 0 },
  absentDays:        { type: Number, default: 0 },
  leaveDays:         { type: Number, default: 0 },
  totalHoursWorked:  { type: Number, default: 0 },

  // ── Salary components ────────────────────────────────────────────────────
  /**
   * baseSalary: gross pay before deductions/OT.
   * For hourly employees  → sum of daily basePay.
   * For monthly employees → monthlySalary (pro-rated if partial month).
   */
  baseSalary:     { type: Number, default: 0, min: 0 },
  totalDeduction: { type: Number, default: 0, min: 0 },
  totalOtHours:   { type: Number, default: 0, min: 0 },
  totalOtAmount:  { type: Number, default: 0, min: 0 },

  /**
   * netSalary = baseSalary - totalDeduction + totalOtAmount
   * Always recomputed on save.
   */
  netSalary: { type: Number, default: 0, min: 0 },

  // ── Per-day breakdown (for admin detail view & employee salary page) ──────
  dailyBreakdown: {
    type: [dailyBreakdownSchema],
    default: []
  },

  // ── Status / workflow ─────────────────────────────────────────────────────
  /**
   * draft    → calculated but not yet reviewed
   * approved → admin has reviewed and locked the record
   * paid     → salary has been disbursed
   */
  status: {
    type: String,
    enum: ['draft', 'approved', 'paid'],
    default: 'draft',
    index: true
  },

  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
  approvedAt: Date,
  paidAt:     Date,
  notes:      String,

  // ── Audit ─────────────────────────────────────────────────────────────────
  generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
  isDeleted:   { type: Boolean, default: false, index: true }

}, { timestamps: true });

// ─── One payroll record per employee per period ───────────────────────────────
payrollRecordSchema.index({ empId: 1, periodStart: 1, periodEnd: 1 }, { unique: true });

// ─── Auto-compute netSalary on save ──────────────────────────────────────────
payrollRecordSchema.pre('save', function (next) {
  this.netSalary = Math.max(
    0,
    (this.baseSalary || 0)
    - (this.totalDeduction || 0)
    + (this.totalOtAmount  || 0)
  );
  next();
});

const PayrollRecord = mongoose.model('PayrollRecord', payrollRecordSchema);
export default PayrollRecord;