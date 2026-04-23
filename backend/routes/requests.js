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
const effectiveHourlyRate = (emp, workingDaysInPeriod = 21) => {
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

// Minimal employee fields needed for attendance ops — avoids fetching images etc.
const EMP_ATTENDANCE_FIELDS =
  'employeeNumber firstName lastName department shift salaryType hourlyRate monthlySalary';

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

    // ── fetch employee + overlap check in parallel ────────────────────────────
    const [employee, overlap] = await Promise.all([
      Employee.findById(req.userId)
        .select('joiningDate employeeNumber firstName lastName department')
        .lean(),
      LeaveRequest.findOne({
        empId:     req.userId,
        status:    { $in: ['Pending', 'Approved'] },
        fromDate:  { $lte: parsedTo },
        toDate:    { $gte: parsedFrom },
        isDeleted: false
      }).select('_id').lean()
    ]);

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
    await leaveRequest.save();

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

    // ── fetch employee + duplicate check + existing attendance in parallel ────
    const [employee, existing, attendance] = await Promise.all([
      Employee.findById(req.userId)
        .select('employeeNumber firstName lastName department shift')
        .lean(),
      CorrectionRequest.findOne({
        empId:     req.userId,
        date:      parsedDate,
        status:    'Pending',
        isDeleted: false
      }).select('_id').lean(),
      AttendanceLog.findOne({ empId: req.userId, date: parsedDate })
        .select('inOut _id')
        .lean()
    ]);

    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'You already have a pending correction request for this date.'
      });
    }

    const correctionType = resolveCorrectionType(correctedInTime, correctedOutTime);
    const isNightShift   = toMin(employee.shift?.end) < toMin(employee.shift?.start);
    const effectiveIn    = correctedInTime || attendance?.inOut?.in || null;
    let outNextDay       = attendance?.inOut?.outNextDay || false;
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
        ? LeaveRequest.find(leaveQuery).select('-__v').sort({ createdAt: -1 }).lean()
        : [],
      (!type || type === 'correction')
        ? CorrectionRequest.find(correctionQuery).select('-__v').sort({ createdAt: -1 }).lean()
        : []
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
    const baseFilter = { status: 'Pending', isDeleted: false, createdAt: { $gte: cutoff } };

    const [leaveRequests, correctionRequests] = await Promise.all([
      LeaveRequest.find(baseFilter)
        .select('-__v')
        .populate('empId', 'firstName lastName employeeNumber department shift')
        .sort({ createdAt: -1 })
        .lean(),
      CorrectionRequest.find(baseFilter)
        .select('-__v')
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

    const skip     = (Number(page) - 1) * Number(limit);
    const limitNum = Number(limit);

    const [leaveRequests, correctionRequests] = await Promise.all([
      (!type || type === 'leave')
        ? LeaveRequest.find(baseQuery)
            .select('-__v')
            .populate('empId', 'firstName lastName employeeNumber department')
            .sort({ createdAt: -1 })
            .skip(skip).limit(limitNum)
            .lean()
        : [],
      (!type || type === 'correction')
        ? CorrectionRequest.find(baseQuery)
            .select('-__v')
            .populate('empId', 'firstName lastName employeeNumber department')
            .sort({ createdAt: -1 })
            .skip(skip).limit(limitNum)
            .lean()
        : []
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
    // ── fetch leave request + employee in parallel ────────────────────────────
    const leaveRequest = await LeaveRequest.findOne({
      _id: req.params.requestId, isDeleted: false
    }).select('-__v');

    if (!leaveRequest) {
      return res.status(404).json({ success: false, message: 'Leave request not found' });
    }
    if (leaveRequest.status !== 'Pending') {
      return res.status(400).json({ success: false, message: `Request already ${leaveRequest.status.toLowerCase()}` });
    }

    const employee = await Employee.findById(leaveRequest.empId)
      .select(EMP_ATTENDANCE_FIELDS)
      .lean();
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    // ── compute affected dates ────────────────────────────────────────────────
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

    leaveRequest.status                  = 'Approved';
    leaveRequest.approvedBy              = req.userId;
    leaveRequest.approvedAt              = new Date();
    leaveRequest.affectedAttendanceDates = affectedDates;

    const schedHours = shiftHours(employee.shift);
    const rate       = effectiveHourlyRate(employee, 21);
    const basePay    = schedHours * rate;
    const now        = new Date();

    // ── save leave + all attendance upserts in parallel ───────────────────────
    await Promise.all([
      leaveRequest.save(),
      ...affectedDates.map(iso => {
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
              status:  'Leave',
              inOut:   { in: null, out: null, outNextDay: false },
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
              'metadata.lastModifiedAt': now
            }
          },
          { upsert: true, new: false, setDefaultsOnInsert: true }
        );
      })
    ]);

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
    }).select('status empId fromDate toDate');

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
    }).select('-__v');

    if (!correctionRequest) {
      return res.status(404).json({ success: false, message: 'Correction request not found' });
    }
    if (correctionRequest.status !== 'Pending') {
      return res.status(400).json({ success: false, message: `Request already ${correctionRequest.status.toLowerCase()}` });
    }

    const dateObj = new Date(correctionRequest.date);
    dateObj.setHours(0, 0, 0, 0);

    // ── fetch employee + existing attendance log in parallel ──────────────────
    const [employee, existingRecord] = await Promise.all([
      Employee.findById(correctionRequest.empId)
        .select(EMP_ATTENDANCE_FIELDS)
        .lean(),
      correctionRequest.attendanceLogRef
        ? AttendanceLog.findById(correctionRequest.attendanceLogRef)
        : AttendanceLog.findOne({ empId: correctionRequest.empId, date: dateObj })
    ]);

    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    const isNightShift = toMin(employee.shift.end) < toMin(employee.shift.start);
    const rate         = effectiveHourlyRate(employee, 21);

    let record = existingRecord;
    if (!record) {
      record = new AttendanceLog({
        empId:      correctionRequest.empId,
        date:       dateObj,
        empNumber:  employee.employeeNumber,
        empName:    `${employee.firstName} ${employee.lastName}`,
        department: employee.department,
        shift:      { start: employee.shift.start, end: employee.shift.end, isNightShift },
        hourlyRate: rate,
        status:     'OffDay'
      });
    }

    // ── apply corrected fields ────────────────────────────────────────────────
    const currentInOut = record.inOut?.toObject?.() ?? { ...(record.inOut || {}) };

    if (['In', 'Both'].includes(correctionRequest.correctionType)) {
      currentInOut.in = correctionRequest.correctedInTime;
    }
    if (['Out', 'Both'].includes(correctionRequest.correctionType)) {
      currentInOut.out = correctionRequest.correctedOutTime;
    }

    currentInOut.outNextDay = (currentInOut.in && currentInOut.out)
      ? isNightShift && toMin(currentInOut.out) < toMin(currentInOut.in)
      : (correctionRequest.outNextDay || false);

    record.inOut = currentInOut;

    // ── recompute financials ──────────────────────────────────────────────────
    const existingFin       = record.financials?.toObject?.() ?? { ...(record.financials || {}) };
    const existingDeduction = existingFin.deduction  || 0;
    const existingOtAmount  = existingFin.otAmount   || 0;

    if (currentInOut.in && currentInOut.out) {
      const hours = calcHours(currentInOut.in, currentInOut.out, currentInOut.outNextDay);
      const base  = hours * rate;
      record.financials = {
        ...existingFin,
        hoursWorked:     hours,
        scheduledHours:  shiftHours(employee.shift),
        basePay:         base,
        finalDayEarning: Math.max(0, base - existingDeduction + existingOtAmount)
      };
      record.status = toMin(currentInOut.in) > toMin(employee.shift.start) ? 'Late' : 'Present';
    } else if (currentInOut.in || currentInOut.out) {
      const schedHrs = shiftHours(employee.shift);
      const base     = schedHrs * rate * 0.5;
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
      ...(record.metadata?.toObject?.() ?? { ...(record.metadata || {}) }),
      source:         'correction_approval',
      lastUpdatedBy:  req.userId,
      lastModifiedAt: new Date()
    };

    // ── save attendance then mark approved ────────────────────────────────────
    await record.save();

    correctionRequest.status           = 'Approved';
    correctionRequest.approvedBy       = req.userId;
    correctionRequest.approvedAt       = new Date();
    correctionRequest.attendanceLogRef = record._id;
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
    }).select('status date empId');

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