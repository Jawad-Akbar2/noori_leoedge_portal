// routes/payroll.js
import express from "express";
import AttendanceLog  from "../models/AttendanceLog.js";
import Employee       from "../models/Employee.js";
import PayrollRecord  from "../models/PayrollRecord.js";
import { adminAuth, employeeAuth } from "../middleware/auth.js";
import { buildDateRange, formatDate } from "../utils/dateUtils.js";
import { isLate, getCompanyMonthDates, getRecentPayPeriods } from "../utils/timeCalculator.js";

const router = express.Router();

const SYSTEM_ROLES = ["superadmin", "owner"];

// Minimal fields for payroll computation — never pulls images or auth fields
const EMP_PAYROLL_FIELDS =
  "_id employeeNumber firstName lastName department shift salaryType hourlyRate monthlySalary role";

// Minimal attendance fields needed for all payroll calculations
const LOG_PAYROLL_FIELDS =
  "empId date status inOut financials metadata shift";

const payrollFilter = (callerRole, extra = {}) => ({
  role:
    callerRole === "superadmin" || callerRole === "owner"
      ? { $nin: ["superadmin", "owner"] }
      : "employee",
  status:     { $in: ["Active", "Frozen"] },
  isArchived: false,
  isDeleted:  false,
  ...extra,
});

// ─── shared helpers ───────────────────────────────────────────────────────────
function parseDateRange(fromDate, toDate) {
  const range = buildDateRange(fromDate, toDate);
  if (!range) return null;
  return { start: range.$gte, end: range.$lte };
}

const n      = (v) => { const x = Number(v); return isFinite(x) ? x : 0; };
const round2 = (v) => parseFloat(n(v).toFixed(2));
const toMin  = (t) => {
  if (!t) return 0;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

function shiftHours(shift) {
  if (!shift?.start || !shift?.end) return 8;
  const isNight = toMin(shift.end) < toMin(shift.start);
  let diff = toMin(shift.end) - toMin(shift.start);
  if (isNight || diff < 0) diff += 1440;
  return Math.max(0, diff / 60);
}

function workingDaysBetween(start, end) {
  let count = 0;
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const day = d.getDay();
    if (day !== 0 && day !== 6) count++;
  }
  return count;
}

function calcEmployeeTotals(emp, records, workingDays, totalBonus = 0) {
  let presentDays = 0, leaveDays = 0, OffDayDays = 0, lateDays = 0, ncnsDays = 0;
  let totalOtHours = 0, rawBase = 0, totalDeduction = 0, totalOt = 0;

  for (const r of records) {
    const st = r.status;
    if (st === "Present") presentDays++;
    else if (st === "Late")   { presentDays++; lateDays++; }
    else if (st === "OffDay") OffDayDays++;
    else if (st === "Leave")  leaveDays++;
    else if (st === "NCNS")   ncnsDays++;
    totalOtHours  += n(r.financials?.otHours);
    rawBase       += n(r.financials?.basePay);
    totalDeduction += n(r.financials?.deduction);
    totalOt       += n(r.financials?.otAmount);
  }

  let baseSalary, netPayable;
  if (emp.salaryType === "monthly" && emp.monthlySalary) {
    baseSalary = rawBase;
    const cappedBase = Math.min(rawBase, emp.monthlySalary);
    netPayable = cappedBase - totalDeduction + totalOt + totalBonus;
  } else {
    baseSalary = rawBase;
    netPayable = rawBase - totalDeduction + totalOt + totalBonus;
  }

  return {
    empId:          emp._id,
    empNumber:      emp.employeeNumber,
    name:           `${emp.firstName} ${emp.lastName}`,
    department:     emp.department,
    salaryType:     emp.salaryType || "hourly",
    hourlyRate:     emp.hourlyRate     || null,
    monthlySalary:  emp.monthlySalary  || null,
    presentDays,
    leaveDays,
    OffDayDays,
    ncnsDays,
    lateDays,
    workingDays,
    baseSalary:     round2(baseSalary),
    totalDeduction: round2(totalDeduction),
    totalOt:        round2(totalOt),
    totalOtHours:   round2(totalOtHours),
    netPayable:     round2(netPayable),
    recordCount:    records.length,
    totalBonus:     round2(totalBonus),
  };
}

