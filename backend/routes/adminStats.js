// routes/statsRoutes.js
import express           from 'express';
import Employee          from '../models/Employee.js';
import AttendanceLog     from '../models/AttendanceLog.js';
import PayrollRecord     from '../models/PayrollRecord.js';
import PerformanceRecord from '../models/PerformanceRecord.js';
import LeaveRequest      from '../models/LeaveRequest.js';
import CorrectionRequest from '../models/CorrectionRequest.js';
import { adminAuth }     from '../middleware/auth.js';

const router  = express.Router();
const BASE    = { isDeleted: false };     // shared — never mutated, spread when extending

/**
 * GET /api/stats/system
 * All helpers run in parallel for maximum throughput.
 *
 * Recommended indexes (add once in your DB init / migration):
 *   AttendanceLog:     { date: 1, isDeleted: 1 }
 *   AttendanceLog:     { date: 1, status: 1 }
 *   PayrollRecord:     { periodStart: 1, isDeleted: 1 }
 *   LeaveRequest:      { fromDate: 1, isDeleted: 1 }
 *   CorrectionRequest: { createdAt: 1, isDeleted: 1 }
 *   PerformanceRecord: { periodStart: 1, isDeleted: 1 }
 *   Employee:          { isDeleted: 1, joiningDate: 1 }
 */
