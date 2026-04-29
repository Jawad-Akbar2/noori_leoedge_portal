// routes/performance.js
import express from 'express';
import AttendanceLog     from '../models/AttendanceLog.js';
import PerformanceRecord from '../models/PerformanceRecord.js';
import Employee          from '../models/Employee.js';
import { adminAuth }     from '../middleware/auth.js';
import { buildDateRange, formatDate } from '../utils/dateUtils.js';
import { countWorkingDays } from '../utils/helpers.js';

const router = express.Router();

// Minimal fields needed for attendance/performance computation
const EMP_PERF_FIELDS =
  '_id employeeNumber firstName lastName department shift salaryType hourlyRate monthlySalary role';

const payrollFilter = (callerRole, extra = {}) => ({
  role:       callerRole === 'superadmin' || callerRole === 'owner'
                ? { $nin: ['superadmin', 'owner'] }
                : 'employee',
  status:     { $in: ['Active', 'Frozen'] },
  isArchived: false,
  isDeleted:  false,
  ...extra
});

// ─── shared helper ────────────────────────────────────────────────────────────
function computePerformance(employee, logs, periodStart, periodEnd, totalWorkingDays) {
  let presentDays = 0, lateDays = 0, OffDayDays = 0, leaveDays = 0, ncnsDays = 0;
  let totalHoursWorked = 0, totalOtHours = 0;

  for (const log of logs) {
    if      (log.status === 'Present') presentDays++;
    else if (log.status === 'Late')    { presentDays++; lateDays++; }
    else if (log.status === 'OffDay')  OffDayDays++;
    else if (log.status === 'Leave')   leaveDays++;
    else if (log.status === 'NCNS')    ncnsDays++;
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
    OffDayDays,
    leaveDays,
    ncnsDays,
    totalHoursWorked,
    totalOtHours,
    attendanceRate:   Math.round(attendanceRate  * 10) / 10,
    punctualityRate:  Math.round(punctualityRate * 10) / 10,
    performanceScore,
    rating,
    scoreOverride: false
  };
}

// ─── shared response shaper ───────────────────────────────────────────────────
function shapeTableRow(r) {
  return {
    _id:              r._id || null,
    empId:            r.empId,
    empNumber:        r.empNumber,
    empName:          r.empName,
    department:       r.department,
    totalWorkingDays: r.totalWorkingDays,
    presentDays:      r.presentDays,
    lateDays:         r.lateDays,
    OffDayDays:       r.OffDayDays,
    leaveDays:        r.leaveDays,
    totalOtHours:     r.totalOtHours,
    attendanceRate:   r.attendanceRate,
    punctualityRate:  r.punctualityRate,
    performanceScore: r.performanceScore,
    rating:           r.rating,
    scoreOverride:    r.scoreOverride || false
  };
}

function buildAggregates(records) {
  const ratingCounts = { Excellent: 0, Good: 0, Average: 0, Poor: 0 };
  const deptMap      = {};

  for (const r of records) {
    ratingCounts[r.rating] = (ratingCounts[r.rating] || 0) + 1;
    (deptMap[r.department] ??= []).push(r.performanceScore);
  }

  const pieData = Object.entries(ratingCounts).map(([rating, count]) => ({
    rating,
    count,
    percentage: records.length ? Math.round((count / records.length) * 100) : 0
  }));

  const deptData = Object.entries(deptMap).map(([dept, scores]) => ({
    department: dept,
    avgScore:   Math.round(scores.reduce((s, v) => s + v, 0) / scores.length),
    count:      scores.length
  })).sort((a, b) => b.avgScore - a.avgScore);

  const avgScore = records.length
    ? Math.round(records.reduce((s, r) => s + r.performanceScore, 0) / records.length)
    : 0;

  return { ratingCounts, pieData, deptData, avgScore };
}

