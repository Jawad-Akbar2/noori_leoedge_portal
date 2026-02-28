// seeders/seedDemoData.js
//
// Generates 60 days of realistic attendance for all active employees, then
// computes and stores PayrollRecord + PerformanceRecord for each month covered.
//
// Run AFTER seedAdmin.js:
//   node seeders/seedAdmin.js
//   node seeders/seedDemoData.js

import mongoose from 'mongoose';
import Employee          from '../models/Employee.js';
import AttendanceLog     from '../models/AttendanceLog.js';
import PayrollRecord     from '../models/PayrollRecord.js';
import PerformanceRecord from '../models/PerformanceRecord.js';
import dotenv from 'dotenv';

dotenv.config();

// ─── helpers ─────────────────────────────────────────────────────────────────

/** Convert "HH:mm" to total minutes from midnight */
const toMin = (t) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

/** Convert minutes-from-midnight back to "HH:mm" */
const fromMin = (m) => {
  const h = Math.floor(((m % 1440) + 1440) % 1440 / 60);
  const min = ((m % 1440) + 1440) % 1440 % 60;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
};

/**
 * Compute scheduled shift hours, handling night-shift correctly.
 * e.g. 22:00 → 06:00  =  8 h  (not  -16 h)
 */
const scheduledHours = (start, end) => {
  let diff = toMin(end) - toMin(start);
  if (diff <= 0) diff += 1440;          // crosses midnight
  return diff / 60;
};

/**
 * Given an employee's shift and a random "lateness" in minutes,
 * return { inTime, outTime, outNextDay, hoursWorked }.
 *
 * For night-shift employees the out time may be on the next calendar day;
 * we mark that with outNextDay=true (matches new AttendanceLog schema).
 */
const buildInOut = (emp, lateMin = 0) => {
  const shiftStartMin = toMin(emp.shift.start);
  const shiftEndMin   = toMin(emp.shift.end);
  const isNight       = shiftEndMin < shiftStartMin;

  const inMin  = shiftStartMin + lateMin;
  const outMin = isNight ? shiftEndMin + 1440 : shiftEndMin; // normalise to same timeline

  const inTime     = fromMin(inMin);
  const outTime    = fromMin(outMin % 1440);
  const outNextDay = isNight;                                  // night shift always crosses midnight
  const hoursWorked = Math.max(0, (outMin - inMin) / 60);

  return { inTime, outTime, outNextDay, hoursWorked };
};

/** Weighted random pick: { Present: 60, Late: 15, Absent: 15, Leave: 10 } */
const randomStatus = () => {
  const r = Math.random() * 100;
  if (r < 60) return 'Present';
  if (r < 75) return 'Late';
  if (r < 90) return 'Absent';
  return 'Leave';
};

/** Build a single AttendanceLog document (plain object for insertMany) */
const buildRecord = (emp, date) => {
  const status    = randomStatus();
  const isWorked  = status === 'Present' || status === 'Late';
  const isLeave   = status === 'Leave';
  const lateMin   = status === 'Late' ? Math.floor(Math.random() * 45) + 5 : 0;

  // ── In / Out ────────────────────────────────────────────────────────────────
  let inTime = null, outTime = null, outNextDay = false, hoursWorked = 0;

  if (isWorked) {
    ({ inTime, outTime, outNextDay, hoursWorked } = buildInOut(emp, lateMin));
  } else if (isLeave) {
    // Leave still earns full shift hours (paid leave)
    hoursWorked = scheduledHours(emp.shift.start, emp.shift.end);
  }

  const schedHours = scheduledHours(emp.shift.start, emp.shift.end);

  // ── Financials ──────────────────────────────────────────────────────────────
  const basePay = hoursWorked * emp.hourlyRate;

  // Random small deduction (~20 % chance)
  const hasDeduction = isWorked && Math.random() < 0.20;
  const deductionAmt = hasDeduction ? Math.round(emp.hourlyRate * 0.5 * 10) / 10 : 0;
  const deductionDetails = hasDeduction
    ? [{ amount: deductionAmt, reason: 'Late deduction', createdAt: new Date() }]
    : [];

  // Random OT (~25 % chance for Present employees)
  const hasOt        = isWorked && status === 'Present' && Math.random() < 0.25;
  const otHours      = hasOt ? Math.round((Math.random() * 2 + 0.5) * 2) / 2 : 0; // 0.5–2.5 h
  const otMultiplier = hasOt ? [1, 1.5, 2][Math.floor(Math.random() * 3)] : 1;
  const otAmount     = otHours * emp.hourlyRate * otMultiplier;
  const otDetails    = hasOt
    ? [{ type: 'calc', amount: otAmount, hours: otHours, rate: otMultiplier, reason: 'After-hours work', createdAt: new Date() }]
    : [];

  // finalDayEarning recomputed in model pre-save, but we set it here too for insertMany
  const finalDayEarning = Math.max(0, basePay - deductionAmt + otAmount);

  return {
    date:      new Date(date),
    empId:     emp._id,
    empNumber: emp.employeeNumber,
    empName:   `${emp.firstName} ${emp.lastName}`,
    department: emp.department,
    status,
    inOut: {
      in:         inTime,
      out:        outTime,
      outNextDay
    },
    shift: {
      start:        emp.shift.start,
      end:          emp.shift.end,
      isNightShift: toMin(emp.shift.end) < toMin(emp.shift.start)
    },
    hourlyRate: emp.hourlyRate,
    financials: {
      hoursWorked,
      scheduledHours: schedHours,
      basePay,
      deduction:        deductionAmt,
      deductionDetails,
      otMultiplier,
      otHours,
      otAmount,
      otDetails,
      finalDayEarning
    },
    manualOverride: false,
    metadata: { source: 'system' }
  };
};

