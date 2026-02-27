import express from "express";
import multer from "multer";
import AttendanceLog from "../models/AttendanceLog.js";
import Employee from "../models/Employee.js";
import { adminAuth } from "../middleware/auth.js";
import validateCSVFile from "../middleware/csvValidator.js";
import {
  parseCSV,
  groupByEmployeeAndDate,
  applyPairingRule,
  mergeTimes,
} from "../utils/csvParser.js";
// Standardized imports
import { formatDate, formatDateTimeForDisplay, parseDDMMYYYY } from "../utils/dateUtils.js";

const router = express.Router();

// Configure multer for CSV upload (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype.includes("csv") ||
      file.mimetype.includes("text") ||
      file.originalname.endsWith(".csv")
    ) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type"));
    }
  },
});

// Helper: Calculate hours between two times
function calcHours(startTime, endTime) {
  if (!startTime || !endTime) return 0;

  const [startH, startM] = startTime.split(":").map(Number);
  const [endH, endM] = endTime.split(":").map(Number);

  let start = startH * 60 + startM;
  let end = endH * 60 + endM;

  if (end < start) {
    end += 24 * 60;
  }

  return (end - start) / 60;
}

// Helper: Check if in time is late
function checkIsLate(inTime, shiftStartTime) {
  if (!inTime || !shiftStartTime) return false;

  const [inH, inM] = inTime.split(":").map(Number);
  const [shiftH, shiftM] = shiftStartTime.split(":").map(Number);

  const inMinutes = inH * 60 + inM;
  const shiftMinutes = shiftH * 60 + shiftM;

  return inMinutes > shiftMinutes;
}

/**
 * POST /api/attendance/import-csv
 * Upload and process CSV file for attendance import
 */