// Single-pass loop replaces three separate .filter() scans
function buildDailyBreakdown(records) {
  return records.map((r) => ({
    date:            formatDate(r.date),
    dateRaw:         r.date,
    status:          r.status,
    inTime:          r.inOut?.in       || null,
    outTime:         r.inOut?.out      || null,
    outNextDay:      r.inOut?.outNextDay || false,
    hoursWorked:     round2(n(r.financials?.hoursWorked)),
    basePay:         round2(n(r.financials?.basePay)),
    deduction:       round2(n(r.financials?.deduction)),
    otHours:         round2(n(r.financials?.otHours)),
    otAmount:        round2(n(r.financials?.otAmount)),
    finalDayEarning: round2(n(r.financials?.finalDayEarning)),
    deductionDetails: r.financials?.deductionDetails || [],
    otDetails:        r.financials?.otDetails        || [],
  }));
}

// ─── build bonus lookup map from a batch of PayrollRecords ───────────────────
function buildBonusMap(payrollRecords) {
  const map = {};
  for (const pr of payrollRecords) map[String(pr.empId)] = pr.totalBonus || 0;
  return map;
}

// ═══════════════════════════════════════════════════════════════════════════════
// EMPLOYEE ROUTES
// ═══════════════════════════════════════════════════════════════════════════════
router.get("/my/periods", employeeAuth, async (req, res) => {
  try {
    const periods = getRecentPayPeriods(6).map((p) => ({
      startDate:   formatDate(p.startDate),
      endDate:     formatDate(p.endDate),
      periodLabel: p.periodLabel,
    }));
    return res.json({ success: true, periods });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get("/my/summary", employeeAuth, async (req, res) => {
  try {
    const range = parseDateRange(req.query.startDate, req.query.endDate);
    if (!range) {
      return res.status(400).json({
        success: false,
        message: "startDate and endDate required (dd/mm/yyyy or YYYY-MM-DD)",
      });
    }
    const { start, end } = range;

    // ── all three fetches in parallel ─────────────────────────────────────────
    const [emp, records, payroll] = await Promise.all([
      Employee.findOne({ _id: req.userId, role: { $nin: SYSTEM_ROLES }, isDeleted: false })
        .select(EMP_PAYROLL_FIELDS)
        .lean(),
      AttendanceLog.find({ empId: req.userId, date: { $gte: start, $lte: end }, isDeleted: false })
        .select(LOG_PAYROLL_FIELDS)
        .sort({ date: 1 })
        .lean(),
      PayrollRecord.findOne({ empId: req.userId, periodStart: start, periodEnd: end, isDeleted: false })
        .select("totalBonus")
        .lean(),
    ]);

    if (!emp) {
      return res.status(404).json({ success: false, message: "Employee not found" });
    }

    const workingDays = workingDaysBetween(start, end);
    const totalBonus  = payroll?.totalBonus || 0;
    const totals      = calcEmployeeTotals(emp, records, workingDays, totalBonus);
    const dailyBreakdown = buildDailyBreakdown(records);

    return res.json({
      success: true,
      summary: {
        empName:          totals.name,
        empNumber:        totals.empNumber,
        department:       totals.department,
        salaryType:       totals.salaryType,
        periodStart:      formatDate(start),
        periodEnd:        formatDate(end),
        totalWorkingDays: workingDays,
        presentDays:      totals.presentDays,
        lateDays:         totals.lateDays,
        OffDayDays:       totals.OffDayDays,
        leaveDays:        totals.leaveDays,
        baseSalary:       totals.baseSalary,
        totalDeduction:   totals.totalDeduction,
        totalOtHours:     totals.totalOtHours,
        totalOtAmount:    totals.totalOt,
        netSalary:        totals.netPayable,
      },
      dailyBreakdown,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get("/my/attendance", employeeAuth, async (req, res) => {
  try {
    const range = parseDateRange(req.query.startDate, req.query.endDate);
    if (!range) {
      return res.status(400).json({ success: false, message: "startDate and endDate required" });
    }
    const { start, end } = range;
    const records = await AttendanceLog.find({
      empId: req.userId,
      date:  { $gte: start, $lte: end },
      isDeleted: false,
    })
      .select(LOG_PAYROLL_FIELDS)
      .sort({ date: 1 })
      .lean();

    return res.json({
      success:    true,
      attendance: buildDailyBreakdown(records),
      total:      records.length,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN ROUTES
// ═══════════════════════════════════════════════════════════════════════════════
router.post("/attendance-overview", adminAuth, async (req, res) => {
  try {
    const { fromDate, toDate, filterType } = req.body;
    const range = parseDateRange(fromDate, toDate);
    if (!range) return res.status(400).json({ success: false, message: "Invalid date range" });
    const { start, end } = range;

    // ── employees + logs in parallel; scope logs to known empIds ─────────────
    const employees = await Employee.find(payrollFilter(req.userRole))
      .select("_id employeeNumber firstName lastName department")
      .lean();

    const empIds = employees.map(e => e._id);
    const allLogs = await AttendanceLog.find({
      empId: { $in: empIds },
      date:  { $gte: start, $lte: end },
      isDeleted: false,
    })
      .select("empId date status inOut shift metadata")
      .lean();

    // Build map: "<empId>_<YYYY-MM-DD>" → log
    const logMap = {};
    for (const log of allLogs) {
      logMap[`${log.empId}_${log.date.toISOString().slice(0, 10)}`] = log;
    }

    const statusCount  = { "On-time": 0, Late: 0, Leave: 0, OffDay: 0, NCNS: 0 };
    const detailedList = [];
    const filterLower  = filterType?.toLowerCase();

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const iso  = d.toISOString().slice(0, 10);
      const disp = formatDate(new Date(d));
      for (const emp of employees) {
        const record = logMap[`${emp._id}_${iso}`];
        let status = "OffDay", delayMinutes = 0, note = "No record found";

        if (record) {
          if (record.status === "Leave") {
            status = "Leave"; note = "Approved leave";
          } else if (record.status === "NCNS") {
            status = "NCNS"; note = record.metadata?.notes || "No Call No Show";
          } else if (record.status === "OffDay") {
            status = "OffDay"; note = record.metadata?.notes || "OffDay";
          } else if (record.inOut?.in) {
            if (isLate(record.inOut.in, record.shift?.start)) {
              delayMinutes = toMin(record.inOut.in) - toMin(record.shift?.start || "00:00");
              status = "Late"; note = `Late by ${delayMinutes} min`;
            } else {
              status = "On-time"; note = "On time";
            }
          }
        }

        if (statusCount[status] !== undefined) statusCount[status]++;
        if (!filterLower || status.toLowerCase() === filterLower) {
          detailedList.push({
            date:         disp,
            empId:        emp.employeeNumber,
            name:         `${emp.firstName} ${emp.lastName}`,
            department:   emp.department,
            type:         status,
            reason:       note,
            delayMinutes,
          });
        }
      }
    }

    const total    = Object.values(statusCount).reduce((a, b) => a + b, 0);
    const chartData = Object.entries(statusCount).map(([name, value]) => ({
      name,
      value,
      percentage: total > 0 ? ((value / total) * 100).toFixed(1) : "0.0",
    }));

    return res.json({ success: true, chartData, detailedList, summary: statusCount });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post("/performance-overview", adminAuth, async (req, res) => {
  try {
    const { fromDate, toDate } = req.body;
    const range = parseDateRange(fromDate, toDate);
    if (!range) return res.status(400).json({ success: false, message: "Invalid date range" });
    const { start, end } = range;

    const [employees, allLogs] = await Promise.all([
      Employee.find(payrollFilter(req.userRole))
        .select("_id employeeNumber firstName lastName department")
        .lean(),
      AttendanceLog.find({ date: { $gte: start, $lte: end }, isDeleted: false })
        .select("empId status financials")
        .lean(),
    ]);

    const workingDays = workingDaysBetween(start, end);
    const empIdSet    = new Set(employees.map(e => String(e._id)));

    const logsByEmp = {};
    for (const log of allLogs) {
      const k = String(log.empId);
      if (empIdSet.has(k)) (logsByEmp[k] ??= []).push(log);
    }

    const performance = employees.map((emp) => {
      const records     = logsByEmp[String(emp._id)] || [];
      let presentDays = 0, leaveDays = 0, OffDayDays = 0, lateDays = 0,
          ncnsDays = 0, totalOtHours = 0;

      for (const r of records) {
        if      (r.status === "Present") presentDays++;
        else if (r.status === "Late")    { presentDays++; lateDays++; }
        else if (r.status === "OffDay")  OffDayDays++;
        else if (r.status === "Leave")   leaveDays++;
        else if (r.status === "NCNS")    ncnsDays++;
        totalOtHours += n(r.financials?.otHours);
      }

      const attendanceRate  = workingDays > 0 ? ((presentDays + leaveDays) / workingDays) * 100 : 0;
      const punctualityRate = presentDays > 0 ? ((presentDays - lateDays) / presentDays) * 100 : 100;
      const otScore         = Math.min(100, (totalOtHours / Math.max(1, workingDays)) * 100);
      const score           = Math.round(attendanceRate * 0.5 + punctualityRate * 0.3 + otScore * 0.2);

      return {
        empId:            emp.employeeNumber,
        empObjectId:      emp._id,
        name:             `${emp.firstName} ${emp.lastName}`,
        department:       emp.department,
        performanceScore: score,
        attendanceRate:   round2(attendanceRate),
        punctualityRate:  round2(punctualityRate),
        presentDays,
        leaveDays,
        OffDayDays,
        lateDays,
        ncnsDays,
        totalOtHours:     round2(totalOtHours),
        workingDays,
        rating: score >= 90 ? "Excellent" : score >= 75 ? "Good" : score >= 60 ? "Average" : "Poor",
      };
    });

    performance.sort((a, b) => b.performanceScore - a.performanceScore);

    const ratingCounts = { Excellent: 0, Good: 0, Average: 0, Poor: 0 };
    for (const p of performance) ratingCounts[p.rating]++;
    const pieData = Object.entries(ratingCounts).map(([name, value]) => ({
      name,
      value,
      percentage: performance.length > 0 ? ((value / performance.length) * 100).toFixed(1) : "0.0",
    }));

    return res.json({ success: true, performance, pieData, workingDays });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── POST /api/payroll/salary-summary ────────────────────────────────────────
router.post("/salary-summary", adminAuth, async (req, res) => {
  try {
    const { fromDate, toDate } = req.body;
    const range = parseDateRange(fromDate, toDate);
    if (!range) return res.status(400).json({ success: false, message: "Invalid date range" });
    const { start, end } = range;

    // ── all three collections in parallel — eliminates N+1 PayrollRecord hits ─
    const [employees, allLogs, payrollRecords] = await Promise.all([
      Employee.find(payrollFilter(req.userRole))
        .select(EMP_PAYROLL_FIELDS)
        .lean(),
      AttendanceLog.find({ date: { $gte: start, $lte: end }, isDeleted: false })
        .select(LOG_PAYROLL_FIELDS)
        .lean(),
      PayrollRecord.find({
        periodStart: start,
        periodEnd:   end,
        isDeleted:   false,
      })
        .select("empId totalBonus")
        .lean(),
    ]);

    const workingDays = workingDaysBetween(start, end);
    const bonusMap    = buildBonusMap(payrollRecords);

    const empIdSet  = new Set(employees.map(e => String(e._id)));
    const logsByEmp = {};
    for (const log of allLogs) {
      const k = String(log.empId);
      if (empIdSet.has(k)) (logsByEmp[k] ??= []).push(log);
    }

    const summary = employees.map((emp) =>
      calcEmployeeTotals(
        emp,
        logsByEmp[String(emp._id)] || [],
        workingDays,
        bonusMap[String(emp._id)] || 0,
      )
    );

    const totals = {
      totalBaseSalary: round2(summary.reduce((s, e) => s + e.baseSalary,     0)),
      totalOT:         round2(summary.reduce((s, e) => s + e.totalOt,        0)),
      totalDeductions: round2(summary.reduce((s, e) => s + e.totalDeduction, 0)),
      totalNetPayable: round2(summary.reduce((s, e) => s + e.netPayable,     0)),
    };

    return res.json({ success: true, summary, totals, workingDays });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── POST /api/payroll/report ─────────────────────────────────────────────────
router.post("/report", adminAuth, async (req, res) => {
  try {
    const { fromDate, toDate, search = "", department } = req.body;
    const range = parseDateRange(fromDate, toDate);
    if (!range) return res.status(400).json({ success: false, message: "Invalid date range" });
    const { start, end } = range;

    const empQuery = payrollFilter(req.userRole);
    if (department) empQuery.department = department;

    const [employees, allLogs] = await Promise.all([
      Employee.find(empQuery)
        .select(EMP_PAYROLL_FIELDS)
        .sort({ firstName: 1, lastName: 1 })
        .lean(),
      AttendanceLog.find({ date: { $gte: start, $lte: end }, isDeleted: false })
        .select(LOG_PAYROLL_FIELDS)
        .sort({ date: 1 })
        .lean(),
    ]);

    const workingDays = workingDaysBetween(start, end);
    const term        = search.trim().toLowerCase();
    const empIdSet    = new Set(employees.map(e => String(e._id)));

    const logsByEmp = {};
    for (const log of allLogs) {
      const k = String(log.empId);
      if (empIdSet.has(k)) (logsByEmp[k] ??= []).push(log);
    }

    const report = employees
      .filter((emp) => {
        if (!term) return true;
        return `${emp.firstName} ${emp.lastName}`.toLowerCase().includes(term)
          || emp.employeeNumber.toLowerCase().includes(term);
      })
      .map((emp) => {
        const records = logsByEmp[String(emp._id)] || [];
        return { ...calcEmployeeTotals(emp, records, workingDays), dailyAttendance: buildDailyBreakdown(records) };
      });

    const grandTotals = {
      totalBaseSalary: round2(report.reduce((s, e) => s + e.baseSalary,     0)),
      totalOT:         round2(report.reduce((s, e) => s + e.totalOt,        0)),
      totalDeductions: round2(report.reduce((s, e) => s + e.totalDeduction, 0)),
      totalNetPayable: round2(report.reduce((s, e) => s + e.netPayable,     0)),
    };

    return res.json({ success: true, report, grandTotals, workingDays });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /api/payroll/employee-breakdown/:empId ───────────────────────────────
router.get("/employee-breakdown/:empId", adminAuth, async (req, res) => {
  try {
    const range = parseDateRange(req.query.fromDate, req.query.toDate);
    if (!range) return res.status(400).json({ success: false, message: "Invalid date range" });
    const { start, end } = range;

    const roleFilter =
      req.userRole === "superadmin"
        ? { role: { $nin: ["superadmin", "owner"] } }
        : { role: "employee" };

    const [emp, records] = await Promise.all([
      Employee.findOne({ _id: req.params.empId, ...roleFilter, isDeleted: false })
        .select(EMP_PAYROLL_FIELDS + " shift")
        .lean(),
      AttendanceLog.find({
        empId: req.params.empId,
        date:  { $gte: start, $lte: end },
        isDeleted: false,
      })
        .select(LOG_PAYROLL_FIELDS)
        .sort({ date: 1 })
        .lean(),
    ]);

    if (!emp) {
      return res.status(404).json({
        success: false,
        message: "Employee not found or you do not have permission to view this account",
      });
    }

    const workingDays    = workingDaysBetween(start, end);
    const empTotals      = calcEmployeeTotals(emp, records, workingDays);
    const dailyBreakdown = buildDailyBreakdown(records);

    return res.json({
      success: true,
      employee: {
        id:             emp._id,
        name:           `${emp.firstName} ${emp.lastName}`,
        employeeNumber: emp.employeeNumber,
        department:     emp.department,
        salaryType:     emp.salaryType    || "hourly",
        hourlyRate:     emp.hourlyRate    || null,
        monthlySalary:  emp.monthlySalary || null,
        shift:          emp.shift,
      },
      dailyBreakdown,
      totals: {
        baseSalary:     empTotals.baseSalary,
        totalDeduction: empTotals.totalDeduction,
        totalOt:        empTotals.totalOt,
        totalOtHours:   empTotals.totalOtHours,
        netPayable:     empTotals.netPayable,
        presentDays:    empTotals.presentDays,
        leaveDays:      empTotals.leaveDays,
        OffDayDays:     empTotals.OffDayDays,
        lateDays:       empTotals.lateDays,
        workingDays,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /api/payroll/live-payroll ────────────────────────────────────────────
router.get("/live-payroll", adminAuth, async (req, res) => {
  try {
    const { startDate, endDate } = getCompanyMonthDates();
    const now = new Date();

    // ── get employee ids + logs in parallel ───────────────────────────────────
    const empIds = await Employee.find(payrollFilter(req.userRole))
      .distinct("_id");

    const logs = await AttendanceLog.find({
      empId: { $in: empIds },
      date:  { $gte: startDate, $lte: now },
      isDeleted: false,
    })
      .select("financials.finalDayEarning")
      .lean();

    const totalPayroll = round2(
      logs.reduce((s, r) => s + n(r.financials?.finalDayEarning), 0)
    );

    return res.json({
      success:     true,
      totalPayroll,
      periodStart: formatDate(startDate),
      periodEnd:   formatDate(endDate),
      asOf:        formatDate(now),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── POST /api/payroll/export ─────────────────────────────────────────────────
router.post("/export", adminAuth, async (req, res) => {
  try {
    const { fromDate, toDate, format = "json", department } = req.body;
    const range = parseDateRange(fromDate, toDate);
    if (!range) return res.status(400).json({ success: false, message: "Invalid date range" });
    const { start, end } = range;

    const empQuery = payrollFilter(req.userRole);
    if (department) empQuery.department = department;

    const [employees, allLogs] = await Promise.all([
      Employee.find(empQuery)
        .select(EMP_PAYROLL_FIELDS)
        .lean(),
      AttendanceLog.find({ date: { $gte: start, $lte: end }, isDeleted: false })
        .select(LOG_PAYROLL_FIELDS)
        .lean(),
    ]);

    const workingDays = workingDaysBetween(start, end);
    const empIdSet    = new Set(employees.map(e => String(e._id)));

    const logsByEmp = {};
    for (const log of allLogs) {
      const k = String(log.empId);
      if (empIdSet.has(k)) (logsByEmp[k] ??= []).push(log);
    }

    const rows = employees
      .map((emp) => calcEmployeeTotals(emp, logsByEmp[String(emp._id)] || [], workingDays))
      .sort((a, b) => a.name.localeCompare(b.name));

    if (format === "csv") {
      const headers = [
        "Employee Number","Name","Department","Salary Type","Working Days",
        "Present Days","Leave Days","Off Days","NCNS Days","Late Days",
        "Base Salary","OT Hours","OT Amount","Deductions","Net Payable",
      ];
      const lines = rows.map((e) =>
        [
          e.empNumber,
          `"${e.name.replace(/"/g, '""')}"`,
          e.department, e.salaryType, e.workingDays,
          e.presentDays, e.leaveDays, e.OffDayDays, e.ncnsDays, e.lateDays,
          e.baseSalary, e.totalOtHours, e.totalOt, e.totalDeduction, e.netPayable,
        ].join(",")
      );
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="payroll_${fromDate}_to_${toDate}.csv"`);
      return res.send([headers.join(","), ...lines].join("\n"));
    }

    return res.json({ success: true, summary: rows, workingDays });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── POST /api/payroll/update-bonus ──────────────────────────────────────────
router.post("/update-bonus", adminAuth, async (req, res) => {
  try {
    const { empId, periodStart, periodEnd, bonusDetails } = req.body;

    if (!empId || !periodStart || !periodEnd) {
      return res.status(400).json({ success: false, message: "empId, periodStart, and periodEnd are required" });
    }
    if (!Array.isArray(bonusDetails)) {
      return res.status(400).json({ success: false, message: "bonusDetails must be an array" });
    }

    const totalBonus = bonusDetails.reduce((s, b) => s + (Number(b.amount) || 0), 0);

    const record = await PayrollRecord.findOneAndUpdate(
      { empId, periodStart, periodEnd },
      { $set: { bonusDetails, totalBonus } },
      { upsert: true, new: true }
    );

    return res.json({ success: true, record });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;