import mongoose from 'mongoose';

const attendanceLogSchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true,
    index: true
  },
  empId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true,
    index: true
  },
  empNumber: {
    type: String,
    required: true,
    index: true
  },
  empName: {
    type: String,
    required: true
  },
  department: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['Present', 'Late', 'Leave', 'Absent'],
    default: 'Absent',
    index: true
  },
  inOut: {
    in: {
      type: String,
      validate: {
        validator: function(v) {
          if (!v) return true;
          return /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(v);
        },
        message: 'Invalid time format'
      }
    },
    out: {
      type: String,
      validate: {
        validator: function(v) {
          if (!v) return true;
          return /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(v);
        },
        message: 'Invalid time format'
      }
    }
  },
  shift: {
    start: {
      type: String,
      required: true,
      validate: {
        validator: function(v) {
          return /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(v);
        },
        message: 'Invalid shift time format'
      }
    },
    end: {
      type: String,
      required: true,
      validate: {
        validator: function(v) {
          return /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(v);
        },
        message: 'Invalid shift time format'
      }
    }
  },
  hourlyRate: {
    type: Number,
    required: true,
    min: 0
  },
  financials: {
    hoursPerDay: {
      type: Number,
      default: 0,
      min: 0
    },
    basePay: {
      type: Number,
      default: 0,
      min: 0
    },
    deduction: {
      type: Number,
      default: 0,
      min: 0
    },
    otMultiplier: {
      type: Number,
      default: 1,
      enum: [1, 1.5, 2]
    },
    otHours: {
      type: Number,
      default: 0,
      min: 0
    },
    otAmount: {
      type: Number,
      default: 0,
      min: 0
    },
    finalDayEarning: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  manualOverride: {
    type: Boolean,
    default: false
  },
  metadata: {
    source: {
      type: String,
      enum: ['system', 'manual', 'csv', 'correction_approval', 'leave_approval'],
      default: 'system'
    },
    notes: String,
    lastUpdatedBy: mongoose.Schema.Types.ObjectId,
    csvImportBatch: String
  },
  isDeleted: {
    type: Boolean,
    default: false,
    index: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  updatedAt: {
    type: Date,
    default: Date.now,
    index: true
  }
}, { 
  timestamps: true
});

// Compound index to ensure one record per employee per date
attendanceLogSchema.index({ empId: 1, date: 1 }, { unique: true });

const AttendanceLog = mongoose.model('AttendanceLog', attendanceLogSchema);

export default AttendanceLog;