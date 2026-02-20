import mongoose from 'mongoose';

const correctionRequestSchema = new mongoose.Schema({
  empId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true,
    index: true
  },
  empNumber: {
    type: String,
    required: true
  },
  empName: {
    type: String,
    required: true
  },
  date: {
    type: Date,
    required: true,
    index: true
  },
  correctionType: {
    type: String,
    enum: ['In', 'Out', 'Both'],
    required: true
  },
  originalInTime: String,
  correctedInTime: String,
  originalOutTime: String,
  correctedOutTime: String,
  reason: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['Pending', 'Approved', 'Rejected'],
    default: 'Pending',
    index: true
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee'
  },
  approvedAt: Date,
  rejectionReason: String,
  isDeleted: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

const CorrectionRequest = mongoose.model('CorrectionRequest', correctionRequestSchema);

export default CorrectionRequest;