router.get('/system', adminAuth, async (req, res) => {
  try {
    const now          = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfWeek  = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const sixMonthsAgo = new Date(now);
    sixMonthsAgo.setMonth(now.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0, 0, 0, 0);

    const [
      employeeStats,
      attendanceStats,
      payrollStats,
      performanceStats,
      leaveStats,
      correctionStats,
      recentActivity,
    ] = await Promise.all([
      getEmployeeStats(startOfMonth, sixMonthsAgo),
      getAttendanceStats(startOfToday, startOfWeek, startOfMonth),
      getPayrollStats(startOfMonth, sixMonthsAgo),
      getPerformanceStats(sixMonthsAgo),
      getLeaveStats(startOfMonth, sixMonthsAgo),
      getCorrectionStats(sixMonthsAgo),
      getRecentActivity(),
    ]);

    res.status(200).json({
      success: true,
      data: {
        timestamp:   now,
        employees:   employeeStats,
        attendance:  attendanceStats,
        payroll:     payrollStats,
        performance: performanceStats,
        leaves:      leaveStats,
        corrections: correctionStats,
        recentActivity,
      },
    });
  } catch (error) {
    console.error('System stats error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch system stats', error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

async function getEmployeeStats(startOfMonth, sixMonthsAgo) {
  const [summary, departmentWise, roleWise, salaryTypeWise, joiningTrends, leftStats, newThisMonth] =
    await Promise.all([
      Employee.aggregate([
        { $match: BASE },
        {
          $group: {
            _id:          null,
            total:        { $sum: 1 },
            active:       { $sum: { $cond: [{ $eq: ['$status', 'Active']    }, 1, 0] } },
            inactive:     { $sum: { $cond: [{ $eq: ['$status', 'Inactive']  }, 1, 0] } },
            frozen:       { $sum: { $cond: [{ $eq: ['$status', 'Frozen']    }, 1, 0] } },
            leftBusiness: { $sum: { $cond: ['$leftBusiness.isLeft',           1, 0] } },
            hourly:       { $sum: { $cond: [{ $eq: ['$salaryType', 'hourly']  }, 1, 0] } },
            monthly:      { $sum: { $cond: [{ $eq: ['$salaryType', 'monthly'] }, 1, 0] } },
            leftThisMonth:{ $sum: { $cond: [{ $and: [
              { $eq:  ['$leftBusiness.isLeft', true] },
              { $gte: ['$leftBusiness.leftDate', startOfMonth] },
            ]}, 1, 0] } },
          },
        },
      ]),
      Employee.aggregate([
        { $match: BASE },
        {
          $group: {
            _id:    '$department',
            total:  { $sum: 1 },
            active: { $sum: { $cond: [{ $eq: ['$status', 'Active'] }, 1, 0] } },
          },
        },
        { $sort: { total: -1 } },
      ]),
      Employee.aggregate([
        { $match: BASE },
        { $group: { _id: '$role', count: { $sum: 1 } } },
      ]),
      Employee.aggregate([
        { $match: { ...BASE, salaryType: { $ne: null } } },
        { $group: { _id: '$salaryType', count: { $sum: 1 } } },
      ]),
      Employee.aggregate([
        { $match: { ...BASE, joiningDate: { $gte: sixMonthsAgo } } },
        {
          $group: {
            _id:   { year: { $year: '$joiningDate' }, month: { $month: '$joiningDate' } },
            count: { $sum: 1 },
          },
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } },
      ]),
      // kept for backward compat shape — leftThisMonth now comes from summary[0]
      Promise.resolve([]),
      Employee.countDocuments({ ...BASE, createdAt: { $gte: startOfMonth } }),
    ]);

  const s            = summary[0] || {};
  const total        = s.total       || 0;
  const totalLeft    = s.leftBusiness || 0;
  const turnoverRate = total > 0 ? parseFloat(((totalLeft / total) * 100).toFixed(2)) : 0;

  return {
    summary: {
      total,
      active:        s.active        || 0,
      inactive:      s.inactive      || 0,
      frozen:        s.frozen        || 0,
      leftBusiness:  totalLeft,
      leftThisMonth: s.leftThisMonth || 0,   // ← now from same pipeline, no extra query
      newThisMonth,
      turnoverRate,
      hourly:  s.hourly  || 0,
      monthly: s.monthly || 0,
    },
    departmentWise,
    roleWise:       roleWise.reduce((a, c)      => ({ ...a, [c._id]: c.count }),        {}),
    salaryTypeWise: salaryTypeWise.reduce((a, c) => ({ ...a, [c._id]: c.count }),        {}),
    joiningTrends,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// getAttendanceStats:
//   Original: 7 separate aggregation pipelines.
//   Optimized: merged the 3 overlapping month-range scans (statusBreakdown,
//   departmentAttendance, avgHours) into thisMonth via $facet so Mongo scans
//   the startOfMonth slice ONCE and fans out to sub-pipelines in memory.
//   today, week, and lateTrends still run as separate pipelines (different date ranges).
// ─────────────────────────────────────────────────────────────────────────────
async function getAttendanceStats(startOfToday, startOfWeek, startOfMonth) {
  const [todayStats, weekStats, monthFacet, lateTrends] = await Promise.all([
    // ── Today ─────────────────────────────────────────────────────────────────
    AttendanceLog.aggregate([
      { $match: { ...BASE, date: { $gte: startOfToday } } },
      {
        $group: {
          _id:          null,
          present:      { $sum: { $cond: [{ $in: ['$status', ['Present', 'Late']] }, 1, 0] } },
          late:         { $sum: { $cond: [{ $eq: ['$status', 'Late']   }, 1, 0] } },
          OffDay:       { $sum: { $cond: [{ $eq: ['$status', 'OffDay'] }, 1, 0] } },
          onLeave:      { $sum: { $cond: [{ $eq: ['$status', 'Leave']  }, 1, 0] } },
          ncns:         { $sum: { $cond: [{ $eq: ['$status', 'NCNS']   }, 1, 0] } },
          totalHours:   { $sum: '$financials.hoursWorked' },
          totalOtHours: { $sum: '$financials.otHours'     },
        },
      },
    ]),

    // ── This week ─────────────────────────────────────────────────────────────
    AttendanceLog.aggregate([
      { $match: { ...BASE, date: { $gte: startOfWeek } } },
      {
        $group: {
          _id:           null,
          totalPresent:  { $sum: { $cond: [{ $in: ['$status', ['Present', 'Late']] }, 1, 0] } },
          totalLate:     { $sum: { $cond: [{ $eq: ['$status', 'Late']   }, 1, 0] } },
          totalOffDay:   { $sum: { $cond: [{ $eq: ['$status', 'OffDay'] }, 1, 0] } },
          totalLeave:    { $sum: { $cond: [{ $eq: ['$status', 'Leave']  }, 1, 0] } },
          totalNcns:     { $sum: { $cond: [{ $eq: ['$status', 'NCNS']   }, 1, 0] } },
          totalOtHours:  { $sum: '$financials.otHours'  },
          totalOtAmount: { $sum: '$financials.otAmount' },
        },
      },
    ]),

    // ── Month: thisMonth + statusBreakdown + departmentAttendance + avgHours
    //    all in ONE collection scan via $facet ─────────────────────────────────
    AttendanceLog.aggregate([
      { $match: { ...BASE, date: { $gte: startOfMonth } } },
      {
        $facet: {
          totals: [
            {
              $group: {
                _id:             null,
                totalRecords:    { $sum: 1 },
                presentCount:    { $sum: { $cond: [{ $in: ['$status', ['Present', 'Late']] }, 1, 0] } },
                lateCount:       { $sum: { $cond: [{ $eq: ['$status', 'Late']   }, 1, 0] } },
                OffDayCount:     { $sum: { $cond: [{ $eq: ['$status', 'OffDay'] }, 1, 0] } },
                leaveCount:      { $sum: { $cond: [{ $eq: ['$status', 'Leave']  }, 1, 0] } },
                ncnsCount:       { $sum: { $cond: [{ $eq: ['$status', 'NCNS']   }, 1, 0] } },
                totalHours:      { $sum: '$financials.hoursWorked' },
                totalOtHours:    { $sum: '$financials.otHours'     },
                totalOtAmount:   { $sum: '$financials.otAmount'    },
                totalDeductions: { $sum: '$financials.deduction'   },
                totalBasePay:    { $sum: '$financials.basePay'     },
                avgLateMinutes:  { $avg: '$financials.lateMinutes' },
                avgHoursWorked:  { $avg: '$financials.hoursWorked' },
                avgOtHours:      { $avg: '$financials.otHours'     },
              },
            },
          ],
          statusBreakdown: [
            { $group: { _id: '$status', count: { $sum: 1 } } },
          ],
          departmentAttendance: [
            {
              $group: {
                _id:          '$department',
                total:        { $sum: 1 },
                presentCount: { $sum: { $cond: [{ $in: ['$status', ['Present', 'Late', 'Leave']] }, 1, 0] } },
                ncnsCount:    { $sum: { $cond: [{ $eq: ['$status', 'NCNS']  }, 1, 0] } },
                totalHours:   { $sum: '$financials.hoursWorked' },
                totalOtHours: { $sum: '$financials.otHours'     },
                lateCount:    { $sum: { $cond: [{ $eq: ['$status', 'Late'] }, 1, 0] } },
              },
            },
            {
              $addFields: {
                attendanceRate: {
                  $multiply: [{ $divide: ['$presentCount', { $max: ['$total', 1] }] }, 100],
                },
              },
            },
            { $sort: { attendanceRate: -1 } },
          ],
        },
      },
    ]),

    // ── Late trends (last 7 days) — separate range so can't share month facet ─
    AttendanceLog.aggregate([
      { $match: { ...BASE, date: { $gte: startOfWeek }, status: 'Late' } },
      {
        $group: {
          _id:            { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
          lateCount:      { $sum: 1 },
          avgLateMinutes: { $avg: '$financials.lateMinutes' },
        },
      },
      { $sort: { _id: 1 } },
    ]),
  ]);

  const td  = todayStats[0]    || {};
  const wk  = weekStats[0]     || {};
  const mf  = monthFacet[0]    || {};          // $facet always returns one doc
  const ms  = mf.totals?.[0]   || {};
  const deptAtt   = mf.departmentAttendance || [];
  const statusBkd = mf.statusBreakdown      || [];

  const todayTotal   = (td.present || 0) + (td.OffDay || 0) + (td.onLeave || 0);
  const todayAttRate = todayTotal > 0
    ? parseFloat((((td.present || 0) / todayTotal) * 100).toFixed(2))
    : 0;
  const monthTotal   = ms.totalRecords || 1;

  return {
    today: {
      present:        td.present    || 0,
      late:           td.late       || 0,
      OffDay:         td.OffDay     || 0,
      onLeave:        td.onLeave    || 0,
      totalHours:     parseFloat((td.totalHours   || 0).toFixed(2)),
      totalOtHours:   parseFloat((td.totalOtHours || 0).toFixed(2)),
      attendanceRate: todayAttRate,
    },
    thisWeek: {
      totalPresent:  wk.totalPresent  || 0,
      totalLate:     wk.totalLate     || 0,
      totalOffDay:   wk.totalOffDay   || 0,
      totalLeave:    wk.totalLeave    || 0,
      totalOtHours:  wk.totalOtHours  || 0,
      totalOtAmount: wk.totalOtAmount || 0,
    },
    thisMonth: {
      presentCount:    ms.presentCount    || 0,
      lateCount:       ms.lateCount       || 0,
      OffDayCount:     ms.OffDayCount     || 0,
      leaveCount:      ms.leaveCount      || 0,
      totalHours:      parseFloat((ms.totalHours      || 0).toFixed(2)),
      totalOtHours:    parseFloat((ms.totalOtHours    || 0).toFixed(2)),
      totalOtAmount:   parseFloat((ms.totalOtAmount   || 0).toFixed(2)),
      totalDeductions: parseFloat((ms.totalDeductions || 0).toFixed(2)),
      totalBasePay:    parseFloat((ms.totalBasePay    || 0).toFixed(2)),
      avgLateMinutes:  parseFloat((ms.avgLateMinutes  || 0).toFixed(1)),
      attendanceRate:  parseFloat((((ms.presentCount || 0) + (ms.leaveCount || 0)) / monthTotal * 100).toFixed(2)),
    },
    statusBreakdown:     statusBkd.reduce((a, c) => ({ ...a, [c._id]: c.count }), {}),
    departmentAttendance: deptAtt,
    lateTrends,
    averageHours: {
      perDay:      parseFloat((ms.avgHoursWorked || 0).toFixed(2)),
      otPerDay:    parseFloat((ms.avgOtHours     || 0).toFixed(2)),
      lateMinutes: parseFloat((ms.avgLateMinutes || 0).toFixed(1)),
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// getPayrollStats:
//   Original: 6 pipelines, 4 hitting startOfMonth.
//   Optimized: merged currentMonth + departmentPayroll + salaryDistribution
//   into ONE $facet scan. pending countDocuments kept separate (no aggregation
//   overhead). monthlyTrends and statusCounts kept separate (different ranges).
// ─────────────────────────────────────────────────────────────────────────────
async function getPayrollStats(startOfMonth, sixMonthsAgo) {
  const [monthFacet, monthlyTrends, statusCounts, pending] = await Promise.all([
    // ── $facet: currentMonth + departmentPayroll + salaryDistribution ─────────
    PayrollRecord.aggregate([
      { $match: { ...BASE, periodStart: { $gte: startOfMonth } } },
      {
        $facet: {
          summary: [
            {
              $group: {
                _id:                null,
                totalGross:         { $sum: '$baseSalary'       },
                totalNet:           { $sum: '$netSalary'        },
                totalDeductions:    { $sum: '$totalDeduction'   },
                totalOtAmount:      { $sum: '$totalOtAmount'    },
                totalOtHours:       { $sum: '$totalOtHours'     },
                totalHoursWorked:   { $sum: '$totalHoursWorked' },
                employeesProcessed: { $sum: 1                   },
                approved: { $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] } },
                paid:     { $sum: { $cond: [{ $eq: ['$status', 'paid']     }, 1, 0] } },
                draft:    { $sum: { $cond: [{ $eq: ['$status', 'draft']    }, 1, 0] } },
              },
            },
          ],
          departmentPayroll: [
            {
              $group: {
                _id:           '$department',
                totalPayroll:  { $sum: '$netSalary'    },
                employeeCount: { $sum: 1               },
                avgSalary:     { $avg: '$netSalary'    },
                totalOt:       { $sum: '$totalOtAmount'},
              },
            },
            { $sort: { totalPayroll: -1 } },
          ],
          salaryDistribution: [
            {
              $bucket: {
                groupBy:    '$netSalary',
                boundaries: [0, 20000, 40000, 60000, 80000, 100000, 150000],
                default:    '150000+',
                output: {
                  count:       { $sum: 1 },
                  totalAmount: { $sum: '$netSalary' },
                },
              },
            },
          ],
        },
      },
    ]),

    // ── Monthly trends (6 months) — different range, separate pipeline ────────
    PayrollRecord.aggregate([
      { $match: { ...BASE, periodStart: { $gte: sixMonthsAgo } } },
      {
        $group: {
          _id:           { year: { $year: '$periodStart' }, month: { $month: '$periodStart' } },
          totalNet:      { $sum: '$netSalary'      },
          totalGross:    { $sum: '$baseSalary'     },
          totalOt:       { $sum: '$totalOtAmount'  },
          totalDeduct:   { $sum: '$totalDeduction' },
          employeeCount: { $sum: 1                 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]),

    // ── Status distribution (all-time) ────────────────────────────────────────
    PayrollRecord.aggregate([
      { $match: BASE },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),

    // ── Pending count (countDocuments is faster than aggregate for a single num)
    PayrollRecord.countDocuments({ ...BASE, status: 'draft', periodStart: { $gte: startOfMonth } }),
  ]);

  const mf  = monthFacet[0]           || {};
  const cm  = mf.summary?.[0]         || {};
  const deptPayroll   = mf.departmentPayroll   || [];
  const salaryDistrib = mf.salaryDistribution  || [];

  const avgSalary = cm.employeesProcessed
    ? parseFloat((cm.totalNet / cm.employeesProcessed).toFixed(2))
    : 0;

  return {
    currentMonth: {
      totalGross:         parseFloat((cm.totalGross       || 0).toFixed(2)),
      totalNet:           parseFloat((cm.totalNet         || 0).toFixed(2)),
      totalDeductions:    parseFloat((cm.totalDeductions  || 0).toFixed(2)),
      totalOtAmount:      parseFloat((cm.totalOtAmount    || 0).toFixed(2)),
      totalOtHours:       parseFloat((cm.totalOtHours     || 0).toFixed(2)),
      totalHoursWorked:   parseFloat((cm.totalHoursWorked || 0).toFixed(2)),
      employeesProcessed: cm.employeesProcessed || 0,
      approved:           cm.approved           || 0,
      paid:               cm.paid               || 0,
      draft:              cm.draft              || 0,
      pending,
      avgSalary,
    },
    monthlyTrends,
    departmentWise:     deptPayroll,
    salaryDistribution: salaryDistrib,
    statusDistribution: statusCounts.reduce((a, c) => ({ ...a, [c._id]: c.count }), {}),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// getPerformanceStats — already optimal (5 pipelines, all parallel).
// Added $project to topPerformers to avoid fetching unused fields.
// ─────────────────────────────────────────────────────────────────────────────
async function getPerformanceStats(sixMonthsAgo) {
  const [overall, ratingDistribution, topPerformers, departmentPerf, trends] =
    await Promise.all([
      PerformanceRecord.aggregate([
        { $match: BASE },
        {
          $group: {
            _id:            null,
            avgScore:       { $avg: '$performanceScore' },
            avgAttendance:  { $avg: '$attendanceRate'   },
            avgPunctuality: { $avg: '$punctualityRate'  },
            totalEmployees: { $sum: 1                   },
            excellentCount: { $sum: { $cond: [{ $eq: ['$rating', 'Excellent'] }, 1, 0] } },
            goodCount:      { $sum: { $cond: [{ $eq: ['$rating', 'Good']      }, 1, 0] } },
            averageCount:   { $sum: { $cond: [{ $eq: ['$rating', 'Average']   }, 1, 0] } },
            poorCount:      { $sum: { $cond: [{ $eq: ['$rating', 'Poor']      }, 1, 0] } },
          },
        },
      ]),
      PerformanceRecord.aggregate([
        { $match: BASE },
        {
          $group: {
            _id:      '$rating',
            count:    { $sum: 1 },
            avgScore: { $avg: '$performanceScore' },
          },
        },
      ]),
      PerformanceRecord.aggregate([
        { $match: BASE },
        { $sort: { performanceScore: -1 } },
        { $limit: 10 },
        {
          $project: {
            empName: 1, empNumber: 1, department: 1,
            performanceScore: 1, rating: 1,
            attendanceRate: 1, punctualityRate: 1,
            totalOtHours: 1, periodLabel: 1,
          },
        },
      ]),
      PerformanceRecord.aggregate([
        { $match: BASE },
        {
          $group: {
            _id:            '$department',
            avgScore:       { $avg: '$performanceScore' },
            avgAttendance:  { $avg: '$attendanceRate'   },
            avgPunctuality: { $avg: '$punctualityRate'  },
            employeeCount:  { $sum: 1                   },
            excellentCount: { $sum: { $cond: [{ $eq: ['$rating', 'Excellent'] }, 1, 0] } },
            poorCount:      { $sum: { $cond: [{ $eq: ['$rating', 'Poor']      }, 1, 0] } },
          },
        },
        { $sort: { avgScore: -1 } },
      ]),
      PerformanceRecord.aggregate([
        { $match: { ...BASE, periodStart: { $gte: sixMonthsAgo } } },
        {
          $group: {
            _id:            '$periodLabel',
            avgScore:       { $avg: '$performanceScore' },
            avgAttendance:  { $avg: '$attendanceRate'   },
            avgPunctuality: { $avg: '$punctualityRate'  },
            employeeCount:  { $sum: 1                   },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

  const ov = overall[0] || {};
  return {
    overall: {
      averageScore:       parseFloat((ov.avgScore       || 0).toFixed(2)),
      averageAttendance:  parseFloat((ov.avgAttendance  || 0).toFixed(2)),
      averagePunctuality: parseFloat((ov.avgPunctuality || 0).toFixed(2)),
      totalEmployees:     ov.totalEmployees || 0,
      excellentCount:     ov.excellentCount || 0,
      goodCount:          ov.goodCount      || 0,
      averageCount:       ov.averageCount   || 0,
      poorCount:          ov.poorCount      || 0,
    },
    ratingDistribution: ratingDistribution.reduce(
      (a, c) => ({ ...a, [c._id]: { count: c.count, avgScore: c.avgScore } }), {}
    ),
    topPerformers,
    departmentPerformance: departmentPerf,
    performanceTrends:     trends,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// getLeaveStats — merged pendingRequests into $facet with the other month queries
// so the startOfMonth filter scans once instead of twice.
// ─────────────────────────────────────────────────────────────────────────────
async function getLeaveStats(startOfMonth, sixMonthsAgo) {
  const [globalFacet, monthlyTrends] = await Promise.all([
    // ── summary + typeDistribution + departmentStats + pendingRequests — 1 scan
    LeaveRequest.aggregate([
      { $match: BASE },
      {
        $facet: {
          summary: [
            {
              $group: {
                _id:            null,
                totalRequests:  { $sum: 1 },
                approved:       { $sum: { $cond: [{ $eq: ['$status', 'Approved'] }, 1, 0] } },
                rejected:       { $sum: { $cond: [{ $eq: ['$status', 'Rejected'] }, 1, 0] } },
                pending:        { $sum: { $cond: [{ $eq: ['$status', 'Pending']  }, 1, 0] } },
                totalLeaveDays: { $sum: '$totalDays' },
              },
            },
          ],
          typeDistribution: [
            {
              $group: {
                _id:       '$leaveType',
                count:     { $sum: 1 },
                totalDays: { $sum: '$totalDays' },
              },
            },
          ],
          pendingRequests: [
            { $match:  { status: 'Pending' } },
            { $sort:   { createdAt: -1 } },
            { $limit:  10 },
            {
              $project: {
                empName: 1, empNumber: 1, department: 1,
                leaveType: 1, fromDate: 1, toDate: 1,
                totalDays: 1, reason: 1, createdAt: 1,
              },
            },
          ],
          departmentWise: [
            { $match: { fromDate: { $gte: startOfMonth }, status: 'Approved' } },
            {
              $group: {
                _id:            '$department',
                totalLeaveDays: { $sum: '$totalDays' },
                totalRequests:  { $sum: 1            },
              },
            },
            { $sort: { totalLeaveDays: -1 } },
          ],
        },
      },
    ]),

    // ── Monthly trends — different date field ($fromDate), kept separate ───────
    LeaveRequest.aggregate([
      { $match: { ...BASE, fromDate: { $gte: sixMonthsAgo } } },
      {
        $group: {
          _id:           { year: { $year: '$fromDate' }, month: { $month: '$fromDate' } },
          totalRequests: { $sum: 1 },
          totalDays:     { $sum: '$totalDays' },
          approved:      { $sum: { $cond: [{ $eq: ['$status', 'Approved'] }, 1, 0] } },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]),
  ]);

  const gf  = globalFacet[0] || {};
  const s   = gf.summary?.[0] || {};
  const approvalRate = s.totalRequests
    ? parseFloat(((s.approved / s.totalRequests) * 100).toFixed(2))
    : 0;

  return {
    summary: {
      totalRequests:  s.totalRequests  || 0,
      approved:       s.approved       || 0,
      rejected:       s.rejected       || 0,
      pending:        s.pending        || 0,
      totalLeaveDays: s.totalLeaveDays || 0,
      approvalRate,
    },
    typeDistribution: gf.typeDistribution || [],
    monthlyTrends,
    pendingRequests:  gf.pendingRequests  || [],
    departmentWise:   gf.departmentWise   || [],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// getCorrectionStats — already 4 parallel pipelines, already good.
// Minor: fold pendingCorrections into a $facet with the other BASE queries.
// ─────────────────────────────────────────────────────────────────────────────
async function getCorrectionStats(sixMonthsAgo) {
  const [globalFacet, monthlyTrends] = await Promise.all([
    CorrectionRequest.aggregate([
      { $match: BASE },
      {
        $facet: {
          summary: [
            {
              $group: {
                _id:           null,
                total:         { $sum: 1 },
                approved:      { $sum: { $cond: [{ $eq: ['$status', 'Approved'] }, 1, 0] } },
                rejected:      { $sum: { $cond: [{ $eq: ['$status', 'Rejected'] }, 1, 0] } },
                pending:       { $sum: { $cond: [{ $eq: ['$status', 'Pending']  }, 1, 0] } },
                fromEmployees: { $sum: { $cond: [{ $eq: ['$source', 'employee'] }, 1, 0] } },
                fromAdmin:     { $sum: { $cond: [{ $eq: ['$source', 'admin']    }, 1, 0] } },
              },
            },
          ],
          typeDistribution: [
            { $group: { _id: '$correctionType', count: { $sum: 1 } } },
          ],
          pendingCorrections: [
            { $match: { status: 'Pending' } },
            { $sort:  { createdAt: -1 } },
            { $limit: 10 },
            {
              $project: {
                empName: 1, empNumber: 1, department: 1,
                date: 1, correctionType: 1, reason: 1, createdAt: 1,
              },
            },
          ],
        },
      },
    ]),

    CorrectionRequest.aggregate([
      { $match: { ...BASE, createdAt: { $gte: sixMonthsAgo } } },
      {
        $group: {
          _id:      { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
          total:    { $sum: 1 },
          approved: { $sum: { $cond: [{ $eq: ['$status', 'Approved'] }, 1, 0] } },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]),
  ]);

  const gf = globalFacet[0] || {};
  const s  = gf.summary?.[0] || {};

  return {
    summary: {
      total:         s.total         || 0,
      approved:      s.approved      || 0,
      rejected:      s.rejected      || 0,
      pending:       s.pending       || 0,
      fromEmployees: s.fromEmployees || 0,
      fromAdmin:     s.fromAdmin     || 0,
      approvalRate:  s.total
        ? parseFloat(((s.approved / s.total) * 100).toFixed(2))
        : 0,
    },
    typeDistribution:   (gf.typeDistribution || []).reduce((a, c) => ({ ...a, [c._id]: c.count }), {}),
    monthlyTrends,
    pendingCorrections: gf.pendingCorrections || [],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// getRecentActivity — already optimal (4 parallel .find() with select + limit).
// ─────────────────────────────────────────────────────────────────────────────
async function getRecentActivity() {
  const [payroll, leaves, corrections, employees] = await Promise.all([
    PayrollRecord.find({ isDeleted: false, approvedAt: { $ne: null } })
      .sort({ approvedAt: -1 }).limit(5)
      .select('empName periodLabel status approvedAt netSalary department')
      .lean(),
    LeaveRequest.find({ isDeleted: false, approvedAt: { $ne: null } })
      .sort({ approvedAt: -1 }).limit(5)
      .select('empName leaveType fromDate toDate status approvedAt department')
      .lean(),
    CorrectionRequest.find({ isDeleted: false, approvedAt: { $ne: null } })
      .sort({ approvedAt: -1 }).limit(5)
      .select('empName correctionType date status approvedAt department')
      .lean(),
    Employee.find({ isDeleted: false })
      .sort({ createdAt: -1 }).limit(5)
      .select('firstName lastName employeeNumber department role createdAt status')
      .lean(),
  ]);

  return [
    ...payroll.map(p => ({
      type:        'payroll',
      description: `Payroll ${p.status} — ${p.empName} (${p.periodLabel})`,
      amount:      p.netSalary,
      department:  p.department,
      timestamp:   p.approvedAt,
    })),
    ...leaves.map(l => ({
      type:        'leave',
      description: `${l.leaveType} ${l.status} — ${l.empName}`,
      department:  l.department,
      timestamp:   l.approvedAt,
    })),
    ...corrections.map(c => ({
      type:        'correction',
      description: `${c.correctionType} correction ${c.status} — ${c.empName}`,
      department:  c.department,
      timestamp:   c.approvedAt,
    })),
    ...employees.map(e => ({
      type:        'employee',
      description: `New employee: ${e.firstName} ${e.lastName} (${e.employeeNumber})`,
      department:  e.department,
      timestamp:   e.createdAt,
    })),
  ]
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, 20);
}

export default router;