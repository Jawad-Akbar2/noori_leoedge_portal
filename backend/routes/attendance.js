// routes/attendance.js

import express from 'express';
import multer from 'multer';
import AttendanceLog from '../models/AttendanceLog.js';
import Employee from '../models/Employee.js';
import { adminAuth } from '../middleware/auth.js';
import validateCSVFile from '../middleware/csvValidator.js';
import { parseCSV, groupByEmployeeAndDate, mergeTimes } from '../utils/csvParser.js';
import { formatDate, formatDateTimeForDisplay, parseDDMMYYYY } from '../utils/dateUtils.js';

const router = express.Router();

// ─── Only superadmin is login-only — excluded from attendance/payroll logic ───
const SYSTEM_ROLES = ['superadmin'];

const payrollEmployeeFilter = (extra = {}) => ({
  role:       { $nin: SYSTEM_ROLES },
  status:     'Active',
  isArchived: false,
  isDeleted:  false,
  ...extra
});

// ─── multer ───────────────────────────────────────────────────────────────────

const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = file.mimetype.includes('csv') ||
               file.mimetype.includes('text') ||
               file.originalname.endsWith('.csv');
    cb(ok ? null : new Error('Invalid file type'), ok);
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// ─── PURE TIME HELPERS ───────────────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════

