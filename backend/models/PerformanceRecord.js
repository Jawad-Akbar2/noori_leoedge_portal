// models/PerformanceRecord.js
import mongoose from 'mongoose';

const performanceRecordSchema = new mongoose.Schema(
  {
    // ── Identity ────────────────────────────────────────────────────────────
    empId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'Employee',
      required: true,
      index:    true,
    },
    empNumber:  { type: String, required: true },
    empName:    { type: String, required: true },
    department: { type: String, required: true },

    // ── Period ──────────────────────────────────────────────────────────────
    periodStart: { type: Date,   required: true, index: true },
    periodEnd:   { type: Date,   required: true, index: true },
    periodLabel: { type: String, index: true },

    // ── Attendance-based metrics ────────────────────────────────────────────
    totalWorkingDays: { type: Number, default: 0 },
    presentDays:      { type: Number, default: 0 },
    lateDays:         { type: Number, default: 0 },
    OffDayDays:       { type: Number, default: 0 },
    leaveDays:        { type: Number, default: 0 },
    ncnsDays:         { type: Number, default: 0 },
    totalHoursWorked: { type: Number, default: 0 },
    totalOtHours:     { type: Number, default: 0 },
    attendanceRate:   { type: Number, default: 0, max: 100 },
    punctualityRate:  { type: Number, default: 0, max: 100 },
    performanceScore: { type: Number, default: 0, max: 100 },
    scoreOverride:    { type: Boolean, default: false },

    rating: {
      type:    String,
      enum:    ['Excellent', 'Good', 'Average', 'Poor'],
      default: 'Average',
    },

    notes:       String,
    generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    isDeleted:   { type: Boolean, default: false, index: true },
  },
  { timestamps: true },
);

// ─── Existing compound unique index ──────────────────────────────────────────
// One performance record per employee per period.
performanceRecordSchema.index(
  { empId: 1, periodStart: 1, periodEnd: 1 },
  { unique: true },
);

// ─── New compound indexes ─────────────────────────────────────────────────────

// Admin "all employees" performance table filtered by department and period.
// The primary view the spec describes — renders every employee's row for a
// given month within a department. department first (equality); periodStart
// narrows within it.
performanceRecordSchema.index(
  { department: 1, periodStart: 1 },
  { name: 'idx_department_periodStart' },
);

// Pie / bar chart aggregations: "how many Excellent / Good / Average / Poor
// employees this month?" This is a $group or $facet aggregation on rating
// within a period. Without this index MongoDB scans the full period's docs
// to tally the four buckets. rating first (4-value enum, equality); periodStart
// ranges within each bucket.
performanceRecordSchema.index(
  { rating: 1, periodStart: 1 },
  { name: 'idx_rating_periodStart' },
);

// Employee date-picker: "show me my performance for January 2025."
// Same rationale as PayrollRecord — periodLabel alone scans all employees
// for that label before filtering by empId. Compound makes it a point seek.
performanceRecordSchema.index(
  { empId: 1, periodLabel: 1 },
  { name: 'idx_empId_periodLabel' },
);

// Cross-filter chart: "show me Poor performers in the IT department."
// department + rating together produce a highly selective result even though
// each field has low cardinality individually (6 depts × 4 ratings = 24 combos).
// Useful for the "underperformers by department" bar chart variant.
performanceRecordSchema.index(
  { department: 1, rating: 1 },
  { name: 'idx_department_rating' },
);

// ─── Sparse index ─────────────────────────────────────────────────────────────

// scoreOverride is false on the vast majority of records — only manually
// adjusted scores flip it to true. Sparse skips every auto-computed record,
// leaving a tiny index that serves admin audit queries like
// "show me all manually overridden scores this quarter" instantly.
performanceRecordSchema.index(
  { scoreOverride: 1, periodStart: 1 },
  { sparse: true, name: 'idx_scoreOverride_periodStart_sparse' },
);

// ─── Pre-save: recompute derived metrics ─────────────────────────────────────
performanceRecordSchema.pre('save', function (next) {
  if (!this.scoreOverride) {
    const total = this.totalWorkingDays || 1;

    this.attendanceRate = Math.min(
      100,
      ((this.presentDays + this.leaveDays) / total) * 100,
    );

    const onTimeDays = Math.max(0, this.presentDays - this.lateDays);
    this.punctualityRate = this.presentDays > 0
      ? (onTimeDays / this.presentDays) * 100
      : 100;

    const maxOtHours = total * 1;
    const otScore    = Math.min(100, (this.totalOtHours / Math.max(1, maxOtHours)) * 100);

    this.performanceScore = Math.round(
      this.attendanceRate  * 0.5 +
      this.punctualityRate * 0.3 +
      otScore              * 0.2,
    );
  }

  if      (this.performanceScore >= 90) this.rating = 'Excellent';
  else if (this.performanceScore >= 75) this.rating = 'Good';
  else if (this.performanceScore >= 60) this.rating = 'Average';
  else                                  this.rating = 'Poor';

  next();
});

const PerformanceRecord = mongoose.model('PerformanceRecord', performanceRecordSchema);
export default PerformanceRecord;