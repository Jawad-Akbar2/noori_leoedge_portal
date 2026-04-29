// routes/employeeStatsRoute.js
import express           from 'express';
import AttendanceLog     from '../models/AttendanceLog.js';
import PayrollRecord     from '../models/PayrollRecord.js';
import PerformanceRecord from '../models/PerformanceRecord.js';
import LeaveRequest      from '../models/LeaveRequest.js';
import CorrectionRequest from '../models/CorrectionRequest.js';
import { employeeAuth }  from '../middleware/auth.js';

const router = express.Router();

/**
 * GET /api/stats/employee
 *
 * Optimizations vs original:
 *  - AttendanceLog: 4 pipelines → 2  (month+6m+week in $facet; today separate)
 *  - LeaveRequest:  4 pipelines → 1  ($facet)
 *  - CorrectionRequest: 2 → 1        ($facet)
 *  - currentPeriodPay absorbed into attendance $facet
 *  - Single BASE filter object reused everywhere
 *
 * Recommended indexes:
 *   AttendanceLog:     { empId: 1, date: 1, isDeleted: 1 }
 *   LeaveRequest:      { empId: 1, isDeleted: 1, createdAt: -1 }
 *   CorrectionRequest: { empId: 1, isDeleted: 1, createdAt: -1 }
 *   PayrollRecord:     { empId: 1, isDeleted: 1, periodStart: -1 }
 *   PerformanceRecord: { empId: 1, isDeleted: 1, periodStart: -1 }
 */
