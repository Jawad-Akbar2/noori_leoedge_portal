// routes/employeeStatsRoute.js
// Employee-facing personal stats endpoint — parallel aggregations, lean projections

import express from 'express';
import AttendanceLog from '../models/AttendanceLog.js';
import PayrollRecord from '../models/PayrollRecord.js';
import PerformanceRecord from '../models/PerformanceRecord.js';
import LeaveRequest from '../models/LeaveRequest.js';
import CorrectionRequest from '../models/CorrectionRequest.js';
import { employeeAuth } from '../middleware/auth.js';

const router = express.Router();

/**
 * GET /api/stats/employee
 * Authenticated employee — returns only that employee's personal statistics.
 * Uses req.user._id (set by employeeAuth middleware).
 *
 * All aggregations run in parallel for max speed.
 */
router.get('/employee', employeeAuth, async (req, res) => {
  try {
    const empId = req.user._id;
    const now   = new Date();

    // ── Time anchors ────────────────────────────────────────────────────────
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek  = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Six months back (for trends)
    const sixMonthsAgo = new Date(now);
    sixMonthsAgo.setMonth(now.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0, 0, 0, 0);

    // Company pay period: 18th prev month → 17th current month
    const buildPayPeriod = () => {
      const d = now.getDate();
      const y = now.getFullYear();
      const m = now.getMonth();
      let start, end;
      if (d >= 18) {
        start = new Date(y, m, 18);
        end   = new Date(y, m + 1, 17, 23, 59, 59);
      } else {
        start = new Date(y, m - 1, 18);
        end   = new Date(y, m, 17, 23, 59, 59);
      }
      return { start, end: end > now ? now : end };
    };
    const { start: periodStart, end: periodEnd } = buildPayPeriod();

    // ── Base filters ─────────────────────────────────────────────────────────
    const BASE_ATT = { empId, isDeleted: false };
    const BASE_PAY = { empId, isDeleted: false };
    const BASE_LVE = { empId, isDeleted: false };
    const BASE_COR = { empId, isDeleted: false };
    const BASE_PRF = { empId, isDeleted: false };

    const [
      attendanceStats,
      currentPeriodPay,
      payrollHistory,
      leaveStats,
      correctionStats,
      performanceStats,
      recentAttendance,
    ] = await Promise.all([

      // ── 1. Attendance overview ─────────────────────────────────────────────
      Promise.all([
        // Monthly summary
        AttendanceLog.aggregate([
          { $match: { ...BASE_ATT, date: { $gte: startOfMonth } } },
          {
            $group: {
              _id:                null,
              totalDays:          { $sum: 1 },
              presentDays:        { $sum: { $cond: [{ $in: ['$status', ['Present', 'Late']] }, 1, 0] } },
              lateDays:           { $sum: { $cond: [{ $eq: ['$status', 'Late']    }, 1, 0] } },
              absentDays:         { $sum: { $cond: [{ $eq: ['$status', 'Absent'] }, 1, 0] } },
              leaveDays:          { $sum: { $cond: [{ $eq: ['$status', 'Leave']  }, 1, 0] } },
              totalHoursWorked:   { $sum: '$financials.hoursWorked'    },
              totalOtHours:       { $sum: '$financials.otHours'        },
              totalOtAmount:      { $sum: '$financials.otAmount'       },
              totalDeductions:    { $sum: '$financials.deduction'      },
              totalBasePay:       { $sum: '$financials.basePay'        },
              totalFinalEarning:  { $sum: '$financials.finalDayEarning'},
              totalLateMinutes:   { $sum: '$financials.lateMinutes'    },
              avgLateMinutes:     { $avg: '$financials.lateMinutes'    },
            },
          },
        ]),

        // 6-month attendance trend
        AttendanceLog.aggregate([
          { $match: { ...BASE_ATT, date: { $gte: sixMonthsAgo } } },
          {
            $group: {
              _id:          { year: { $year: '$date' }, month: { $month: '$date' } },
              presentDays:  { $sum: { $cond: [{ $in: ['$status', ['Present', 'Late']] }, 1, 0] } },
              lateDays:     { $sum: { $cond: [{ $eq: ['$status', 'Late']   }, 1, 0] } },
              absentDays:   { $sum: { $cond: [{ $eq: ['$status', 'Absent']}, 1, 0] } },
              leaveDays:    { $sum: { $cond: [{ $eq: ['$status', 'Leave'] }, 1, 0] } },
              totalDays:    { $sum: 1 },
              hoursWorked:  { $sum: '$financials.hoursWorked' },
              otHours:      { $sum: '$financials.otHours'     },
            },
          },
          { $sort: { '_id.year': 1, '_id.month': 1 } },
        ]),

        // Weekly summary (current week)
        AttendanceLog.aggregate([
          { $match: { ...BASE_ATT, date: { $gte: startOfWeek } } },
          {
            $group: {
              _id:          null,
              presentDays:  { $sum: { $cond: [{ $in: ['$status', ['Present', 'Late']] }, 1, 0] } },
              lateDays:     { $sum: { $cond: [{ $eq: ['$status', 'Late']   }, 1, 0] } },
              absentDays:   { $sum: { $cond: [{ $eq: ['$status', 'Absent']}, 1, 0] } },
              totalHours:   { $sum: '$financials.hoursWorked' },
              otHours:      { $sum: '$financials.otHours'     },
            },
          },
        ]),

        // Today's record
        AttendanceLog.findOne({ empId, isDeleted: false, date: { $gte: startOfToday } })
          .select('status inOut financials shift')
          .lean(),
      ]),

      // ── 2. Current pay-period earnings (from AttendanceLogs) ──────────────
      AttendanceLog.aggregate([
        { $match: { ...BASE_ATT, date: { $gte: periodStart, $lte: periodEnd } } },
        {
          $group: {
            _id:               null,
            daysWorked:        { $sum: { $cond: [{ $in: ['$status', ['Present', 'Late']] }, 1, 0] } },
            totalHoursWorked:  { $sum: '$financials.hoursWorked'     },
            totalBasePay:      { $sum: '$financials.basePay'         },
            totalDeductions:   { $sum: '$financials.deduction'       },
            totalOtHours:      { $sum: '$financials.otHours'         },
            totalOtAmount:     { $sum: '$financials.otAmount'        },
            netEarnings:       { $sum: '$financials.finalDayEarning' },
          },
        },
      ]),

      // ── 3. Payroll history (last 6 paid/approved records) ─────────────────
      PayrollRecord.find({ ...BASE_PAY })
        .sort({ periodStart: -1 })
        .limit(6)
        .select('periodLabel periodStart periodEnd netSalary baseSalary totalDeduction totalOtAmount totalOtHours totalHoursWorked presentDays lateDays absentDays leaveDays status')
        .lean(),

      // ── 4. Leave stats ────────────────────────────────────────────────────
      Promise.all([
        LeaveRequest.aggregate([
          { $match: BASE_LVE },
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
        ]),

        // Type breakdown
        LeaveRequest.aggregate([
          { $match: BASE_LVE },
          {
            $group: {
              _id:       '$leaveType',
              count:     { $sum: 1 },
              totalDays: { $sum: '$totalDays' },
              approved:  { $sum: { $cond: [{ $eq: ['$status', 'Approved'] }, 1, 0] } },
            },
          },
        ]),

        // Recent 5 leave requests
        LeaveRequest.find({ ...BASE_LVE })
          .sort({ createdAt: -1 })
          .limit(5)
          .select('leaveType fromDate toDate totalDays status reason createdAt rejectionReason')
          .lean(),

        // 6-month leave trend
        LeaveRequest.aggregate([
          { $match: { ...BASE_LVE, fromDate: { $gte: sixMonthsAgo } } },
          {
            $group: {
              _id:       { year: { $year: '$fromDate' }, month: { $month: '$fromDate' } },
              count:     { $sum: 1 },
              totalDays: { $sum: '$totalDays' },
            },
          },
          { $sort: { '_id.year': 1, '_id.month': 1 } },
        ]),
      ]),

      // ── 5. Correction stats ───────────────────────────────────────────────
      Promise.all([
        CorrectionRequest.aggregate([
          { $match: BASE_COR },
          {
            $group: {
              _id:      null,
              total:    { $sum: 1 },
              approved: { $sum: { $cond: [{ $eq: ['$status', 'Approved'] }, 1, 0] } },
              rejected: { $sum: { $cond: [{ $eq: ['$status', 'Rejected'] }, 1, 0] } },
              pending:  { $sum: { $cond: [{ $eq: ['$status', 'Pending']  }, 1, 0] } },
            },
          },
        ]),

        // Recent 5 corrections
        CorrectionRequest.find({ ...BASE_COR })
          .sort({ createdAt: -1 })
          .limit(5)
          .select('date correctionType originalInTime correctedInTime originalOutTime correctedOutTime status reason createdAt rejectionReason')
          .lean(),
      ]),

      // ── 6. Performance record (most recent) ───────────────────────────────
      PerformanceRecord.find({ ...BASE_PRF })
        .sort({ periodStart: -1 })
        .limit(6)
        .select('periodLabel periodStart performanceScore attendanceRate punctualityRate rating totalOtHours presentDays lateDays absentDays totalWorkingDays')
        .lean(),

      // ── 7. Recent 7 attendance records ────────────────────────────────────
      AttendanceLog.find({ ...BASE_ATT })
        .sort({ date: -1 })
        .limit(7)
        .select('date status inOut financials shift')
        .lean(),
    ]);

    // ── Destructure parallel results ─────────────────────────────────────────
    const [monthSummaryArr, attTrend6m, weekSummaryArr, todayRecord] = attendanceStats;
    const [leaveSummaryArr, leaveTypes, recentLeaves, leaveTrend6m]  = leaveStats;
    const [corrSummaryArr, recentCorrections]                        = correctionStats;

    const monthSummary = monthSummaryArr[0] || {};
    const weekSummary  = weekSummaryArr[0]  || {};
    const leaveSummary = leaveSummaryArr[0] || {};
    const corrSummary  = corrSummaryArr[0]  || {};
    const currentPay   = currentPeriodPay[0] || {};

    // ── Compute attendance rate this month ────────────────────────────────────
    const totalTracked = (monthSummary.presentDays || 0) + (monthSummary.absentDays || 0) + (monthSummary.leaveDays || 0);
    const attendanceRate = totalTracked > 0
      ? parseFloat((((monthSummary.presentDays + monthSummary.leaveDays) / totalTracked) * 100).toFixed(1))
      : 0;

    const punctualityRate = (monthSummary.presentDays || 0) > 0
      ? parseFloat(((Math.max(0, (monthSummary.presentDays || 0) - (monthSummary.lateDays || 0)) / monthSummary.presentDays) * 100).toFixed(1))
      : 100;

    // ── Most recent performance record ────────────────────────────────────────
    const latestPerf = performanceStats[0] || null;

    res.status(200).json({
      success: true,
      data: {
        timestamp: now,

        // ── Current pay period ─────────────────────────────────────────────
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

        // ── Attendance ────────────────────────────────────────────────────
        attendance: {
          today: todayRecord
            ? {
                status:       todayRecord.status,
                inTime:       todayRecord.inOut?.in     || null,
                outTime:      todayRecord.inOut?.out    || null,
                hoursWorked:  todayRecord.financials?.hoursWorked  || 0,
                lateMinutes:  todayRecord.financials?.lateMinutes  || 0,
                otHours:      todayRecord.financials?.otHours      || 0,
                basePay:      todayRecord.financials?.basePay      || 0,
                deduction:    todayRecord.financials?.deduction    || 0,
                finalEarning: todayRecord.financials?.finalDayEarning || 0,
              }
            : null,

          thisWeek: {
            presentDays: weekSummary.presentDays || 0,
            lateDays:    weekSummary.lateDays    || 0,
            absentDays:  weekSummary.absentDays  || 0,
            totalHours:  parseFloat((weekSummary.totalHours || 0).toFixed(2)),
            otHours:     parseFloat((weekSummary.otHours    || 0).toFixed(2)),
          },

          thisMonth: {
            presentDays:      monthSummary.presentDays      || 0,
            lateDays:         monthSummary.lateDays         || 0,
            absentDays:       monthSummary.absentDays       || 0,
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

          trend6Months: attTrend6m,
          recentRecords: recentAttendance,
        },

        // ── Payroll history ───────────────────────────────────────────────
        payroll: {
          history: payrollHistory,
        },

        // ── Leaves ────────────────────────────────────────────────────────
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

        // ── Corrections ───────────────────────────────────────────────────
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

        // ── Performance ───────────────────────────────────────────────────
        performance: {
          latest: latestPerf,
          history: performanceStats,
        },
      },
    });
  } catch (error) {
    console.error('Employee stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch employee stats',
      error: error.message,
    });
  }
});

export default router;