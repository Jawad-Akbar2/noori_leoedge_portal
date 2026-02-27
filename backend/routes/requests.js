import express from 'express';
import jwt from 'jsonwebtoken';
import LeaveRequest from '../models/LeaveRequest.js';
import CorrectionRequest from '../models/CorrectionRequest.js';
import AttendanceLog from '../models/AttendanceLog.js';
import Employee from '../models/Employee.js';
import { calculateHours } from '../utils/timeCalculator.js';
import { parseDDMMYYYY, formatDate } from '../utils/dateUtils.js';

const router = express.Router();

// Middleware
const auth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Unauthorized' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await Employee.findById(decoded.id);
    req.user = user;
    req.role = decoded.role || (user.department === 'Manager' ? 'admin' : 'employee');
    req.userId = decoded.id;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Unauthorized' });
  }
};

function getLeaveBalance(joiningDate) {
  const now = new Date();
  const joinDate = new Date(joiningDate);
  const daysElapsed = Math.floor((now - joinDate) / (1000 * 60 * 60 * 24));
  const canApply = daysElapsed >= 90;
  const daysUntilEligible = Math.max(0, 90 - daysElapsed);
  
  return { canApply, daysUntilEligible, holidayLeaves: 13, sickLeaves: 7 };
}

// **Submit leave request**
router.post('/leave/submit', auth, async (req, res) => {
  try {
    const { fromDate, toDate, leaveType, reason } = req.body;
    
    const parsedFrom = parseDDMMYYYY(fromDate);
    const parsedTo = parseDDMMYYYY(toDate);

    if (!parsedFrom || !parsedTo) {
      return res.status(400).json({ message: 'Invalid date format. Use dd/mm/yyyy' });
    }

    const { canApply, daysUntilEligible } = getLeaveBalance(req.user.joiningDate);
    if (!canApply) {
      return res.status(400).json({
        message: `You can apply for leave after ${daysUntilEligible} days`,
        daysUntilEligible
      });
    }
    
    const existingRequest = await LeaveRequest.findOne({
      empId: req.user._id,
      status: 'Pending',
      fromDate: { $lte: parsedTo },
      toDate: { $gte: parsedFrom },
      isDeleted: false
    });
    
    if (existingRequest) {
      return res.status(400).json({
        message: 'You already have a pending leave request for this date range.'
      });
    }
    
    const leaveRequest = new LeaveRequest({
      empId: req.user._id,
      empNumber: req.user.employeeNumber,
      empName: `${req.user.firstName} ${req.user.lastName}`,
      leaveType,
      fromDate: parsedFrom,
      toDate: parsedTo,
      reason,
      status: 'Pending'
    });
    
    await leaveRequest.save();
    
    res.json({
      message: 'Leave request submitted successfully',
      requestId: leaveRequest._id
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// **Submit correction request**
router.post('/correction/submit', auth, async (req, res) => {
  try {
    const { date, fromTime, toTime, reason } = req.body;
    
    const parsedDate = parseDDMMYYYY(date);
    if (!parsedDate) {
      return res.status(400).json({ message: 'Invalid date format. Use dd/mm/yyyy' });
    }

    const existingRequest = await CorrectionRequest.findOne({
      empId: req.user._id,
      date: parsedDate,
      status: 'Pending',
      isDeleted: false
    });
    
    if (existingRequest) {
      return res.status(400).json({
        message: 'You already have a pending correction request for this date.'
      });
    }
    
    const attendance = await AttendanceLog.findOne({
      empId: req.user._id,
      date: parsedDate
    });
    
    const correctionRequest = new CorrectionRequest({
      empId: req.user._id,
      empNumber: req.user.employeeNumber,
      empName: `${req.user.firstName} ${req.user.lastName}`,
      date: parsedDate,
      correctionType: 'Both',
      originalInTime: attendance?.inOut?.in,
      correctedInTime: fromTime,
      originalOutTime: attendance?.inOut?.out,
      correctedOutTime: toTime,
      reason,
      status: 'Pending'
    });
    
    await correctionRequest.save();
    
    res.json({
      message: 'Correction request submitted successfully',
      requestId: correctionRequest._id
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// **Get employee requests**
router.get('/my-requests', auth, async (req, res) => {
  try {
    const { fromDate, toDate, status, type } = req.query;
    
    let query = {
      empId: req.user._id,
      isDeleted: false
    };
    
    if (fromDate && toDate) {
      const start = parseDDMMYYYY(fromDate);
      const end = parseDDMMYYYY(toDate);
      if (start && end) {
        query.createdAt = {
          $gte: start,
          $lte: end
        };
      }
    }
    
    let leaveRequests = [];
    let correctionRequests = [];
    
    if (!type || type === 'leave') {
      let leaveQuery = { ...query };
      if (status) leaveQuery.status = status;
      leaveRequests = await LeaveRequest.find(leaveQuery);
    }
    
    if (!type || type === 'correction') {
      let correctionQuery = { ...query };
      if (status) correctionQuery.status = status;
      correctionRequests = await CorrectionRequest.find(correctionQuery);
    }
    
    res.json({
      leaveRequests,
      correctionRequests,
      total: leaveRequests.length + correctionRequests.length
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// **Admin: Get all pending requests**
router.get('/admin/pending', auth, async (req, res) => {
  try {
    if (req.role !== 'admin') {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    
    const defaultDate = new Date();
    defaultDate.setDate(defaultDate.getDate() - 45);

    const leaveRequests = await LeaveRequest.find({
      status: 'Pending',
      isDeleted: false,
      createdAt: { $gte: defaultDate }
    }).populate('empId', 'firstName lastName employeeNumber');

    const correctionRequests = await CorrectionRequest.find({
      status: 'Pending',
      isDeleted: false,
      createdAt: { $gte: defaultDate }
    }).populate('empId', 'firstName lastName employeeNumber');

    res.json({
      leaveRequests,
      correctionRequests
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// **Admin: Approve leave request**
router.patch('/leave/:requestId/approve', auth, async (req, res) => {
  try {
    if (req.role !== 'admin') {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    
    const leaveRequest = await LeaveRequest.findById(req.params.requestId);
    if (!leaveRequest) return res.status(404).json({ message: 'Request not found' });
    
    leaveRequest.status = 'Approved';
    leaveRequest.approvedBy = req.userId;
    leaveRequest.approvedAt = new Date();
    await leaveRequest.save();
    
    // Update attendance records for each day
    const currentDate = new Date(leaveRequest.fromDate);
    while (currentDate <= leaveRequest.toDate) {
      const dateObj = new Date(currentDate);
      dateObj.setHours(0, 0, 0, 0);

      const employee = await Employee.findById(leaveRequest.empId);
      const hoursPerDay = calculateHours(employee.shift.start, employee.shift.end);
      const basePay = hoursPerDay * employee.hourlyRate;

      await AttendanceLog.findOneAndUpdate(
        { empId: leaveRequest.empId, date: dateObj },
        {
          $set: {
            status: 'Leave',
            empNumber: employee.employeeNumber,
            empName: `${employee.firstName} ${employee.lastName}`,
            department: employee.department,
            shift: employee.shift,
            hourlyRate: employee.hourlyRate,
            financials: {
              hoursPerDay,
              basePay,
              deduction: 0,
              otMultiplier: 1,
              otHours: 0,
              otAmount: 0,
              finalDayEarning: basePay
            },
            metadata: {
              source: 'leave_approval',
              lastUpdatedBy: req.userId
            }
          }
        },
        { upsert: true, new: true }
      );

      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    res.json({ message: 'Leave request approved', leaveRequest });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// **Admin: Reject leave request**
router.patch('/leave/:requestId/reject', auth, async (req, res) => {
  try {
    if (req.role !== 'admin') {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    
    const { reason } = req.body;
    const leaveRequest = await LeaveRequest.findById(req.params.requestId);
    if (!leaveRequest) return res.status(404).json({ message: 'Request not found' });
    
    leaveRequest.status = 'Rejected';
    leaveRequest.rejectionReason = reason;
    await leaveRequest.save();
    
    res.json({ message: 'Leave request rejected', leaveRequest });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// **Admin: Approve correction request**
router.patch('/correction/:requestId/approve', auth, async (req, res) => {
  try {
    if (req.role !== 'admin') {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    
    const correctionRequest = await CorrectionRequest.findById(req.params.requestId);
    if (!correctionRequest) return res.status(404).json({ message: 'Request not found' });
    
    correctionRequest.status = 'Approved';
    correctionRequest.approvedBy = req.userId;
    correctionRequest.approvedAt = new Date();
    await correctionRequest.save();

    // Get employee for calculations
    const employee = await Employee.findById(correctionRequest.empId);
    if (!employee) return res.status(404).json({ message: 'Employee not found' });

    // Calculate new financials
    const hoursPerDay = calculateHours(correctionRequest.correctedInTime, correctionRequest.correctedOutTime);
    const basePay = hoursPerDay * employee.hourlyRate;
    const finalDayEarning = basePay;

    // UPSERT attendance
    const dateObj = new Date(correctionRequest.date);
    dateObj.setHours(0, 0, 0, 0);

    const attendance = await AttendanceLog.findOneAndUpdate(
      { empId: correctionRequest.empId, date: dateObj },
      {
        $set: {
          inOut: {
            in: correctionRequest.correctedInTime,
            out: correctionRequest.correctedOutTime
          },
          financials: {
            hoursPerDay,
            basePay,
            deduction: 0,
            otMultiplier: 1,
            otHours: 0,
            otAmount: 0,
            finalDayEarning
          },
          status: 'Present',
          metadata: {
            lastUpdatedBy: req.userId,
            source: 'correction_approval'
          },
          updatedAt: new Date()
        }
      },
      { upsert: true, new: true }
    );
    
    res.json({ 
      message: 'Correction request approved and attendance updated',
      correctionRequest,
      updatedAttendance: attendance
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// **Admin: Reject correction request**
router.patch('/correction/:requestId/reject', auth, async (req, res) => {
  try {
    if (req.role !== 'admin') {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    
    const { reason } = req.body;
    const correctionRequest = await CorrectionRequest.findById(req.params.requestId);
    if (!correctionRequest) return res.status(404).json({ message: 'Request not found' });
    
    correctionRequest.status = 'Rejected';
    correctionRequest.rejectionReason = reason;
    await correctionRequest.save();
    
    res.json({ message: 'Correction request rejected', correctionRequest });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;