router.get('/employee', employeeAuth, async (req, res) => {
  try {
    const empId = req.user._id;
    const now   = new Date();

    // ── Time anchors ──────────────────────────────────────────────────────────
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const sixMonthsAgo = new Date(now);
    sixMonthsAgo.setMonth(now.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0, 0, 0, 0);

    // Company pay period: 18th prev month → 17th current month
    const { start: periodStart, end: periodEnd } = (() => {
      const d = now.getDate(), y = now.getFullYear(), m = now.getMonth();
      let start, end;
      if (d >= 18) {
        start = new Date(y, m,     18);
        end   = new Date(y, m + 1, 17, 23, 59, 59);
      } else {
        start = new Date(y, m - 1, 18);
        end   = new Date(y, m,     17, 23, 59, 59);
      }
      return { start, end: end > now ? now : end };
    })();

    // Single base filter — empId + isDeleted shared by every collection
    const BASE = { empId, isDeleted: false };

    // ── All queries in one top-level Promise.all ───────────────────────────────
    const [
      attFacet,         // attendance $facet (month + 6m + week + pay-period)
      todayRecord,      // today's single attendance doc
      payrollHistory,
      leaveFacet,       // leave $facet (summary + types + recent + trend)
      corrFacet,        // correction $facet (summary + recent)
      performanceStats,
    ] = await Promise.all([

      // ── 1. Attendance: one scan for month/6m/week/pay-period via $facet ──────
      AttendanceLog.aggregate([
        // Match the widest range needed (sixMonthsAgo covers everything)
        { $match: { ...BASE, date: { $gte: sixMonthsAgo } } },
        {
          $facet: {
            // Monthly summary
            month: [
              { $match: { date: { $gte: startOfMonth } } },
              {
                $group: {
                  _id:               null,
                  totalDays:         { $sum: 1 },
                  presentDays:       { $sum: { $cond: [{ $in: ['$status', ['Present', 'Late']] }, 1, 0] } },
                  lateDays:          { $sum: { $cond: [{ $eq: ['$status', 'Late']   }, 1, 0] } },
                  OffDayDays:        { $sum: { $cond: [{ $eq: ['$status', 'OffDay'] }, 1, 0] } },
                  leaveDays:         { $sum: { $cond: [{ $eq: ['$status', 'Leave']  }, 1, 0] } },
                  ncnsDays:          { $sum: { $cond: [{ $eq: ['$status', 'NCNS']   }, 1, 0] } },
                  totalHoursWorked:  { $sum: '$financials.hoursWorked'     },
                  totalOtHours:      { $sum: '$financials.otHours'         },
                  totalOtAmount:     { $sum: '$financials.otAmount'        },
                  totalDeductions:   { $sum: '$financials.deduction'       },
                  totalBasePay:      { $sum: '$financials.basePay'         },
                  totalFinalEarning: { $sum: '$financials.finalDayEarning' },
                  totalLateMinutes:  { $sum: '$financials.lateMinutes'     },
                  avgLateMinutes:    { $avg: '$financials.lateMinutes'     },
                },
              },
            ],
            // Current pay-period earnings (absorbed from separate pipeline)
            payPeriod: [
              { $match: { date: { $gte: periodStart, $lte: periodEnd } } },
              {
                $group: {
                  _id:              null,
                  daysWorked:       { $sum: { $cond: [{ $in: ['$status', ['Present', 'Late']] }, 1, 0] } },
                  totalHoursWorked: { $sum: '$financials.hoursWorked'     },
                  totalBasePay:     { $sum: '$financials.basePay'         },
                  totalDeductions:  { $sum: '$financials.deduction'       },
                  totalOtHours:     { $sum: '$financials.otHours'         },
                  totalOtAmount:    { $sum: '$financials.otAmount'        },
                  netEarnings:      { $sum: '$financials.finalDayEarning' },
                },
              },
            ],
            // This week summary
            week: [
              { $match: { date: { $gte: startOfWeek } } },
              {
                $group: {
                  _id:         null,
                  presentDays: { $sum: { $cond: [{ $in: ['$status', ['Present', 'Late']] }, 1, 0] } },
                  lateDays:    { $sum: { $cond: [{ $eq: ['$status', 'Late']   }, 1, 0] } },
                  OffDayDays:  { $sum: { $cond: [{ $eq: ['$status', 'OffDay'] }, 1, 0] } },
                  totalHours:  { $sum: '$financials.hoursWorked' },
                  otHours:     { $sum: '$financials.otHours'     },
                },
              },
            ],
            // 6-month monthly trend
            trend6m: [
              {
                $group: {
                  _id:         { year: { $year: '$date' }, month: { $month: '$date' } },
                  presentDays: { $sum: { $cond: [{ $in: ['$status', ['Present', 'Late']] }, 1, 0] } },
                  lateDays:    { $sum: { $cond: [{ $eq: ['$status', 'Late']   }, 1, 0] } },
                  OffDayDays:  { $sum: { $cond: [{ $eq: ['$status', 'OffDay'] }, 1, 0] } },
                  leaveDays:   { $sum: { $cond: [{ $eq: ['$status', 'Leave']  }, 1, 0] } },
                  ncnsDays:    { $sum: { $cond: [{ $eq: ['$status', 'NCNS']   }, 1, 0] } },
                  totalDays:   { $sum: 1 },
                  hoursWorked: { $sum: '$financials.hoursWorked' },
                  otHours:     { $sum: '$financials.otHours'     },
                },
              },
              { $sort: { '_id.year': 1, '_id.month': 1 } },
            ],
            // Recent 7 records
            recent7: [
              { $sort:  { date: -1 } },
              { $limit: 7 },
              {
                $project: {
                  date: 1, status: 1, inOut: 1, financials: 1, shift: 1,
                },
              },
            ],
          },
        },
      ]),

      // ── 2. Today's record (separate — startOfToday not in sixMonthsAgo range edge) ─
      AttendanceLog.findOne({ ...BASE, date: { $gte: startOfToday } })
        .select('status inOut financials shift')
        .lean(),

      // ── 3. Payroll history ────────────────────────────────────────────────────
      PayrollRecord.find(BASE)
        .sort({ periodStart: -1 })
        .limit(6)
        .select('periodLabel periodStart periodEnd netSalary baseSalary totalDeduction totalOtAmount totalOtHours totalHoursWorked presentDays lateDays OffDayDays leaveDays status')
        .lean(),

      // ── 4. Leave: all 4 sub-queries merged into one $facet ───────────────────
      LeaveRequest.aggregate([
        { $match: BASE },
        {
          $facet: {
            summary: [
              {
                $group: {
                  _id:            null,
                  total:          { $sum: 1 },
                  approved:       { $sum: { $cond: [{ $eq: ['$status', 'Approved'] }, 1, 0] } },
                  rejected:       { $sum: { $cond: [{ $eq: ['$status', 'Rejected'] }, 1, 0] } },
                  pending:        { $sum: { $cond: [{ $eq: ['$status', 'Pending']  }, 1, 0] } },
                  totalLeaveDays: { $sum: '$totalDays' },
                },
              },
            ],
            typeBreakdown: [
              {
                $group: {
                  _id:       '$leaveType',
                  count:     { $sum: 1 },
                  totalDays: { $sum: '$totalDays' },
                  approved:  { $sum: { $cond: [{ $eq: ['$status', 'Approved'] }, 1, 0] } },
                },
              },
            ],
            recent: [
              { $sort:  { createdAt: -1 } },
              { $limit: 5 },
              {
                $project: {
                  leaveType: 1, fromDate: 1, toDate: 1,
                  totalDays: 1, status: 1, reason: 1,
                  createdAt: 1, rejectionReason: 1,
                },
              },
            ],
            trend6m: [
              { $match: { fromDate: { $gte: sixMonthsAgo } } },
              {
                $group: {
                  _id:       { year: { $year: '$fromDate' }, month: { $month: '$fromDate' } },
                  count:     { $sum: 1 },
                  totalDays: { $sum: '$totalDays' },
                },
              },
              { $sort: { '_id.year': 1, '_id.month': 1 } },
            ],
          },
        },
      ]),

      // ── 5. Correction: summary + recent merged into $facet ───────────────────
      CorrectionRequest.aggregate([
        { $match: BASE },
        {
          $facet: {
            summary: [
              {
                $group: {
                  _id:      null,
                  total:    { $sum: 1 },
                  approved: { $sum: { $cond: [{ $eq: ['$status', 'Approved'] }, 1, 0] } },
                  rejected: { $sum: { $cond: [{ $eq: ['$status', 'Rejected'] }, 1, 0] } },
                  pending:  { $sum: { $cond: [{ $eq: ['$status', 'Pending']  }, 1, 0] } },
                },
              },
            ],
            recent: [
              { $sort:  { createdAt: -1 } },
              { $limit: 5 },
              {
                $project: {
                  date: 1, correctionType: 1,
                  originalInTime: 1, correctedInTime: 1,
                  originalOutTime: 1, correctedOutTime: 1,
                  status: 1, reason: 1, createdAt: 1, rejectionReason: 1,
                },
              },
            ],
          },
        },
      ]),

      // ── 6. Performance history ────────────────────────────────────────────────
      PerformanceRecord.find(BASE)
        .sort({ periodStart: -1 })
        .limit(6)
        .select('periodLabel periodStart performanceScore attendanceRate punctualityRate rating totalOtHours presentDays lateDays OffDayDays totalWorkingDays')
        .lean(),
    ]);

    // ── Unpack $facet results ─────────────────────────────────────────────────
    const af  = attFacet[0]  || {};   // attendance facet doc
    const lf  = leaveFacet[0] || {};  // leave facet doc
    const cf  = corrFacet[0]  || {};  // correction facet doc

    const monthSummary = af.month?.[0]     || {};
    const currentPay   = af.payPeriod?.[0] || {};
    const weekSummary  = af.week?.[0]      || {};
    const attTrend6m   = af.trend6m        || [];
    const recentAtt    = af.recent7        || [];

    const leaveSummary     = lf.summary?.[0]  || {};
    const leaveTypes       = lf.typeBreakdown || [];
    const recentLeaves     = lf.recent        || [];
    const leaveTrend6m     = lf.trend6m       || [];

    const corrSummary      = cf.summary?.[0]  || {};
    const recentCorrections = cf.recent       || [];

    // ── Derived rates ─────────────────────────────────────────────────────────
    const totalTracked   = (monthSummary.presentDays || 0) + (monthSummary.OffDayDays || 0) + (monthSummary.leaveDays || 0);
    const attendanceRate = totalTracked > 0
      ? parseFloat((((monthSummary.presentDays + monthSummary.leaveDays) / totalTracked) * 100).toFixed(1))
      : 0;
    const punctualityRate = (monthSummary.presentDays || 0) > 0
      ? parseFloat(((Math.max(0, (monthSummary.presentDays || 0) - (monthSummary.lateDays || 0)) / monthSummary.presentDays) * 100).toFixed(1))
      : 100;

    res.status(200).json({
      success: true,
      data: {
        timestamp: now,

        currentPeriod: {
          periodStart,
          periodEnd,
          daysWorked:       currentPay.daysWorked       || 0,
          totalHoursWorked: parseFloat((currentPay.totalHoursWorked || 0).toFixed(2)),
          totalBasePay:     parseFloat((currentPay.totalBasePay     || 0).toFixed(2)),
          totalDeductions:  parseFloat((currentPay.totalDeductions  || 0).toFixed(2)),
          totalOtHours:     parseFloat((currentPay.totalOtHours     || 0).toFixed(2)),
          totalOtAmount:    parseFloat((currentPay.totalOtAmount    || 0).toFixed(2)),
          netEarnings:      parseFloat((currentPay.netEarnings      || 0).toFixed(2)),
        },

        attendance: {
          today: todayRecord ? {
            status:       todayRecord.status,
            inTime:       todayRecord.inOut?.in              || null,
            outTime:      todayRecord.inOut?.out             || null,
            hoursWorked:  todayRecord.financials?.hoursWorked    || 0,
            lateMinutes:  todayRecord.financials?.lateMinutes    || 0,
            otHours:      todayRecord.financials?.otHours        || 0,
            basePay:      todayRecord.financials?.basePay        || 0,
            deduction:    todayRecord.financials?.deduction      || 0,
            finalEarning: todayRecord.financials?.finalDayEarning || 0,
          } : null,
          thisWeek: {
            presentDays: weekSummary.presentDays || 0,
            lateDays:    weekSummary.lateDays    || 0,
            OffDayDays:  weekSummary.OffDayDays  || 0,
            totalHours:  parseFloat((weekSummary.totalHours || 0).toFixed(2)),
            otHours:     parseFloat((weekSummary.otHours    || 0).toFixed(2)),
          },
          thisMonth: {
            presentDays:      monthSummary.presentDays      || 0,
            lateDays:         monthSummary.lateDays         || 0,
            OffDayDays:       monthSummary.OffDayDays       || 0,
            leaveDays:        monthSummary.leaveDays        || 0,
            totalHoursWorked: parseFloat((monthSummary.totalHoursWorked  || 0).toFixed(2)),
            totalOtHours:     parseFloat((monthSummary.totalOtHours      || 0).toFixed(2)),
            totalOtAmount:    parseFloat((monthSummary.totalOtAmount     || 0).toFixed(2)),
            totalDeductions:  parseFloat((monthSummary.totalDeductions   || 0).toFixed(2)),
            totalBasePay:     parseFloat((monthSummary.totalBasePay      || 0).toFixed(2)),
            netEarning:       parseFloat((monthSummary.totalFinalEarning || 0).toFixed(2)),
            totalLateMinutes: monthSummary.totalLateMinutes || 0,
            avgLateMinutes:   parseFloat((monthSummary.avgLateMinutes    || 0).toFixed(1)),
            attendanceRate,
            punctualityRate,
          },
          trend6Months:  attTrend6m,
          recentRecords: recentAtt,
        },

        payroll: {
          history: payrollHistory,
        },

        leaves: {
          summary: {
            total:          leaveSummary.total          || 0,
            approved:       leaveSummary.approved       || 0,
            rejected:       leaveSummary.rejected       || 0,
            pending:        leaveSummary.pending        || 0,
            totalLeaveDays: leaveSummary.totalLeaveDays || 0,
            approvalRate: leaveSummary.total
              ? parseFloat(((leaveSummary.approved / leaveSummary.total) * 100).toFixed(1))
              : 0,
          },
          typeBreakdown: leaveTypes,
          recent:        recentLeaves,
          trend6Months:  leaveTrend6m,
        },

        corrections: {
          summary: {
            total:    corrSummary.total    || 0,
            approved: corrSummary.approved || 0,
            rejected: corrSummary.rejected || 0,
            pending:  corrSummary.pending  || 0,
            approvalRate: corrSummary.total
              ? parseFloat(((corrSummary.approved / corrSummary.total) * 100).toFixed(1))
              : 0,
          },
          recent: recentCorrections,
        },

        performance: {
          latest:  performanceStats[0] || null,
          history: performanceStats,
        },
      },
    });
  } catch (error) {
    console.error('Employee stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch employee stats',
      error:   error.message,
    });
  }
});

export default router;