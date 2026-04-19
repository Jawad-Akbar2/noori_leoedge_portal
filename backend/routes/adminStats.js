// routes/statsRoutes.js
// Optimized: all aggregations run in parallel, lean projections, no unnecessary lookups

import express from 'express';
import Employee from '../models/Employee.js';
import AttendanceLog from '../models/AttendanceLog.js';
import PayrollRecord from '../models/PayrollRecord.js';
import PerformanceRecord from '../models/PerformanceRecord.js';
import LeaveRequest from '../models/LeaveRequest.js';
import CorrectionRequest from '../models/CorrectionRequest.js';
import { adminAuth } from '../middleware/auth.js';

const router = express.Router();

/**
 * GET /api/stats/system
 * SuperAdmin / Admin / Owner dashboard – full system statistics.
 * All aggregations run in a single Promise.all for maximum speed.
 */
router.get('/system', adminAuth, async (req, res) => {
  try {
    const now = new Date();
    const startOfToday  = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth  = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfWeek   = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    // Six months ago (for trends)
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
        timestamp: now,
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
  const BASE = { isDeleted: false };

  const [summary, departmentWise, roleWise, salaryTypeWise, joiningTrends, leftStats, newThisMonth] =
    await Promise.all([
      // ── Summary counts ────────────────────────────────────────────────────
      Employee.aggregate([
        { $match: BASE },
        {
          $group: {
            _id: null,
            total:        { $sum: 1 },
            active:       { $sum: { $cond: [{ $eq: ['$status', 'Active']   }, 1, 0] } },
            inactive:     { $sum: { $cond: [{ $eq: ['$status', 'Inactive'] }, 1, 0] } },
            frozen:       { $sum: { $cond: [{ $eq: ['$status', 'Frozen']   }, 1, 0] } },
            leftBusiness: { $sum: { $cond: ['$leftBusiness.isLeft', 1, 0]              } },
            hourly:       { $sum: { $cond: [{ $eq: ['$salaryType', 'hourly']  }, 1, 0] } },
            monthly:      { $sum: { $cond: [{ $eq: ['$salaryType', 'monthly'] }, 1, 0] } },
          },
        },
      ]),

      // ── Department breakdown ──────────────────────────────────────────────
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

      // ── Role breakdown ────────────────────────────────────────────────────
      Employee.aggregate([
        { $match: BASE },
        { $group: { _id: '$role', count: { $sum: 1 } } },
      ]),

      // ── Salary type ───────────────────────────────────────────────────────
      Employee.aggregate([
        { $match: { ...BASE, salaryType: { $ne: null } } },
        { $group: { _id: '$salaryType', count: { $sum: 1 } } },
      ]),

      // ── Joining trends (6 months) ─────────────────────────────────────────
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

      // ── Employees who left ────────────────────────────────────────────────
      Employee.aggregate([
        { $match: { 'leftBusiness.isLeft': true, isDeleted: false } },
        {
          $group: {
            _id:            null,
            totalLeft:      { $sum: 1 },
            leftThisMonth:  {
              $sum: {
                $cond: [
                  { $gte: ['$leftBusiness.leftDate', startOfMonth] }, 1, 0,
                ],
              },
            },
          },
        },
      ]),

      // ── New hires this month ──────────────────────────────────────────────
      Employee.countDocuments({ ...BASE, createdAt: { $gte: startOfMonth } }),
    ]);

  const total       = summary[0]?.total       || 0;
  const totalLeft   = leftStats[0]?.totalLeft || 0;
  const turnoverRate = total > 0 ? parseFloat(((totalLeft / total) * 100).toFixed(2)) : 0;

  return {
    summary: {
      total,
      active:        summary[0]?.active        || 0,
      inactive:      summary[0]?.inactive      || 0,
      frozen:        summary[0]?.frozen        || 0,
      leftBusiness:  totalLeft,
      leftThisMonth: leftStats[0]?.leftThisMonth || 0,
      newThisMonth,
      turnoverRate,
      hourly:  summary[0]?.hourly  || 0,
      monthly: summary[0]?.monthly || 0,
    },
    departmentWise,
    roleWise:      roleWise.reduce((a, c) => ({ ...a, [c._id]: c.count }), {}),
    salaryTypeWise: salaryTypeWise.reduce((a, c) => ({ ...a, [c._id]: c.count }), {}),
    joiningTrends,
  };
}

// ─────────────────────────────────────────────────────────────────────────────

async function getAttendanceStats(startOfToday, startOfWeek, startOfMonth) {
  const BASE = { isDeleted: false };

  const [todayStats, weekStats, monthStats, statusBreakdown, departmentAttendance, lateTrends, avgHours] =
    await Promise.all([
      // ── Today ─────────────────────────────────────────────────────────────
      AttendanceLog.aggregate([
        { $match: { ...BASE, date: { $gte: startOfToday } } },
        {
          $group: {
            _id:         null,
            present:     { $sum: { $cond: [{ $in: ['$status', ['Present', 'Late']] }, 1, 0] } },
            late:        { $sum: { $cond: [{ $eq: ['$status', 'Late']    }, 1, 0] } },
            OffDay:      { $sum: { $cond: [{ $eq: ['$status', 'OffDay'] }, 1, 0] } },
            onLeave:     { $sum: { $cond: [{ $eq: ['$status', 'Leave']  }, 1, 0] } },
            ncns:        { $sum: { $cond: [{ $eq: ['$status', 'NCNS']  }, 1, 0] } },
            totalHours:  { $sum: '$financials.hoursWorked' },
            totalOtHours:{ $sum: '$financials.otHours' },
          },
        },
      ]),

      // ── This week ─────────────────────────────────────────────────────────
      AttendanceLog.aggregate([
        { $match: { ...BASE, date: { $gte: startOfWeek } } },
        {
          $group: {
            _id:          null,
            totalPresent: { $sum: { $cond: [{ $in: ['$status', ['Present', 'Late']] }, 1, 0] } },
            totalLate:    { $sum: { $cond: [{ $eq: ['$status', 'Late']    }, 1, 0] } },
            totalOffDay:  { $sum: { $cond: [{ $eq: ['$status', 'OffDay'] }, 1, 0] } },
            totalLeave:   { $sum: { $cond: [{ $eq: ['$status', 'Leave']  }, 1, 0] } },
            totalNcns:    { $sum: { $cond: [{ $eq: ['$status', 'NCNS']  }, 1, 0] } },
            totalOtHours: { $sum: '$financials.otHours' },
            totalOtAmount:{ $sum: '$financials.otAmount' },
          },
        },
      ]),

      // ── This month ────────────────────────────────────────────────────────
      AttendanceLog.aggregate([
        { $match: { ...BASE, date: { $gte: startOfMonth } } },
        {
          $group: {
            _id:             null,
            totalRecords:    { $sum: 1 },
            presentCount:    { $sum: { $cond: [{ $in: ['$status', ['Present', 'Late']] }, 1, 0] } },
            lateCount:       { $sum: { $cond: [{ $eq: ['$status', 'Late']    }, 1, 0] } },
            OffDayCount:     { $sum: { $cond: [{ $eq: ['$status', 'OffDay'] }, 1, 0] } },
            leaveCount:      { $sum: { $cond: [{ $eq: ['$status', 'Leave']  }, 1, 0] } },
            ncnsCount:       { $sum: { $cond: [{ $eq: ['$status', 'NCNS']  }, 1, 0] } },
            totalHours:      { $sum: '$financials.hoursWorked' },
            totalOtHours:    { $sum: '$financials.otHours' },
            totalOtAmount:   { $sum: '$financials.otAmount' },
            totalDeductions: { $sum: '$financials.deduction' },
            totalBasePay:    { $sum: '$financials.basePay' },
            avgLateMinutes:  { $avg: '$financials.lateMinutes' },
          },
        },
      ]),

      // ── Status breakdown (month) ──────────────────────────────────────────
      AttendanceLog.aggregate([
        { $match: { ...BASE, date: { $gte: startOfMonth } } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),

      // ── Department attendance rate (month) ────────────────────────────────
      AttendanceLog.aggregate([
        { $match: { ...BASE, date: { $gte: startOfMonth } } },
        {
          $group: {
            _id:          '$department',
            total:        { $sum: 1 },
            presentCount: { $sum: { $cond: [{ $in: ['$status', ['Present', 'Late', 'Leave']] }, 1, 0] } },
            ncnsCount:    { $sum: { $cond: [{ $eq: ['$status', 'NCNS']  }, 1, 0] } },
            totalHours:   { $sum: '$financials.hoursWorked' },
            totalOtHours: { $sum: '$financials.otHours' },
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
      ]),

      // ── Late trends (last 7 days) ─────────────────────────────────────────
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

      // ── Avg hours / OT (month) ────────────────────────────────────────────
      AttendanceLog.aggregate([
        { $match: { ...BASE, date: { $gte: startOfMonth } } },
        {
          $group: {
            _id:           null,
            avgHoursWorked:{ $avg: '$financials.hoursWorked' },
            avgOtHours:    { $avg: '$financials.otHours' },
            avgLateMinutes:{ $avg: '$financials.lateMinutes' },
          },
        },
      ]),
    ]);

  const td = todayStats[0] || {};
  const todayTotal = (td.present || 0) + (td.OffDay || 0) + (td.onLeave || 0);
  const todayAttRate = todayTotal > 0
    ? parseFloat((((td.present || 0) / todayTotal) * 100).toFixed(2))
    : 0;

  const ms = monthStats[0] || {};
  const monthTotal = ms.totalRecords || 1;

  return {
    today: {
      present:        td.present   || 0,
      late:           td.late      || 0,
      OffDay:         td.OffDay    || 0,
      onLeave:        td.onLeave   || 0,
      totalHours:     parseFloat((td.totalHours  || 0).toFixed(2)),
      totalOtHours:   parseFloat((td.totalOtHours|| 0).toFixed(2)),
      attendanceRate: todayAttRate,
    },
    thisWeek: {
      totalPresent: weekStats[0]?.totalPresent  || 0,
      totalLate:    weekStats[0]?.totalLate     || 0,
      totalOffDay:  weekStats[0]?.totalOffDay   || 0,
      totalLeave:   weekStats[0]?.totalLeave    || 0,
      totalOtHours: weekStats[0]?.totalOtHours  || 0,
      totalOtAmount:weekStats[0]?.totalOtAmount || 0,
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
      attendanceRate:  parseFloat(((ms.presentCount + ms.leaveCount || 0) / monthTotal * 100).toFixed(2)),
    },
    statusBreakdown: statusBreakdown.reduce((a, c) => ({ ...a, [c._id]: c.count }), {}),
    departmentAttendance,
    lateTrends,
    averageHours: {
      perDay:     parseFloat((avgHours[0]?.avgHoursWorked  || 0).toFixed(2)),
      otPerDay:   parseFloat((avgHours[0]?.avgOtHours      || 0).toFixed(2)),
      lateMinutes:parseFloat((avgHours[0]?.avgLateMinutes  || 0).toFixed(1)),
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────

async function getPayrollStats(startOfMonth, sixMonthsAgo) {
  const BASE = { isDeleted: false };

  const [currentMonth, monthlyTrends, departmentPayroll, salaryDistribution, pending, statusCounts] =
    await Promise.all([
      // ── Current month totals ──────────────────────────────────────────────
      PayrollRecord.aggregate([
        { $match: { ...BASE, periodStart: { $gte: startOfMonth } } },
        {
          $group: {
            _id:               null,
            totalGross:        { $sum: '$baseSalary'     },
            totalNet:          { $sum: '$netSalary'      },
            totalDeductions:   { $sum: '$totalDeduction' },
            totalOtAmount:     { $sum: '$totalOtAmount'  },
            totalOtHours:      { $sum: '$totalOtHours'   },
            totalHoursWorked:  { $sum: '$totalHoursWorked' },
            employeesProcessed:{ $sum: 1                 },
            approved:          { $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] } },
            paid:              { $sum: { $cond: [{ $eq: ['$status', 'paid']     }, 1, 0] } },
            draft:             { $sum: { $cond: [{ $eq: ['$status', 'draft']    }, 1, 0] } },
          },
        },
      ]),

      // ── Monthly trends (6 months) ─────────────────────────────────────────
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

      // ── Department payroll (month) ────────────────────────────────────────
      PayrollRecord.aggregate([
        { $match: { ...BASE, periodStart: { $gte: startOfMonth } } },
        {
          $group: {
            _id:           '$department',
            totalPayroll:  { $sum: '$netSalary'   },
            employeeCount: { $sum: 1               },
            avgSalary:     { $avg: '$netSalary'    },
            totalOt:       { $sum: '$totalOtAmount'},
          },
        },
        { $sort: { totalPayroll: -1 } },
      ]),

      // ── Salary distribution buckets ───────────────────────────────────────
      PayrollRecord.aggregate([
        { $match: { ...BASE, periodStart: { $gte: startOfMonth } } },
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
      ]),

      // ── Pending (draft) count ─────────────────────────────────────────────
      PayrollRecord.countDocuments({ ...BASE, status: 'draft', periodStart: { $gte: startOfMonth } }),

      // ── Status distribution all-time ──────────────────────────────────────
      PayrollRecord.aggregate([
        { $match: BASE },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
    ]);

  const cm = currentMonth[0] || {};
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
    departmentWise: departmentPayroll,
    salaryDistribution,
    statusDistribution: statusCounts.reduce((a, c) => ({ ...a, [c._id]: c.count }), {}),
  };
}

// ─────────────────────────────────────────────────────────────────────────────

async function getPerformanceStats(sixMonthsAgo) {
  const BASE = { isDeleted: false };

  const [overall, ratingDistribution, topPerformers, departmentPerf, trends] =
    await Promise.all([
      // ── Overall averages ──────────────────────────────────────────────────
      PerformanceRecord.aggregate([
        { $match: BASE },
        {
          $group: {
            _id:              null,
            avgScore:         { $avg: '$performanceScore' },
            avgAttendance:    { $avg: '$attendanceRate'   },
            avgPunctuality:   { $avg: '$punctualityRate'  },
            totalEmployees:   { $sum: 1                   },
            excellentCount:   { $sum: { $cond: [{ $eq: ['$rating', 'Excellent'] }, 1, 0] } },
            goodCount:        { $sum: { $cond: [{ $eq: ['$rating', 'Good']      }, 1, 0] } },
            averageCount:     { $sum: { $cond: [{ $eq: ['$rating', 'Average']   }, 1, 0] } },
            poorCount:        { $sum: { $cond: [{ $eq: ['$rating', 'Poor']      }, 1, 0] } },
          },
        },
      ]),

      // ── Rating distribution ───────────────────────────────────────────────
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

      // ── Top 10 performers ─────────────────────────────────────────────────
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

      // ── Department averages ───────────────────────────────────────────────
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

      // ── Trends (6 periods) ────────────────────────────────────────────────
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
      averageScore:      parseFloat((ov.avgScore       || 0).toFixed(2)),
      averageAttendance: parseFloat((ov.avgAttendance  || 0).toFixed(2)),
      averagePunctuality:parseFloat((ov.avgPunctuality || 0).toFixed(2)),
      totalEmployees:    ov.totalEmployees || 0,
      excellentCount:    ov.excellentCount || 0,
      goodCount:         ov.goodCount      || 0,
      averageCount:      ov.averageCount   || 0,
      poorCount:         ov.poorCount      || 0,
    },
    ratingDistribution: ratingDistribution.reduce((a, c) => ({ ...a, [c._id]: { count: c.count, avgScore: c.avgScore } }), {}),
    topPerformers,
    departmentPerformance: departmentPerf,
    performanceTrends: trends,
  };
}

// ─────────────────────────────────────────────────────────────────────────────

async function getLeaveStats(startOfMonth, sixMonthsAgo) {
  const BASE = { isDeleted: false };

  const [summary, typeDistribution, monthlyTrends, pendingRequests, departmentStats] =
    await Promise.all([
      // ── Overall totals ────────────────────────────────────────────────────
      LeaveRequest.aggregate([
        { $match: BASE },
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
      ]),

      // ── Type distribution ─────────────────────────────────────────────────
      LeaveRequest.aggregate([
        { $match: BASE },
        {
          $group: {
            _id:       '$leaveType',
            count:     { $sum: 1 },
            totalDays: { $sum: '$totalDays' },
          },
        },
      ]),

      // ── Monthly trends (6 months) ─────────────────────────────────────────
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

      // ── Top 10 pending (lean projection) ─────────────────────────────────
      LeaveRequest.find({ status: 'Pending', isDeleted: false })
        .sort({ createdAt: -1 })
        .limit(10)
        .select('empName empNumber department leaveType fromDate toDate totalDays reason createdAt')
        .lean(),

      // ── Department stats (month, approved only) ───────────────────────────
      LeaveRequest.aggregate([
        { $match: { ...BASE, fromDate: { $gte: startOfMonth }, status: 'Approved' } },
        {
          $group: {
            _id:            '$department',
            totalLeaveDays: { $sum: '$totalDays' },
            totalRequests:  { $sum: 1             },
          },
        },
        { $sort: { totalLeaveDays: -1 } },
      ]),
    ]);

  const s = summary[0] || {};
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
    typeDistribution,
    monthlyTrends,
    pendingRequests,
    departmentWise: departmentStats,
  };
}

// ─────────────────────────────────────────────────────────────────────────────

async function getCorrectionStats(sixMonthsAgo) {
  const BASE = { isDeleted: false };

  const [summary, typeDistribution, monthlyTrends, pendingCorrections] =
    await Promise.all([
      // ── Overall totals ────────────────────────────────────────────────────
      CorrectionRequest.aggregate([
        { $match: BASE },
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
      ]),

      // ── Type distribution ─────────────────────────────────────────────────
      CorrectionRequest.aggregate([
        { $match: BASE },
        { $group: { _id: '$correctionType', count: { $sum: 1 } } },
      ]),

      // ── Monthly trends (6 months) ─────────────────────────────────────────
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

      // ── Top 10 pending (lean) ─────────────────────────────────────────────
      CorrectionRequest.find({ status: 'Pending', isDeleted: false })
        .sort({ createdAt: -1 })
        .limit(10)
        .select('empName empNumber department date correctionType reason createdAt')
        .lean(),
    ]);

  const s = summary[0] || {};
  return {
    summary: {
      total:         s.total         || 0,
      approved:      s.approved      || 0,
      rejected:      s.rejected      || 0,
      pending:       s.pending       || 0,
      fromEmployees: s.fromEmployees || 0,
      fromAdmin:     s.fromAdmin     || 0,
      approvalRate: s.total
        ? parseFloat(((s.approved / s.total) * 100).toFixed(2))
        : 0,
    },
    typeDistribution: typeDistribution.reduce((a, c) => ({ ...a, [c._id]: c.count }), {}),
    monthlyTrends,
    pendingCorrections,
  };
}

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

  const activities = [
    ...payroll.map(p => ({
      type: 'payroll',
      description: `Payroll ${p.status} — ${p.empName} (${p.periodLabel})`,
      amount: p.netSalary,
      department: p.department,
      timestamp: p.approvedAt,
    })),
    ...leaves.map(l => ({
      type: 'leave',
      description: `${l.leaveType} ${l.status} — ${l.empName}`,
      department: l.department,
      timestamp: l.approvedAt,
    })),
    ...corrections.map(c => ({
      type: 'correction',
      description: `${c.correctionType} correction ${c.status} — ${c.empName}`,
      department: c.department,
      timestamp: c.approvedAt,
    })),
    ...employees.map(e => ({
      type: 'employee',
      description: `New employee: ${e.firstName} ${e.lastName} (${e.employeeNumber})`,
      department: e.department,
      timestamp: e.createdAt,
    })),
  ];

  return activities
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, 20);
}

export default router;