/** Convert "HH:mm" → total minutes since midnight */
const toMin = (t) => {
  if (!t) return 0;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

/** Hours between two HH:mm times, respecting outNextDay for night shifts */
function calcHours(inTime, outTime, outNextDay = false) {
  if (!inTime || !outTime) return 0;
  let diff = toMin(outTime) - toMin(inTime);
  if (outNextDay || diff < 0) diff += 1440;
  return Math.max(0, diff / 60);
}

/** Scheduled shift duration in hours (handles night shifts) */
function shiftHours(shift) {
  if (!shift?.start || !shift?.end) return 8;
  const isNight = toMin(shift.end) < toMin(shift.start);
  return calcHours(shift.start, shift.end, isNight);
}

/** Returns true when employee arrived strictly after shift start */
function isLate(inTime, shiftStart) {
  if (!inTime || !shiftStart) return false;
  return toMin(inTime) > toMin(shiftStart);
}

/** Effective hourly rate — derives from monthlySalary for monthly employees */
function effectiveHourlyRate(emp, workingDaysInPeriod = 26) {
  if (emp.salaryType === 'monthly' && emp.monthlySalary) {
    const scheduledHrsPerDay = shiftHours(emp.shift) || 8;
    return emp.monthlySalary / (workingDaysInPeriod * scheduledHrsPerDay);
  }
  return emp.hourlyRate || 0;
}

// ═════════════════════════════════════════════════════════════════════════════
// ─── DEDUCTION ENGINE ────────────────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════
//
// Single source of truth for ALL deduction logic.
// Called by CSV import, save-row, bulk-save, and correction re-calc.
//
// LOGIN brackets (relative to shift.start):
//   inTime ≤ shiftStart − 10 min             → 0 PKR
//   inTime in (shiftStart−10, shiftStart−5]  → 250 PKR  fixed_penalty
//   inTime in (shiftStart−5,  shiftStart]    → 500 PKR  fixed_penalty
//   inTime > shiftStart (late)               → 800 PKR  fixed_penalty
//   inTime > shiftStart + 30 min             → 800 PKR  fixed_penalty
//                                            + 1 × hourlyRate  hourly_penalty
//
// LOGOUT brackets (relative to shift.end, night-shift aware):
//   outTime ≥ shiftEnd                       → 0 PKR
//   outTime in [shiftEnd−30, shiftEnd)       → 500 PKR  early_logout
//   outTime < shiftEnd − 30 min              → 800 PKR  early_logout
//
// Both penalties STACK on the same day.
// No deduction is applied when inTime or outTime is absent (handled by 50%-pay
// logic inside buildFinancials instead).
// OT is NEVER touched here — admin-only manual field.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {string|null} inTime       – HH:mm or null
 * @param {string|null} outTime      – HH:mm or null
 * @param {boolean}     outNextDay   – true when outTime crosses midnight
 * @param {{ start: string, end: string, isNightShift?: boolean }} shift
 * @param {number}      hourlyRate   – effective rate at time of log
 *
 * @returns {{
 *   deductionDetails: Array,
 *   totalDeduction:   number,
 *   lateMinutes:      number,
 *   earlyLogoutMinutes: number
 * }}
 */
function computeDeductions({ inTime, outTime, outNextDay = false, shift, hourlyRate }) {
  const details = [];
  let lateMinutes        = 0;
  let earlyLogoutMinutes = 0;

  const shiftStartMin = toMin(shift.start);
  const isNightShift  = toMin(shift.end) < toMin(shift.start);

  // ── LOGIN penalty ──────────────────────────────────────────────────────────
  // Only applies when the employee actually checked in.
  if (inTime) {
    const inMin        = toMin(inTime);
    // For night shifts the "in" time might wrap — normalise to shift-relative minutes
    // by projecting inMin forward if it appears numerically before shiftStart
    let normInMin = inMin;
    if (isNightShift && inMin < shiftStartMin) normInMin += 1440;

    // Minutes relative to shift start (positive = after start, negative = before)
    const diffFromStart = normInMin - shiftStartMin;

    if (diffFromStart > 30) {
      // More than 30 minutes late → 800 fixed + 1 hour salary
      lateMinutes = diffFromStart;
      details.push({
        type:   'fixed_penalty',
        amount: 800,
        reason: `Late login: ${diffFromStart} min after shift start (>30 min bracket)`
      });
      details.push({
        type:   'hourly_penalty',
        amount: Math.round(hourlyRate),   // exactly 1 × hourlyRate
        reason: `Additional 1-hour salary deduction for login >30 min late`
      });
    } else if (diffFromStart > 0) {
      // 1–30 minutes late → 800 fixed only
      lateMinutes = diffFromStart;
      details.push({
        type:   'fixed_penalty',
        amount: 800,
        reason: `Late login: ${diffFromStart} min after shift start (1–30 min bracket)`
      });
    } else if (diffFromStart > -5) {
      // Within 5 minutes before shift start → 500 PKR
      // diffFromStart is in (−5, 0], i.e. 0 to 4 minutes early
      details.push({
        type:   'fixed_penalty',
        amount: 500,
        reason: `Login 0–5 min before shift start (${Math.abs(diffFromStart)} min early)`
      });
    } else if (diffFromStart > -10) {
      // 6–10 minutes before shift start → 250 PKR
      // diffFromStart is in (−10, −5]
      details.push({
        type:   'fixed_penalty',
        amount: 250,
        reason: `Login 6–10 min before shift start (${Math.abs(diffFromStart)} min early)`
      });
    }
    // diffFromStart ≤ −10  → on time, no penalty
  }

  // ── LOGOUT penalty ─────────────────────────────────────────────────────────
  // Only applies when the employee actually checked out.
  if (outTime) {
    const shiftEndMin = toMin(shift.end);

    // For night shifts: project outTime onto the same 48-h timeline
    // shift.end is "next day" when isNightShift, so add 1440 to it for comparison
    let normShiftEndMin = shiftEndMin;
    let normOutMin      = toMin(outTime);

    if (isNightShift) {
      normShiftEndMin += 1440;                        // shift end is next day
      if (outNextDay) normOutMin += 1440;             // out is also next day
      // If out looks like it's still same-day on a night shift, it may be early logout
      // Leave normOutMin as-is; the diff will be negative → early logout
    }

    // minutesBeforeEnd: positive means left early
    const minutesBeforeEnd = normShiftEndMin - normOutMin;

    if (minutesBeforeEnd > 30) {
      // Left more than 30 min early → 800 PKR
      earlyLogoutMinutes = minutesBeforeEnd;
      details.push({
        type:   'early_logout',
        amount: 800,
        reason: `Early logout: ${minutesBeforeEnd} min before shift end (>30 min bracket)`
      });
    } else if (minutesBeforeEnd > 0) {
      // Left 1–30 min early → 500 PKR
      earlyLogoutMinutes = minutesBeforeEnd;
      details.push({
        type:   'early_logout',
        amount: 500,
        reason: `Early logout: ${minutesBeforeEnd} min before shift end (1–30 min bracket)`
      });
    }
    // minutesBeforeEnd ≤ 0 → left on time or after shift end → no penalty
  }

  const totalDeduction = details.reduce((s, d) => s + d.amount, 0);

  return { deductionDetails: details, totalDeduction, lateMinutes, earlyLogoutMinutes };
}

// ═════════════════════════════════════════════════════════════════════════════
// ─── FINANCIALS BUILDER ──────────────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════
//
// Computes the full financials sub-document for one attendance record.
// Always calls computeDeductions internally — callers NEVER pass raw deductions.
// OT fields are preserved from any existing record (admin-only, never overwritten).
//
// basePay rules:
//   Leave                    → 100% of scheduledHours × rate
//   Present/Late + both times → actual hoursWorked × rate
//   Only one of in/out       → 50% of scheduledHours × rate  (incomplete punch)
//   Absent                   → 0
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {{
 *   status:      string,
 *   inTime:      string|null,
 *   outTime:     string|null,
 *   outNextDay:  boolean,
 *   shift:       object,
 *   hourlyRate:  number,
 *   salaryType:  string,
 *   otHours?:    number,         // preserved from existing record
 *   otAmount?:   number,         // preserved from existing record
 *   otMultiplier?: number,       // preserved from existing record
 *   otDetails?:  Array,          // preserved from existing record
 * }} params
 *
 * @returns {object} financials sub-document (matches AttendanceLog.financials schema)
 */
function buildFinancials({
  status,
  inTime, outTime, outNextDay = false,
  shift, hourlyRate, salaryType,
  // OT fields — preserved as-is, never auto-computed
  otHours = 0, otMultiplier = 1, otDetails = [], otAmount = 0
}) {
  const scheduledHrs = shiftHours(shift);
  let hoursWorked    = 0;
  let basePay        = 0;

  if (status === 'Leave') {
    hoursWorked = scheduledHrs;
    basePay     = hoursWorked * hourlyRate;
  } else if ((status === 'Present' || status === 'Late') && inTime && outTime) {
    hoursWorked = calcHours(inTime, outTime, outNextDay);
    basePay     = hoursWorked * hourlyRate;
  } else if ((inTime && !outTime) || (!inTime && outTime)) {
    // Incomplete punch → 50% penalty on scheduled hours
    hoursWorked = scheduledHrs;
    basePay     = hoursWorked * hourlyRate * 0.5;
  }
  // Absent → hoursWorked = 0, basePay = 0

  // ── Run the deduction engine ───────────────────────────────────────────────
  // Leave records never incur login/logout penalties.
  // Absent records have no times so computeDeductions returns 0 anyway,
  // but we skip it explicitly for clarity.
  let deductionDetails   = [];
  let totalDeduction     = 0;
  let lateMinutes        = 0;
  let earlyLogoutMinutes = 0;

  if (status !== 'Leave' && status !== 'Absent') {
    ({ deductionDetails, totalDeduction, lateMinutes, earlyLogoutMinutes } =
      computeDeductions({ inTime, outTime, outNextDay, shift, hourlyRate }));
  }

  // OT amount: sum of manual entries only — system never auto-adds
  const resolvedOtAmount = otDetails.length
    ? otDetails.reduce((s, e) => s + (e.amount || 0), 0)
    : (otAmount || 0);   // preserve existing amount if no details array

  const resolvedOtHours = otDetails.length
    ? otDetails.reduce((s, e) => s + (e.hours || 0), 0)
    : (otHours || 0);

  const finalDayEarning = Math.max(0, basePay - totalDeduction + resolvedOtAmount);

  return {
    hoursWorked,
    scheduledHours:    scheduledHrs,
    lateMinutes,
    earlyLogoutMinutes,
    basePay,
    deduction:         totalDeduction,
    deductionDetails,
    otMultiplier:      otMultiplier || 1,
    otHours:           resolvedOtHours,
    otAmount:          resolvedOtAmount,
    otDetails,
    finalDayEarning
  };
}

const hoursLabel = (f) =>
  `Hours: ${(f.hoursWorked || 0).toFixed(2)} | Base: ${(f.basePay || 0).toFixed(2)} | Deduction: ${(f.deduction || 0).toFixed(2)} | OT: ${(f.otAmount || 0).toFixed(2)} | Final: ${(f.finalDayEarning || 0).toFixed(2)}`;

// ═════════════════════════════════════════════════════════════════════════════
// ─── 14-HOUR SHIFT-BASED PAIRING ─────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Window = Shift Start → Shift Start + 14 hours.
 * Login time is NOT used — only Shift Start anchors the window.
 */
function applyShiftBasedPairing(shiftStart, punchTimes) {
  if (!punchTimes || punchTimes.length === 0) {
    return { inTime: null, outTime: null, outNextDay: false };
  }

  const shiftStartMin = toMin(shiftStart);
  const windowEnd     = shiftStartMin + 14 * 60;

  const normalised = punchTimes
    .map(t => {
      let m = toMin(t);
      if (m < shiftStartMin) m += 1440;
      return { time: t, norm: m };
    })
    .sort((a, b) => a.norm - b.norm);

  const inEntry = normalised.find(p => p.norm >= shiftStartMin && p.norm <= windowEnd);
  if (!inEntry) {
    const outOnly = normalised.find(p => p.norm > shiftStartMin && p.norm <= windowEnd);
    if (outOnly) {
      return {
        inTime:     null,
        outTime:    outOnly.time,
        outNextDay: outOnly.norm > 1440 || toMin(outOnly.time) < shiftStartMin % 1440
      };
    }
    return { inTime: null, outTime: null, outNextDay: false };
  }

  const outEntry = normalised.find(p => p.norm > inEntry.norm && p.norm <= windowEnd);
  if (!outEntry) {
    return { inTime: inEntry.time, outTime: null, outNextDay: false };
  }

  const outNextDay = toMin(outEntry.time) < toMin(inEntry.time);
  return { inTime: inEntry.time, outTime: outEntry.time, outNextDay };
}

// ─── Null-safe time merge helpers ────────────────────────────────────────────

function earliestTime(a, b) {
  if (!a && !b) return null;
  if (!a) return b;
  if (!b) return a;
  return toMin(a) <= toMin(b) ? a : b;
}

function latestTime(a, b) {
  if (!a && !b) return null;
  if (!a) return b;
  if (!b) return a;
  return toMin(a) >= toMin(b) ? a : b;
}

// ═════════════════════════════════════════════════════════════════════════════
// ─── POST /api/attendance/import-csv ─────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════

router.post(
  '/import-csv',
  adminAuth,
  upload.single('csvFile'),
  validateCSVFile,
  async (req, res) => {
    const log = [];
    let rowsProcessed = 0, rowsSuccess = 0, rowsSkipped = 0;
    let recordsCreated = 0, recordsUpdated = 0;

    try {
      const csvContent = req.file.buffer.toString('utf-8');
      log.push({ type: 'INFO', message: `📁 File: ${req.file.originalname} (${req.file.size} bytes)` });

      const { parsed, errors } = parseCSV(csvContent);
      errors.forEach(e => log.push({ type: 'ERROR', message: `Row ${e.rowNumber}: ${e.error}` }));

      rowsProcessed = parsed.length;

      if (parsed.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No valid rows found in CSV file',
          processingLog: log,
          summary: { total: 0, success: 0, failed: errors.length, skipped: 0, recordsCreated: 0, recordsUpdated: 0 }
        });
      }

      log.push({ type: 'INFO', message: `✓ Parsed ${parsed.length} valid row(s)` });

      const empNumbers = [...new Set(parsed.map(r => r.empId))];
      const employees  = await Employee.find({
        employeeNumber: { $in: empNumbers },
        role:           { $nin: SYSTEM_ROLES },
        isDeleted:      false
      }).lean();
      const empMap = Object.fromEntries(employees.map(e => [e.employeeNumber, e]));

      const grouped = groupByEmployeeAndDate(parsed);
      log.push({ type: 'INFO', message: `📦 ${Object.keys(grouped).length} employee-date group(s)` });

      for (const [, groupData] of Object.entries(grouped)) {
        const { empId, firstName, lastName, dateStr, date, rows } = groupData;

        log.push({ type: 'INFO', message: `\n👤 ${empId} (${firstName} ${lastName}) — ${dateStr}` });

        const employee = empMap[empId];
        if (!employee) {
          log.push({ type: 'WARN', message: `  ⚠️ Employee #${empId} not found or is a superadmin. Skipped.` });
          rowsSkipped += rows.length;
          continue;
        }

        const punchTimes = rows.map(r => r.time).filter(Boolean);
        const merged     = mergeTimes(rows);

        let inTime, outTime, outNextDay;

        if (merged.inTime || merged.outTime) {
          inTime     = merged.inTime;
          outTime    = merged.outTime;
          outNextDay = merged.outNextDay || false;
        } else {
          ({ inTime, outTime, outNextDay } = applyShiftBasedPairing(employee.shift.start, punchTimes));
        }

        if (inTime)              log.push({ type: 'INFO', message: `  ✓ In:  ${inTime}` });
        if (outTime)             log.push({ type: 'INFO', message: `  ✓ Out: ${outTime}${outNextDay ? ' (next day)' : ''}` });
        if (!inTime && !outTime) log.push({ type: 'WARN', message: `  ⚠️ No punches found within 14-h shift window` });

        let status = 'Absent';
        if (inTime || outTime) {
          status = (inTime && isLate(inTime, employee.shift.start)) ? 'Late' : 'Present';
        }

        const rate       = effectiveHourlyRate(employee, 26);
        const financials = buildFinancials({
          status, inTime, outTime, outNextDay,
          shift:      employee.shift,
          hourlyRate: rate,
          salaryType: employee.salaryType
        });

        log.push({ type: 'INFO', message: `  💰 ${hoursLabel(financials)} | Status: ${status}` });
        if (financials.deductionDetails.length > 0) {
          financials.deductionDetails.forEach(d =>
            log.push({ type: 'INFO', message: `    ⚠️ Deduction: ${d.type} — PKR ${d.amount} (${d.reason})` })
          );
        }

        try {
          const existing = await AttendanceLog.findOne({ empId: employee._id, date });

          if (existing) {
            if (existing.manualOverride) {
              log.push({ type: 'WARN', message: `  ⚠️ Skipped — record has manual override.` });
              rowsSkipped += rows.length;
              continue;
            }

            // Merge: earliest IN, latest OUT
            const mergedIn  = earliestTime(existing.inOut?.in,  inTime);
            const mergedOut = latestTime(existing.inOut?.out, outTime);

            const mergedOutNextDay = existing.shift?.isNightShift && mergedIn && mergedOut
              ? toMin(mergedOut) < toMin(mergedIn)
              : outNextDay;

            let mergedStatus = existing.status;
            if (mergedIn || mergedOut) {
              mergedStatus = (mergedIn && isLate(mergedIn, employee.shift.start)) ? 'Late' : 'Present';
            }

            // Re-run deductions with merged times; preserve existing OT
            const mergedFinancials = buildFinancials({
              status:      mergedStatus,
              inTime:      mergedIn,
              outTime:     mergedOut,
              outNextDay:  mergedOutNextDay,
              shift:       employee.shift,
              hourlyRate:  rate,
              salaryType:  employee.salaryType,
              // Preserve existing admin-set OT — never overwrite
              otHours:     existing.financials?.otHours     || 0,
              otAmount:    existing.financials?.otAmount    || 0,
              otMultiplier:existing.financials?.otMultiplier || 1,
              otDetails:   existing.financials?.otDetails   || []
            });

            await AttendanceLog.updateOne({ _id: existing._id }, {
              $set: {
                status,
                salaryType:                employee.salaryType,
                'inOut.in':                mergedIn     || null,
                'inOut.out':               mergedOut    || null,
                'inOut.outNextDay':        mergedOutNextDay,
                hourlyRate:                rate,
                financials:                mergedFinancials,
                'metadata.source':         'csv',
                'metadata.lastUpdatedBy':  req.userId,
                'metadata.lastModifiedAt': new Date()
              }
            });

            recordsUpdated++;
            log.push({ type: 'SUCCESS', message: `  ✓ Updated (merged — ${mergedStatus})` });
          } else {
            await AttendanceLog.create({
              date,
              empId:      employee._id,
              empNumber:  employee.employeeNumber,
              empName:    `${employee.firstName} ${employee.lastName}`,
              department: employee.department,
              status,
              salaryType: employee.salaryType,
              inOut: { in: inTime || null, out: outTime || null, outNextDay: outNextDay || false },
              shift: {
                start:        employee.shift.start,
                end:          employee.shift.end,
                isNightShift: toMin(employee.shift.end) < toMin(employee.shift.start)
              },
              hourlyRate: rate,
              financials,
              manualOverride: false,
              metadata: {
                source:         'csv',
                lastUpdatedBy:  req.userId,
                lastModifiedAt: new Date()
              }
            });

            recordsCreated++;
            log.push({ type: 'SUCCESS', message: `  ✓ Created (${status})` });
          }

          rowsSuccess += rows.length;
        } catch (dbErr) {
          log.push({ type: 'ERROR', message: `  ✗ DB error: ${dbErr.message}` });
        }
      }

      log.push({
        type: 'SUMMARY',
        message: `✅ DONE — Rows: ${rowsProcessed} | OK: ${rowsSuccess} | Skipped: ${rowsSkipped} | Errors: ${errors.length} | Created: ${recordsCreated} | Updated: ${recordsUpdated}`
      });

      return res.json({
        success: true,
        message: 'CSV import complete',
        processingLog: log,
        summary: { total: rowsProcessed, success: rowsSuccess, failed: errors.length, skipped: rowsSkipped, recordsCreated, recordsUpdated }
      });
    } catch (err) {
      log.push({ type: 'ERROR', message: `Fatal: ${err.message}` });
      return res.status(500).json({
        success: false,
        message: 'Error processing CSV file',
        error: err.message,
        processingLog: log,
        summary: { total: rowsProcessed, success: rowsSuccess, failed: 0, skipped: rowsSkipped, recordsCreated, recordsUpdated }
      });
    }
  }
);