router.post(
  "/import-csv",
  adminAuth,
  upload.single("csvFile"),
  validateCSVFile,
  async (req, res) => {
    const processingLog = [];
    let rowsProcessed = 0;
    let rowsSuccess = 0;
    let rowsSkipped = 0;
    let recordsCreated = 0;
    let recordsUpdated = 0;

    try {
      if (!req.file || !req.file.buffer) {
        return res.status(400).json({
          message: "No CSV file provided",
          processingLog: [
            {
              type: "ERROR",
              message: "CSV file buffer not found",
            },
          ],
          summary: {
            total: 0,
            success: 0,
            failed: 0,
            skipped: 0,
            recordsCreated: 0,
            recordsUpdated: 0,
          },
          success: false,
        });
      }

      const csvContent = req.file.buffer.toString("utf-8");

      processingLog.push({
        type: "INFO",
        message: `📁 CSV file received: ${req.file.originalname} (${req.file.size} bytes)`,
      });

      const { parsed, errors } = parseCSV(csvContent);

      processingLog.push({
        type: "INFO",
        message: `📋 CSV parsing complete`,
      });

      for (const error of errors) {
        processingLog.push({
          type: "ERROR",
          message: `❌ Row ${error.rowNumber}: ${error.error}`,
          rowNumber: error.rowNumber,
        });
      }

      rowsProcessed = parsed.length;

      if (parsed.length === 0) {
        processingLog.push({
          type: "ERROR",
          message: `⚠️ No valid rows found in CSV file. Check format and try again.`,
        });

        return res.status(400).json({
          message: "No valid rows found in CSV file",
          processingLog,
          summary: {
            total: rowsProcessed,
            success: 0,
            failed: errors.length,
            skipped: 0,
            recordsCreated: 0,
            recordsUpdated: 0,
          },
          success: false,
        });
      }

      processingLog.push({
        type: "INFO",
        message: `✓ Parsed ${parsed.length} valid row(s) from CSV`,
      });

      const grouped = groupByEmployeeAndDate(parsed);

      processingLog.push({
        type: "INFO",
        message: `📦 Grouped into ${Object.keys(grouped).length} unique employee-date combination(s)`,
      });

      for (const [key, groupData] of Object.entries(grouped)) {
        const { empId, firstName, lastName, dateStr, date, rows } = groupData;

        processingLog.push({
          type: "INFO",
          message: `\n👤 Processing: ${empId} (${firstName} ${lastName}) on ${dateStr}`,
        });

        const employee = await Employee.findOne({
          employeeNumber: empId,
          isDeleted: false,
        });

        if (!employee) {
          processingLog.push({
            type: "WARN",
            message: `  ⚠️ Employee #${empId} not found in system. Skipping ${rows.length} row(s).`,
          });
          rowsSkipped += rows.length;
          continue;
        }

        processingLog.push({
          type: "SUCCESS",
          message: `  ✓ Found employee: ${employee.firstName} ${employee.lastName}`,
        });

        const merged = mergeTimes(rows);
        const { inTime, outTime } = merged;

        processingLog.push({
          type: "INFO",
          message: `  📊 Events on ${dateStr}: ${rows.length} row(s)`,
        });

        if (inTime) {
          processingLog.push({
            type: "INFO",
            message: `    ✓ Check-in: ${inTime}`,
          });
        }
        if (outTime) {
          processingLog.push({
            type: "INFO",
            message: `    ✓ Check-out: ${outTime}`,
          });
        }

        let status = "Absent";
        let hoursPerDay = 0;
        let basePay = 0;
        let finalDayEarning = 0;

        if (inTime && outTime) {
          const isPaired = applyPairingRule(inTime, outTime);

          if (!isPaired) {
            processingLog.push({
              type: "WARN",
              message: `    ⚠️ Check-in (${inTime}) and check-out (${outTime}) exceed 14-hour rule.`,
            });
          }

          hoursPerDay = calcHours(inTime, outTime);
          basePay = hoursPerDay * employee.hourlyRate;

          if (checkIsLate(inTime, employee.shift.start)) {
            status = "Late";
            const [inH, inM] = inTime.split(":").map(Number);
            const [shiftH, shiftM] = employee.shift.start.split(":").map(Number);
            const delayMin = inH * 60 + inM - (shiftH * 60 + shiftM);
            processingLog.push({
              type: "INFO",
              message: `    ⏱️ Status: LATE (${delayMin} minutes after ${employee.shift.start})`,
            });
          } else {
            status = "Present";
            processingLog.push({
              type: "SUCCESS",
              message: `    ✓ Status: PRESENT`,
            });
          }

          finalDayEarning = basePay;
          processingLog.push({
            type: "INFO",
            message: `    💰 Hours: ${hoursPerDay.toFixed(2)}, Pay: PKR ${basePay.toFixed(2)}`,
          });
        } else if (inTime && !outTime) {
          hoursPerDay = calcHours(employee.shift.start, employee.shift.end);
          basePay = hoursPerDay * employee.hourlyRate * 0.5;
          status = checkIsLate(inTime, employee.shift.start) ? "Late" : "Present";
          finalDayEarning = basePay;
          processingLog.push({
            type: "WARN",
            message: `    ⚠️ Only check-in recorded. Calculated 50% pay: PKR ${basePay.toFixed(2)}`,
          });
        } else if (!inTime && outTime) {
          hoursPerDay = calcHours(employee.shift.start, employee.shift.end);
          basePay = hoursPerDay * employee.hourlyRate * 0.5;
          status = "Present";
          finalDayEarning = basePay;
          processingLog.push({
            type: "WARN",
            message: `    ⚠️ Only check-out recorded. Calculated 50% pay: PKR ${basePay.toFixed(2)}`,
          });
        } else {
          status = "Absent";
          processingLog.push({
            type: "WARN",
            message: `    ⚠️ No check-in or check-out times found. Status: ABSENT`,
          });
        }

        try {
          const existingRecord = await AttendanceLog.findOne({
            empId: employee._id,
            date: date,
          });

          const now = new Date();

          const updateData = {
            empNumber: employee.employeeNumber,
            empName: `${employee.firstName} ${employee.lastName}`,
            department: employee.department,
            status,
            inOut: { in: inTime, out: outTime },
            shift: employee.shift,
            hourlyRate: employee.hourlyRate,
            financials: {
              hoursPerDay,
              basePay,
              deduction: 0,
              otMultiplier: 1,
              otHours: 0,
              otAmount: 0,
              finalDayEarning,
            },
            manualOverride: true,
            metadata: {
              source: "csv",
              lastUpdatedBy: req.userId,
              lastModifiedAt: now,
            },
            updatedAt: now,
          };

          if (existingRecord) {
            await AttendanceLog.updateOne({ _id: existingRecord._id }, { $set: updateData });
            recordsUpdated++;
            processingLog.push({
              type: "SUCCESS",
              message: `  ✓ Updated existing attendance record (In: ${inTime}, Out: ${outTime}, Status: ${status})`,
            });
          } else {
            const newRecord = new AttendanceLog({
              date,
              empId: employee._id,
              ...updateData,
            });
            await newRecord.save();
            recordsCreated++;
            processingLog.push({
              type: "SUCCESS",
              message: `  ✓ Created new attendance record (In: ${inTime}, Out: ${outTime}, Status: ${status})`,
            });
          }
          rowsSuccess += rows.length;
        } catch (dbError) {
          processingLog.push({
            type: "ERROR",
            message: `  ✗ Database error: ${dbError.message}`,
          });
        }
      }

      processingLog.push({
        type: "SUMMARY",
        message: `\n✅ IMPORT COMPLETE\nProcessed: ${rowsProcessed} rows | Success: ${rowsSuccess} | Skipped: ${rowsSkipped} | Errors: ${errors.length}\nRecords Created: ${recordsCreated} | Records Updated: ${recordsUpdated}`,
      });

      res.json({
        message: "CSV import completed successfully",
        processingLog,
        summary: {
          total: rowsProcessed,
          success: rowsSuccess,
          failed: errors.length,
          skipped: rowsSkipped,
          recordsCreated,
          recordsUpdated,
        },
        success: true,
      });
    } catch (error) {
      processingLog.push({ type: "ERROR", message: `Fatal error: ${error.message}` });
      res.status(500).json({
        message: "Error processing CSV file",
        error: error.message,
        processingLog,
        summary: { total: rowsProcessed, success: rowsSuccess, failed: 0, skipped: rowsSkipped, recordsCreated, recordsUpdated },
        success: false,
      });
    }
  },
);

