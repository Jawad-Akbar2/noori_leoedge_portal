// models/CorrectionRequest.js
import mongoose from 'mongoose';

const TIME_REGEX = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
const timeValidator = {
  validator: v => !v || TIME_REGEX.test(v),
  message:   'Time must be in HH:mm (24-hour) format',
};

const correctionRequestSchema = new mongoose.Schema(
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

    // ── Which attendance record is being corrected ──────────────────────────
    attendanceLogRef: {
      type:    mongoose.Schema.Types.ObjectId,
      ref:     'AttendanceLog',
      default: null,
    },
    date: {
      type:     Date,
      required: true,
      index:    true,
    },

    // ── Correction payload ──────────────────────────────────────────────────
    correctionType: {
      type:     String,
      enum:     ['In', 'Out', 'Both'],
      required: true,
    },
    originalInTime:   { type: String, validate: timeValidator, default: null },
    correctedInTime:  { type: String, validate: timeValidator, default: null },
    originalOutTime:  { type: String, validate: timeValidator, default: null },
    correctedOutTime: { type: String, validate: timeValidator, default: null },
    outNextDay:       { type: Boolean, default: false },
    reason:           { type: String, required: true, trim: true },

    // ── Approval workflow ───────────────────────────────────────────────────
    status: {
      type:    String,
      enum:    ['Pending', 'Approved', 'Rejected'],
      default: 'Pending',
      index:   true,
    },
    approvedBy:      { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', default: null },
    approvedAt:      { type: Date, default: null },
    rejectionReason: { type: String, default: null },

    // ── Metadata ────────────────────────────────────────────────────────────
    source: {
      type:    String,
      enum:    ['employee', 'admin'],
      default: 'employee',
    },
    isDeleted: { type: Boolean, default: false, index: true },
  },
  { timestamps: true },
);

// ─── Existing compound index ──────────────────────────────────────────────────
// Employee correction history filtered by status — e.g. "all Pending requests
// for employee X". empId first (high cardinality ObjectId prunes fastest).
correctionRequestSchema.index({ empId: 1, date: 1, status: 1 });

// ─── New compound indexes ─────────────────────────────────────────────────────

// Admin approval queue: "show me all Pending requests, oldest first."
// status narrows to Pending/Approved/Rejected; createdAt sorts within that set.
// A sort on createdAt alone would require a full scan — this index serves both
// the filter AND the sort in one pass.
correctionRequestSchema.index(
  { status: 1, createdAt: 1 },
  { name: 'idx_status_createdAt' },
);

// Department manager queue: "show me Pending requests for my department."
// department + status together are selective enough to avoid a collection scan
// even though department has low cardinality on its own.
correctionRequestSchema.index(
  { department: 1, status: 1 },
  { name: 'idx_department_status' },
);

// ─── New sparse indexes ───────────────────────────────────────────────────────

// attendanceLogRef is null until the request is approved and linked.
// Sparse skips every Pending/Rejected doc (the vast majority), keeping the
// index tiny. Used for reverse-lookup: "which correction(s) touched this log?"
correctionRequestSchema.index(
  { attendanceLogRef: 1 },
  { sparse: true, name: 'idx_attendanceLogRef_sparse' },
);

// approvedBy + approvedAt: only populated after approval. Audit queries like
// "show me everything admin X approved this month" hit this index directly
// without touching the ~80% of docs that are still Pending or Rejected.
correctionRequestSchema.index(
  { approvedBy: 1, approvedAt: 1 },
  { sparse: true, name: 'idx_approvedBy_approvedAt_sparse' },
);

// ─── Pre-validate: correctedInTime / correctedOutTime presence check ──────────
correctionRequestSchema.pre('validate', function (next) {
  const errors = [];
  if (['In',  'Both'].includes(this.correctionType) && !this.correctedInTime)
    errors.push('correctedInTime is required for correctionType "In" or "Both"');
  if (['Out', 'Both'].includes(this.correctionType) && !this.correctedOutTime)
    errors.push('correctedOutTime is required for correctionType "Out" or "Both"');
  if (errors.length) {
    return next(
      new mongoose.Error.ValidationError(
        Object.assign(new Error(errors.join('; ')), { name: 'ValidationError' }),
      ),
    );
  }
  next();
});

const CorrectionRequest = mongoose.model('CorrectionRequest', correctionRequestSchema);
export default CorrectionRequest;