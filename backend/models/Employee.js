import mongoose from 'mongoose';
import bcryptjs from 'bcryptjs';

const employeeSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    index: true
  },
  employeeNumber: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  firstName: {
    type: String,
    required: true
  },
  lastName: {
    type: String,
    required: true
  },
  department: {
    type: String,
    enum: ['IT', 'Customer Support', 'Manager', 'Marketing', 'HR', 'Finance'],
    required: true
  },
  role: {
    type: String,
    enum: ['admin', 'employee'],
    default: 'employee',
    index: true
  },
  joiningDate: {
    type: Date,
    required: true
  },
  shift: {
    start: {
      type: String,
      required: true,
      default: '09:00',
      validate: {
        validator: function(v) {
          return /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(v);
        },
        message: 'Shift time must be in HH:mm format (24-hour)'
      }
    },
    end: {
      type: String,
      required: true,
      default: '18:00',
      validate: {
        validator: function(v) {
          return /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(v);
        },
        message: 'Shift time must be in HH:mm format (24-hour)'
      }
    }
  },
  hourlyRate: {
    type: Number,
    required: true,
    min: 0
  },
  status: {
    type: String,
    enum: ['Active', 'Inactive', 'Frozen'],
    default: 'Inactive',
    index: true
  },
  isArchived: {
    type: Boolean,
    default: false
  },
  password: String,
  tempPassword: String,
  inviteToken: String,
  inviteTokenExpires: Date,
  bank: {
    bankName: String,
    accountName: String,
    accountNumber: String
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

// Hash password before saving
employeeSchema.pre('save', async function(next) {
  if (!this.isModified('password') && !this.isModified('tempPassword')) return next();
  
  try {
    if (this.password) {
      const salt = await bcryptjs.genSalt(10);
      this.password = await bcryptjs.hash(this.password, salt);
    }
    
    if (this.tempPassword) {
      const salt = await bcryptjs.genSalt(10);
      this.tempPassword = await bcryptjs.hash(this.tempPassword, salt);
    }
    
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare passwords
employeeSchema.methods.comparePassword = async function(enteredPassword) {
  return await bcryptjs.compare(enteredPassword, this.password);
};

// Method to check if employee is eligible for leave (3 months)
employeeSchema.methods.isLeaveEligible = function() {
  const now = new Date();
  const joinDate = new Date(this.joiningDate);
  const daysElapsed = Math.floor((now - joinDate) / (1000 * 60 * 60 * 24));
  return daysElapsed >= 90;
};

// Method to get days until leave eligibility
employeeSchema.methods.getDaysUntilLeaveEligible = function() {
  const now = new Date();
  const joinDate = new Date(this.joiningDate);
  const daysElapsed = Math.floor((now - joinDate) / (1000 * 60 * 60 * 24));
  return Math.max(0, 90 - daysElapsed);
};

const Employee = mongoose.model('Employee', employeeSchema);

export default Employee;