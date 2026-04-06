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
  parseDDMMYYYY,
} from "../utils/dateUtils.js";

const router = express.Router();

// ─── Only superadmin is login-only — excluded from attendance/payroll logic ───
const SYSTEM_ROLES = ["superadmin", "owner"];

const payrollEmployeeFilter = (extra = {}) => ({
  role: { $nin: SYSTEM_ROLES },
  status: { $in: ["Active", "Frozen"] },
  isArchived: false,
  isDeleted: false,
  ...extra,
});

// ─── multer ───────────────────────────────────────────────────────────────────

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok =
      file.mimetype.includes("csv") ||
      file.mimetype.includes("text") ||
      file.originalname.endsWith(".csv");
    cb(ok ? null : new Error("Invalid file type"), ok);
  },
});

// ═════════════════════════════════════════════════════════════════════════════
// ─── PURE TIME HELPERS ───────────────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════

/** Convert "HH:mm" → total minutes since midnight */
const toMin = (t) => {
  if (!t) return 0;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

// ─── Night-shift checkout date resolver ──────────────────────────────────────
function resolveNightShiftCheckoutDate(outTime, csvDate, shift) {
  const isNightShift = toMin(shift.end) < toMin(shift.start);
  if (!isNightShift) {
    return { shiftDate: csvDate, outNextDay: false };
  }
  const outMin = toMin(outTime);
  const shiftStartMin = toMin(shift.start);
  if (outMin >= shiftStartMin) {
    return { shiftDate: csvDate, outNextDay: false };
  }
  const prevDay = new Date(csvDate);
  prevDay.setDate(prevDay.getDate() - 1);
  prevDay.setHours(0, 0, 0, 0);
  return { shiftDate: prevDay, outNextDay: true };
}

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
  if (emp.salaryType === "monthly" && emp.monthlySalary) {
    const scheduledHrsPerDay = shiftHours(emp.shift) || 8;
    return emp.monthlySalary / (workingDaysInPeriod * scheduledHrsPerDay);
  }
  return emp.hourlyRate || 0;
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
// ─── DEDUCTION ENGINE ────────────────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════

function computeDeductions({
  inTime,
  outTime,
  outNextDay = false,
  shift,
  hourlyRate,
}) {
  const details = [];
  let lateMinutes = 0;
  let earlyLogoutMinutes = 0;

  const shiftStartMin = toMin(shift.start);
  const isNightShift = toMin(shift.end) < toMin(shift.start);

  // ── LOGIN penalty ──────────────────────────────────────────────────────────
  if (inTime) {
    const inMin = toMin(inTime);
    let normInMin = inMin;
    if (isNightShift && inMin < shiftStartMin) normInMin += 1440;
    const diffFromStart = normInMin - shiftStartMin;

    if (diffFromStart > 30) {
      lateMinutes = diffFromStart;
      details.push({
        type: "fixed_penalty",
        amount: 800,
        reason: `Late login: ${diffFromStart} min after shift start (>30 min bracket)`,
      });
      details.push({
        type: "hourly_penalty",
        amount: Math.round(hourlyRate),
        reason: `Additional 1-hour salary deduction for login >30 min late`,
      });
    } else if (diffFromStart > 0) {
      lateMinutes = diffFromStart;
      details.push({
        type: "fixed_penalty",
        amount: 800,
        reason: `Late login: ${diffFromStart} min after shift start (1–30 min bracket)`,
      });
    } else if (diffFromStart > -5) {
      details.push({
        type: "fixed_penalty",
        amount: 500,
        reason: `Login 0–5 min before shift start (${Math.abs(diffFromStart)} min early)`,
      });
    } else if (diffFromStart > -10) {
      details.push({
        type: "fixed_penalty",
        amount: 250,
        reason: `Login 6–10 min before shift start (${Math.abs(diffFromStart)} min early)`,
      });
    }
  }

  // ── LOGOUT penalty ─────────────────────────────────────────────────────────
  if (outTime) {
    const shiftEndMin = toMin(shift.end);
    let normShiftEndMin = shiftEndMin;
    let normOutMin = toMin(outTime);
    if (isNightShift) {
      normShiftEndMin += 1440;
      if (outNextDay) normOutMin += 1440;
    }
    const minutesBeforeEnd = normShiftEndMin - normOutMin;
    if (minutesBeforeEnd > 30) {
      earlyLogoutMinutes = minutesBeforeEnd;
      details.push({
        type: "early_logout",
        amount: 800,
        reason: `Early logout: ${minutesBeforeEnd} min before shift end (>30 min bracket)`,
      });
    } else if (minutesBeforeEnd > 0) {
      earlyLogoutMinutes = minutesBeforeEnd;
      details.push({
        type: "early_logout",
        amount: 500,
        reason: `Early logout: ${minutesBeforeEnd} min before shift end (1–30 min bracket)`,
      });
    }
  }

  const totalDeduction = details.reduce((s, d) => s + d.amount, 0);
  return {
    deductionDetails: details,
    totalDeduction,
    lateMinutes,
    earlyLogoutMinutes,
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// ─── FINANCIALS BUILDER ──────────────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════

function buildFinancials({
  status,
  inTime,
  outTime,
  outNextDay = false,
  shift,
  hourlyRate,
  salaryType,
  otHours = 0,
  otMultiplier = 1,
  otDetails = [],
  otAmount = 0,
}) {
  const scheduledHrs = shiftHours(shift);
  let hoursWorked = 0;
  let basePay = 0;

  if (status === "Leave") {
    hoursWorked = scheduledHrs;
    basePay = hoursWorked * hourlyRate;
  } else if ((status === "Present" || status === "Late") && inTime && outTime) {
    hoursWorked = calcHours(inTime, outTime, outNextDay);
    basePay = hoursWorked * hourlyRate;
  } else if ((inTime && !outTime) || (!inTime && outTime)) {
    hoursWorked = scheduledHrs;
    basePay = hoursWorked * hourlyRate;

    deduction = 50; // ✅ fixed penalty
  } else if (status === "NCNS") {
    const fullDayPay = scheduledHrs * hourlyRate;

    hoursWorked = 0;
    basePay = 0;

    deduction = fullDayPay * 2; // ✅ 200% penalty
  }

  let deductionDetails = [];
  let totalDeduction = 0;
  let lateMinutes = 0;
  let earlyLogoutMinutes = 0;

  if (status !== "Leave" && status !== "Absent") {
    ({ deductionDetails, totalDeduction, lateMinutes, earlyLogoutMinutes } =
      computeDeductions({ inTime, outTime, outNextDay, shift, hourlyRate }));
  }

  const resolvedOtAmount = otDetails.length
    ? otDetails.reduce((s, e) => {
        if (e.type === "manual") return s + (e.amount || 0);
        return s + (e.hours || 0) * (e.rate || 1) * hourlyRate;
      }, 0)
    : otAmount || 0;

  const resolvedOtHours = otDetails.length
    ? otDetails.reduce((s, e) => s + (e.hours || 0), 0)
    : otHours || 0;

  const finalDayEarning = Math.max(
    0,
    basePay - totalDeduction + resolvedOtAmount,
  );

  return {
    hoursWorked,
    scheduledHours: scheduledHrs,
    lateMinutes,
    earlyLogoutMinutes,
    basePay,
    deduction: totalDeduction,
    deductionDetails,
    otMultiplier: otMultiplier || 1,
    otHours: resolvedOtHours,
    otAmount: resolvedOtAmount,
    otDetails,
    finalDayEarning,
  };
}

const hoursLabel = (f) =>
  `Hours: ${(f.hoursWorked || 0).toFixed(2)} | Base: ${(f.basePay || 0).toFixed(2)} | Deduction: ${(f.deduction || 0).toFixed(2)} | OT: ${(f.otAmount || 0).toFixed(2)} | Final: ${(f.finalDayEarning || 0).toFixed(2)}`;

// ═════════════════════════════════════════════════════════════════════════════
// ─── 14-HOUR SHIFT-BASED PAIRING ─────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════

function applyShiftBasedPairing(shiftStart, punchTimes) {
  if (!punchTimes || punchTimes.length === 0) {
    return { inTime: null, outTime: null, outNextDay: false };
  }

  const shiftStartMin = toMin(shiftStart);
  const windowEnd = shiftStartMin + 14 * 60;

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
    const outOnly = normalised.find(
      (p) => p.norm >= shiftStartMin && p.norm <= windowEnd,
    );
    if (outOnly) {
      return {
        inTime: null,
        outTime: outOnly.time,
        outNextDay:
          outOnly.norm > 1440 || toMin(outOnly.time) < shiftStartMin % 1440,
      };
    }
    return { inTime: null, outTime: null, outNextDay: false };
  }

  const outEntry = normalised.find(
    (p) => p.norm > inEntry.norm && p.norm <= windowEnd,
  );
  if (!outEntry) {
    return { inTime: inEntry.time, outTime: null, outNextDay: false };
  }

  const outNextDay = toMin(outEntry.time) < toMin(inEntry.time);
  return { inTime: inEntry.time, outTime: outEntry.time, outNextDay };
}

// ═════════════════════════════════════════════════════════════════════════════
// ─── POST /api/attendance/import-csv ─────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════

router.post(
  "/import-csv",
  adminAuth,
  upload.single("csvFile"),
  validateCSVFile,
  async (req, res) => {
    const log = [];
    let rowsProcessed = 0,
      rowsSuccess = 0,
      rowsSkipped = 0;
    let recordsCreated = 0,
      recordsUpdated = 0;

    try {
      const csvContent = req.file.buffer.toString("utf-8");
      log.push({
        type: "INFO",
        message: `📁 File: ${req.file.originalname} (${req.file.size} bytes)`,
      });

      const { parsed, errors } = parseCSV(csvContent);
      errors.forEach((e) =>
        log.push({ type: "ERROR", message: `Row ${e.rowNumber}: ${e.error}` }),
      );

      rowsProcessed = parsed.length;

      if (parsed.length === 0) {
        return res.status(400).json({
          success: false,
          message: "No valid rows found in CSV file",
          processingLog: log,
          summary: {
            total: 0,
            success: 0,
            failed: errors.length,
            skipped: 0,
            recordsCreated: 0,
            recordsUpdated: 0,
          },
        });
      }

      log.push({
        type: "INFO",
        message: `✓ Parsed ${parsed.length} valid row(s)`,
      });

      const empNumbers = [...new Set(parsed.map((r) => r.empId))];
      const employees = await Employee.find({
        employeeNumber: { $in: empNumbers },
        role: { $nin: SYSTEM_ROLES },
        isDeleted: false,
      }).lean();
      const empMap = Object.fromEntries(
        employees.map((e) => [e.employeeNumber, e]),
      );

      const grouped = groupByEmployeeAndDate(parsed);
      log.push({
        type: "INFO",
        message: `📦 ${Object.keys(grouped).length} employee-date group(s)`,
      });

      for (const [, groupData] of Object.entries(grouped)) {
        const { empId, firstName, lastName, dateStr, date, rows } = groupData;

        log.push({
          type: "INFO",
          message: `\n👤 ${empId} (${firstName} ${lastName}) — ${dateStr}`,
        });

        const employee = empMap[empId];
        if (!employee) {
          log.push({
            type: "WARN",
            message: `  ⚠️ Employee #${empId} not found or is a superadmin. Skipped.`,
          });
          rowsSkipped += rows.length;
          continue;
        }

        const punchTimes = rows.map((r) => r.time).filter(Boolean);
        const merged = mergeTimes(rows);

        let inTime, outTime, outNextDay;

        if (merged.inTime || merged.outTime) {
          inTime = merged.inTime;
          outTime = merged.outTime;
          outNextDay = merged.outNextDay || false;
        } else {
          ({ inTime, outTime, outNextDay } = applyShiftBasedPairing(
            employee.shift.start,
            punchTimes,
          ));
        }

        const isNightShiftEmp =
          toMin(employee.shift.end) < toMin(employee.shift.start);

        if (isNightShiftEmp && inTime && outTime && outNextDay) {
          const outMin = toMin(outTime);
          const shiftStartMin = toMin(employee.shift.start);

          if (outMin < shiftStartMin) {
            const prevDay = new Date(date);
            prevDay.setDate(prevDay.getDate() - 1);
            prevDay.setHours(0, 0, 0, 0);

            log.push({
              type: "INFO",
              message: `  ℹ️ Mixed group: out=${outTime} → prev shift ${formatDate(prevDay)}, in=${inTime} → today ${dateStr}`,
            });

            const prevRate = effectiveHourlyRate(employee, 26);

            try {
              const prevExisting = await AttendanceLog.findOne({
                empId: employee._id,
                date: prevDay,
              });

              if (prevExisting && prevExisting.manualOverride) {
                log.push({
                  type: "WARN",
                  message: `  ⚠️ Prev shift (${formatDate(prevDay)}) has manual override — checkout skipped`,
                });
              } else if (prevExisting) {
                const prevMergedOut = latestTime(
                  prevExisting.inOut?.out,
                  outTime,
                );
                const prevMergedIn = prevExisting.inOut?.in || null;
                const prevOutNextDay =
                  prevMergedIn && prevMergedOut
                    ? toMin(prevMergedOut) < toMin(prevMergedIn)
                    : true;
                const prevStatus =
                  prevMergedIn && isLate(prevMergedIn, employee.shift.start)
                    ? "Late"
                    : "Present";
                const prevFinancials = buildFinancials({
                  status: prevStatus,
                  inTime: prevMergedIn,
                  outTime: prevMergedOut,
                  outNextDay: prevOutNextDay,
                  shift: employee.shift,
                  hourlyRate: prevRate,
                  salaryType: employee.salaryType,
                  otHours: prevExisting.financials?.otHours || 0,
                  otAmount: prevExisting.financials?.otAmount || 0,
                  otMultiplier: prevExisting.financials?.otMultiplier || 1,
                  otDetails: prevExisting.financials?.otDetails || [],
                });
                await AttendanceLog.updateOne(
                  { _id: prevExisting._id },
                  {
                    $set: {
                      status: prevStatus,
                      "inOut.out": prevMergedOut,
                      "inOut.outNextDay": prevOutNextDay,
                      financials: prevFinancials,
                      "metadata.source": "csv",
                      "metadata.lastUpdatedBy": req.userId,
                      "metadata.lastModifiedAt": new Date(),
                    },
                  },
                );
                recordsUpdated++;
                log.push({
                  type: "SUCCESS",
                  message: `  ✓ Prev shift (${formatDate(prevDay)}) updated with out=${outTime}`,
                });
              } else {
                const prevFinancials = buildFinancials({
                  status: "Present",
                  inTime: null,
                  outTime,
                  outNextDay: true,
                  shift: employee.shift,
                  hourlyRate: prevRate,
                  salaryType: employee.salaryType,
                });
                await AttendanceLog.create({
                  date: prevDay,
                  empId: employee._id,
                  empNumber: employee.employeeNumber,
                  empName: `${employee.firstName} ${employee.lastName}`,
                  department: employee.department,
                  status: "Present",
                  salaryType: employee.salaryType,
                  inOut: { in: null, out: outTime, outNextDay: true },
                  shift: {
                    start: employee.shift.start,
                    end: employee.shift.end,
                    isNightShift: true,
                  },
                  hourlyRate: prevRate,
                  financials: prevFinancials,
                  manualOverride: false,
                  metadata: {
                    source: "csv",
                    lastUpdatedBy: req.userId,
                    lastModifiedAt: new Date(),
                  },
                });
                recordsCreated++;
                log.push({
                  type: "SUCCESS",
                  message: `  ✓ Prev shift (${formatDate(prevDay)}) created with out=${outTime}`,
                });
              }
            } catch (splitErr) {
              log.push({
                type: "ERROR",
                message: `  ✗ Prev shift save failed: ${splitErr.message}`,
              });
            }

            outTime = null;
            outNextDay = false;
          }
        }

        let attendanceDate = date;
        if (!inTime && outTime) {
          const resolved = resolveNightShiftCheckoutDate(
            outTime,
            date,
            employee.shift,
          );
          attendanceDate = resolved.shiftDate;
          outNextDay = resolved.outNextDay;
          if (resolved.shiftDate.getTime() !== date.getTime()) {
            log.push({
              type: "INFO",
              message: `  ℹ️ Night-shift checkout — resolved to shift date: ${formatDate(resolved.shiftDate)}`,
            });
          }
        }

        if (inTime) log.push({ type: "INFO", message: `  ✓ In:  ${inTime}` });
        if (outTime)
          log.push({
            type: "INFO",
            message: `  ✓ Out: ${outTime}${outNextDay ? " (next day)" : ""}`,
          });
        if (!inTime && !outTime)
          log.push({
            type: "WARN",
            message: `  ⚠️ No punches found within 14-h shift window`,
          });

        let status = "Absent";
        if (inTime || outTime) {
          status =
            inTime && isLate(inTime, employee.shift.start) ? "Late" : "Present";
        }

        const rate = effectiveHourlyRate(employee, 26);
        const financials = buildFinancials({
          status,
          inTime,
          outTime,
          outNextDay,
          shift: employee.shift,
          hourlyRate: rate,
          salaryType: employee.salaryType,
        });

        log.push({
          type: "INFO",
          message: `  💰 ${hoursLabel(financials)} | Status: ${status}`,
        });
        if (financials.deductionDetails.length > 0) {
          financials.deductionDetails.forEach((d) =>
            log.push({
              type: "INFO",
              message: `    ⚠️ Deduction: ${d.type} — PKR ${d.amount} (${d.reason})`,
            }),
          );
        }

        try {
          const existing = await AttendanceLog.findOne({
            empId: employee._id,
            date: attendanceDate,
          });

          if (existing) {
            if (existing.manualOverride) {
              log.push({
                type: "WARN",
                message: `  ⚠️ Skipped — record has manual override.`,
              });
              rowsSkipped += rows.length;
              continue;
            }

            let mergedIn = earliestTime(existing.inOut?.in, inTime);
            let mergedOut = latestTime(existing.inOut?.out, outTime);

            let mergedOutNextDay =
              existing.shift?.isNightShift && mergedIn && mergedOut
                ? toMin(mergedOut) < toMin(mergedIn)
                : outNextDay;

            let mergedStatus = existing.status;
            if (mergedIn || mergedOut) {
              mergedStatus =
                mergedIn && isLate(mergedIn, employee.shift.start)
                  ? "Late"
                  : "Present";
            }

            const mergedFinancials = buildFinancials({
              status: mergedStatus,
              inTime: mergedIn,
              outTime: mergedOut,
              outNextDay: mergedOutNextDay,
              shift: employee.shift,
              hourlyRate: rate,
              salaryType: employee.salaryType,
              otHours: existing.financials?.otHours || 0,
              otAmount: existing.financials?.otAmount || 0,
              otMultiplier: existing.financials?.otMultiplier || 1,
              otDetails: existing.financials?.otDetails || [],
            });

            await AttendanceLog.updateOne(
              { _id: existing._id },
              {
                $set: {
                  status: mergedStatus,
                  salaryType: employee.salaryType,
                  "inOut.in": mergedIn || null,
                  "inOut.out": mergedOut || null,
                  "inOut.outNextDay": mergedOutNextDay,
                  hourlyRate: rate,
                  financials: mergedFinancials,
                  "metadata.source": "csv",
                  "metadata.lastUpdatedBy": req.userId,
                  "metadata.lastModifiedAt": new Date(),
                },
              },
            );

            recordsUpdated++;
            log.push({
              type: "SUCCESS",
              message: `  ✓ Updated (merged — ${mergedStatus})`,
            });
          } else {
            await AttendanceLog.create({
              date: attendanceDate,
              empId: employee._id,
              empNumber: employee.employeeNumber,
              empName: `${employee.firstName} ${employee.lastName}`,
              department: employee.department,
              status,
              salaryType: employee.salaryType,
              inOut: {
                in: inTime || null,
                out: outTime || null,
                outNextDay: outNextDay || false,
              },
              shift: {
                start: employee.shift.start,
                end: employee.shift.end,
                isNightShift:
                  toMin(employee.shift.end) < toMin(employee.shift.start),
              },
              hourlyRate: rate,
              financials,
              manualOverride: false,
              metadata: {
                source: "csv",
                lastUpdatedBy: req.userId,
                lastModifiedAt: new Date(),
              },
            });

            recordsCreated++;
            log.push({ type: "SUCCESS", message: `  ✓ Created (${status})` });
          }

          rowsSuccess += rows.length;
        } catch (dbErr) {
          log.push({
            type: "ERROR",
            message: `  ✗ DB error: ${dbErr.message}`,
          });
        }
      }

      log.push({
        type: "SUMMARY",
        message: `✅ DONE — Rows: ${rowsProcessed} | OK: ${rowsSuccess} | Skipped: ${rowsSkipped} | Errors: ${errors.length} | Created: ${recordsCreated} | Updated: ${recordsUpdated}`,
      });

      return res.json({
        success: true,
        message: "CSV import complete",
        processingLog: log,
        summary: {
          total: rowsProcessed,
          success: rowsSuccess,
          failed: errors.length,
          skipped: rowsSkipped,
          recordsCreated,
          recordsUpdated,
        },
      });
    } catch (err) {
      log.push({ type: "ERROR", message: `Fatal: ${err.message}` });
      return res.status(500).json({
        success: false,
        message: "Error processing CSV file",
        error: err.message,
        processingLog: log,
        summary: {
          total: rowsProcessed,
          success: rowsSuccess,
          failed: 0,
          skipped: rowsSkipped,
          recordsCreated,
          recordsUpdated,
        },
      });
    }
  },
);

// ═════════════════════════════════════════════════════════════════════════════
// ─── GET /api/attendance/range ────────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════

router.get("/range", adminAuth, async (req, res) => {
  try {
    const { fromDate, toDate } = req.query;

    if (!fromDate || !toDate) {
      return res
        .status(400)
        .json({ success: false, message: "fromDate and toDate required" });
    }

    const from = parseDDMMYYYY(fromDate);
    const to = parseDDMMYYYY(toDate);

    if (!from || !to) {
      return res.status(400).json({
        success: false,
        message: "Invalid date format. Use dd/mm/yyyy",
      });
    }

    to.setHours(23, 59, 59, 999);

    const populateRoleMatch =
      req.userRole === "superadmin"
        ? { role: { $nin: ["superadmin"] } }
        : { role: "employee" };

    const records = await AttendanceLog.find({
      date: { $gte: from, $lte: to },
      isDeleted: false,
    })
      .populate({
        path: "empId",
        select: "firstName lastName email employeeNumber shift role",
        match: populateRoleMatch,
      })
      .sort({ date: -1, empNumber: 1 })
      .lean();

    const attendance = records
      .filter((r) => r.empId != null)
      .map((r) => ({
        ...r,
        empRole: r.empId?.role || "employee",
        dateFormatted: formatDate(r.date),
        inTime: r.inOut?.in || null,
        outTime: r.inOut?.out || null,
        outNextDay: r.inOut?.outNextDay || false,
        financials: {
          ...r.financials,
          deductionDetails: r.financials?.deductionDetails || [],
          otDetails: r.financials?.otDetails || [],
        },
        lastModified: r.metadata?.lastModifiedAt
          ? formatDateTimeForDisplay(r.metadata.lastModifiedAt)
          : "--",
        lastModifiedRaw: r.metadata?.lastModifiedAt || null,
      }));

    return res.json({ success: true, attendance, total: attendance.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// ─── POST /api/attendance/worksheet ──────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════

router.post("/worksheet", adminAuth, async (req, res) => {
  try {
    const { fromDate, toDate } = req.body;

    if (!fromDate || !toDate) {
      return res
        .status(400)
        .json({ success: false, message: "fromDate and toDate required" });
    }

    const start = parseDDMMYYYY(fromDate);
    const end = parseDDMMYYYY(toDate);

    if (!start || !end || isNaN(start) || isNaN(end)) {
      return res.status(400).json({
        success: false,
        message: "Invalid date format. Use dd/mm/yyyy",
      });
    }

    const daySpan = Math.round((end - start) / 86_400_000);
    if (daySpan > 93) {
      return res
        .status(400)
        .json({ success: false, message: "Date range cannot exceed 93 days" });
    }

    end.setHours(23, 59, 59, 999);

    const employees = await Employee.find(payrollEmployeeFilter())
      .sort({ employeeNumber: 1 })
      .lean();

    if (employees.length === 0) {
      return res.json({ success: true, worksheet: [], total: 0 });
    }

    const empIds = employees.map((e) => e._id);
    const logs = await AttendanceLog.find({
      empId: { $in: empIds },
      date: { $gte: start, $lte: end },
      isDeleted: false,
    }).lean();

    const logMap = {};
    for (const log of logs) {
      const key = `${log.empId}_${log.date.toISOString().slice(0, 10)}`;
      logMap[key] = log;
    }

    const worksheet = [];

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const iso = d.toISOString().slice(0, 10);
      const disp = formatDate(new Date(d));

      for (const emp of employees) {
        const key = `${emp._id}_${iso}`;
        const existing = logMap[key];

        if (existing) {
          worksheet.push({
            _id: existing._id,
            date: disp,
            dateRaw: existing.date,
            empId: emp._id,
            empNumber: emp.employeeNumber,
            empName: `${emp.firstName} ${emp.lastName}`,
            department: emp.department,
            shift: emp.shift,
            salaryType: existing.salaryType || emp.salaryType,
            hourlyRate: existing.hourlyRate,
            status: existing.status,
            inOut: existing.inOut,
            financials: {
              ...existing.financials,
              deductionDetails: existing.financials?.deductionDetails || [],
              otDetails: existing.financials?.otDetails || [],
            },
            manualOverride: existing.manualOverride,
            lastModified: existing.metadata?.lastModifiedAt
              ? formatDateTimeForDisplay(existing.metadata.lastModifiedAt)
              : "--",
            lastModifiedRaw: existing.metadata?.lastModifiedAt || null,
            isVirtual: false,
            isModified: false,
          });
        } else {
          worksheet.push({
            date: disp,
            dateRaw: new Date(iso),
            empId: emp._id,
            empNumber: emp.employeeNumber,
            empName: `${emp.firstName} ${emp.lastName}`,
            department: emp.department,
            shift: emp.shift,
            salaryType: emp.salaryType,
            hourlyRate: effectiveHourlyRate(emp, 26),
            status: "Absent",
            inOut: { in: null, out: null, outNextDay: false },
            financials: {
              hoursWorked: 0,
              scheduledHours: shiftHours(emp.shift),
              lateMinutes: 0,
              earlyLogoutMinutes: 0,
              basePay: 0,
              deduction: 0,
              deductionDetails: [],
              otMultiplier: 1,
              otHours: 0,
              otAmount: 0,
              otDetails: [],
              finalDayEarning: 0,
            },
            manualOverride: false,
            lastModified: "--",
            lastModifiedRaw: null,
            isVirtual: true,
            isModified: false,
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
    } = req.body;

    if (!empId || !date || !status) {
      return res.status(400).json({
        success: false,
        message: "empId, date, and status are required",
      });
    }

    const roleFilter =
      req.userRole === "superadmin"
        ? { role: { $nin: ["superadmin"] } }
        : { role: "employee" };

    const employee = await Employee.findOne({
      _id: empId,
      ...roleFilter,
      isDeleted: false,
    });
    if (!employee) {
      return res.status(404).json({
        success: false,
        message:
          "Employee not found or you do not have permission to edit this account",
      });
    }

    // 🚨 BUSINESS RULE: Block attendance after employee left
    if (employee.leftBusiness?.isLeft && employee.leftBusiness?.leftDate) {
      const leftDate = new Date(employee.leftBusiness.leftDate);
      leftDate.setHours(0, 0, 0, 0);

      const attendanceDate = new Date(dateObj);
      attendanceDate.setHours(0, 0, 0, 0);

      if (attendanceDate > leftDate) {
        return res.status(400).json({
          success: false,
          message: "Cannot add attendance after employee has left the business",
        });
      }
    }

    const dateObj = parseDDMMYYYY(date);
    if (!dateObj || isNaN(dateObj)) {
      return res.status(400).json({
        success: false,
        message: "Invalid date (dd/mm/yyyy required)",
      });
    }
    dateObj.setHours(0, 0, 0, 0);

    const isNightShift =
      toMin(employee.shift.end) < toMin(employee.shift.start);

    let resolvedOutNextDay = Boolean(outNextDay);
    if (outNextDay === undefined && inTime && outTime) {
      resolvedOutNextDay = isNightShift && toMin(outTime) < toMin(inTime);
    }

    let resolvedInTime = inTime || null;
    let resolvedOutTime = outTime || null;

    const cleanOtDetails = (Array.isArray(otDetails) ? otDetails : [])
      .map((e) => ({
        type: e?.type === "calc" ? "calc" : "manual",
        amount: Number(e?.amount) || 0,
        hours: Number(e?.hours) || 0,
        rate: [1, 1.5, 2].includes(Number(e?.rate)) ? Number(e.rate) : 1,
        reason: String(e?.reason || "").trim(),
      }))
      .filter(
        (e) => e.reason && (e.type === "calc" ? e.hours > 0 : e.amount > 0),
      );

    const hasManualDeductions = Array.isArray(manualDeductionDetails);
    const cleanDeductionDetails = hasManualDeductions
      ? manualDeductionDetails
          .map((d) => ({
            type: d?.type || "manual",
            amount: Number(d?.amount) || 0,
            reason: String(d?.reason || "").trim(),
          }))
          .filter((d) => d.reason && d.amount >= 0)
      : null;

    const rate = effectiveHourlyRate(employee, 26);

    const existingRecord = await AttendanceLog.findOne({
      empId: employee._id,
      date: dateObj,
    });

    const otWasExplicitlySent = Array.isArray(otDetails);

    const preservedOt =
      !otWasExplicitlySent && existingRecord
        ? {
            otHours: existingRecord.financials?.otHours || 0,
            otAmount: existingRecord.financials?.otAmount || 0,
            otMultiplier: existingRecord.financials?.otMultiplier || 1,
            otDetails: existingRecord.financials?.otDetails || [],
          }
        : {
            otHours: Number(otHours) || 0,
            otMultiplier: Number(otMultiplier) || 1,
            otDetails: cleanOtDetails,
            otAmount: 0,
          };

    const financials = buildFinancials({
      status,
      inTime: resolvedInTime,
      outTime: resolvedOutTime,
      outNextDay: resolvedOutNextDay,
      shift: employee.shift,
      hourlyRate: rate,
      salaryType: employee.salaryType,
      ...preservedOt,
    });

    if (
      cleanDeductionDetails !== null &&
      (existingRecord || cleanDeductionDetails.length > 0)
    ) {
      const totalDeduction = cleanDeductionDetails.reduce(
        (s, d) => s + d.amount,
        0,
      );
      financials.deductionDetails = cleanDeductionDetails;
      financials.deduction = totalDeduction;
      financials.finalDayEarning = Math.max(
        0,
        financials.basePay - totalDeduction + financials.otAmount,
      );
    }

    let record =
      existingRecord ||
      new AttendanceLog({ empId: employee._id, date: dateObj });

    record.empNumber = employee.employeeNumber;
    record.empName = `${employee.firstName} ${employee.lastName}`;
    record.department = employee.department;
    record.status = status;
    record.salaryType = employee.salaryType;
    record.inOut = {
      in: resolvedInTime,
      out: resolvedOutTime,
      outNextDay: resolvedOutNextDay,
    };
    record.shift = {
      start: employee.shift.start,
      end: employee.shift.end,
      isNightShift,
    };
    record.hourlyRate = rate;
    record.financials = financials;
    record.manualOverride = true;
    record.metadata = {
      ...(record.metadata?.toObject?.() || { ...(record.metadata || {}) }),
      source: "manual",
      lastUpdatedBy: req.userId,
      lastModifiedAt: new Date(),
    };

    await record.save();

    return res.json({
      success: true,
      message: "Attendance saved",
      record,
      lastModified: formatDateTimeForDisplay(new Date()),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// ─── DELETE /api/attendance/:id ──────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════

router.delete("/:id", adminAuth, async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || id.length !== 24) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid record ID" });
    }

    // Role-based access: admins can only delete employee records, superadmins can delete any (except superadmin)
    const record = await AttendanceLog.findOne({
      _id: id,
      isDeleted: { $ne: true },
    })
      .populate({
        path: "empId",
        select: "role",
        match: { role: { $nin: ["superadmin"] } },
      })
      .lean();

    if (!record) {
      return res
        .status(404)
        .json({ success: false, message: "Record not found" });
    }

    // If empId didn't pass populate match (superadmin employee), block deletion
    if (!record.empId) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to delete this record",
      });
    }

    // Admins cannot delete records for other privileged roles
    if (req.userRole === "admin" && record.empId?.role !== "employee") {
      return res.status(403).json({
        success: false,
        message:
          "Admins can only delete attendance records for employee-role accounts",
      });
    }

    // Soft delete — preserves data integrity for payroll history
    await AttendanceLog.updateOne(
      { _id: id },
      {
        $set: {
          isDeleted: true,
          "metadata.deletedBy": req.userId,
          "metadata.deletedAt": new Date(),
          "metadata.lastModifiedAt": new Date(),
        },
      },
    );

    return res.json({
      success: true,
      message: "Attendance record deleted successfully",
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// ─── POST /api/attendance/bulk-save ──────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════

router.post("/bulk-save", adminAuth, async (req, res) => {
  try {
    const { rows, forceOverride = false } = req.body;

    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: "rows array is required and must not be empty",
      });
    }
    if (rows.length > 500) {
      return res.status(400).json({
        success: false,
        message: "Maximum 500 rows per bulk-save request",
      });
    }

    const roleFilter =
      req.userRole === "superadmin"
        ? { role: { $nin: ["superadmin"] } }
        : { role: "employee" };

    const empIds = [
      ...new Set(rows.map((r) => String(r.empId)).filter(Boolean)),
    ];
    const employees = await Employee.find({
      _id: { $in: empIds },
      ...roleFilter,
      isDeleted: false,
    }).lean();
    const empMap = Object.fromEntries(employees.map((e) => [String(e._id), e]));

    const results = { saved: 0, skipped: 0, errors: [] };
    const bulkOps = [];

    for (const row of rows) {
      const emp = empMap[String(row.empId)];
      if (!emp) {
        results.errors.push({
          empId: row.empId,
          date: row.date,
          error: "Employee not found or no permission",
        });
        results.skipped++;
        continue;
      }

      const dateObj =
        parseDDMMYYYY(row.date) || (row.dateRaw ? new Date(row.dateRaw) : null);
      if (!dateObj || isNaN(dateObj)) {
        results.errors.push({
          empId: row.empId,
          date: row.date,
          error: "Invalid date",
        });
        results.skipped++;
        continue;
      }
      dateObj.setHours(0, 0, 0, 0);

      const isNightShift = toMin(emp.shift.end) < toMin(emp.shift.start);
      const inTime = row.inOut?.in || row.inTime || null;
      const outTime = row.inOut?.out || row.outTime || null;

      let resolvedOutNextDay = Boolean(row.inOut?.outNextDay || row.outNextDay);
      if (!row.inOut?.outNextDay && inTime && outTime) {
        resolvedOutNextDay = isNightShift && toMin(outTime) < toMin(inTime);
      }

      const rate = effectiveHourlyRate(emp, 26);
      const status = row.status || "Absent";

      const rowOtDetails = (
        Array.isArray(row.financials?.otDetails) ? row.financials.otDetails : []
      ).map((e) => ({ ...e, type: "manual" }));

      const financials = buildFinancials({
        status,
        inTime,
        outTime,
        outNextDay: resolvedOutNextDay,
        shift: emp.shift,
        hourlyRate: rate,
        salaryType: emp.salaryType,
        otHours: Number(row.financials?.otHours) || 0,
        otMultiplier: Number(row.financials?.otMultiplier) || 1,
        otDetails: rowOtDetails,
        otAmount: Number(row.financials?.otAmount) || 0,
      });

      bulkOps.push({
        updateOne: {
          filter: { empId: emp._id, date: dateObj },
          update: {
            $setOnInsert: { empId: emp._id, date: dateObj },
            $set: {
              empNumber: emp.employeeNumber,
              empName: `${emp.firstName} ${emp.lastName}`,
              department: emp.department,
              status,
              salaryType: emp.salaryType,
              inOut: {
                in: inTime,
                out: outTime,
                outNextDay: resolvedOutNextDay,
              },
              shift: {
                start: emp.shift.start,
                end: emp.shift.end,
                isNightShift,
              },
              hourlyRate: rate,
              financials,
              manualOverride: Boolean(forceOverride),
              "metadata.source": "manual",
              "metadata.lastUpdatedBy": req.userId,
              "metadata.lastModifiedAt": new Date(),
            },
          },
          upsert: true,
        },
      });

      results.saved++;
    }

    if (bulkOps.length > 0) {
      await AttendanceLog.bulkWrite(bulkOps, { ordered: false });
    }

    return res.json({ success: true, message: "Bulk save complete", results });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
