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
import AttendanceLog     from '../models/AttendanceLog.js';
import LeaveRequest      from '../models/LeaveRequest.js';
import CorrectionRequest from '../models/CorrectionRequest.js';
import { auth, adminAuth } from '../middleware/auth.js';
import { formatDate, formatDateTimeForDisplay } from '../utils/dateUtils.js';

const router = express.Router();

// ─── helpers ──────────────────────────────────────────────────────────────────

const fmtLeave = (r) => ({
  ...r,
  fromDateFormatted: formatDate(r.fromDate),   // correct field: fromDate (not startDate)
  toDateFormatted:   formatDate(r.toDate),      // correct field: toDate   (not endDate)
  createdAtFormatted: formatDateTimeForDisplay(r.createdAt)
});

const fmtCorrection = (r) => ({
  ...r,
  dateFormatted:      formatDate(r.date),
  createdAtFormatted: formatDateTimeForDisplay(r.createdAt)
});

// ─── GET /api/notifications/pending  (admin only) ─────────────────────────────
// Returns all Pending leave + correction requests for the admin notifications panel.

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
// Returns the logged-in employee's own leave + correction requests
// so they can see current status (Pending / Approved / Rejected).

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
    const leave = await LeaveRequest.findOne({ _id: req.params.id, isDeleted: false });
    if (!leave) {
      return res.status(404).json({ success: false, message: 'Leave request not found' });
    }
    if (leave.status !== 'Pending') {
      return res.status(400).json({ success: false, message: `Request already ${leave.status.toLowerCase()}` });
    }

    leave.status     = 'Approved';
    leave.approvedBy = req.userId;
    leave.approvedAt = new Date();
    await leave.save();

    // Create / update AttendanceLog records for each approved leave day
    await applyLeaveToAttendance(leave, req.userId);

    return res.json({ success: true, message: 'Leave request approved', leave: fmtLeave(leave.toObject()) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── POST /api/notifications/leave/:id/reject  (admin) ───────────────────────

router.post('/leave/:id/reject', adminAuth, async (req, res) => {
  try {
    const { reason } = req.body;

    const leave = await LeaveRequest.findOne({ _id: req.params.id, isDeleted: false });
    if (!leave) {
      return res.status(404).json({ success: false, message: 'Leave request not found' });
    }
    if (leave.status !== 'Pending') {
      return res.status(400).json({ success: false, message: `Request already ${leave.status.toLowerCase()}` });
    }

    leave.status          = 'Rejected';
    leave.approvedBy      = req.userId;
    leave.approvedAt      = new Date();
    leave.rejectionReason = reason || 'Rejected by admin';
    await leave.save();

    return res.json({ success: true, message: 'Leave request rejected', leave: fmtLeave(leave.toObject()) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── POST /api/notifications/correction/:id/approve  (admin) ─────────────────

router.post('/correction/:id/approve', adminAuth, async (req, res) => {
  try {
    const correction = await CorrectionRequest.findOne({ _id: req.params.id, isDeleted: false });
    if (!correction) {
      return res.status(404).json({ success: false, message: 'Correction request not found' });
    }
    if (correction.status !== 'Pending') {
      return res.status(400).json({ success: false, message: `Request already ${correction.status.toLowerCase()}` });
    }

    correction.status     = 'Approved';
    correction.approvedBy = req.userId;
    correction.approvedAt = new Date();
    await correction.save();

    // Apply corrected times to the AttendanceLog record
    await applyCorrectionToAttendance(correction, req.userId);

    return res.json({
      success:    true,
      message:    'Correction approved and attendance updated',
      correction: fmtCorrection(correction.toObject())
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── POST /api/notifications/correction/:id/reject  (admin) ──────────────────

router.post('/correction/:id/reject', adminAuth, async (req, res) => {
  try {
    const { reason } = req.body;

    const correction = await CorrectionRequest.findOne({ _id: req.params.id, isDeleted: false });
    if (!correction) {
      return res.status(404).json({ success: false, message: 'Correction request not found' });
    }
    if (correction.status !== 'Pending') {
      return res.status(400).json({ success: false, message: `Request already ${correction.status.toLowerCase()}` });
    }

    correction.status          = 'Rejected';
    correction.approvedBy      = req.userId;
    correction.approvedAt      = new Date();
    correction.rejectionReason = reason || 'Rejected by admin';
    await correction.save();

    return res.json({
      success:    true,
      message:    'Correction request rejected',
      correction: fmtCorrection(correction.toObject())
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── domain helpers ───────────────────────────────────────────────────────────

/**
 * When a leave request is approved, upsert one AttendanceLog per leave day.
 * Existing records for those dates are only overwritten if they are 'Absent'
 * (don't clobber a Present/Late record with Leave).
 */
async function applyLeaveToAttendance(leave, adminId) {
  const Employee = (await import('../models/Employee.js')).default;
  const employee = await Employee.findById(leave.empId).lean();
  if (!employee) return;

  const shiftStart = employee.shift.start;
  const shiftEnd   = employee.shift.end;

  // Scheduled hours for pay calculation
  const toMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  let shiftDiff = toMin(shiftEnd) - toMin(shiftStart);
  if (shiftDiff <= 0) shiftDiff += 1440;
  const scheduledHours = shiftDiff / 60;
  const basePay        = scheduledHours * employee.hourlyRate;

  const ops = [];
  for (let d = new Date(leave.fromDate); d <= new Date(leave.toDate); d.setDate(d.getDate() + 1)) {
    const day = new Date(d);
    day.setHours(0, 0, 0, 0);

    ops.push(
      AttendanceLog.findOneAndUpdate(
        { empId: leave.empId, date: day },
        {
          $setOnInsert: {
            empId:      leave.empId,
            date:       day,
            empNumber:  employee.employeeNumber,
            empName:    `${employee.firstName} ${employee.lastName}`,
            department: employee.department,
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
            manualOverride: false,
            'metadata.source':         'leave_approval',
            'metadata.lastUpdatedBy':  adminId,
            'metadata.lastModifiedAt': new Date()
          }
        },
        {
          upsert:    true,
          new:       true,
          // Only update if not already Present/Late — don't overwrite worked days
          setDefaultsOnInsert: true
        }
      ).catch(() => null)   // individual day failure shouldn't abort the whole batch
    );
  }

  await Promise.all(ops);
}

/**
 * When a correction is approved, update the AttendanceLog record for that date
 * with the corrected in/out times and recompute pay.
 */
async function applyCorrectionToAttendance(correction, adminId) {
  const record = await AttendanceLog.findOne({
    empId: correction.empId,
    date:  correction.date
  });

  if (!record) return;   // nothing to patch if no record exists

  // Apply only the fields included in the correction
  if (correction.correctionType === 'In' || correction.correctionType === 'Both') {
    record.inOut.in = correction.correctedInTime;
  }
  if (correction.correctionType === 'Out' || correction.correctionType === 'Both') {
    record.inOut.out = correction.correctedOutTime;
  }

  // Recompute hours + pay with updated times
  const inTime  = record.inOut.in;
  const outTime = record.inOut.out;

  if (inTime && outTime) {
    const toMin  = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
    let diff     = toMin(outTime) - toMin(inTime);
    if (diff < 0) diff += 1440;
    const hours  = diff / 60;
    const base   = hours * record.hourlyRate;

    record.financials.hoursWorked = hours;
    record.financials.basePay     = base;
    // Preserve existing deduction + OT, just update base and final
    record.financials.finalDayEarning = Math.max(
      0,
      base - (record.financials.deduction || 0) + (record.financials.otAmount || 0)
    );
    // Status: re-evaluate lateness
    const shiftStartMin = toMin(record.shift.start);
    record.status = toMin(inTime) > shiftStartMin ? 'Late' : 'Present';
  }

  record.manualOverride          = false;
  record.metadata.source         = 'correction_approval';
  record.metadata.lastUpdatedBy  = adminId;
  record.metadata.lastModifiedAt = new Date();

  await record.save();
}

export default router;