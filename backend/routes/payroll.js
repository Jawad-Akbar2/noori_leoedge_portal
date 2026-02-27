import express from "express";
import AttendanceLog from "../models/AttendanceLog.js";
import Employee from "../models/Employee.js";
import { adminAuth } from "../middleware/auth.js";
import { parseDDMMYYYY, formatDate } from "../utils/dateUtils.js";
import { isLate, calculateHours } from "../utils/timeCalculator.js";

const router = express.Router();

// Helper: Get company month dates (18th to 17th)
function getCompanyMonthDates(date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();

  let startDate, endDate;

  if (day >= 18) {
    startDate = new Date(year, month, 18);
    endDate = new Date(year, month + 1, 17);
  } else {
    startDate = new Date(year, month - 1, 18);
    endDate = new Date(year, month, 17);
  }

  return { startDate, endDate };
}

function parseDateRange(fromDate, toDate) {
  const parseInputDate = (value) => {
    if (!value) return null;

    // Support both dd/mm/yyyy and native input date format (yyyy-mm-dd).
    if (String(value).includes("/")) {
      return parseDDMMYYYY(value);
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    parsed.setHours(0, 0, 0, 0);
    return parsed;
  };

  const start = parseInputDate(fromDate);
  const end = parseInputDate(toDate);

  if (!start || !end) return null;

  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

function normalizeNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

// **SECTION 1: Attendance & Discipline Overview**
router.post("/attendance-overview", adminAuth, async (req, res) => {
  try {
    const { fromDate, toDate, filterType } = req.body;

    const range = parseDateRange(fromDate, toDate);

    if (!range) {
      return res.status(400).json({
        message: "Invalid date format. Use dd/mm/yyyy",
      });
    }

    const { start, end } = range;

    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    const employees = await Employee.find({
      status: "Active",
      isArchived: false,
      isDeleted: false,
    });

    const attendance = await AttendanceLog.find({
      date: { $gte: start, $lte: end },
      isDeleted: false,
    });

    const statusCount = {
      "On-time": 0,
      Late: 0,
      Leave: 0,
      Absent: 0,
    };

    const detailedList = [];

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const currentDate = new Date(d);
      currentDate.setHours(0, 0, 0, 0);

      for (const emp of employees) {
        const record = attendance.find(
          (a) =>
            a.empId.toString() === emp._id.toString() &&
            new Date(a.date).getTime() === currentDate.getTime(),
        );

        let status = "Absent";
        let delayMinutes = 0;
        let note = "No record found";

        if (record) {
          if (record.status === "Leave") {
            status = "Leave";
            note = "Approved leave";
          } else if (record.status === "Absent") {
            status = "Absent";
            note = record.metadata?.notes || "No record found";
          } else if (record.inOut?.in) {
            if (isLate(record.inOut.in, record.shift.start)) {
              status = "Late";
              const [inH, inM] = record.inOut.in.split(":").map(Number);
              const [shiftH, shiftM] = record.shift.start
                .split(":")
                .map(Number);
              delayMinutes = inH * 60 + inM - (shiftH * 60 + shiftM);
              note = `Late by ${delayMinutes} minutes`;
            } else {
              status = "On-time";
              note = "On time";
            }
          }
        }

        statusCount[status]++;

        if (!filterType || status.toLowerCase() === filterType.toLowerCase()) {
          detailedList.push({
            date: formatDate(currentDate), // Updated to use dd/mm/yyyy
            empId: emp.employeeNumber,
            name: `${emp.firstName} ${emp.lastName}`,
            type: status,
            reason: note,
            delayMinutes,
          });
        }
      }
    }

    const total = Object.values(statusCount).reduce((a, b) => a + b, 0);
    const chartData = Object.entries(statusCount).map(([name, value]) => ({
      name,
      value,
      percentage: ((value / total) * 100).toFixed(1),
    }));

    res.json({
      chartData,
      detailedList,
      summary: statusCount,
    });
  } catch (error) {
    console.error("Error in attendance-overview:", error);
    res.status(500).json({ message: error.message });
  }
});

// **SECTION 2: Performance Overview**
router.post("/performance-overview", adminAuth, async (req, res) => {
  try {
    const { fromDate, toDate } = req.body;

    const range = parseDateRange(fromDate, toDate);
    if (!range) {
      return res.status(400).json({
        message: "Invalid date format. Use dd/mm/yyyy",
      });
    }
    const { start, end } = range;

    const employees = await Employee.find({
      status: "Active",
      isArchived: false,
      isDeleted: false,
    });

    const performance = [];

    for (const emp of employees) {
      const empAttendance = await AttendanceLog.find({
        empId: emp._id,
        date: { $gte: start, $lte: end },
        isDeleted: false,
      });

      const present = empAttendance.filter(
        (a) => a.status === "Present" || a.status === "Late",
      ).length;
      const absent = empAttendance.filter((a) => a.status === "Absent").length;
      const leave = empAttendance.filter((a) => a.status === "Leave").length;

      const score =
        empAttendance.length > 0
          ? Math.round(((present + leave) / empAttendance.length) * 100)
          : 0;

      performance.push({
        empId: emp.employeeNumber,
        name: `${emp.firstName} ${emp.lastName}`,
        performanceScore: score,
        present,
        absent,
        leave,
        status:
          score >= 90
            ? "Excellent"
            : score >= 75
              ? "Good"
              : "Needs Improvement",
      });
    }

    res.json({ performance });
  } catch (error) {
    console.error("Error in performance-overview:", error);
    res.status(500).json({ message: error.message });
  }
});

// **SECTION 3: Salary Summary**
router.post("/salary-summary", adminAuth, async (req, res) => {
  try {
    const { fromDate, toDate } = req.body;

    const range = parseDateRange(fromDate, toDate);
    if (!range) {
      return res.status(400).json({
        message: "Invalid date format. Use dd/mm/yyyy",
      });
    }
    const { start, end } = range;

    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    const attendance = await AttendanceLog.find({
      date: { $gte: start, $lte: end },
      isDeleted: false,
    });

    const employees = await Employee.find({
      status: "Active",
      isArchived: false,
      isDeleted: false,
    });

    const summary = [];

    for (const emp of employees) {
      const empRecords = attendance.filter(
        (a) => a.empId.toString() === emp._id.toString(),
      );

      const basicEarned = empRecords.reduce(
        (sum, r) => sum + (r.financials?.basePay || 0),
        0,
      );
      const otTotal = empRecords.reduce(
        (sum, r) => sum + (r.financials?.otAmount || 0),
        0,
      );
      const deductionTotal = empRecords.reduce(
        (sum, r) => sum + (r.financials?.deduction || 0),
        0,
      );
      const netPayable = empRecords.reduce(
        (sum, r) => sum + (r.financials?.finalDayEarning || 0),
        0,
      );

      summary.push({
        empId: emp._id,
        empNumber: emp.employeeNumber,
        name: `${emp.firstName} ${emp.lastName}`,
        basicEarned: parseFloat(basicEarned.toFixed(2)),
        otTotal: parseFloat(otTotal.toFixed(2)),
        deductionTotal: parseFloat(deductionTotal.toFixed(2)),
        netPayable: parseFloat(netPayable.toFixed(2)),
        recordCount: empRecords.length,
      });
    }

    summary.sort((a, b) => a.name.localeCompare(b.name));

    const totals = {
      totalBasicEarned: parseFloat(
        summary.reduce((s, e) => s + e.basicEarned, 0).toFixed(2),
      ),
      totalOT: parseFloat(
        summary.reduce((s, e) => s + e.otTotal, 0).toFixed(2),
      ),
      totalDeductions: parseFloat(
        summary.reduce((s, e) => s + e.deductionTotal, 0).toFixed(2),
      ),
      totalNetPayable: parseFloat(
        summary.reduce((s, e) => s + e.netPayable, 0).toFixed(2),
      ),
    };

    res.json({ summary, totals });
  } catch (error) {
    console.error("Error in salary-summary:", error);
    res.status(500).json({ message: error.message });
  }
});

// Full payroll report with per-day details for each employee in the selected date range.
router.post("/report", adminAuth, async (req, res) => {
  try {
    const { fromDate, toDate, search = "" } = req.body;
    const range = parseDateRange(fromDate, toDate);

    if (!range) {
      return res.status(400).json({ message: "Invalid date format. Use dd/mm/yyyy or yyyy-mm-dd" });
    }

    const { start, end } = range;

    const employees = await Employee.find({
      status: "Active",
      isArchived: false,
      isDeleted: false,
    }).sort({ firstName: 1, lastName: 1 });

    const attendanceRecords = await AttendanceLog.find({
      date: { $gte: start, $lte: end },
      isDeleted: false,
    }).sort({ date: 1 });

    const searchTerm = String(search || "").trim().toLowerCase();

    const report = employees
      .map((employee) => {
        const fullName = `${employee.firstName} ${employee.lastName}`;

        if (
          searchTerm &&
          !fullName.toLowerCase().includes(searchTerm) &&
          !String(employee.employeeNumber || "").toLowerCase().includes(searchTerm)
        ) {
          return null;
        }

        const records = attendanceRecords.filter(
          (item) => item.empId.toString() === employee._id.toString(),
        );

        // Daily rows preserve deduction/OT details for nested UI rendering.
        const dailyAttendance = records.map((row) => {
          const basePay = normalizeNumber(row.financials?.basePay);
          const deduction = normalizeNumber(row.financials?.deduction);
          const otAmount = normalizeNumber(row.financials?.otAmount);
          const finalEarning = normalizeNumber(row.financials?.finalDayEarning);

          return {
            date: formatDate(row.date),
            status: row.status,
            inTime: row.inOut?.in || "--",
            outTime: row.inOut?.out || "--",
            hoursPerDay: normalizeNumber(row.financials?.hoursPerDay),
            basePay,
            deduction,
            otAmount,
            finalEarning,
            deductionDetails: row.financials?.deductionDetails || [],
            otDetails: row.financials?.otDetails || [],
          };
        });

        // Aggregate totals from the daily rows to keep parent + nested table fully consistent.
        const totals = dailyAttendance.reduce(
          (acc, day) => {
            acc.basePay += day.basePay;
            acc.deduction += day.deduction;
            acc.otAmount += day.otAmount;
            acc.finalEarning += day.finalEarning;
            return acc;
          },
          { basePay: 0, deduction: 0, otAmount: 0, finalEarning: 0 },
        );

        return {
          empId: employee._id,
          empNumber: employee.employeeNumber,
          name: fullName,
          totals: {
            basePay: Number(totals.basePay.toFixed(2)),
            deduction: Number(totals.deduction.toFixed(2)),
            otAmount: Number(totals.otAmount.toFixed(2)),
            finalEarning: Number(totals.finalEarning.toFixed(2)),
          },
          dailyAttendance,
        };
      })
      .filter(Boolean);

    const grandTotals = report.reduce(
      (acc, employee) => {
        acc.basePay += employee.totals.basePay;
        acc.deduction += employee.totals.deduction;
        acc.otAmount += employee.totals.otAmount;
        acc.finalEarning += employee.totals.finalEarning;
        return acc;
      },
      { basePay: 0, deduction: 0, otAmount: 0, finalEarning: 0 },
    );

    res.json({
      report,
      grandTotals: {
        basePay: Number(grandTotals.basePay.toFixed(2)),
        deduction: Number(grandTotals.deduction.toFixed(2)),
        otAmount: Number(grandTotals.otAmount.toFixed(2)),
        finalEarning: Number(grandTotals.finalEarning.toFixed(2)),
      },
    });
  } catch (error) {
    console.error("Error in payroll report:", error);
    res.status(500).json({ message: error.message });
  }
});

// **Employee Detailed Breakdown**
router.get("/employee-breakdown/:empId", adminAuth, async (req, res) => {
  try {
    const { fromDate, toDate } = req.query;

    const range = parseDateRange(fromDate, toDate);
    if (!range) {
      return res.status(400).json({
        message: "Invalid date format. Use dd/mm/yyyy",
      });
    }
    const { start, end } = range;

    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    const emp = await Employee.findById(req.params.empId);
    if (!emp) return res.status(404).json({ message: "Employee not found" });

    const records = await AttendanceLog.find({
      empId: req.params.empId,
      date: { $gte: start, $lte: end },
      isDeleted: false,
    }).sort({ date: 1 });

    const dailyBreakdown = records.map((r) => ({
      date: formatDate(r.date), // Updated to use dd/mm/yyyy
      inOut: r.inOut,
      status: r.status,
      hoursPerDay: r.financials.hoursPerDay,
      basePay: r.financials.basePay,
      otAmount: r.financials.otAmount,
      deduction: r.financials.deduction,
      dailyEarning: r.financials.finalDayEarning,
    }));

    const totals = {
      basicEarned: parseFloat(
        dailyBreakdown.reduce((s, d) => s + d.basePay, 0).toFixed(2),
      ),
      otTotal: parseFloat(
        dailyBreakdown.reduce((s, d) => s + d.otAmount, 0).toFixed(2),
      ),
      deductionTotal: parseFloat(
        dailyBreakdown.reduce((s, d) => s + d.deduction, 0).toFixed(2),
      ),
      netPayable: parseFloat(
        dailyBreakdown.reduce((s, d) => s + d.dailyEarning, 0).toFixed(2),
      ),
    };

    res.json({
      employee: {
        id: emp._id,
        name: `${emp.firstName} ${emp.lastName}`,
        employeeNumber: emp.employeeNumber,
        hourlyRate: emp.hourlyRate,
        shift: emp.shift,
      },
      dailyBreakdown,
      totals,
    });
  } catch (error) {
    console.error("Error in employee-breakdown:", error);
    res.status(500).json({ message: error.message });
  }
});

// **Live Monthly Payroll Block**
router.get("/live-payroll", adminAuth, async (req, res) => {
  try {
    const { startDate, endDate } = getCompanyMonthDates();

    const attendance = await AttendanceLog.find({
      date: { $gte: startDate, $lte: new Date() },
      isDeleted: false,
    });

    const totalPayroll = attendance.reduce(
      (sum, r) => sum + (r.financials?.finalDayEarning || 0),
      0,
    );

    res.json({
      totalPayroll: parseFloat(totalPayroll.toFixed(2)),
      periodStart: formatDate(startDate), // Updated to use dd/mm/yyyy
      periodEnd: formatDate(endDate),     // Updated to use dd/mm/yyyy
      asOf: formatDate(new Date()),       // Updated to use dd/mm/yyyy
    });
  } catch (error) {
    console.error("Error in live-payroll:", error);
    res.status(500).json({ message: error.message });
  }
});

// **Export Payroll (CSV)**
router.post("/export", adminAuth, async (req, res) => {
  try {
    const { fromDate, toDate, format } = req.body;
    const range = parseDateRange(fromDate, toDate);
    if (!range) {
      return res.status(400).json({
        message: "Invalid date format. Use dd/mm/yyyy",
      });
    }
    const { start, end } = range;

    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    const attendance = await AttendanceLog.find({
      date: { $gte: start, $lte: end },
      isDeleted: false,
    });

    const employees = await Employee.find({
      status: "Active",
      isArchived: false,
      isDeleted: false,
    });

    const summary = [];

    for (const emp of employees) {
      const empRecords = attendance.filter(
        (a) => a.empId.toString() === emp._id.toString(),
      );

      const basicEarned = empRecords.reduce(
        (sum, r) => sum + (r.financials?.basePay || 0),
        0,
      );
      const otTotal = empRecords.reduce(
        (sum, r) => sum + (r.financials?.otAmount || 0),
        0,
      );
      const deductionTotal = empRecords.reduce(
        (sum, r) => sum + (r.financials?.deduction || 0),
        0,
      );
      const netPayable = empRecords.reduce(
        (sum, r) => sum + (r.financials?.finalDayEarning || 0),
        0,
      );

      summary.push({
        empNumber: emp.employeeNumber,
        name: `${emp.firstName} ${emp.lastName}`,
        basicEarned: parseFloat(basicEarned.toFixed(2)),
        otTotal: parseFloat(otTotal.toFixed(2)),
        deductionTotal: parseFloat(deductionTotal.toFixed(2)),
        netPayable: parseFloat(netPayable.toFixed(2)),
      });
    }

    if (format === "csv") {
      let csv =
        "Employee Number,Name,Basic Earned,OT Total,Deductions,Net Payable\n";
      summary.forEach((emp) => {
        csv += `${emp.empNumber},"${emp.name}",${emp.basicEarned},${emp.otTotal},${emp.deductionTotal},${emp.netPayable}\n`;
      });

      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="payroll.csv"',
      );
      res.send(csv);
    } else {
      res.json({ summary });
    }
  } catch (error) {
    console.error("Error in export:", error);
    res.status(500).json({ message: error.message });
  }
});

export default router;