// ═════════════════════════════════════════════════════════════════════════════
// ─── GET /api/attendance/range ────────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════

router.get('/range', adminAuth, async (req, res) => {
  try {
    const { fromDate, toDate } = req.query;

    if (!fromDate || !toDate) {
      return res.status(400).json({ success: false, message: 'fromDate and toDate required' });
    }

    const from = parseDDMMYYYY(fromDate);
    const to   = parseDDMMYYYY(toDate);

    if (!from || !to) {
      return res.status(400).json({ success: false, message: 'Invalid date format. Use dd/mm/yyyy' });
    }

    to.setHours(23, 59, 59, 999);

    const populateRoleMatch = req.userRole === 'superadmin'
      ? { role: { $nin: ['superadmin'] } }
      : { role: 'employee' };

    const records = await AttendanceLog.find({
      date:      { $gte: from, $lte: to },
      isDeleted: false
    })
      .populate({
        path:   'empId',
        select: 'firstName lastName email employeeNumber shift role',
        match:  populateRoleMatch
      })
      .sort({ date: -1, empNumber: 1 })
      .lean();

    const attendance = records
      .filter(r => r.empId != null)
      .map(r => ({
        ...r,
        empRole:       r.empId?.role || 'employee',
        dateFormatted: formatDate(r.date),
        inTime:        r.inOut?.in        || null,
        outTime:       r.inOut?.out       || null,
        outNextDay:    r.inOut?.outNextDay || false,
        financials: {
          ...r.financials,
          deductionDetails: r.financials?.deductionDetails || [],
          otDetails:        r.financials?.otDetails        || []
        },
        lastModified:    r.metadata?.lastModifiedAt ? formatDateTimeForDisplay(r.metadata.lastModifiedAt) : '--',
        lastModifiedRaw: r.metadata?.lastModifiedAt || null
      }));

    return res.json({ success: true, attendance, total: attendance.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// ─── POST /api/attendance/worksheet ──────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════

router.post('/worksheet', adminAuth, async (req, res) => {
  try {
    const { fromDate, toDate } = req.body;

    if (!fromDate || !toDate) {
      return res.status(400).json({ success: false, message: 'fromDate and toDate required' });
    }

    const start = parseDDMMYYYY(fromDate);
    const end   = parseDDMMYYYY(toDate);

    if (!start || !end || isNaN(start) || isNaN(end)) {
      return res.status(400).json({ success: false, message: 'Invalid date format. Use dd/mm/yyyy' });
    }

    const daySpan = Math.round((end - start) / 86_400_000);
    if (daySpan > 93) {
      return res.status(400).json({ success: false, message: 'Date range cannot exceed 93 days' });
    }

    end.setHours(23, 59, 59, 999);

    const employees = await Employee.find(payrollEmployeeFilter())
      .sort({ employeeNumber: 1 })
      .lean();

    if (employees.length === 0) {
      return res.json({ success: true, worksheet: [], total: 0 });
    }

    const empIds = employees.map(e => e._id);
    const logs   = await AttendanceLog.find({
      empId:     { $in: empIds },
      date:      { $gte: start, $lte: end },
      isDeleted: false
    }).lean();

    const logMap = {};
    for (const log of logs) {
      const key = `${log.empId}_${log.date.toISOString().slice(0, 10)}`;
      logMap[key] = log;
    }

    const worksheet = [];

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const iso  = d.toISOString().slice(0, 10);
      const disp = formatDate(new Date(d));

      for (const emp of employees) {
        const key      = `${emp._id}_${iso}`;
        const existing = logMap[key];

        if (existing) {
          worksheet.push({
            _id:          existing._id,
            date:         disp,
            dateRaw:      existing.date,
            empId:        emp._id,
            empNumber:    emp.employeeNumber,
            empName:      `${emp.firstName} ${emp.lastName}`,
            department:   emp.department,
            shift:        emp.shift,
            salaryType:   existing.salaryType || emp.salaryType,
            hourlyRate:   existing.hourlyRate,
            status:       existing.status,
            inOut:        existing.inOut,
            financials: {
              ...existing.financials,
              deductionDetails: existing.financials?.deductionDetails || [],
              otDetails:        existing.financials?.otDetails        || []
            },
            manualOverride:  existing.manualOverride,
            lastModified:    existing.metadata?.lastModifiedAt
                               ? formatDateTimeForDisplay(existing.metadata.lastModifiedAt)
                               : '--',
            lastModifiedRaw: existing.metadata?.lastModifiedAt || null,
            isVirtual:  false,
            isModified: false
          });
        } else {
          worksheet.push({
            date:       disp,
            dateRaw:    new Date(iso),
            empId:      emp._id,
            empNumber:  emp.employeeNumber,
            empName:    `${emp.firstName} ${emp.lastName}`,
            department: emp.department,
            shift:      emp.shift,
            salaryType: emp.salaryType,
            hourlyRate: effectiveHourlyRate(emp, 26),
            status:     'Absent',
            inOut:      { in: null, out: null, outNextDay: false },
            financials: {
              hoursWorked:       0,
              scheduledHours:    shiftHours(emp.shift),
              lateMinutes:       0,
              earlyLogoutMinutes:0,
              basePay:           0,
              deduction:         0,
              deductionDetails:  [],
              otMultiplier:      1,
              otHours:           0,
              otAmount:          0,
              otDetails:         [],
              finalDayEarning:   0
            },
            manualOverride:  false,
            lastModified:    '--',
            lastModifiedRaw: null,
            isVirtual:  true,
            isModified: false
          });
        }
      }
    }

    worksheet.sort((a, b) => {
      const dc = new Date(a.dateRaw) - new Date(b.dateRaw);
      return dc !== 0 ? dc : a.empNumber.localeCompare(b.empNumber);
    });

    return res.json({ success: true, worksheet, total: worksheet.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// ─── POST /api/attendance/save-row ───────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════
//
// Admin manual entry for a single row.
// Deductions are computed server-side — frontend must NOT send deductionDetails.
// OT fields ARE accepted from the frontend (admin-only manual input).
// ─────────────────────────────────────────────────────────────────────────────

router.post('/save-row', adminAuth, async (req, res) => {
  try {
    const {
      empId, date, status,
      inTime, outTime, outNextDay,
      // OT — admin manual only
      otHours, otMultiplier, otDetails
    } = req.body;

    if (!empId || !date || !status) {
      return res.status(400).json({ success: false, message: 'empId, date, and status are required' });
    }

    const roleFilter = req.userRole === 'superadmin'
      ? { role: { $nin: ['superadmin'] } }
      : { role: 'employee' };

    const employee = await Employee.findOne({ _id: empId, ...roleFilter, isDeleted: false });
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found or you do not have permission to edit this account'
      });
    }

    const dateObj = parseDDMMYYYY(date);
    if (!dateObj || isNaN(dateObj)) {
      return res.status(400).json({ success: false, message: 'Invalid date (dd/mm/yyyy required)' });
    }
    dateObj.setHours(0, 0, 0, 0);

    const isNightShift = toMin(employee.shift.end) < toMin(employee.shift.start);
    let resolvedOutNextDay = Boolean(outNextDay);
    if (outNextDay === undefined && inTime && outTime) {
      resolvedOutNextDay = isNightShift && toMin(outTime) < toMin(inTime);
    }

    // ── Sanitise OT details — only 'manual' type is valid ────────────────────
    const cleanOtDetails = (Array.isArray(otDetails) ? otDetails : [])
      .map(e => ({
        type:   'manual',                               // always manual, never calc
        amount: Number(e?.amount) || 0,
        hours:  Number(e?.hours)  || 0,
        rate:   [1, 1.5, 2].includes(Number(e?.rate)) ? Number(e.rate) : 1,
        reason: String(e?.reason || '').trim()
      }))
      .filter(e => e.reason && e.amount >= 0);

    const rate = effectiveHourlyRate(employee, 26);

    // Load existing record to preserve its OT if no new OT is being submitted
    const existingRecord = await AttendanceLog.findOne({ empId: employee._id, date: dateObj });
    const preservedOt = cleanOtDetails.length === 0 && existingRecord ? {
      otHours:      existingRecord.financials?.otHours     || 0,
      otAmount:     existingRecord.financials?.otAmount    || 0,
      otMultiplier: existingRecord.financials?.otMultiplier || 1,
      otDetails:    existingRecord.financials?.otDetails   || []
    } : {
      otHours:      Number(otHours)      || 0,
      otMultiplier: Number(otMultiplier) || 1,
      otDetails:    cleanOtDetails,
      otAmount:     0   // will be derived from otDetails inside buildFinancials
    };

    const financials = buildFinancials({
      status,
      inTime:  inTime  || null,
      outTime: outTime || null,
      outNextDay: resolvedOutNextDay,
      shift:      employee.shift,
      hourlyRate: rate,
      salaryType: employee.salaryType,
      ...preservedOt
    });

    let record = existingRecord || new AttendanceLog({ empId: employee._id, date: dateObj });

    record.empNumber   = employee.employeeNumber;
    record.empName     = `${employee.firstName} ${employee.lastName}`;
    record.department  = employee.department;
    record.status      = status;
    record.salaryType  = employee.salaryType;
    record.inOut = {
      in:         inTime  || null,
      out:        outTime || null,
      outNextDay: resolvedOutNextDay
    };
    record.shift = {
      start:        employee.shift.start,
      end:          employee.shift.end,
      isNightShift: isNightShift
    };
    record.hourlyRate     = rate;
    record.financials     = financials;
    record.manualOverride = true;
    record.metadata = {
      ...(record.metadata?.toObject?.() || { ...(record.metadata || {}) }),
      source:         'manual',
      lastUpdatedBy:  req.userId,
      lastModifiedAt: new Date()
    };

    await record.save();

    return res.json({
      success:      true,
      message:      'Attendance saved',
      record,
      lastModified: formatDateTimeForDisplay(new Date())
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// ─── POST /api/attendance/bulk-save ──────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════

router.post('/bulk-save', adminAuth, async (req, res) => {
  try {
    const { rows, forceOverride = false } = req.body;

    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ success: false, message: 'rows array is required and must not be empty' });
    }

    if (rows.length > 500) {
      return res.status(400).json({ success: false, message: 'Maximum 500 rows per bulk-save request' });
    }

    const roleFilter = req.userRole === 'superadmin'
      ? { role: { $nin: ['superadmin'] } }
      : { role: 'employee' };

    const empIds    = [...new Set(rows.map(r => String(r.empId)).filter(Boolean))];
    const employees = await Employee.find({ _id: { $in: empIds }, ...roleFilter, isDeleted: false }).lean();
    const empMap    = Object.fromEntries(employees.map(e => [String(e._id), e]));

    const results = { saved: 0, skipped: 0, errors: [] };
    const bulkOps = [];

    for (const row of rows) {
      const emp = empMap[String(row.empId)];
      if (!emp) {
        results.errors.push({ empId: row.empId, date: row.date, error: 'Employee not found or no permission' });
        results.skipped++;
        continue;
      }

      const dateObj = parseDDMMYYYY(row.date) || (row.dateRaw ? new Date(row.dateRaw) : null);
      if (!dateObj || isNaN(dateObj)) {
        results.errors.push({ empId: row.empId, date: row.date, error: 'Invalid date' });
        results.skipped++;
        continue;
      }
      dateObj.setHours(0, 0, 0, 0);

      const isNightShift = toMin(emp.shift.end) < toMin(emp.shift.start);
      const inTime  = row.inOut?.in   || row.inTime  || null;
      const outTime = row.inOut?.out  || row.outTime || null;

      let resolvedOutNextDay = Boolean(row.inOut?.outNextDay || row.outNextDay);
      if (!row.inOut?.outNextDay && inTime && outTime) {
        resolvedOutNextDay = isNightShift && toMin(outTime) < toMin(inTime);
      }

      const rate   = effectiveHourlyRate(emp, 26);
      const status = row.status || 'Absent';

      // OT from the row — only manual entries; preserve amounts, never derive
      const rowOtDetails = (Array.isArray(row.financials?.otDetails) ? row.financials.otDetails : [])
        .map(e => ({ ...e, type: 'manual' }));

      const financials = buildFinancials({
        status, inTime, outTime,
        outNextDay:  resolvedOutNextDay,
        shift:       emp.shift,
        hourlyRate:  rate,
        salaryType:  emp.salaryType,
        otHours:     Number(row.financials?.otHours)      || 0,
        otMultiplier:Number(row.financials?.otMultiplier) || 1,
        otDetails:   rowOtDetails,
        otAmount:    Number(row.financials?.otAmount)     || 0
      });

      bulkOps.push({
        updateOne: {
          filter: { empId: emp._id, date: dateObj },
          update: {
            $setOnInsert: { empId: emp._id, date: dateObj },
            $set: {
              empNumber:  emp.employeeNumber,
              empName:    `${emp.firstName} ${emp.lastName}`,
              department: emp.department,
              status,
              salaryType: emp.salaryType,
              inOut:      { in: inTime, out: outTime, outNextDay: resolvedOutNextDay },
              shift:      { start: emp.shift.start, end: emp.shift.end, isNightShift },
              hourlyRate: rate,
              financials,
              manualOverride:            Boolean(forceOverride),
              'metadata.source':         'manual',
              'metadata.lastUpdatedBy':  req.userId,
              'metadata.lastModifiedAt': new Date()
            }
          },
          upsert: true
        }
      });

      results.saved++;
    }

    if (bulkOps.length > 0) {
      await AttendanceLog.bulkWrite(bulkOps, { ordered: false });
    }

    return res.json({ success: true, message: 'Bulk save complete', results });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;