// ─── GET /api/performance/summary ────────────────────────────────────────────
router.get('/summary', adminAuth, async (req, res) => {
  try {
    const { startDate, endDate, department } = req.query;
    const range = buildDateRange(startDate, endDate);
    if (!range) {
      return res.status(400).json({ success: false, message: 'startDate and endDate required' });
    }

    const prQuery = {
      periodStart: { $lte: range.$lte },
      periodEnd:   { $gte: range.$gte },
      isDeleted:   false
    };
    if (department) prQuery.department = department;

    // ── fetch cached records + (if needed) scoping employee ids in parallel ──
    const isSuperiorRole = req.userRole === 'superadmin' || req.userRole === 'owner';

    const [cachedRecords, scopedIds] = await Promise.all([
      PerformanceRecord.find(prQuery).select('-__v').lean(),
      // Only fetch scoping ids if admin-level caller needs role filtering
      !isSuperiorRole
        ? Employee.find(payrollFilter(req.userRole)).distinct('_id')
        : Promise.resolve(null)
    ]);

    let records = cachedRecords;

    if (records.length > 0 && scopedIds) {
      const empIdSet = new Set(scopedIds.map(id => String(id)));
      records = records.filter(r => empIdSet.has(String(r.empId)));
    }

    if (records.length === 0) {
      // ── live compute: employees + logs in parallel ────────────────────────
      const empQuery  = payrollFilter(req.userRole, department ? { department } : {});
      const [employees, logs] = await Promise.all([
        Employee.find(empQuery).select(EMP_PERF_FIELDS).lean(),
        AttendanceLog.find({ date: range, isDeleted: false })
          .select('empId status financials')
          .lean()
      ]);

      const workingDays = countWorkingDays(range.$gte, range.$lte);

      // Filter logs to only employees in scope (logs query has no empId filter above
      // since we didn't have empIds yet — filter in JS instead of a second round-trip)
      const empIdSet  = new Set(employees.map(e => String(e._id)));
      const logsByEmp = {};
      for (const log of logs) {
        const k = String(log.empId);
        if (empIdSet.has(k)) (logsByEmp[k] ??= []).push(log);
      }

      records = employees.map(emp =>
        computePerformance(emp, logsByEmp[String(emp._id)] || [], range.$gte, range.$lte, workingDays)
      );
    }

    const table = records.map(shapeTableRow);
    const { ratingCounts, pieData, deptData, avgScore } = buildAggregates(records);

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

    const roleFilter = req.userRole === 'superadmin' || req.userRole === 'owner'
      ? { role: { $nin: ['superadmin', 'owner'] } }
      : { role: 'employee' };

    // ── employee + cached record + trend — all three in parallel ─────────────
    const [employee, cachedRecord, trend] = await Promise.all([
      Employee.findOne({ _id: req.params.empId, ...roleFilter, isDeleted: false })
        .select(EMP_PERF_FIELDS + ' shift')
        .lean(),
      PerformanceRecord.findOne({
        empId:       req.params.empId,
        periodStart: { $lte: range.$lte },
        periodEnd:   { $gte: range.$gte },
        isDeleted:   false
      }).select('-__v').lean(),
      PerformanceRecord.find({ empId: req.params.empId, isDeleted: false })
        .select('periodLabel periodStart performanceScore attendanceRate punctualityRate rating')
        .sort({ periodStart: -1 })
        .limit(6)
        .lean()
    ]);

    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found or access denied' });
    }

    // ── if no cached record, compute live ────────────────────────────────────
    let record = cachedRecord;
    if (!record) {
      const logs = await AttendanceLog.find({ empId: employee._id, date: range, isDeleted: false })
        .select('status financials date')
        .sort({ date: 1 })
        .lean();
      const workingDays = countWorkingDays(range.$gte, range.$lte);
      record = computePerformance(employee, logs, range.$gte, range.$lte, workingDays);
    }

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
        OffDayDays:       record.OffDayDays,
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

    const employees = await Employee.find(payrollFilter(req.userRole))
      .select(EMP_PERF_FIELDS)
      .lean();

    if (!employees.length) {
      return res.json({ success: true, message: 'No active employees', created: 0, updated: 0, skipped: 0 });
    }

    const empIds      = employees.map(e => e._id);
    const workingDays = countWorkingDays(range.$gte, range.$lte);

    // ── fetch logs + existing records in parallel — eliminates N+1 ───────────
    const [logs, existingRecords] = await Promise.all([
      AttendanceLog.find({ empId: { $in: empIds }, date: range, isDeleted: false })
        .select('empId status financials')
        .lean(),
      PerformanceRecord.find({
        empId:       { $in: empIds },
        periodStart: range.$gte,
        periodEnd:   range.$lte
      }).select('empId scoreOverride').lean()
    ]);

    // Build fast O(1) lookup maps
    const logsByEmp = {};
    for (const log of logs) {
      const k = String(log.empId);
      (logsByEmp[k] ??= []).push(log);
    }
    const existingByEmp = {};
    for (const rec of existingRecords) {
      existingByEmp[String(rec.empId)] = rec;
    }

    // ── compute all records, then batch-write with bulkWrite ─────────────────
    const bulkOps  = [];
    let created = 0, updated = 0, skipped = 0;

    for (const emp of employees) {
      const k        = String(emp._id);
      const existing = existingByEmp[k];

      if (existing?.scoreOverride) {
        skipped++;
        continue;
      }

      const data = computePerformance(
        emp,
        logsByEmp[k] || [],
        range.$gte, range.$lte, workingDays
      );
      data.generatedBy = req.userId;

      if (existing) {
        bulkOps.push({
          updateOne: {
            filter: { _id: existing._id },
            update: { $set: data }
          }
        });
        updated++;
      } else {
        bulkOps.push({ insertOne: { document: data } });
        created++;
      }
    }

    if (bulkOps.length) {
      await PerformanceRecord.bulkWrite(bulkOps, { ordered: false });
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

    const isSuperior = req.userRole === 'superadmin' || req.userRole === 'owner';

    // ── fetch record; if admin-level, also verify target employee role ────────
    const record = await PerformanceRecord.findOne({ _id: req.params.id, isDeleted: false })
      .select('-__v');
    if (!record) {
      return res.status(404).json({ success: false, message: 'Performance record not found' });
    }

    if (!isSuperior) {
      const emp = await Employee.findOne({ _id: record.empId, role: 'employee' })
        .select('_id').lean();
      if (!emp) {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to override scores for admin accounts'
        });
      }
    }

    record.performanceScore = numScore;
    record.scoreOverride    = true;
    if (notes) record.notes = notes;
    record.rating = numScore >= 90 ? 'Excellent'
                  : numScore >= 75 ? 'Good'
                  : numScore >= 60 ? 'Average'
                  : 'Poor';

    await record.save();
    return res.json({ success: true, message: 'Performance score updated', record });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;