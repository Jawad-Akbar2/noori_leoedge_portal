/**
 * services/payrollRoutes.js  (or routes/payrollRoutes.js)
 *
 * All payroll API calls — uses central apiClient (no manual token handling).
 * Field names and HTTP methods match routes/payroll.js exactly.
 * 
 * 
 * 
 */

import apiClient from '../services/api.js';

const payrollAPI = {

  // ── POST /api/payroll/attendance-overview ────────────────────────────────
  getAttendanceOverview: (fromDate, toDate, filterType = 'all') =>
    apiClient
      .post('/payroll/attendance-overview', { fromDate, toDate, filterType })
      .then(r => r.data),

  // ── POST /api/payroll/performance-overview ───────────────────────────────
  getPerformanceOverview: (fromDate, toDate) =>
    apiClient
      .post('/payroll/performance-overview', { fromDate, toDate })
      .then(r => r.data),

  // ── POST /api/payroll/salary-summary ────────────────────────────────────
  getSalarySummary: (fromDate, toDate) =>
    apiClient
      .post('/payroll/salary-summary', { fromDate, toDate })
      .then(r => r.data),

  // ── POST /api/payroll/report ─────────────────────────────────────────────
  // Returns: { report[], grandTotals, workingDays }
  // Each report row has a dailyAttendance[] nested array.
  getPayrollReport: (fromDate, toDate, search = '') =>
    apiClient
      .post('/payroll/report', { fromDate, toDate, search })
      .then(r => r.data),

  // ── GET /api/payroll/employee-breakdown/:empId ───────────────────────────
  // Returns: { employee, dailyBreakdown[], totals }
  getEmployeeBreakdown: (empId, fromDate, toDate) =>
    apiClient
      .get(`/payroll/employee-breakdown/${empId}`, { params: { fromDate, toDate } })
      .then(r => r.data),

  // ── GET /api/payroll/live-payroll ────────────────────────────────────────
  // Returns: { totalPayroll, periodStart, periodEnd, asOf }
  getLivePayroll: () =>
    apiClient
      .get('/payroll/live-payroll')
      .then(r => r.data),

  // ── POST /api/payroll/export ─────────────────────────────────────────────
  // format: 'csv' → text/csv response  |  'json' → JSON response
  // For CSV the caller should use the returned string directly or trigger a
  // download; for JSON use exportPayrollToExcel() / exportPayrollToCSV() helpers.
  exportPayroll: (fromDate, toDate, format = 'json') =>
    apiClient
      .post(
        '/payroll/export',
        { fromDate, toDate, format },
        { responseType: format === 'csv' ? 'text' : 'json' }
      )
      .then(r => r.data),

  // ── Employee self-service ─────────────────────────────────────────────────

  // GET /api/payroll/my/periods
  getMyPeriods: () =>
    apiClient
      .get('/payroll/my/periods')
      .then(r => r.data),

  // GET /api/payroll/my/summary?startDate=&endDate=
  // Returns: { summary, dailyBreakdown[] }
  getMySummary: (startDate, endDate) =>
    apiClient
      .get('/payroll/my/summary', { params: { startDate, endDate } })
      .then(r => r.data),
};

export default payrollAPI;