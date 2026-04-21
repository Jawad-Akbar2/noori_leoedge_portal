// models/AttendanceLog.js

import mongoose from "mongoose";

const deductionDetailSchema = new mongoose.Schema(
  {
    amount: { type: Number, required: true, min: 0 },
    reason: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: [
        "late_login",
        "early_logout",
        "fixed_penalty",
        "hourly_penalty",
        "ncns_penalty",
        "manual",
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
    amount: { type: Number,  default: 0 },
    hours: { type: Number,  default: 0 },
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
    /**
     * For normal shifts: this is the calendar date of check-in.
     * For night shifts: this is the calendar date when the shift STARTS
     * (even if the employee checks out the next calendar day).
     */
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
    empName: {
      type: String,
      required: true,
    },
    department: {
      type: String,
      required: true,
    },
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
          validator: function (v) {
            if (!v) return true;
            return /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(v);
          },
          message: "Invalid time format (HH:mm expected)",
        },
      },
      out: {
        type: String,
        validate: {
          validator: function (v) {
            if (!v) return true;
            return /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(v);
          },
          message: "Invalid time format (HH:mm expected)",
        },
      },
      /**
       * outNextDay: true means the "out" time belongs to the NEXT calendar day.
       * Used for night-shift employees whose check-out crosses midnight.
       * CSV import sets this automatically via the 14-hour window rule.
       */
      outNextDay: {
        type: Boolean,
        default: false,
      },
    },

    shift: {
      start: { type: String, required: true }, // e.g. "22:00"
      end: { type: String, required: true }, // e.g. "06:00" — can be next-day
      /**
       * isNightShift: true when shift.end < shift.start (crosses midnight).
       * Computed and stored on save so queries can filter efficiently.
       */
      isNightShift: { type: Boolean, default: false },
    },
    salaryType: {
      type: String,
      enum: ["hourly", "monthly"],
      required: true,
    },
    hourlyRate: {
      // already exists — effective rate at time of log
      type: Number,
      required: true,
      
    },

    financials: {
      hoursWorked: {
        type: Number,
        default: 0,
        
      },
      // Scheduled shift duration in hours (e.g. 8h for a 22:00–06:00 shift)
      scheduledHours: {
        type: Number,
        default: 0,
        
      },
      lateMinutes: { type: Number, default: 0, min: 0 }, // minutes after shift.start
      earlyLogoutMinutes: { type: Number, default: 0, min: 0 }, // minutes before shift.end
      basePay: {
        type: Number,
        default: 0,
        
      },
      deduction: {
        type: Number,
        default: 0,
        
      },
      deductionDetails: {
        type: [deductionDetailSchema],
        default: [],
      },
      otMultiplier: {
        type: Number,
        default: 1,
        enum: [1, 1.5, 2],
      },
      otHours: {
        type: Number,
        default: 0,
        
      },
      otAmount: {
        type: Number,
        default: 0,
        
      },
      otDetails: {
        type: [otDetailSchema],
        default: [],
      },
      /**
       * finalDayEarning = basePay - deduction + otAmount
       * Always recomputed on save; do NOT set this manually.
       */
      finalDayEarning: {
        type: Number,
        default: 0,
        
      },
    },

    manualOverride: {
      type: Boolean,
      default: false,
    },

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
      lastModifiedAt: {
        type: Date,
        default: Date.now,
      },
    },

    isDeleted: { type: Boolean, default: false, index: true },
  },
  {
    timestamps: true, // adds createdAt + updatedAt automatically
  },
);


attendanceLogSchema.index({ date: 1, status: 1 });
attendanceLogSchema.index({ empNumber: 1, date: 1 });

// ─── Compound index: one record per employee per shift-start date ─────────────
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
