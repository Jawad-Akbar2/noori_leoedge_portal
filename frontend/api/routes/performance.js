// routes/performance.js

import express from 'express';
import AttendanceLog     from '../models/AttendanceLog.js';
import PerformanceRecord from '../models/PerformanceRecord.js';
import Employee          from '../models/Employee.js';
import { adminAuth }     from '../middleware/auth.js';
import { buildDateRange, formatDate } from '../utils/dateUtils.js';
import { countWorkingDays } from '../utils/helpers.js';

const router = express.Router();

const SYSTEM_ROLES = ['superadmin'];

/**
 * Scoped Mongoose filter for payroll-eligible employees.
 *
 *   superadmin caller -> admin + employee  (excludes only superadmin)
 *   admin caller      -> employee only     (excludes admin + superadmin)
 */
const payrollFilter = (callerRole, extra = {}) => ({
  role:       callerRole === 'superadmin'
                ? { $nin: ['superadmin'] }
                : 'employee',
  status:     'Active',
  isArchived: false,
  isDeleted:  false,
  ...extra
});

// ─── shared helper ────────────────────────────────────────────────────────────

function computePerformance(employee, logs, periodStart, periodEnd, totalWorkingDays) {
  let presentDays = 0, lateDays = 0, absentDays = 0, leaveDays = 0;
  let totalHoursWorked = 0, totalOtHours = 0;

  for (const log of logs) {
    if      (log.status === 'Present') presentDays++;
    else if (log.status === 'Late')    { presentDays++; lateDays++; }
    else if (log.status === 'Absent')  absentDays++;
    else if (log.status === 'Leave')   leaveDays++;

    totalHoursWorked += log.financials?.hoursWorked || 0;
    totalOtHours     += log.financials?.otHours     || 0;
  }

  const total           = totalWorkingDays || 1;
  const attendanceRate  = Math.min(100, ((presentDays + leaveDays) / total) * 100);
  const onTimeDays      = Math.max(0, presentDays - lateDays);
  const punctualityRate = presentDays > 0 ? (onTimeDays / presentDays) * 100 : 100;
  const otScore         = Math.min(100, (totalOtHours / Math.max(1, total)) * 100);

  const performanceScore = Math.round(
    attendanceRate  * 0.5 +
    punctualityRate * 0.3 +
    otScore         * 0.2
  );

  let rating = 'Poor';
  if      (performanceScore >= 90) rating = 'Excellent';
  else if (performanceScore >= 75) rating = 'Good';
  else if (performanceScore >= 60) rating = 'Average';

  const periodLabel = `${periodStart.toLocaleString('en-US', { month: 'long' })} ${periodStart.getFullYear()}`;

  return {
    empId:            employee._id,
    empNumber:        employee.employeeNumber,
    empName:          `${employee.firstName} ${employee.lastName}`,
    department:       employee.department,
    periodStart,
    periodEnd,
    periodLabel,
    totalWorkingDays: totalWorkingDays || 0,
    presentDays,
    lateDays,
    absentDays,
    leaveDays,
    totalHoursWorked,
    totalOtHours,
    attendanceRate:   Math.round(attendanceRate  * 10) / 10,
    punctualityRate:  Math.round(punctualityRate * 10) / 10,
    performanceScore,
    rating,
    scoreOverride: false
  };
}

// ─── GET /api/performance/summary ────────────────────────────────────────────