/**
 * GET /api/attendance/range
 * Get attendance records for date range
 */
router.get("/range", adminAuth, async (req, res) => {
  try {
    const { fromDate, toDate } = req.query;

    if (!fromDate || !toDate) {
      return res.status(400).json({ message: "fromDate and toDate query parameters required" });
    }

    const from = parseDDMMYYYY(fromDate);
    const to = parseDDMMYYYY(toDate);

    if (!from || !to) {
      return res.status(400).json({ message: "Invalid date format. Use dd/mm/yyyy" });
    }

    // Standardized query using the parsed date objects directly
    const attendance = await AttendanceLog.find({
      date: {
        $gte: from,
        $lte: new Date(to.getFullYear(), to.getMonth(), to.getDate(), 23, 59, 59),
      },
      isDeleted: false,
    })
      .populate("empId", "firstName lastName email employeeNumber")
      .sort({ date: -1, empNumber: 1 })
      .lean();

    const formattedAttendance = attendance.map((record) => ({
      ...record,
      dateFormatted: formatDate(record.date),
      inTime: record.inOut?.in || "--",
      outTime: record.inOut?.out || "--",
      lastModified: record.metadata?.lastModifiedAt
        ? formatDateTimeForDisplay(record.metadata.lastModifiedAt)
        : "--",
      lastModifiedRaw: record.metadata?.lastModifiedAt,
    }));

    res.json({ attendance: formattedAttendance, total: formattedAttendance.length });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/**
 * POST /api/attendance/worksheet
 * Generate worksheet with all employees for date range
 */
router.post("/worksheet", adminAuth, async (req, res) => {
  try {
    const { fromDate, toDate } = req.body;

    if (!fromDate || !toDate) {
      return res.status(400).json({ message: "fromDate and toDate required" });
    }

    const start = parseDDMMYYYY(fromDate);
    const end = parseDDMMYYYY(toDate);

    if (!start || !end || isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ message: "Invalid date format. Use dd/mm/yyyy" });
    }

    const employees = await Employee.find({
      status: "Active",
      isArchived: false,
      isDeleted: false,
    }).sort({ employeeNumber: 1, firstName: 1 });

    const worksheet = [];

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const currentDate = new Date(d);
      currentDate.setHours(0, 0, 0, 0);

      for (const emp of employees) {
        const existing = await AttendanceLog.findOne({
          empId: emp._id,
          date: currentDate,
        }).lean();

        if (existing) {
          worksheet.push({
            _id: existing._id,
            date: formatDate(existing.date),
            empId: emp._id,
            empNumber: emp.employeeNumber,
            empName: `${emp.firstName} ${emp.lastName}`,
            department: emp.department,
            shift: emp.shift,
            hourlyRate: emp.hourlyRate,
            status: existing.status,
            inOut: existing.inOut,
            financials: existing.financials,
            manualOverride: existing.manualOverride,
            lastModified: existing.metadata?.lastModifiedAt
              ? formatDateTimeForDisplay(existing.metadata.lastModifiedAt)
              : "--",
            lastModifiedRaw: existing.metadata?.lastModifiedAt,
            isVirtual: false,
            isModified: false,
          });
        } else {
          worksheet.push({
            date: formatDate(currentDate),
            empId: emp._id,
            empNumber: emp.employeeNumber,
            empName: `${emp.firstName} ${emp.lastName}`,
            department: emp.department,
            shift: emp.shift,
            hourlyRate: emp.hourlyRate,
            status: "Absent",
            inOut: { in: null, out: null },
            financials: {
              hoursPerDay: 0,
              basePay: 0,
              deduction: 0,
              otMultiplier: 1,
              otHours: 0,
              otAmount: 0,
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
      const dateA = parseDDMMYYYY(a.date);
      const dateB = parseDDMMYYYY(b.date);
      const dateCompare = dateA - dateB;
      if (dateCompare !== 0) return dateCompare;
      return a.empNumber.localeCompare(b.empNumber);
    });

    res.json({ worksheet, total: worksheet.length });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/**
 * POST /api/attendance/save-row
 * Save single attendance row
 */
router.post("/save-row", adminAuth, async (req, res) => {
  try {
    const { empId, date, status, inTime, outTime, otHours, otMultiplier, deduction } = req.body;

    const employee = await Employee.findById(empId);
    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    const dateObj = parseDDMMYYYY(date);
    if (!dateObj || isNaN(dateObj.getTime())) {
      return res.status(400).json({ message: "Invalid date format (dd/mm/yyyy required)" });
    }

    let hoursPerDay = 0;
    let basePay = 0;
    let otAmount = 0;
    let finalDayEarning = 0;

    if (status === "Leave") {
      hoursPerDay = calcHours(employee.shift.start, employee.shift.end);
      basePay = hoursPerDay * employee.hourlyRate;
      finalDayEarning = basePay;
    } else if (status === "Absent" || (!inTime && !outTime)) {
      finalDayEarning = 0;
    } else if (inTime && outTime) {
      hoursPerDay = calcHours(inTime, outTime);
      basePay = hoursPerDay * employee.hourlyRate;
      otAmount = (otHours || 0) * employee.hourlyRate * (otMultiplier || 1);
      finalDayEarning = basePay + otAmount - (deduction || 0);
      finalDayEarning = Math.max(0, finalDayEarning);
    }

    const now = new Date();

    const attendance = await AttendanceLog.findOneAndUpdate(
      { empId: employee._id, date: dateObj },
      {
        $set: {
          empNumber: employee.employeeNumber,
          empName: `${employee.firstName} ${employee.lastName}`,
          department: employee.department,
          status: status || "Present",
          inOut: { in: inTime || null, out: outTime || null },
          shift: employee.shift,
          hourlyRate: employee.hourlyRate,
          financials: { hoursPerDay, basePay, deduction: deduction || 0, otMultiplier: otMultiplier || 1, otHours: otHours || 0, otAmount, finalDayEarning },
          manualOverride: true,
          metadata: { lastUpdatedBy: req.userId, source: "manual", lastModifiedAt: now },
          updatedAt: now,
        },
      },
      { upsert: true, new: true, runValidators: true },
    );

    res.json({
      message: "Attendance saved successfully",
      record: attendance,
      lastModified: formatDateTimeForDisplay(now),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;