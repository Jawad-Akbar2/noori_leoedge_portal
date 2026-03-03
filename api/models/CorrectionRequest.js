// models/CorrectionRequest.js

import mongoose from 'mongoose';

const TIME_REGEX = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;

const timeValidator = {
  validator: v => !v || TIME_REGEX.test(v),
  message:   'Time must be in HH:mm (24-hour) format'
};

const correctionRequestSchema = new mongoose.Schema({

  // ── Identity ──────────────────────────────────────────────────────────────
  empId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true,
    index: true
  },
  empNumber:  { type: String, required: true },
  empName:    { type: String, required: true },
  department: { type: String, required: true },   // added for payroll/reporting consistency

  // ── Which attendance record is being corrected ────────────────────────────
  /**
   * attendanceLogRef: direct reference to the AttendanceLog document.
   * Populated on approval so the handler knows exactly which record to patch.
   */
  attendanceLogRef: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AttendanceLog',
    default: null
  },

  /**
   * date: the shift-start date of the attendance record being corrected.
   * For night-shift employees this is the date the shift BEGAN,
   * NOT the calendar date of check-out (mirrors AttendanceLog.date).
   */
  date: {
    type: Date,
    required: true,
    index: true
  },

  // ── Correction payload ────────────────────────────────────────────────────
  correctionType: {
    type: String,
    enum: ['In', 'Out', 'Both'],
    required: true
  },

  originalInTime:  { type: String, validate: timeValidator, default: null },
  correctedInTime: { type: String, validate: timeValidator, default: null },

  originalOutTime:  { type: String, validate: timeValidator, default: null },
  correctedOutTime: { type: String, validate: timeValidator, default: null },

  /**
   * outNextDay: true when the corrected OUT time belongs to the day AFTER `date`.
   * Required for night-shift employees (e.g. shift starts 22:00, ends 06:00 next day).
   * The approval handler must use this flag when writing back to AttendanceLog.inOut.outNextDay.
   */
  outNextDay: {
    type: Boolean,
    default: false
  },

  reason: {
    type: String,
    required: true,
    trim: true
  },

  // ── Approval workflow ─────────────────────────────────────────────────────
  status: {
    type: String,
    enum: ['Pending', 'Approved', 'Rejected'],
    default: 'Pending',
    index: true
  },
  approvedBy:      { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', default: null },
  approvedAt:      { type: Date, default: null },
  rejectionReason: { type: String, default: null },

  // ── Metadata ──────────────────────────────────────────────────────────────
  /**
   * source:
   *   'employee' — submitted by the employee themselves
   *   'admin'    — correction entered directly by admin (no approval flow needed)
   */
  source: {
    type: String,
    enum: ['employee', 'admin'],
    default: 'employee'
  },

  isDeleted: { type: Boolean, default: false, index: true }

}, { timestamps: true });   // provides createdAt + updatedAt automatically

// ─── Compound index: one pending correction per employee per date ─────────────
// (allows multiple corrections over time but makes lookups fast)
correctionRequestSchema.index({ empId: 1, date: 1, status: 1 });

// ─── Guard: correctedInTime required when correctionType is 'In' or 'Both' ───
correctionRequestSchema.pre('validate', function (next) {
  const errors = [];

  if (['In', 'Both'].includes(this.correctionType) && !this.correctedInTime) {
    errors.push('correctedInTime is required for correctionType "In" or "Both"');
  }
  if (['Out', 'Both'].includes(this.correctionType) && !this.correctedOutTime) {
    errors.push('correctedOutTime is required for correctionType "Out" or "Both"');
  }

  if (errors.length) {
    return next(new mongoose.Error.ValidationError(
      Object.assign(new Error(errors.join('; ')), { name: 'ValidationError' })
    ));
  }

  next();
});

const CorrectionRequest = mongoose.model('CorrectionRequest', correctionRequestSchema);
export default CorrectionRequest;