// routes/attendance.js
import express from "express";
import multer from "multer";
import AttendanceLog from "../models/AttendanceLog.js";
import Employee from "../models/Employee.js";
import { adminAuth } from "../middleware/auth.js";
import validateCSVFile from "../middleware/csvValidator.js";
import {
  parseCSV,
  groupByEmployeeAndDate,
  mergeTimes,
} from "../utils/csvParser.js";
import {
  formatDate,
  formatDateTimeForDisplay,
  startOfDay,
  addDaysUTC,
  parseDDMMYYYY,
} from "../utils/dateUtils.js";

const router = express.Router();
const SYSTEM_ROLES = ["superadmin", "owner"];

const payrollEmployeeFilter = (extra = {}) => ({
  role:       { $nin: SYSTEM_ROLES },
  status:     { $in: ["Active", "Frozen"] },
  isArchived: false,
  isDeleted:  false,
  ...extra,
});

// ─── multer ────────────────────────────────────────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok =
      file.mimetype.includes("csv") ||
      file.mimetype.includes("text") ||
      file.originalname.endsWith(".csv");
    cb(ok ? null : new Error("Invalid file type"), ok);
  },
});

// ═════════════════════════════════════════════════════════════════════════════
// ─── PURE TIME HELPERS
// ═════════════════════════════════════════════════════════════════════════════
const toMin = (t) => {
  if (!t) return 0;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

function calcHours(inTime, outTime, outNextDay = false) {
  if (!inTime || !outTime) return 0;
  let diff = toMin(outTime) - toMin(inTime);
  if (outNextDay || diff < 0) diff += 1440;
  return Math.max(0, diff / 60);
}

function shiftHours(shift) {
  if (!shift?.start || !shift?.end) return 8;
  const isNight = toMin(shift.end) < toMin(shift.start);
  return calcHours(shift.start, shift.end, isNight);
}

function isLate(inTime, shiftStart) {
  if (!inTime || !shiftStart) return false;
  return toMin(inTime) > toMin(shiftStart);
}

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
// ─── SALARY HELPERS
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Returns the number of calendar days in the month that contains `date`.
 * e.g. January → 31, April → 30, February (leap) → 29.
 */
function calendarDaysInMonth(date) {
  const d = date ? new Date(date) : new Date();
  // Day 0 of next month === last day of current month
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

/**
 * Per-day salary rate used for the day-based payroll formula.
 *
 * Monthly employees:  monthlySalary ÷ total calendar days in the month
 *   e.g. 80,000 ÷ 30 = 2,666.67 PKR/day
 *
 * Hourly employees:   hourlyRate × scheduled shift hours
 *   Converts to an equivalent daily rate so the same payable-days
 *   formula works uniformly for both salary types.
 *
 * @param {object} emp   - Employee document (lean)
 * @param {Date}   date  - The specific date being processed (determines month)
 */
function perDaySalary(emp, date) {
  if (emp.salaryType === "monthly" && emp.monthlySalary) {
    return emp.monthlySalary / calendarDaysInMonth(date);
  }
  // Hourly: rate × scheduled hours → daily equivalent
  const scheduledHrs = shiftHours(emp.shift) || 8;
  return (emp.hourlyRate || 0) * scheduledHrs;
}

// ═════════════════════════════════════════════════════════════════════════════
// ─── FINANCIALS BUILDER  (day-based salary logic)
// ═════════════════════════════════════════════════════════════════════════════
/**
 * Builds the financials object for one attendance log record.
 *
 * ── Salary rule ──────────────────────────────────────────────────────────────
 *
 *   Status         │ Payable days effect  │ basePay
 *   ───────────────┼──────────────────────┼──────────────────
 *   Present        │ +1                   │ dayRate × 1
 *   Late           │ +1                   │ dayRate × 1
 *   Leave          │ +1 (admin approved)  │ dayRate × 1
 *   OffDay         │ +1 (admin approved)  │ dayRate × 1
 *   NCNS           │ −2 (0 earned + 1     │ 0
 *                  │  penalty day)        │ deduction = dayRate × 2
 *
 *   finalDayEarning = basePay − deduction + otAmount
 *
 *   Monthly payroll rollup formula (do this in your payroll route):
 *     payableDays = (present + late + leave + offDay) − ncns
 *     finalSalary = (monthlySalary / daysInMonth) × payableDays + totalOT
 *
 * ── Parameters ──────────────────────────────────────────────────────────────
 * @param {string}   status
 * @param {string}   inTime          HH:mm or null
 * @param {string}   outTime         HH:mm or null
 * @param {boolean}  outNextDay
 * @param {object}   shift           { start, end }
 * @param {number}   dayRate         Result of perDaySalary() — pre-computed by caller
 * @param {string}   salaryType      "monthly" | "hourly"
 * @param {number}   [otHours]
 * @param {number}   [otMultiplier]
 * @param {Array}    [otDetails]
 * @param {number}   [otAmount]
 * @param {Array}    [manualDeductions]  Caller-supplied deduction overrides
 */
function buildFinancials({
  status,
  inTime,
  outTime,
  outNextDay = false,
  shift,
  dayRate,
  salaryType,
  otHours = 0,
  otMultiplier = 1,
  otDetails = [],
  otAmount = 0,
  manualDeductions = null,
}) {
  const scheduledHrs = shiftHours(shift);

  // ── Hours worked (kept for display / audit — not used in pay calc) ─────────
  let hoursWorked = 0;
  if (status === "Leave" || status === "OffDay") {
    hoursWorked = scheduledHrs;
  } else if ((status === "Present" || status === "Late") && inTime && outTime) {
    hoursWorked = Math.min(calcHours(inTime, outTime, outNextDay), scheduledHrs);
  }

  // ── Base pay & deductions ─────────────────────────────────────────────────
  let basePay       = 0;
  let deductionAmt  = 0;
  let deductionDets = [];

  switch (status) {
    case "Present":
    case "Late":
    case "Leave":
    case "OffDay":
      // All four count as 1 fully paid day
      basePay = dayRate;
      break;

    case "NCNS":
      // Employee earns nothing AND is penalised one extra day:
      //   basePay    = 0          (0 earned for the absent day)
      //   deduction  = 2 × dayRate (covers the absent day + penalty day)
      //   → finalDayEarning will be capped at 0 by Math.max
      //
      // In the monthly payroll rollup you additionally subtract 2 from
      // payable days for each NCNS (the formula already accounts for this
      // because you sum finalDayEarning per log, but if you compute via
      // payableDays × perDay instead, remember: payableDays -= ncnsCount).
      basePay       = 0;
      deductionAmt  = dayRate * 2;
      deductionDets = [
        {
          type:   "ncns_penalty",
          amount: dayRate * 2,
          reason: "No Call No Show — absent day (unpaid) + 1 penalty day deducted (2× daily rate)",
        },
      ];
      break;

    default:
      basePay = 0;
  }

  // ── Manual deductions override (passed from save-row / bulk-save) ──────────
  // When the admin explicitly sends deductionDetails we respect those instead
  // of the system-generated ones.  For NCNS the caller should NOT pass manual
  // deductions — the system ones above are authoritative.
  if (Array.isArray(manualDeductions) && manualDeductions.length > 0) {
    deductionDets = manualDeductions;
    deductionAmt  = manualDeductions.reduce((s, d) => s + (d.amount || 0), 0);
  }

  // ── OT resolution ─────────────────────────────────────────────────────────
  // calc-type OT entries use hours × rate × (dayRate / scheduledHrs) to
  // convert back to an hourly rate.  manual-type entries carry a fixed amount.
  const hourlyEquiv = scheduledHrs > 0 ? dayRate / scheduledHrs : 0;

  const resolvedOtAmount = otDetails.length
    ? otDetails.reduce(
        (s, e) =>
          e.type === "manual"
            ? s + (e.amount || 0)
            : s + (e.hours || 0) * (e.rate || 1) * hourlyEquiv,
        0,
      )
    : otAmount || 0;

  const resolvedOtHours = otDetails.length
    ? otDetails.reduce((s, e) => s + (e.hours || 0), 0)
    : otHours || 0;

  const finalDayEarning = Math.max(0, basePay - deductionAmt + resolvedOtAmount);

  return {
    hoursWorked,
    scheduledHours:     scheduledHrs,
    lateMinutes:        0,   // field kept for schema compatibility; not computed by new logic
    earlyLogoutMinutes: 0,   // same — admin can still add manual late_login / early_logout deductions
    basePay,
    deduction:          deductionAmt,
    deductionDetails:   deductionDets,
    otMultiplier:       otMultiplier || 1,
    otHours:            resolvedOtHours,
    otAmount:           resolvedOtAmount,
    otDetails,
    finalDayEarning,
  };
}

const financialsLabel = (f) =>
  `Base: ${(f.basePay || 0).toFixed(2)} | Deduction: ${(f.deduction || 0).toFixed(2)} | OT: ${(f.otAmount || 0).toFixed(2)} | Final: ${(f.finalDayEarning || 0).toFixed(2)}`;

// ═════════════════════════════════════════════════════════════════════════════
// ─── 14-HOUR SHIFT-BASED PAIRING
// ═════════════════════════════════════════════════════════════════════════════
function applyShiftBasedPairing(shiftStart, punchTimes) {
  if (!punchTimes || punchTimes.length === 0)
    return { inTime: null, outTime: null, outNextDay: false };

  const shiftStartMin = toMin(shiftStart);
  const windowEnd     = shiftStartMin + 14 * 60;

  const normalised = punchTimes
    .map((t) => {
      let m = toMin(t);
      if (m < shiftStartMin) m += 1440;
      return { time: t, norm: m };
    })
    .sort((a, b) => a.norm - b.norm);

  const inEntry = normalised.find(
    (p) => p.norm >= shiftStartMin && p.norm <= windowEnd,
  );
  if (!inEntry) {
    const fallback = normalised[0];
    return fallback
      ? { inTime: fallback.time, outTime: null, outNextDay: false }
      : { inTime: null, outTime: null, outNextDay: false };
  }

  const outEntry = normalised.find(
    (p) => p.norm > inEntry.norm && p.norm <= windowEnd,
  );
  if (!outEntry) return { inTime: inEntry.time, outTime: null, outNextDay: false };

  const outNextDay = toMin(outEntry.time) < toMin(inEntry.time);
  return { inTime: inEntry.time, outTime: outEntry.time, outNextDay };
}

// ═════════════════════════════════════════════════════════════════════════════
// ─── POST /api/attendance/bulk-delete
// ═════════════════════════════════════════════════════════════════════════════
router.post("/bulk-delete", adminAuth, async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0)
      return res.status(400).json({ success: false, message: "ids array is required" });
    if (ids.length > 500)
      return res.status(400).json({ success: false, message: "Maximum 500 records per request" });

    const records = await AttendanceLog.find({
      _id:       { $in: ids },
      isDeleted: { $ne: true },
    }).populate({
      path:  "empId",
      select: "role",
      match: { role: { $nin: ["superadmin"] } },
    });

    const allowedIds = records
      .filter((r) => {
        if (!r.empId) return false;
        if (req.userRole === "admin" && r.empId.role !== "employee") return false;
        return true;
      })
      .map((r) => r._id);

    if (allowedIds.length === 0)
      return res.status(403).json({ success: false, message: "No records allowed to delete" });

    await AttendanceLog.updateMany(
      { _id: { $in: allowedIds } },
      {
        $set: {
          isDeleted:                   true,
          "metadata.deletedBy":        req.userId,
          "metadata.deletedAt":        new Date(),
          "metadata.lastModifiedAt":   new Date(),
        },
      },
    );

    return res.json({ success: true, message: `${allowedIds.length} record(s) deleted` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// ─── POST /api/attendance/import-csv
// ═════════════════════════════════════════════════════════════════════════════
router.post(
  "/import-csv",
  adminAuth,
  upload.single("csvFile"),
  validateCSVFile,
  async (req, res) => {
    const log = [];
    let rowsProcessed = 0, rowsSuccess = 0, rowsSkipped = 0;
    let recordsCreated = 0, recordsUpdated = 0;

    try {
      const csvContent = req.file.buffer.toString("utf-8");
      log.push({ type: "INFO", message: `📁 File: ${req.file.originalname} (${req.file.size} bytes)` });

      const { parsed, errors } = parseCSV(csvContent);
      errors.forEach((e) => log.push({ type: "ERROR", message: `Row ${e.rowNumber}: ${e.error}` }));
      rowsProcessed = parsed.length;

      if (parsed.length === 0) {
        return res.status(400).json({
          success:      false,
          message:      "No valid rows found in CSV file",
          processingLog: log,
          summary:      { total: 0, success: 0, failed: errors.length, skipped: 0, recordsCreated: 0, recordsUpdated: 0 },
        });
      }

      log.push({ type: "INFO", message: `✓ Parsed ${parsed.length} valid row(s)` });

      // ── Fetch employees + existing logs in parallel ──────────────────────
      const empNumbers   = [...new Set(parsed.map((r) => r.empId))];
      const grouped      = groupByEmployeeAndDate(parsed);
      const groupEntries = Object.entries(grouped);

      const allDates = groupEntries.map(([, g]) => g.date);
      const minDate  = new Date(Math.min(...allDates.map((d) => d.getTime())));
      const maxDate  = new Date(Math.max(...allDates.map((d) => d.getTime())));
      minDate.setDate(minDate.getDate() - 1);
      maxDate.setDate(maxDate.getDate() + 1);

      const [employees, existingLogs] = await Promise.all([
        Employee.find({
          employeeNumber: { $in: empNumbers },
          role:           { $nin: SYSTEM_ROLES },
          isDeleted:      false,
        }).lean(),
        AttendanceLog.find({
          date:      { $gte: startOfDay(minDate), $lte: maxDate },
          isDeleted: false,
        }).lean(),
      ]);

      const empMap = Object.fromEntries(employees.map((e) => [e.employeeNumber, e]));

      const logMap = new Map();
      for (const l of existingLogs) {
        const key = `${l.empId}_${l.date.toISOString().slice(0, 10)}`;
        logMap.set(key, l);
      }

      log.push({ type: "INFO", message: `📦 ${groupEntries.length} employee-date group(s)` });

      const bulkOps = [];

      for (const [, groupData] of groupEntries) {
        const { empId, firstName, lastName, dateStr, date, rows } = groupData;
        log.push({ type: "INFO", message: `\n👤 ${empId} (${firstName} ${lastName}) — ${dateStr}` });

        const employee = empMap[empId];
        if (!employee) {
          log.push({ type: "WARN", message: `  ⚠️ Employee #${empId} not found or is a superadmin. Skipped.` });
          rowsSkipped += rows.length;
          continue;
        }

        // Per-day rate for this employee on this date
        const dayRate        = perDaySalary(employee, date);
        const isNightShiftEmp = toMin(employee.shift.end) < toMin(employee.shift.start);

        // ── NIGHT-SHIFT BRANCH ────────────────────────────────────────────
        if (isNightShiftEmp) {
          const shiftStartMin = toMin(employee.shift.start);
          const todaysIns = [], todaysOuts = [], prevDayOuts = [];

          for (const r of rows) {
            const tMin = toMin(r.time);
            if (r.isCheckIn) todaysIns.push(r.time);
            if (r.isCheckOut) {
              if (tMin < shiftStartMin) prevDayOuts.push(r.time);
              else todaysOuts.push(r.time);
            }
          }

          const hasIn  = todaysIns.length > 0;
          const hasOut = todaysOuts.length > 0 || prevDayOuts.length > 0;

          if (!hasIn && !hasOut) {
            log.push({ type: "WARN", message: `  ⚠️ No valid punches found for ${dateStr}` });
            rowsSkipped += rows.length;
            continue;
          }

          let todayOut = null;
          if (todaysOuts.length)
            todayOut = todaysOuts.sort((a, b) => toMin(a) - toMin(b))[0];
          else if (prevDayOuts.length)
            todayOut = prevDayOuts.sort((a, b) => toMin(a) - toMin(b))[0];

          if (todayOut) {
            const shiftDate  = startOfDay(date);
            const prevDay    = addDaysUTC(shiftDate, -1);
            const prevKey    = `${employee._id}_${prevDay.toISOString().slice(0, 10)}`;
            const prevExisting = logMap.get(prevKey) || null;
            const prevIn     = prevExisting?.inOut?.in || null;

            const status   = prevIn
              ? isLate(prevIn, employee.shift.start) ? "Late" : "Present"
              : "Present";
            const finalOut = latestTime(prevExisting?.inOut?.out, todayOut);

            // Use the per-day rate for the PREVIOUS day's date
            const prevDayRate = perDaySalary(employee, prevDay);

            const prevFinancials = buildFinancials({
              status,
              inTime:      prevIn,
              outTime:     finalOut,
              outNextDay:  true,
              shift:       employee.shift,
              dayRate:     prevDayRate,
              salaryType:  employee.salaryType,
              otHours:     prevExisting?.financials?.otHours     || 0,
              otAmount:    prevExisting?.financials?.otAmount     || 0,
              otMultiplier: prevExisting?.financials?.otMultiplier || 1,
              otDetails:   prevExisting?.financials?.otDetails    || [],
            });

            bulkOps.push({
              updateOne: {
                filter: { empId: employee._id, date: prevDay },
                update: {
                  $set: {
                    empNumber:              employee.employeeNumber,
                    empName:               `${employee.firstName} ${employee.lastName}`,
                    department:            employee.department,
                    shift:                 { start: employee.shift.start, end: employee.shift.end, isNightShift: true },
                    hourlyRate:            prevDayRate,
                    salaryType:            employee.salaryType,
                    "inOut.out":           finalOut,
                    "inOut.outNextDay":    true,
                    status,
                    financials:            prevFinancials,
                  },
                  $setOnInsert: { empId: employee._id, date: prevDay, "inOut.in": null },
                },
                upsert: true,
              },
            });
            log.push({ type: "SUCCESS", message: `  ✓ OUT (${todayOut}) merged into ${formatDate(prevDay)}` });
            recordsUpdated++;
          }

          if (todaysIns.length > 0) {
            const todayIn  = todaysIns.sort((a, b) => toMin(a) - toMin(b))[0];
            const shiftDate = startOfDay(date);
            const todayKey  = `${employee._id}_${shiftDate.toISOString().slice(0, 10)}`;
            const existing  = logMap.get(todayKey) || null;
            const mergedOut = existing?.inOut?.out || null;

            const financials = buildFinancials({
              status:     isLate(todayIn, employee.shift.start) ? "Late" : "Present",
              inTime:     todayIn,
              outTime:    mergedOut,
              outNextDay: mergedOut ? toMin(mergedOut) < toMin(todayIn) : false,
              shift:      employee.shift,
              dayRate,
              salaryType: employee.salaryType,
            });

            bulkOps.push({
              updateOne: {
                filter: { empId: employee._id, date: shiftDate },
                update: {
                  $set: {
                    empNumber:               employee.employeeNumber,
                    empName:                `${employee.firstName} ${employee.lastName}`,
                    department:             employee.department,
                    shift:                  { start: employee.shift.start, end: employee.shift.end, isNightShift: true },
                    hourlyRate:             dayRate,
                    salaryType:             employee.salaryType,
                    "inOut.in":             todayIn,
                    "inOut.out":            mergedOut || null,
                    "inOut.outNextDay":     !!mergedOut,
                    financials,
                    status:                 isLate(todayIn, employee.shift.start) ? "Late" : "Present",
                    "metadata.lastModifiedAt": new Date(),
                  },
                },
                upsert: true,
              },
            });
            log.push({ type: "SUCCESS", message: `  ✓ IN (${todayIn}) saved for ${dateStr}` });
            recordsCreated++;
          }

          rowsSuccess += rows.length;
          continue;
        }

        // ── DAY-SHIFT BRANCH ──────────────────────────────────────────────
        const punchTimes = rows.map((r) => r.time).filter(Boolean);
        const merged     = mergeTimes(rows);
        let inTime, outTime, outNextDay;

        if (merged.inTime || merged.outTime) {
          inTime     = merged.inTime;
          outTime    = merged.outTime;
          outNextDay = merged.outNextDay || false;
        } else {
          ({ inTime, outTime, outNextDay } = applyShiftBasedPairing(employee.shift.start, punchTimes));
        }

        if (inTime)  log.push({ type: "INFO", message: `  ✓ In:  ${inTime}` });
        if (outTime) log.push({ type: "INFO", message: `  ✓ Out: ${outTime}${outNextDay ? " (next day)" : ""}` });
        if (!inTime && !outTime)
          log.push({ type: "WARN", message: `  ⚠️ No punches found within 14-h shift window` });

        let status = "OffDay";
        if (inTime || outTime) {
          const timeForLateCheck = inTime || outTime;
          status = isLate(timeForLateCheck, employee.shift.start) ? "Late" : "Present";
        }

        const shiftDate  = startOfDay(date);
        const existingKey = `${employee._id}_${shiftDate.toISOString().slice(0, 10)}`;
        const existing   = logMap.get(existingKey) || null;

        try {
          if (existing) {
            if (existing.manualOverride) {
              log.push({ type: "WARN", message: `  ⚠️ Skipped — record has manual override.` });
              rowsSkipped += rows.length;
              continue;
            }

            const mergedIn         = earliestTime(existing.inOut?.in, inTime);
            const mergedOut        = latestTime(existing.inOut?.out, outTime);
            const mergedOutNextDay = existing.shift?.isNightShift && mergedIn && mergedOut
              ? toMin(mergedOut) < toMin(mergedIn)
              : outNextDay;

            let mergedStatus = existing.status;
            if (mergedIn || mergedOut) {
              mergedStatus = mergedIn && isLate(mergedIn, employee.shift.start) ? "Late" : "Present";
            }

            const mergedFinancials = buildFinancials({
              status:      mergedStatus,
              inTime:      mergedIn,
              outTime:     mergedOut,
              outNextDay:  mergedOutNextDay,
              shift:       employee.shift,
              dayRate,
              salaryType:  employee.salaryType,
              otHours:     existing.financials?.otHours     || 0,
              otAmount:    existing.financials?.otAmount     || 0,
              otMultiplier: existing.financials?.otMultiplier || 1,
              otDetails:   existing.financials?.otDetails    || [],
            });

            log.push({ type: "INFO", message: `  💰 ${financialsLabel(mergedFinancials)} | Status: ${mergedStatus}` });
            mergedFinancials.deductionDetails.forEach((d) =>
              log.push({ type: "INFO", message: `    ⚠️ Deduction: ${d.type} — PKR ${d.amount} (${d.reason})` }),
            );

            bulkOps.push({
              updateOne: {
                filter: { _id: existing._id },
                update: {
                  $set: {
                    status:                    mergedStatus,
                    salaryType:                employee.salaryType,
                    "inOut.in":                mergedIn  || null,
                    "inOut.out":               mergedOut || null,
                    "inOut.outNextDay":        mergedOutNextDay,
                    hourlyRate:                dayRate,
                    financials:                mergedFinancials,
                    "metadata.source":         "csv",
                    "metadata.lastUpdatedBy":  req.userId,
                    "metadata.lastModifiedAt": new Date(),
                  },
                },
              },
            });
            recordsUpdated++;
            log.push({ type: "SUCCESS", message: `  ✓ Updated (merged — ${mergedStatus})` });

          } else {
            const financials = buildFinancials({
              status,
              inTime,
              outTime,
              outNextDay,
              shift:      employee.shift,
              dayRate,
              salaryType: employee.salaryType,
            });

            log.push({ type: "INFO", message: `  💰 ${financialsLabel(financials)} | Status: ${status}` });
            financials.deductionDetails.forEach((d) =>
              log.push({ type: "INFO", message: `    ⚠️ Deduction: ${d.type} — PKR ${d.amount} (${d.reason})` }),
            );

            bulkOps.push({
              updateOne: {
                filter: { empId: employee._id, date: shiftDate },
                update: {
                  $setOnInsert: { empId: employee._id, date: shiftDate },
                  $set: {
                    empNumber:               employee.employeeNumber,
                    empName:                `${employee.firstName} ${employee.lastName}`,
                    department:             employee.department,
                    status,
                    salaryType:             employee.salaryType,
                    inOut:                  { in: inTime || null, out: outTime || null, outNextDay: outNextDay || false },
                    shift:                  { start: employee.shift.start, end: employee.shift.end, isNightShift: false },
                    hourlyRate:             dayRate,
                    financials,
                    manualOverride:         false,
                    isDeleted:              false,
                    "metadata.source":      "csv",
                    "metadata.lastUpdatedBy": req.userId,
                    "metadata.lastModifiedAt": new Date(),
                  },
                },
                upsert: true,
              },
            });
            recordsCreated++;
            log.push({ type: "SUCCESS", message: `  ✓ Created (${status})` });
          }

          rowsSuccess += rows.length;
        } catch (dbErr) {
          log.push({ type: "ERROR", message: `  ✗ DB error: ${dbErr.message}` });
        }
      }

      if (bulkOps.length > 0) {
        await AttendanceLog.bulkWrite(bulkOps, { ordered: false });
      }

      log.push({
        type:    "SUMMARY",
        message: `✅ DONE — Rows: ${rowsProcessed} | OK: ${rowsSuccess} | Skipped: ${rowsSkipped} | Errors: ${errors.length} | Created: ${recordsCreated} | Updated: ${recordsUpdated}`,
      });

      return res.json({
        success:       true,
        message:       "CSV import complete",
        processingLog: log,
        summary:       { total: rowsProcessed, success: rowsSuccess, failed: errors.length, skipped: rowsSkipped, recordsCreated, recordsUpdated },
      });
    } catch (err) {
      log.push({ type: "ERROR", message: `Fatal: ${err.message}` });
      return res.status(500).json({
        success:       false,
        message:       "Error processing CSV file",
        error:         err.message,
        processingLog: log,
        summary:       { total: rowsProcessed, success: rowsSuccess, failed: 0, skipped: rowsSkipped, recordsCreated, recordsUpdated },
      });
    }
  },
);

// ═════════════════════════════════════════════════════════════════════════════
// ─── GET /api/attendance/range
// ═════════════════════════════════════════════════════════════════════════════
router.get("/range", adminAuth, async (req, res) => {
  try {
    const { fromDate, toDate, page = 1, limit = 50, search = "" } = req.query;
    if (!fromDate || !toDate)
      return res.status(400).json({ success: false, message: "fromDate and toDate required" });

    const from = parseDDMMYYYY(fromDate);
    const to   = parseDDMMYYYY(toDate);
    if (!from || !to)
      return res.status(400).json({ success: false, message: "Invalid date format. Use dd/mm/yyyy" });

    to.setHours(23, 59, 59, 999);

    const pageNum  = Math.max(1, parseInt(page));
    const limitNum = Math.min(200, Math.max(1, parseInt(limit)));
    const skip     = (pageNum - 1) * limitNum;

    const populateRoleMatch = req.userRole === "superadmin"
      ? { role: { $nin: ["superadmin"] } }
      : { role: "employee" };

    const baseQuery = { date: { $gte: from, $lte: to }, isDeleted: false };
    if (search.trim()) {
      const rx = new RegExp(search.trim(), "i");
      baseQuery.$or = [
        { empNumber:  rx },
        { empName:    rx },
        { department: rx },
        { status:     rx },
      ];
    }

    const [records, totalCount] = await Promise.all([
      AttendanceLog.find(baseQuery)
        .populate({
          path:   "empId",
          select: "firstName lastName email employeeNumber shift role",
          match:  populateRoleMatch,
        })
        .sort({ date: -1, empNumber: 1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      AttendanceLog.countDocuments(baseQuery),
    ]);

    const attendance = records
      .filter((r) => r.empId != null)
      .map((r) => ({
        ...r,
        empRole:        r.empId?.role || "employee",
        dateFormatted:  formatDate(r.date),
        inTime:         r.inOut?.in          || null,
        outTime:        r.inOut?.out         || null,
        outNextDay:     r.inOut?.outNextDay  || false,
        financials: {
          ...r.financials,
          deductionDetails: r.financials?.deductionDetails || [],
          otDetails:        r.financials?.otDetails        || [],
        },
        lastModified:    r.metadata?.lastModifiedAt ? formatDateTimeForDisplay(r.metadata.lastModifiedAt) : "--",
        lastModifiedRaw: r.metadata?.lastModifiedAt || null,
      }));

    return res.json({
      success: true,
      attendance,
      pagination: {
        total:      totalCount,
        page:       pageNum,
        limit:      limitNum,
        totalPages: Math.ceil(totalCount / limitNum),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// ─── POST /api/attendance/worksheet
// ═════════════════════════════════════════════════════════════════════════════
router.post("/worksheet", adminAuth, async (req, res) => {
  try {
    const { fromDate, toDate } = req.body;
    if (!fromDate || !toDate)
      return res.status(400).json({ success: false, message: "fromDate and toDate required" });

    const start = parseDDMMYYYY(fromDate);
    const end   = parseDDMMYYYY(toDate);
    if (!start || !end || isNaN(start) || isNaN(end))
      return res.status(400).json({ success: false, message: "Invalid date format. Use dd/mm/yyyy" });

    const daySpan = Math.round((end - start) / 86_400_000);
    if (daySpan > 93)
      return res.status(400).json({ success: false, message: "Date range cannot exceed 93 days" });

    end.setHours(23, 59, 59, 999);

    const [employees, logs] = await Promise.all([
      Employee.find(payrollEmployeeFilter()).sort({ employeeNumber: 1 }).lean(),
      Employee.countDocuments(payrollEmployeeFilter()).then((count) => {
        if (count === 0) return [];
        return AttendanceLog.find({
          date:      { $gte: start, $lte: end },
          isDeleted: false,
        }).lean();
      }),
    ]);

    if (employees.length === 0)
      return res.json({ success: true, worksheet: [], total: 0 });

    const logMap = {};
    for (const l of logs) {
      const key  = `${l.empId}_${l.date.toISOString().slice(0, 10)}`;
      logMap[key] = l;
    }

    const worksheet = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const iso  = d.toISOString().slice(0, 10);
      const disp = formatDate(new Date(d));
      const dateForRate = new Date(d); // capture current loop date for rate calc

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
            empName:     `${emp.firstName} ${emp.lastName}`,
            department:   emp.department,
            shift:        emp.shift,
            salaryType:   existing.salaryType || emp.salaryType,
            hourlyRate:   existing.hourlyRate,
            status:       existing.status,
            inOut:        existing.inOut,
            financials: {
              ...existing.financials,
              deductionDetails: existing.financials?.deductionDetails || [],
              otDetails:        existing.financials?.otDetails        || [],
            },
            manualOverride:  existing.manualOverride,
            lastModified:    existing.metadata?.lastModifiedAt
              ? formatDateTimeForDisplay(existing.metadata.lastModifiedAt)
              : "--",
            lastModifiedRaw: existing.metadata?.lastModifiedAt || null,
            isVirtual:       false,
            isModified:      false,
          });
        } else {
          // Virtual (OffDay) row — compute the correct per-day rate for display
          const dayRate = perDaySalary(emp, dateForRate);
          worksheet.push({
            date:      disp,
            dateRaw:   new Date(iso),
            empId:     emp._id,
            empNumber: emp.employeeNumber,
            empName:  `${emp.firstName} ${emp.lastName}`,
            department: emp.department,
            shift:      emp.shift,
            salaryType: emp.salaryType,
            hourlyRate: dayRate,
            status:     "OffDay",
            inOut:      { in: null, out: null, outNextDay: false },
            financials: {
              hoursWorked:        0,
              scheduledHours:     shiftHours(emp.shift),
              lateMinutes:        0,
              earlyLogoutMinutes: 0,
              basePay:            0,
              deduction:          0,
              deductionDetails:   [],
              otMultiplier:       1,
              otHours:            0,
              otAmount:           0,
              otDetails:          [],
              finalDayEarning:    0,
            },
            manualOverride:  false,
            lastModified:    "--",
            lastModifiedRaw: null,
            isVirtual:       true,
            isModified:      false,
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
// ─── POST /api/attendance/save-row
// ═════════════════════════════════════════════════════════════════════════════
router.post("/save-row", adminAuth, async (req, res) => {
  try {
    const {
      empId,
      date,
      status,
      inTime,
      outTime,
      outNextDay,
      otHours,
      otMultiplier,
      otDetails,
      deductionDetails: manualDeductionDetails,
      notes,
    } = req.body;

    if (!empId || !date || !status)
      return res.status(400).json({ success: false, message: "empId, date, and status are required" });

    const roleFilter = req.userRole === "superadmin"
      ? { role: { $nin: ["superadmin"] } }
      : { role: "employee" };

    const dateObj = parseDDMMYYYY(date);
    if (!dateObj || isNaN(dateObj))
      return res.status(400).json({ success: false, message: "Invalid date (dd/mm/yyyy required)" });
    dateObj.setHours(0, 0, 0, 0);

    const [employee, existingRecord] = await Promise.all([
      Employee.findOne({ _id: empId, ...roleFilter, isDeleted: false }),
      AttendanceLog.findOne({ empId, date: dateObj, isDeleted: false }),
    ]);

    if (!employee)
      return res.status(404).json({
        success: false,
        message: "Employee not found or you do not have permission to edit this account",
      });

    if (employee.leftBusiness?.isLeft && employee.leftBusiness?.leftDate) {
      const leftDate = new Date(employee.leftBusiness.leftDate);
      leftDate.setHours(0, 0, 0, 0);
      if (dateObj > leftDate)
        return res.status(400).json({
          success: false,
          message: "Cannot add attendance after employee has left the business",
        });
    }

    const isNightShift      = toMin(employee.shift.end) < toMin(employee.shift.start);
    let resolvedOutNextDay  = Boolean(outNextDay);
    if (outNextDay === undefined && inTime && outTime)
      resolvedOutNextDay = isNightShift && toMin(outTime) < toMin(inTime);

    const resolvedInTime  = inTime  || null;
    const resolvedOutTime = outTime || null;

    const cleanOtDetails = (Array.isArray(otDetails) ? otDetails : [])
      .map((e) => ({
        type:   e?.type === "calc" ? "calc" : "manual",
        amount: Number(e?.amount) || 0,
        hours:  Number(e?.hours)  || 0,
        rate:   [1, 1.5, 2].includes(Number(e?.rate)) ? Number(e.rate) : 1,
        reason: String(e?.reason || "").trim(),
      }))
      .filter((e) => e.reason && (e.type === "calc" ? e.hours > 0 : e.amount > 0));

    const hasManualDeductions = Array.isArray(manualDeductionDetails);
    const cleanDeductionDetails = hasManualDeductions
      ? manualDeductionDetails
          .map((d) => ({
            type:   d?.type   || "manual",
            amount: Number(d?.amount) || 0,
            reason: String(d?.reason || "").trim(),
          }))
          .filter((d) => d.reason && d.amount >= 0)
      : null;

    // Per-day rate for this specific date
    const dayRate = perDaySalary(employee, dateObj);

    const otWasExplicitlySent = Array.isArray(otDetails);
    const preservedOt = !otWasExplicitlySent && existingRecord
      ? {
          otHours:     existingRecord.financials?.otHours      || 0,
          otAmount:    existingRecord.financials?.otAmount      || 0,
          otMultiplier: existingRecord.financials?.otMultiplier || 1,
          otDetails:   existingRecord.financials?.otDetails     || [],
        }
      : {
          otHours:     Number(otHours)     || 0,
          otMultiplier: Number(otMultiplier) || 1,
          otDetails:   cleanOtDetails,
          otAmount:    0,
        };

    const financials = buildFinancials({
      status,
      inTime:     resolvedInTime,
      outTime:    resolvedOutTime,
      outNextDay: resolvedOutNextDay,
      shift:      employee.shift,
      dayRate,
      salaryType: employee.salaryType,
      ...preservedOt,
    });

    // Apply manual deduction overrides if supplied
    if (cleanDeductionDetails !== null && (existingRecord || cleanDeductionDetails.length > 0)) {
      const totalDeduction        = cleanDeductionDetails.reduce((s, d) => s + d.amount, 0);
      financials.deductionDetails = cleanDeductionDetails;
      financials.deduction        = totalDeduction;
      financials.finalDayEarning  = Math.max(0, financials.basePay - totalDeduction + financials.otAmount);
    }

    let record = existingRecord;
    if (!record) {
      const deletedRecord = await AttendanceLog.findOne({ empId: employee._id, date: dateObj, isDeleted: true });
      record = deletedRecord || new AttendanceLog({ empId: employee._id, date: dateObj });
    }

    record.empNumber    = employee.employeeNumber;
    record.empName      = `${employee.firstName} ${employee.lastName}`;
    record.department   = employee.department;
    record.status       = status;
    record.salaryType   = employee.salaryType;
    record.inOut        = { in: resolvedInTime, out: resolvedOutTime, outNextDay: resolvedOutNextDay };
    record.shift        = { start: employee.shift.start, end: employee.shift.end, isNightShift };
    record.hourlyRate   = dayRate;
    record.financials   = financials;
    record.isDeleted    = false;
    record.manualOverride = true;
    record.metadata     = {
      ...(record.metadata?.toObject?.() || { ...(record.metadata || {}) }),
      source:          "manual",
      lastUpdatedBy:   req.userId,
      lastModifiedAt:  new Date(),
      ...(notes !== undefined ? { notes: notes || "" } : {}),
    };

    await record.save();

    return res.json({
      success:      true,
      message:      "Attendance saved",
      record,
      lastModified: formatDateTimeForDisplay(new Date()),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// ─── DELETE /api/attendance/:id
// ═════════════════════════════════════════════════════════════════════════════
router.delete("/:id", adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || id.length !== 24)
      return res.status(400).json({ success: false, message: "Invalid record ID" });

    const record = await AttendanceLog.findOne({ _id: id, isDeleted: { $ne: true } })
      .populate({ path: "empId", select: "role", match: { role: { $nin: ["superadmin"] } } })
      .lean();

    if (!record)
      return res.status(404).json({ success: false, message: "Record not found" });
    if (!record.empId)
      return res.status(403).json({ success: false, message: "You do not have permission to delete this record" });
    if (req.userRole === "admin" && record.empId?.role !== "employee")
      return res.status(403).json({
        success: false,
        message: "Admins can only delete attendance records for employee-role accounts",
      });

    await AttendanceLog.updateOne(
      { _id: id },
      {
        $set: {
          isDeleted:                 true,
          "metadata.deletedBy":      req.userId,
          "metadata.deletedAt":      new Date(),
          "metadata.lastModifiedAt": new Date(),
        },
      },
    );

    return res.json({ success: true, message: "Attendance record deleted successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// ─── POST /api/attendance/bulk-save
// ═════════════════════════════════════════════════════════════════════════════
router.post("/bulk-save", adminAuth, async (req, res) => {
  try {
    const { rows, forceOverride = false } = req.body;
    if (!Array.isArray(rows) || rows.length === 0)
      return res.status(400).json({ success: false, message: "rows array is required and must not be empty" });
    if (rows.length > 500)
      return res.status(400).json({ success: false, message: "Maximum 500 rows per bulk-save request" });

    const roleFilter = req.userRole === "superadmin"
      ? { role: { $nin: ["superadmin"] } }
      : { role: "employee" };

    const empIds    = [...new Set(rows.map((r) => String(r.empId)).filter(Boolean))];
    const employees = await Employee.find({ _id: { $in: empIds }, ...roleFilter, isDeleted: false }).lean();
    const empMap    = Object.fromEntries(employees.map((e) => [String(e._id), e]));

    const results  = { saved: 0, skipped: 0, errors: [] };
    const bulkOps  = [];

    for (const row of rows) {
      const emp = empMap[String(row.empId)];
      if (!emp) {
        results.errors.push({ empId: row.empId, date: row.date, error: "Employee not found or no permission" });
        results.skipped++;
        continue;
      }

      const dateObj = parseDDMMYYYY(row.date) || (row.dateRaw ? new Date(row.dateRaw) : null);
      if (!dateObj || isNaN(dateObj)) {
        results.errors.push({ empId: row.empId, date: row.date, error: "Invalid date" });
        results.skipped++;
        continue;
      }
      dateObj.setHours(0, 0, 0, 0);

      const isNightShift     = toMin(emp.shift.end) < toMin(emp.shift.start);
      const inTime           = row.inOut?.in   || row.inTime  || null;
      const outTime          = row.inOut?.out  || row.outTime || null;
      let resolvedOutNextDay = Boolean(row.inOut?.outNextDay || row.outNextDay);
      if (!row.inOut?.outNextDay && inTime && outTime)
        resolvedOutNextDay = isNightShift && toMin(outTime) < toMin(inTime);

      // Per-day rate for this specific date
      const dayRate = perDaySalary(emp, dateObj);
      const status  = row.status || "OffDay";

      const rowOtDetails = (Array.isArray(row.financials?.otDetails) ? row.financials.otDetails : [])
        .map((e) => ({ ...e, type: "manual" }));

      const financials = buildFinancials({
        status,
        inTime,
        outTime,
        outNextDay:  resolvedOutNextDay,
        shift:       emp.shift,
        dayRate,
        salaryType:  emp.salaryType,
        otHours:     Number(row.financials?.otHours)     || 0,
        otMultiplier: Number(row.financials?.otMultiplier) || 1,
        otDetails:   rowOtDetails,
        otAmount:    Number(row.financials?.otAmount)     || 0,
      });

      bulkOps.push({
        updateOne: {
          filter: { empId: emp._id, date: dateObj },
          update: {
            $setOnInsert: { empId: emp._id, date: dateObj },
            $set: {
              empNumber:               emp.employeeNumber,
              empName:                `${emp.firstName} ${emp.lastName}`,
              department:             emp.department,
              status,
              salaryType:             emp.salaryType,
              inOut:                  { in: inTime, out: outTime, outNextDay: resolvedOutNextDay },
              shift:                  { start: emp.shift.start, end: emp.shift.end, isNightShift },
              hourlyRate:             dayRate,
              financials,
              manualOverride:         Boolean(forceOverride),
              isDeleted:              false,
              "metadata.source":      "manual",
              "metadata.lastUpdatedBy": req.userId,
              "metadata.lastModifiedAt": new Date(),
            },
          },
          upsert: true,
        },
      });
      results.saved++;
    }

    if (bulkOps.length > 0)
      await AttendanceLog.bulkWrite(bulkOps, { ordered: false });

    return res.json({ success: true, message: "Bulk save complete", results });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;