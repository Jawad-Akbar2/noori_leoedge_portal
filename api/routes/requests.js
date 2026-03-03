// routes/requests.js

import express from 'express';
import LeaveRequest      from '../models/LeaveRequest.js';
import CorrectionRequest from '../models/CorrectionRequest.js';
import AttendanceLog     from '../models/AttendanceLog.js';
import Employee          from '../models/Employee.js';
import { adminAuth, employeeAuth } from '../middleware/auth.js';
import { parseDDMMYYYY, formatDate } from '../utils/dateUtils.js';

const router = express.Router();

// ─── helpers ──────────────────────────────────────────────────────────────────

const toMin = (t) => {
  if (!t) return 0;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

const calcHours = (inT, outT, outNextDay = false) => {
  if (!inT || !outT) return 0;
  let diff = toMin(outT) - toMin(inT);
  if (outNextDay || diff < 0) diff += 1440;
  return Math.max(0, diff / 60);
};

const shiftHours = (shift) => {
  if (!shift?.start || !shift?.end) return 8;
  const isNight = toMin(shift.end) < toMin(shift.start);
  return calcHours(shift.start, shift.end, isNight);
};

const effectiveHourlyRate = (emp, workingDaysInPeriod = 26) => {
  if (emp.salaryType === 'monthly' && emp.monthlySalary) {
    const scheduledHrsPerDay = shiftHours(emp.shift) || 8;
    return emp.monthlySalary / (workingDaysInPeriod * scheduledHrsPerDay);
  }
  return emp.hourlyRate || 0;
};

const resolveCorrectionType = (correctedIn, correctedOut) => {
  if (correctedIn  && correctedOut)  return 'Both';
  if (correctedIn  && !correctedOut) return 'In';
  if (!correctedIn && correctedOut)  return 'Out';
  return 'Both';
};

// ─── POST /api/requests/leave/submit  (employee) ─────────────────────────────

router.post('/leave/submit', employeeAuth, async (req, res) => {
  try {
    const { fromDate, toDate, leaveType, reason } = req.body;

    if (!fromDate || !toDate || !leaveType || !reason) {
      return res.status(400).json({
        success: false,
        message: 'fromDate, toDate, leaveType, and reason are required'
      });
    }

    const parsedFrom = parseDDMMYYYY(fromDate) || new Date(fromDate);
    const parsedTo   = parseDDMMYYYY(toDate)   || new Date(toDate);

    if (!parsedFrom || isNaN(parsedFrom) || !parsedTo || isNaN(parsedTo)) {
      return res.status(400).json({ success: false, message: 'Invalid date format. Use dd/mm/yyyy or YYYY-MM-DD' });
    }

    parsedFrom.setHours(0, 0, 0, 0);
    parsedTo.setHours(0, 0, 0, 0);

    if (parsedTo < parsedFrom) {
      return res.status(400).json({ success: false, message: 'toDate must be on or after fromDate' });
    }

    // ── 90-day eligibility check ──────────────────────────────────────────────
    const employee = await Employee.findById(req.userId).lean();
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    const daysElapsed = Math.floor((Date.now() - new Date(employee.joiningDate)) / 86_400_000);
    if (daysElapsed < 90) {
      return res.status(400).json({
        success: false,
        message: `Leave not eligible yet. ${90 - daysElapsed} day(s) remaining.`,
        daysUntilEligible: 90 - daysElapsed
      });
    }

    // ── overlap check ─────────────────────────────────────────────────────────
    const overlap = await LeaveRequest.findOne({
      empId:     employee._id,
      status:    { $in: ['Pending', 'Approved'] },
      fromDate:  { $lte: parsedTo },
      toDate:    { $gte: parsedFrom },
      isDeleted: false
    });

    if (overlap) {
      return res.status(400).json({
        success: false,
        message: 'You already have a leave request (Pending or Approved) overlapping these dates.'
      });
    }

    const leaveRequest = new LeaveRequest({
      empId:              employee._id,
      empNumber:          employee.employeeNumber,
      empName:            `${employee.firstName} ${employee.lastName}`,
      department:         employee.department,
      leaveType,
      fromDate:           parsedFrom,
      toDate:             parsedTo,
      reason,
      status:             'Pending',
      eligibilityChecked: true
    });

    await leaveRequest.save();   // totalDays auto-computed by pre-save hook

    return res.status(201).json({
      success:   true,
      message:   'Leave request submitted',
      requestId: leaveRequest._id,
      request: {
        ...leaveRequest.toObject(),
        fromDateFormatted: formatDate(parsedFrom),
        toDateFormatted:   formatDate(parsedTo)
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── POST /api/requests/correction/submit  (employee) ────────────────────────

router.post('/correction/submit', employeeAuth, async (req, res) => {
  try {
    const { date, correctedInTime, correctedOutTime, reason } = req.body;

    if (!date || !reason) {
      return res.status(400).json({ success: false, message: 'date and reason are required' });
    }

    if (!correctedInTime && !correctedOutTime) {
      return res.status(400).json({
        success: false,
        message: 'Provide at least one of correctedInTime or correctedOutTime'
      });
    }

    // ── HH:mm format validation ───────────────────────────────────────────────
    const TIME_RE = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
    if (correctedInTime  && !TIME_RE.test(correctedInTime)) {
      return res.status(400).json({ success: false, message: 'correctedInTime must be HH:mm (24-hour)' });
    }
    if (correctedOutTime && !TIME_RE.test(correctedOutTime)) {
      return res.status(400).json({ success: false, message: 'correctedOutTime must be HH:mm (24-hour)' });
    }

    const parsedDate = parseDDMMYYYY(date) || new Date(date);
    if (!parsedDate || isNaN(parsedDate)) {
      return res.status(400).json({ success: false, message: 'Invalid date format' });
    }
    parsedDate.setHours(0, 0, 0, 0);

    const employee = await Employee.findById(req.userId).lean();
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    // ── duplicate pending correction guard ────────────────────────────────────
    const existing = await CorrectionRequest.findOne({
      empId:     employee._id,
      date:      parsedDate,
      status:    'Pending',
      isDeleted: false
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'You already have a pending correction request for this date.'
      });
    }

    const attendance = await AttendanceLog.findOne({
      empId: employee._id,
      date:  parsedDate
    }).lean();

    const correctionType = resolveCorrectionType(correctedInTime, correctedOutTime);

    // ── determine outNextDay for night-shift corrections ──────────────────────
    // If correcting Out on a night-shift employee and the corrected out time
    // is earlier than the in time (or the shift start), flag outNextDay.
    const isNightShift = toMin(employee.shift?.end) < toMin(employee.shift?.start);
    const effectiveIn  = correctedInTime || attendance?.inOut?.in || null;
    let outNextDay = attendance?.inOut?.outNextDay || false;
    if (correctedOutTime && effectiveIn) {
      outNextDay = isNightShift && toMin(correctedOutTime) < toMin(effectiveIn);
    }

    const correctionRequest = new CorrectionRequest({
      empId:            employee._id,
      empNumber:        employee.employeeNumber,
      empName:          `${employee.firstName} ${employee.lastName}`,
      department:       employee.department,
      attendanceLogRef: attendance?._id || null,
      date:             parsedDate,
      correctionType,
      originalInTime:   attendance?.inOut?.in  || null,
      correctedInTime:  correctedInTime        || null,
      originalOutTime:  attendance?.inOut?.out || null,
      correctedOutTime: correctedOutTime       || null,
      outNextDay,
      reason,
      source: 'employee',
      status: 'Pending'
    });

    await correctionRequest.save();

    return res.status(201).json({
      success:   true,
      message:   'Correction request submitted',
      requestId: correctionRequest._id,
      request:   { ...correctionRequest.toObject(), dateFormatted: formatDate(parsedDate) }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /api/requests/my-requests  (employee) ───────────────────────────────

router.get('/my-requests', employeeAuth, async (req, res) => {
  try {
    const { status, type, fromDate, toDate } = req.query;

    const baseQuery = { empId: req.userId, isDeleted: false };

    if (fromDate && toDate) {
      const start = parseDDMMYYYY(fromDate) || new Date(fromDate);
      const end   = parseDDMMYYYY(toDate)   || new Date(toDate);
      if (start && !isNaN(start) && end && !isNaN(end)) {
        end.setHours(23, 59, 59, 999);
        baseQuery.createdAt = { $gte: start, $lte: end };
      }
    }

    const leaveQuery      = { ...baseQuery, ...(status ? { status } : {}) };
    const correctionQuery = { ...baseQuery, ...(status ? { status } : {}) };

    const [leaveRequests, correctionRequests] = await Promise.all([
      (!type || type === 'leave')
        ? LeaveRequest.find(leaveQuery).sort({ createdAt: -1 }).lean()
        : Promise.resolve([]),
      (!type || type === 'correction')
        ? CorrectionRequest.find(correctionQuery).sort({ createdAt: -1 }).lean()
        : Promise.resolve([])
    ]);

    return res.json({
      success: true,
      leaveRequests: leaveRequests.map(r => ({
        ...r,
        fromDateFormatted: formatDate(r.fromDate),
        toDateFormatted:   formatDate(r.toDate)
      })),
      correctionRequests: correctionRequests.map(r => ({
        ...r,
        dateFormatted: formatDate(r.date)
      })),
      total: leaveRequests.length + correctionRequests.length
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /api/requests/admin/pending  (admin) ────────────────────────────────

router.get('/admin/pending', adminAuth, async (req, res) => {
  try {
    const days   = Math.min(Number(req.query.days) || 45, 180);
    const cutoff = new Date(Date.now() - days * 86_400_000);

    const [leaveRequests, correctionRequests] = await Promise.all([
      LeaveRequest.find({ status: 'Pending', isDeleted: false, createdAt: { $gte: cutoff } })
        .populate('empId', 'firstName lastName employeeNumber department shift')
        .sort({ createdAt: -1 })
        .lean(),
      CorrectionRequest.find({ status: 'Pending', isDeleted: false, createdAt: { $gte: cutoff } })
        .populate('empId', 'firstName lastName employeeNumber department shift')
        .sort({ createdAt: -1 })
        .lean()
    ]);

    return res.json({
      success: true,
      leaveRequests: leaveRequests.map(r => ({
        ...r,
        fromDateFormatted: formatDate(r.fromDate),
        toDateFormatted:   formatDate(r.toDate)
      })),
      correctionRequests: correctionRequests.map(r => ({
        ...r,
        dateFormatted: formatDate(r.date)
      })),
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

// ─── GET /api/requests/admin/all  (admin) ────────────────────────────────────
// Full history with optional filters: status, type, empId, fromDate, toDate

router.get('/admin/all', adminAuth, async (req, res) => {
  try {
    const { status, type, empId, fromDate, toDate, page = 1, limit = 50 } = req.query;

    const baseQuery = { isDeleted: false };
    if (status) baseQuery.status = status;
    if (empId)  baseQuery.empId  = empId;

    if (fromDate && toDate) {
      const start = parseDDMMYYYY(fromDate) || new Date(fromDate);
      const end   = parseDDMMYYYY(toDate)   || new Date(toDate);
      if (start && end) {
        end.setHours(23, 59, 59, 999);
        baseQuery.createdAt = { $gte: start, $lte: end };
      }
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [leaveRequests, correctionRequests] = await Promise.all([
      (!type || type === 'leave')
        ? LeaveRequest.find(baseQuery)
            .populate('empId', 'firstName lastName employeeNumber department')
            .sort({ createdAt: -1 })
            .skip(skip).limit(Number(limit))
            .lean()
        : Promise.resolve([]),
      (!type || type === 'correction')
        ? CorrectionRequest.find(baseQuery)
            .populate('empId', 'firstName lastName employeeNumber department')
            .sort({ createdAt: -1 })
            .skip(skip).limit(Number(limit))
            .lean()
        : Promise.resolve([])
    ]);

    return res.json({
      success: true,
      leaveRequests:      leaveRequests.map(r => ({ ...r, fromDateFormatted: formatDate(r.fromDate), toDateFormatted: formatDate(r.toDate) })),
      correctionRequests: correctionRequests.map(r => ({ ...r, dateFormatted: formatDate(r.date) })),
      total: leaveRequests.length + correctionRequests.length
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── PATCH /api/requests/leave/:requestId/approve  (admin) ───────────────────

router.patch('/leave/:requestId/approve', adminAuth, async (req, res) => {
  try {
    const leaveRequest = await LeaveRequest.findOne({
      _id: req.params.requestId, isDeleted: false
    });
    if (!leaveRequest) {
      return res.status(404).json({ success: false, message: 'Leave request not found' });
    }
    if (leaveRequest.status !== 'Pending') {
      return res.status(400).json({ success: false, message: `Request already ${leaveRequest.status.toLowerCase()}` });
    }

    const employee = await Employee.findById(leaveRequest.empId).lean();
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    // ── mark approved FIRST so a DB error in attendance ops doesn't leave
    //    the request in Pending with partial attendance rows written ───────────
    leaveRequest.status     = 'Approved';
    leaveRequest.approvedBy = req.userId;
    leaveRequest.approvedAt = new Date();

    // Build the list of affected dates BEFORE saving so we can store them
    const affectedDates = [];
    for (
      let d = new Date(leaveRequest.fromDate);
      d <= new Date(leaveRequest.toDate);
      d.setDate(d.getDate() + 1)
    ) {
      const day = new Date(d);
      day.setHours(0, 0, 0, 0);
      affectedDates.push(day.toISOString().slice(0, 10));
    }
    leaveRequest.affectedAttendanceDates = affectedDates;

    await leaveRequest.save();

    // ── upsert AttendanceLog for each leave day ───────────────────────────────
    const schedHours = shiftHours(employee.shift);
    const rate       = effectiveHourlyRate(employee, 26);
    const basePay    = schedHours * rate;

    const ops = affectedDates.map(iso => {
      const day = new Date(iso);
      day.setHours(0, 0, 0, 0);

      return AttendanceLog.findOneAndUpdate(
        { empId: leaveRequest.empId, date: day },
        {
          $setOnInsert: {
            empId:      leaveRequest.empId,
            date:       day,
            empNumber:  employee.employeeNumber,
            empName:    `${employee.firstName} ${employee.lastName}`,
            department: employee.department
          },
          $set: {
            status:     'Leave',
            inOut:      { in: null, out: null, outNextDay: false },
            shift: {
              start:        employee.shift.start,
              end:          employee.shift.end,
              isNightShift: toMin(employee.shift.end) < toMin(employee.shift.start)
            },
            hourlyRate: rate,
            financials: {
              hoursWorked:      schedHours,
              scheduledHours:   schedHours,
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
            'metadata.lastUpdatedBy':  req.userId,
            'metadata.lastModifiedAt': new Date()
          }
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      ).catch(err => ({ error: err.message }));
    });

    await Promise.all(ops);

    return res.json({
      success: true,
      message: `Leave approved. ${affectedDates.length} attendance record(s) updated.`,
      leaveRequest: {
        ...leaveRequest.toObject(),
        fromDateFormatted: formatDate(leaveRequest.fromDate),
        toDateFormatted:   formatDate(leaveRequest.toDate)
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── PATCH /api/requests/leave/:requestId/reject  (admin) ────────────────────

router.patch('/leave/:requestId/reject', adminAuth, async (req, res) => {
  try {
    const { reason } = req.body;

    const leaveRequest = await LeaveRequest.findOne({
      _id: req.params.requestId, isDeleted: false
    });
    if (!leaveRequest) {
      return res.status(404).json({ success: false, message: 'Leave request not found' });
    }
    if (leaveRequest.status !== 'Pending') {
      return res.status(400).json({ success: false, message: `Request already ${leaveRequest.status.toLowerCase()}` });
    }

    leaveRequest.status          = 'Rejected';
    leaveRequest.approvedBy      = req.userId;
    leaveRequest.approvedAt      = new Date();
    leaveRequest.rejectionReason = reason?.trim() || 'Rejected by admin';
    await leaveRequest.save();

    return res.json({
      success: true,
      message: 'Leave request rejected',
      leaveRequest: {
        ...leaveRequest.toObject(),
        fromDateFormatted: formatDate(leaveRequest.fromDate),
        toDateFormatted:   formatDate(leaveRequest.toDate)
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── PATCH /api/requests/correction/:requestId/approve  (admin) ──────────────

router.patch('/correction/:requestId/approve', adminAuth, async (req, res) => {
  try {
    const correctionRequest = await CorrectionRequest.findOne({
      _id: req.params.requestId, isDeleted: false
    });
    if (!correctionRequest) {
      return res.status(404).json({ success: false, message: 'Correction request not found' });
    }
    if (correctionRequest.status !== 'Pending') {
      return res.status(400).json({ success: false, message: `Request already ${correctionRequest.status.toLowerCase()}` });
    }

    const employee = await Employee.findById(correctionRequest.empId).lean();
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    const dateObj = new Date(correctionRequest.date);
    dateObj.setHours(0, 0, 0, 0);

    // ── load or create the AttendanceLog row ──────────────────────────────────
    // Use attendanceLogRef if available (populated by the DB model) for an
    // indexed direct hit; fall back to the compound { empId, date } lookup.
    let record = correctionRequest.attendanceLogRef
      ? await AttendanceLog.findById(correctionRequest.attendanceLogRef)
      : await AttendanceLog.findOne({ empId: correctionRequest.empId, date: dateObj });

    const isNightShift = toMin(employee.shift.end) < toMin(employee.shift.start);
    const rate         = effectiveHourlyRate(employee, 26);

    if (!record) {
      record = new AttendanceLog({
        empId:      correctionRequest.empId,
        date:       dateObj,
        empNumber:  employee.employeeNumber,
        empName:    `${employee.firstName} ${employee.lastName}`,
        department: employee.department,
        shift: {
          start:        employee.shift.start,
          end:          employee.shift.end,
          isNightShift
        },
        hourlyRate: rate,
        status:     'Absent'
      });
    }

    // ── apply only the corrected fields ───────────────────────────────────────
    const currentInOut = record.inOut?.toObject?.()
      ? record.inOut.toObject()
      : { ...(record.inOut || {}) };

    if (['In', 'Both'].includes(correctionRequest.correctionType)) {
      currentInOut.in = correctionRequest.correctedInTime;
    }
    if (['Out', 'Both'].includes(correctionRequest.correctionType)) {
      currentInOut.out = correctionRequest.correctedOutTime;
    }

    // Re-derive outNextDay after applying the corrected times
    if (currentInOut.in && currentInOut.out) {
      currentInOut.outNextDay = isNightShift && toMin(currentInOut.out) < toMin(currentInOut.in);
    } else {
      // If the correction supplied an outNextDay override (stored on the request), honour it
      currentInOut.outNextDay = correctionRequest.outNextDay || false;
    }

    record.inOut = currentInOut;

    // ── recompute financials — preserve existing deductions & OT ─────────────
    if (currentInOut.in && currentInOut.out) {
      const hours  = calcHours(currentInOut.in, currentInOut.out, currentInOut.outNextDay);
      const base   = hours * rate;

      // Pull existing financials safely whether doc is new or existing
      const existingFin        = record.financials?.toObject?.() || { ...(record.financials || {}) };
      const existingDeduction  = existingFin.deduction  || 0;
      const existingOtAmount   = existingFin.otAmount   || 0;

      record.financials = {
        ...existingFin,
        hoursWorked:     hours,
        scheduledHours:  shiftHours(employee.shift),
        basePay:         base,
        finalDayEarning: Math.max(0, base - existingDeduction + existingOtAmount)
      };

      // Re-evaluate status based on corrected in-time
      record.status = toMin(currentInOut.in) > toMin(employee.shift.start) ? 'Late' : 'Present';
    } else if (currentInOut.in || currentInOut.out) {
      // Only one side present after correction → 50% pay penalty
      const schedHrs           = shiftHours(employee.shift);
      const base               = schedHrs * rate * 0.5;
      const existingFin        = record.financials?.toObject?.() || { ...(record.financials || {}) };
      const existingDeduction  = existingFin.deduction  || 0;
      const existingOtAmount   = existingFin.otAmount   || 0;

      record.financials = {
        ...existingFin,
        hoursWorked:     schedHrs,
        scheduledHours:  schedHrs,
        basePay:         base,
        finalDayEarning: Math.max(0, base - existingDeduction + existingOtAmount)
      };
      record.status = 'Present';
    }

    record.hourlyRate     = rate;
    record.manualOverride = false;
    record.metadata = {
      ...(record.metadata?.toObject?.() || { ...(record.metadata || {}) }),
      source:         'correction_approval',
      lastUpdatedBy:  req.userId,
      lastModifiedAt: new Date()
    };

    await record.save();

    // ── mark correction as approved AFTER attendance is successfully saved ────
    correctionRequest.status          = 'Approved';
    correctionRequest.approvedBy      = req.userId;
    correctionRequest.approvedAt      = new Date();
    correctionRequest.attendanceLogRef = record._id;   // keep ref in sync
    await correctionRequest.save();

    return res.json({
      success: true,
      message: 'Correction approved and attendance updated',
      correctionRequest: { ...correctionRequest.toObject(), dateFormatted: formatDate(correctionRequest.date) },
      updatedAttendance: record
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── PATCH /api/requests/correction/:requestId/reject  (admin) ───────────────

router.patch('/correction/:requestId/reject', adminAuth, async (req, res) => {
  try {
    const { reason } = req.body;

    const correctionRequest = await CorrectionRequest.findOne({
      _id: req.params.requestId, isDeleted: false
    });
    if (!correctionRequest) {
      return res.status(404).json({ success: false, message: 'Correction request not found' });
    }
    if (correctionRequest.status !== 'Pending') {
      return res.status(400).json({ success: false, message: `Request already ${correctionRequest.status.toLowerCase()}` });
    }

    correctionRequest.status          = 'Rejected';
    correctionRequest.approvedBy      = req.userId;
    correctionRequest.approvedAt      = new Date();
    correctionRequest.rejectionReason = reason?.trim() || 'Rejected by admin';
    await correctionRequest.save();

    return res.json({
      success: true,
      message: 'Correction request rejected',
      correctionRequest: { ...correctionRequest.toObject(), dateFormatted: formatDate(correctionRequest.date) }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;