// ─── payroll & performance builders ──────────────────────────────────────────

/**
 * Aggregate attendance records for one employee + one period into a
 * PayrollRecord and a PerformanceRecord.
 */
const buildPayrollAndPerf = (emp, records, periodStart, periodEnd, totalWorkingDays) => {
  let presentDays = 0, lateDays = 0, absentDays = 0, leaveDays = 0;
  let totalHoursWorked = 0, totalOtHours = 0;
  let totalBasePay = 0, totalDeduction = 0, totalOtAmount = 0;

  const dailyBreakdown = [];

  for (const r of records) {
    if      (r.status === 'Present') presentDays++;
    else if (r.status === 'Late')    { presentDays++; lateDays++; }
    else if (r.status === 'Absent')  absentDays++;
    else if (r.status === 'Leave')   leaveDays++;

    totalHoursWorked += r.financials.hoursWorked   || 0;
    totalOtHours     += r.financials.otHours       || 0;
    totalBasePay     += r.financials.basePay        || 0;
    totalDeduction   += r.financials.deduction      || 0;
    totalOtAmount    += r.financials.otAmount       || 0;

    dailyBreakdown.push({
      date:            r.date,
      status:          r.status,
      inTime:          r.inOut?.in  || null,
      outTime:         r.inOut?.out || null,
      hoursWorked:     r.financials.hoursWorked    || 0,
      basePay:         r.financials.basePay         || 0,
      deduction:       r.financials.deduction       || 0,
      otHours:         r.financials.otHours         || 0,
      otAmount:        r.financials.otAmount        || 0,
      finalDayEarning: r.financials.finalDayEarning || 0
    });
  }

  // For monthly employees override baseSalary with monthlySalary (pro-rated)
  let baseSalary = totalBasePay;
  if (emp.salaryType === 'monthly' && emp.monthlySalary) {
    const daysInMonth = totalWorkingDays || 1;
    const workedOrLeave = presentDays + leaveDays;
    baseSalary = (emp.monthlySalary / daysInMonth) * workedOrLeave;
  }

  const netSalary = Math.max(0, baseSalary - totalDeduction + totalOtAmount);

  const label = periodStart.toLocaleString('en-US', { month: 'long', year: 'numeric' });

  const payroll = {
    empId:            emp._id,
    empNumber:        emp.employeeNumber,
    empName:          `${emp.firstName} ${emp.lastName}`,
    department:       emp.department,
    periodStart,
    periodEnd,
    periodLabel:      label,
    totalWorkingDays,
    presentDays,
    lateDays,
    absentDays,
    leaveDays,
    totalHoursWorked,
    baseSalary,
    totalDeduction,
    totalOtHours,
    totalOtAmount,
    netSalary,
    dailyBreakdown,
    status:           'draft',
    generatedBy:      null
  };

  // ── Performance ────────────────────────────────────────────────────────────
  const attendanceRate   = ((presentDays + leaveDays) / Math.max(1, totalWorkingDays)) * 100;
  const onTimeDays       = Math.max(0, presentDays - lateDays);
  const punctualityRate  = presentDays > 0 ? (onTimeDays / presentDays) * 100 : 100;
  const maxOtHours       = totalWorkingDays * 1;
  const otScore          = Math.min(100, (totalOtHours / Math.max(1, maxOtHours)) * 100);
  const performanceScore = Math.round(attendanceRate * 0.5 + punctualityRate * 0.3 + otScore * 0.2);

  let rating = 'Poor';
  if      (performanceScore >= 90) rating = 'Excellent';
  else if (performanceScore >= 75) rating = 'Good';
  else if (performanceScore >= 60) rating = 'Average';

  const perf = {
    empId:            emp._id,
    empNumber:        emp.employeeNumber,
    empName:          `${emp.firstName} ${emp.lastName}`,
    department:       emp.department,
    periodStart,
    periodEnd,
    periodLabel:      label,
    totalWorkingDays,
    presentDays,
    lateDays,
    absentDays,
    leaveDays,
    totalHoursWorked,
    totalOtHours,
    attendanceRate,
    punctualityRate,
    performanceScore,
    rating,
    scoreOverride: false,
    generatedBy:   null
  };

  return { payroll, perf };
};

