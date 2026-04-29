// routes/notifications.js
//
// Covers:
//   GET  /api/notifications/pending          — admin: all pending requests
//   GET  /api/notifications/my               — employee: their own requests + status updates
//   POST /api/notifications/leave/:id/approve
//   POST /api/notifications/leave/:id/reject
//   POST /api/notifications/correction/:id/approve
//   POST /api/notifications/correction/:id/reject

import express from 'express';
import mongoose from 'mongoose';
import AttendanceLog     from '../models/AttendanceLog.js';
import LeaveRequest      from '../models/LeaveRequest.js';
import CorrectionRequest from '../models/CorrectionRequest.js';
import Employee          from '../models/Employee.js';   // ← static import: no dynamic re-import per call
import { auth, adminAuth } from '../middleware/auth.js';
import { formatDate, formatDateTimeForDisplay } from '../utils/dateUtils.js';

const router = express.Router();

// ─── helpers ──────────────────────────────────────────────────────────────────

const toMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };

const fmtLeave = (r) => ({
  ...r,
  fromDateFormatted:  formatDate(r.fromDate),
  toDateFormatted:    formatDate(r.toDate),
  createdAtFormatted: formatDateTimeForDisplay(r.createdAt)
});

const fmtCorrection = (r) => ({
  ...r,
  dateFormatted:      formatDate(r.date),
  createdAtFormatted: formatDateTimeForDisplay(r.createdAt)
});

// ─── GET /api/notifications/pending  (admin only) ─────────────────────────────