router.get('/summary', adminAuth, async (req, res) => {
  try {
    const { startDate, endDate, department } = req.query;
    const range = buildDateRange(startDate, endDate);

    if (!range) {
      return res.status(400).json({ success: false, message: 'startDate and endDate required' });
    }

    // Try cached PerformanceRecords
    const prQuery = {
      periodStart: { $lte: range.$lte },
      periodEnd:   { $gte: range.$gte },
      isDeleted:   false
    };
    if (department) prQuery.department = department;

    let records = await PerformanceRecord.find(prQuery).lean();

    // If using cached records, filter by caller role so admin doesn't see other admins
    if (records.length > 0 && req.userRole !== 'superadmin') {
      // Need to join with Employee to check role — use empId list approach
      const employeeIds = await Employee.find(payrollFilter(req.userRole))
        .distinct('_id');
      const empIdSet = new Set(employeeIds.map(id => String(id)));
      records = records.filter(r => empIdSet.has(String(r.empId)));
    }

    if (records.length === 0) {
      // Compute live
      const empQuery  = payrollFilter(req.userRole, department ? { department } : {});
      const employees   = await Employee.find(empQuery).lean();
      const workingDays = countWorkingDays(range.$gte, range.$lte);
      const empIds      = employees.map(e => e._id);

      const logs = await AttendanceLog.find({
        empId: { $in: empIds }, date: range, isDeleted: false
      }).lean();

      const logsByEmp = {};
      for (const log of logs) {
        const k = String(log.empId);
        (logsByEmp[k] ??= []).push(log);
      }

      records = employees.map(emp =>
        computePerformance(emp, logsByEmp[String(emp._id)] || [], range.$gte, range.$lte, workingDays)
      );
    }

    const table = records.map(r => ({
      _id:              r._id || null,
      empId:            r.empId,
      empNumber:        r.empNumber,
      empName:          r.empName,
      department:       r.department,
      totalWorkingDays: r.totalWorkingDays,
      presentDays:      r.presentDays,
      lateDays:         r.lateDays,
      absentDays:       r.absentDays,
      leaveDays:        r.leaveDays,
      totalOtHours:     r.totalOtHours,
      attendanceRate:   r.attendanceRate,
      punctualityRate:  r.punctualityRate,
      performanceScore: r.performanceScore,
      rating:           r.rating,
      scoreOverride:    r.scoreOverride || false
    }));

    const ratingCounts = { Excellent: 0, Good: 0, Average: 0, Poor: 0 };
    for (const r of records) ratingCounts[r.rating] = (ratingCounts[r.rating] || 0) + 1;

    const pieData = Object.entries(ratingCounts).map(([rating, count]) => ({
      rating,
      count,
      percentage: records.length ? Math.round((count / records.length) * 100) : 0
    }));

    const deptMap = {};
    for (const r of records) {
      const d = r.department;
      (deptMap[d] ??= []).push(r.performanceScore);
    }
    const deptData = Object.entries(deptMap).map(([dept, scores]) => ({
      department: dept,
      avgScore:   Math.round(scores.reduce((s, v) => s + v, 0) / scores.length),
      count:      scores.length
    })).sort((a, b) => b.avgScore - a.avgScore);

    const avgScore = records.length
      ? Math.round(records.reduce((s, r) => s + r.performanceScore, 0) / records.length)
      : 0;

    return res.json({
      success:     true,
      periodStart: formatDate(range.$gte),
      periodEnd:   formatDate(range.$lte),
      table,
      pieData,
      deptData,
      stats: {
        totalEmployees: records.length,
        avgScore,
        excellent: ratingCounts.Excellent,
        good:      ratingCounts.Good,
        average:   ratingCounts.Average,
        poor:      ratingCounts.Poor
      },
      total: table.length
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /api/performance/:empId ─────────────────────────────────────────────

router.get('/:empId', adminAuth, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const range = buildDateRange(startDate, endDate);

    if (!range) {
      return res.status(400).json({ success: false, message: 'startDate and endDate required' });
    }

    // Scope by caller role
    const roleFilter = req.userRole === 'superadmin'
      ? { role: { $nin: ['superadmin'] } }
      : { role: 'employee' };

    const employee = await Employee.findOne({
      _id:       req.params.empId,
      ...roleFilter,
      isDeleted: false
    }).select('-password -tempPassword').lean();

    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found or access denied' });
    }

    let record = await PerformanceRecord.findOne({
      empId:       employee._id,
      periodStart: { $lte: range.$lte },
      periodEnd:   { $gte: range.$gte },
      isDeleted:   false
    }).lean();

    if (!record) {
      const logs = await AttendanceLog.find({
        empId: employee._id, date: range, isDeleted: false
      }).sort({ date: 1 }).lean();

      const workingDays = countWorkingDays(range.$gte, range.$lte);
      record = computePerformance(employee, logs, range.$gte, range.$lte, workingDays);
    }

    const trend = await PerformanceRecord.find({
      empId:     employee._id,
      isDeleted: false
    })
      .sort({ periodStart: -1 })
      .limit(6)
      .lean();

    const trendData = trend.map(t => ({
      periodLabel:      t.periodLabel,
      periodStart:      formatDate(t.periodStart),
      performanceScore: t.performanceScore,
      attendanceRate:   t.attendanceRate,
      punctualityRate:  t.punctualityRate,
      rating:           t.rating
    })).reverse();

    return res.json({
      success: true,
      employee: {
        _id:        employee._id,
        empNumber:  employee.employeeNumber,
        empName:    `${employee.firstName} ${employee.lastName}`,
        department: employee.department,
        shift:      employee.shift
      },
      performance: {
        periodStart:      formatDate(record.periodStart),
        periodEnd:        formatDate(record.periodEnd),
        periodLabel:      record.periodLabel,
        totalWorkingDays: record.totalWorkingDays,
        presentDays:      record.presentDays,
        lateDays:         record.lateDays,
        absentDays:       record.absentDays,
        leaveDays:        record.leaveDays,
        totalHoursWorked: record.totalHoursWorked,
        totalOtHours:     record.totalOtHours,
        attendanceRate:   record.attendanceRate,
        punctualityRate:  record.punctualityRate,
        performanceScore: record.performanceScore,
        rating:           record.rating,
        scoreOverride:    record.scoreOverride || false
      },
      trendData
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── POST /api/performance/calculate ─────────────────────────────────────────

router.post('/calculate', adminAuth, async (req, res) => {
  try {
    const { startDate, endDate } = req.body;
    const range = buildDateRange(startDate, endDate);

    if (!range) {
      return res.status(400).json({ success: false, message: 'Valid startDate and endDate required' });
    }

    const employees = await Employee.find(payrollFilter(req.userRole)).lean();

    if (!employees.length) {
      return res.json({ success: true, message: 'No active employees', created: 0, updated: 0 });
    }

    const empIds      = employees.map(e => e._id);
    const workingDays = countWorkingDays(range.$gte, range.$lte);

    const logs = await AttendanceLog.find({
      empId: { $in: empIds }, date: range, isDeleted: false
    }).lean();

    const logsByEmp = {};
    for (const log of logs) {
      const k = String(log.empId);
      (logsByEmp[k] ??= []).push(log);
    }

    let created = 0, updated = 0, skipped = 0;

    for (const emp of employees) {
      const data = computePerformance(
        emp,
        logsByEmp[String(emp._id)] || [],
        range.$gte, range.$lte, workingDays
      );
      data.generatedBy = req.userId;

      const existing = await PerformanceRecord.findOne({
        empId:       emp._id,
        periodStart: range.$gte,
        periodEnd:   range.$lte
      });

      if (existing) {
        if (existing.scoreOverride) {
          skipped++;
        } else {
          Object.assign(existing, data);
          await existing.save();
          updated++;
        }
      } else {
        await PerformanceRecord.create(data);
        created++;
      }
    }

    return res.json({
      success:     true,
      message:     `Performance calculated: ${created} created, ${updated} updated, ${skipped} skipped (manual override)`,
      created,
      updated,
      skipped,
      periodStart: formatDate(range.$gte),
      periodEnd:   formatDate(range.$lte)
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── PATCH /api/performance/:id/score ────────────────────────────────────────

router.patch('/:id/score', adminAuth, async (req, res) => {
  try {
    const { score, notes } = req.body;
    const numScore = Number(score);

    if (isNaN(numScore) || numScore < 0 || numScore > 100) {
      return res.status(400).json({ success: false, message: 'score must be a number between 0 and 100' });
    }

    const record = await PerformanceRecord.findOne({ _id: req.params.id, isDeleted: false });
    if (!record) return res.status(404).json({ success: false, message: 'Performance record not found' });

    // Admin cannot override performance scores for other admins/superadmins
    if (req.userRole !== 'superadmin') {
      const emp = await Employee.findOne({ _id: record.empId, role: 'employee' });
      if (!emp) {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to override scores for admin accounts'
        });
      }
    }

    record.performanceScore = numScore;
    record.scoreOverride    = true;
    record.notes            = notes || record.notes;

    if      (numScore >= 90) record.rating = 'Excellent';
    else if (numScore >= 75) record.rating = 'Good';
    else if (numScore >= 60) record.rating = 'Average';
    else                     record.rating = 'Poor';

    await record.save();

    return res.json({ success: true, message: 'Performance score updated', record });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;