// ─── working-days counter ─────────────────────────────────────────────────────

const countWorkingDays = (start, end) => {
  let count = 0;
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const day = d.getDay();
    if (day !== 0 && day !== 6) count++;
  }
  return count;
};

// ─── main ─────────────────────────────────────────────────────────────────────

async function seedDemoData() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✓ Connected to MongoDB');

    // ── Wipe previous seed data ────────────────────────────────────────────
    await AttendanceLog.deleteMany({});
    await PayrollRecord.deleteMany({});
    await PerformanceRecord.deleteMany({});
    console.log('✓ Cleared attendance / payroll / performance records');

    // ── Load active employees ──────────────────────────────────────────────
    const employees = await Employee.find({ status: 'Active', isArchived: false, isDeleted: false });
    console.log(`✓ Found ${employees.length} active employees`);

    // ── Filter to payroll-eligible employees only ──────────────────────────
    // Skip admin / superadmin — they have no shift or salary data.
    const payrollEmployees = employees.filter(
      emp => emp.role === 'employee' && emp.shift?.start && emp.shift?.end && emp.salaryType
    );
    console.log(`  → ${payrollEmployees.length} payroll employees (${employees.length - payrollEmployees.length} system accounts skipped)`);

    // ── Date range: last 60 days ───────────────────────────────────────────
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const rangeStart = new Date(today);
    rangeStart.setDate(rangeStart.getDate() - 60);
    rangeStart.setHours(0, 0, 0, 0);

    // ── Build attendance records ───────────────────────────────────────────
    const attendanceRecords = [];

    for (let d = new Date(rangeStart); d <= today; d.setDate(d.getDate() + 1)) {
      if (d.getDay() === 0 || d.getDay() === 6) continue;  // skip weekends
      for (const emp of payrollEmployees) {
        attendanceRecords.push(buildRecord(emp, d));
      }
    }

    if (attendanceRecords.length > 0) {
      await AttendanceLog.insertMany(attendanceRecords, { ordered: false });
      console.log(`✓ Inserted ${attendanceRecords.length} attendance records`);
    }

    // ── Compute payroll + performance per employee per calendar month ──────
    // Collect unique months covered
    const months = new Set();
    for (let d = new Date(rangeStart); d <= today; d.setMonth(d.getMonth() + 1)) {
      months.add(`${d.getFullYear()}-${d.getMonth()}`);
    }

    const payrollDocs = [];
    const perfDocs    = [];

    for (const monthKey of months) {
      const [year, month] = monthKey.split('-').map(Number);

      const periodStart = new Date(year, month, 1);
      const periodEnd   = new Date(year, month + 1, 0, 23, 59, 59, 999);

      // Clamp to our data range
      const clampedStart = periodStart < rangeStart ? rangeStart : periodStart;
      const clampedEnd   = periodEnd   > today      ? today      : periodEnd;

      const workingDays = countWorkingDays(clampedStart, clampedEnd);

      for (const emp of payrollEmployees) {
        // Fetch this employee's attendance for the clamped period
        const records = attendanceRecords.filter(
          r => String(r.empId) === String(emp._id) &&
               r.date >= clampedStart &&
               r.date <= clampedEnd
        );

        if (records.length === 0) continue;

        const { payroll, perf } = buildPayrollAndPerf(
          emp, records, clampedStart, clampedEnd, workingDays
        );

        payrollDocs.push(payroll);
        perfDocs.push(perf);
      }
    }

    if (payrollDocs.length > 0) {
      await PayrollRecord.insertMany(payrollDocs, { ordered: false });
      console.log(`✓ Inserted ${payrollDocs.length} payroll records`);
    }

    if (perfDocs.length > 0) {
      await PerformanceRecord.insertMany(perfDocs, { ordered: false });
      console.log(`✓ Inserted ${perfDocs.length} performance records`);
    }

    console.log('\n✓ seedDemoData complete!');
    process.exit(0);
  } catch (err) {
    console.error('✗ Seeding error:', err);
    process.exit(1);
  }
}

seedDemoData();