router.get('/pending', adminAuth, async (req, res) => {
  try {
    const [leaveRequests, correctionRequests] = await Promise.all([
      LeaveRequest.find({ status: 'Pending', isDeleted: false })
        .sort({ createdAt: -1 })
        .lean(),
      CorrectionRequest.find({ status: 'Pending', isDeleted: false })
        .sort({ createdAt: -1 })
        .lean()
    ]);

    return res.json({
      success: true,
      leaveRequests:      leaveRequests.map(fmtLeave),
      correctionRequests: correctionRequests.map(fmtCorrection),
      counts: {
        leave:      leaveRequests.length,
        correction: correctionRequests.length,
        total:      leaveRequests.length + correctionRequests.length
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /api/notifications/my  (employee) ────────────────────────────────────

router.get('/my', auth, async (req, res) => {
  try {
    const [leaveRequests, correctionRequests] = await Promise.all([
      LeaveRequest.find({ empId: req.userId, isDeleted: false })
        .sort({ createdAt: -1 })
        .lean(),
      CorrectionRequest.find({ empId: req.userId, isDeleted: false })
        .sort({ createdAt: -1 })
        .lean()
    ]);

    return res.json({
      success: true,
      leaveRequests:      leaveRequests.map(fmtLeave),
      correctionRequests: correctionRequests.map(fmtCorrection)
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── POST /api/notifications/leave/:id/approve  (admin) ──────────────────────

router.post('/leave/:id/approve', adminAuth, async (req, res) => {
  try {
    // findOneAndUpdate in a single round-trip instead of find → mutate → save
    const leave = await LeaveRequest.findOneAndUpdate(
      { _id: req.params.id, isDeleted: false, status: 'Pending' },
      { $set: { status: 'Approved', approvedBy: req.userId, approvedAt: new Date().toLocaleString("en-US", {timeZone: "Asia/Karachi"}) } },
      { new: true }
    ).lean();

    if (!leave) {
      // Distinguish "not found" from "already actioned"
      const exists = await LeaveRequest.exists({ _id: req.params.id, isDeleted: false });
      return res.status(exists ? 400 : 404).json({
        success: false,
        message: exists ? 'Request already actioned' : 'Leave request not found'
      });
    }

    // Fire attendance side-effect in parallel — don't block the response
    applyLeaveToAttendance(leave, req.userId).catch(console.error);

    return res.json({ success: true, message: 'Leave request approved', leave: fmtLeave(leave) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── POST /api/notifications/leave/:id/reject  (admin) ───────────────────────

router.post('/leave/:id/reject', adminAuth, async (req, res) => {
  try {
    const { reason } = req.body;

    const leave = await LeaveRequest.findOneAndUpdate(
      { _id: req.params.id, isDeleted: false, status: 'Pending' },
      {
        $set: {
          status:          'Rejected',
          approvedBy:      req.userId,
          approvedAt:      new Date().toLocaleString("en-US", {timeZone: "Asia/Karachi"}),
          rejectionReason: reason || 'Rejected by admin'
        }
      },
      { new: true }
    ).lean();

    if (!leave) {
      const exists = await LeaveRequest.exists({ _id: req.params.id, isDeleted: false });
      return res.status(exists ? 400 : 404).json({
        success: false,
        message: exists ? 'Request already actioned' : 'Leave request not found'
      });
    }

    return res.json({ success: true, message: 'Leave request rejected', leave: fmtLeave(leave) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── POST /api/notifications/correction/:id/approve  (admin) ─────────────────

router.post('/correction/:id/approve', adminAuth, async (req, res) => {
  try {
    const correction = await CorrectionRequest.findOneAndUpdate(
      { _id: req.params.id, isDeleted: false, status: 'Pending' },
      { $set: { status: 'Approved', approvedBy: req.userId, approvedAt: new Date().toLocaleString("en-US", {timeZone: "Asia/Karachi"}) } },
      { new: true }
    ).lean();

    if (!correction) {
      const exists = await CorrectionRequest.exists({ _id: req.params.id, isDeleted: false });
      return res.status(exists ? 400 : 404).json({
        success: false,
        message: exists ? 'Request already actioned' : 'Correction request not found'
      });
    }

    // Fire side-effect without blocking response
    applyCorrectionToAttendance(correction, req.userId).catch(console.error);

    return res.json({
      success:    true,
      message:    'Correction approved and attendance updated',
      correction: fmtCorrection(correction)
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── POST /api/notifications/correction/:id/reject  (admin) ──────────────────

router.post('/correction/:id/reject', adminAuth, async (req, res) => {
  try {
    const { reason } = req.body;

    const correction = await CorrectionRequest.findOneAndUpdate(
      { _id: req.params.id, isDeleted: false, status: 'Pending' },
      {
        $set: {
          status:          'Rejected',
          approvedBy:      req.userId,
          approvedAt:      new Date().toLocaleString("en-US", {timeZone: "Asia/Karachi"}),
          rejectionReason: reason || 'Rejected by admin'
        }
      },
      { new: true }
    ).lean();

    if (!correction) {
      const exists = await CorrectionRequest.exists({ _id: req.params.id, isDeleted: false });
      return res.status(exists ? 400 : 404).json({
        success: false,
        message: exists ? 'Request already actioned' : 'Correction request not found'
      });
    }

    return res.json({
      success:    true,
      message:    'Correction request rejected',
      correction: fmtCorrection(correction)
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── domain helpers ───────────────────────────────────────────────────────────

/**
 * When a leave request is approved, upsert one AttendanceLog per leave day.
 * Uses bulkWrite for a single DB round-trip instead of N parallel findOneAndUpdate calls.
 */
async function applyLeaveToAttendance(leave, adminId) {
  const employee = await Employee.findById(leave.empId)
    .select('shift hourlyRate employeeNumber firstName lastName department')
    .lean();
  if (!employee) return;

  const { start, end } = employee.shift;
  let shiftDiff = toMin(end) - toMin(start);
  if (shiftDiff <= 0) shiftDiff += 1440;
  const scheduledHours = shiftDiff / 60;
  const basePay        = scheduledHours * employee.hourlyRate;
  const now            = new Date().toLocaleString("en-US", {timeZone: "Asia/Karachi"});
  const empName        = `${employee.firstName} ${employee.lastName}`;

  const ops = [];
  for (let d = new Date(leave.fromDate); d <= new Date(leave.toDate); d.setDate(d.getDate() + 1)) {
    const day = new Date(d);
    day.setHours(0, 0, 0, 0);

    ops.push({
      updateOne: {
        filter: { empId: leave.empId, date: day },
        update: {
          $setOnInsert: {
            empId:      leave.empId,
            date:       day,
            empNumber:  employee.employeeNumber,
            empName,
            department: employee.department
          },
          $set: {
            status:     'Leave',
            inOut:      { in: null, out: null, outNextDay: false },
            shift:      employee.shift,
            hourlyRate: employee.hourlyRate,
            financials: {
              hoursWorked:      scheduledHours,
              scheduledHours,
              basePay,
              deduction:        0,
              deductionDetails: [],
              otMultiplier:     1,
              otHours:          0,
              otAmount:         0,
              otDetails:        [],
              finalDayEarning:  basePay
            },
            manualOverride:            false,
            'metadata.source':         'leave_approval',
            'metadata.lastUpdatedBy':  adminId,
            'metadata.lastModifiedAt': now
          }
        },
        upsert: true
      }
    });
  }

  if (ops.length) {
    // Single round-trip for all days
    await AttendanceLog.bulkWrite(ops, { ordered: false });
  }
}

/**
 * When a correction is approved, apply corrected in/out times and recompute pay
 * in a single findOneAndUpdate + atomic $set — no separate find + save round-trip.
 */
async function applyCorrectionToAttendance(correction, adminId) {
  // First fetch the record to compute new financials (we need existing shift + rates)
  const record = await AttendanceLog.findOne({ empId: correction.empId, date: correction.date }).lean();
  if (!record) return;

  const updatedInOut = { ...record.inOut };
  if (correction.correctionType === 'In'   || correction.correctionType === 'Both') {
    updatedInOut.in  = correction.correctedInTime;
  }
  if (correction.correctionType === 'Out'  || correction.correctionType === 'Both') {
    updatedInOut.out = correction.correctedOutTime;
  }

  const $set = {
    inOut:                     updatedInOut,
    manualOverride:            false,
    'metadata.source':         'correction_approval',
    'metadata.lastUpdatedBy':  adminId,
    'metadata.lastModifiedAt': new Date().toLocaleString("en-US", {timeZone: "Asia/Karachi"})
  };

  const inTime  = updatedInOut.in;
  const outTime = updatedInOut.out;

  if (inTime && outTime) {
    let diff = toMin(outTime) - toMin(inTime);
    if (diff < 0) diff += 1440;
    const hours = diff / 60;
    const base  = hours * record.hourlyRate;

    $set['financials.hoursWorked']     = hours;
    $set['financials.basePay']         = base;
    $set['financials.finalDayEarning'] = Math.max(
      0,
      base - (record.financials?.deduction || 0) + (record.financials?.otAmount || 0)
    );
    $set.status = toMin(inTime) > toMin(record.shift.start) ? 'Late' : 'Present';
  }

  // Single atomic update — no second save() round-trip
  await AttendanceLog.updateOne({ empId: correction.empId, date: correction.date }, { $set });
}

export default router;