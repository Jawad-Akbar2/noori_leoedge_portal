// models/PerformanceRecord.js
//
// Stores a computed performance snapshot per employee per period.
// Used by the admin "all employee performance" table and pie/bar charts (req #2).

import mongoose from 'mongoose';

const performanceRecordSchema = new mongoose.Schema({

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

  // ── Period ────────────────────────────────────────────────────────────────
  periodStart: { type: Date, required: true, index: true },
  periodEnd:   { type: Date, required: true, index: true },
  periodLabel: { type: String, index: true },   // e.g. "January 2025"

  // ── Attendance-based metrics ──────────────────────────────────────────────
  totalWorkingDays: { type: Number, default: 0 },
  presentDays:      { type: Number, default: 0 },
  lateDays:         { type: Number, default: 0 },
  absentDays:       { type: Number, default: 0 },
  leaveDays:        { type: Number, default: 0 },
  totalHoursWorked: { type: Number, default: 0 },
  totalOtHours:     { type: Number, default: 0 },

  /**
   * attendanceRate: (presentDays + leaveDays) / totalWorkingDays × 100
   * Recomputed on save.
   */
  attendanceRate: { type: Number, default: 0, min: 0, max: 100 },

  /**
   * punctualityRate: presentDays that were NOT late / presentDays × 100
   * Recomputed on save.
   */
  punctualityRate: { type: Number, default: 0, min: 0, max: 100 },

  /**
   * performanceScore: weighted composite (0–100).
   * Default formula:
   *   attendanceRate  × 0.5
   *   punctualityRate × 0.3
   *   OT contribution × 0.2   (capped at 100)
   *
   * Admins can override this with a manual score.
   */
  performanceScore: { type: Number, default: 0, min: 0, max: 100 },
  scoreOverride:    { type: Boolean, default: false },

  /**
   * rating: human-readable tier derived from performanceScore.
   *   90–100 → 'Excellent'
   *   75–89  → 'Good'
   *   60–74  → 'Average'
   *   < 60   → 'Poor'
   */
  rating: {
    type: String,
    enum: ['Excellent', 'Good', 'Average', 'Poor'],
    default: 'Average'
  },

  notes: String,

  generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
  isDeleted:   { type: Boolean, default: false, index: true }

}, { timestamps: true });

// ─── One performance record per employee per period ───────────────────────────
performanceRecordSchema.index({ empId: 1, periodStart: 1, periodEnd: 1 }, { unique: true });

// ─── Auto-compute derived fields on save ─────────────────────────────────────
performanceRecordSchema.pre('save', function (next) {
  if (!this.scoreOverride) {
    const total = this.totalWorkingDays || 1; // avoid div/0

    // attendanceRate
    this.attendanceRate = Math.min(
      100,
      ((this.presentDays + this.leaveDays) / total) * 100
    );

    // punctualityRate
    const onTimeDays = Math.max(0, this.presentDays - this.lateDays);
    this.punctualityRate = this.presentDays > 0
      ? (onTimeDays / this.presentDays) * 100
      : 100;

    // OT contribution score (max 100, scales: 1 OT hour per working day = 100)
    const maxOtHours = total * 1;   // 1 OT hr/day = perfect OT score
    const otScore = Math.min(100, (this.totalOtHours / Math.max(1, maxOtHours)) * 100);

    // Weighted composite
    this.performanceScore = Math.round(
      this.attendanceRate  * 0.5 +
      this.punctualityRate * 0.3 +
      otScore              * 0.2
    );
  }

  // Rating tier
  if      (this.performanceScore >= 90) this.rating = 'Excellent';
  else if (this.performanceScore >= 75) this.rating = 'Good';
  else if (this.performanceScore >= 60) this.rating = 'Average';
  else                                  this.rating = 'Poor';

  next();
});

const PerformanceRecord = mongoose.model('PerformanceRecord', performanceRecordSchema);
export default PerformanceRecord;