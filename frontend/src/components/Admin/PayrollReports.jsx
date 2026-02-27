import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line
} from 'recharts';
import { Calendar, Download, Menu, X } from 'lucide-react';
import toast from 'react-hot-toast';
import payrollAPI from '../../routes/payrollRoutes';

export default function PayrollReports() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // Refs for date pickers
  const attFromRef = useRef(null);
  const attToRef = useRef(null);
  const perfFromRef = useRef(null);
  const perfToRef = useRef(null);
  const salFromRef = useRef(null);
  const salToRef = useRef(null);

  // Date Utilities
  const formatDateToDisplay = (dateStr) => {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  };

  // Section 1: Attendance
  const [attendanceFromDate, setAttendanceFromDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [attendanceToDate, setAttendanceToDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [attendanceChart, setAttendanceChart] = useState([]);
  const [attendanceList, setAttendanceList] = useState([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceFilter, setAttendanceFilter] = useState('all');

  // Section 2: Performance
  const [performanceFromDate, setPerformanceFromDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [performanceToDate, setPerformanceToDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [performanceData, setPerformanceData] = useState([]);
  const [performanceLoading, setPerformanceLoading] = useState(false);

  // Section 3: Salary
  const [salaryFromDate, setSalaryFromDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [salaryToDate, setSalaryToDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [salarySummary, setSalarySummary] = useState([]);
  const [salaryTotals, setSalaryTotals] = useState({});
  const [salaryLoading, setSalaryLoading] = useState(false);
  const [salarySearch, setSalarySearch] = useState('');
  const [expandedEmployees, setExpandedEmployees] = useState({});

  const COLORS = ['#10b981', '#f59e0b', '#3b82f6', '#ef4444'];

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // SECTION 1: Fetch Attendance Overview
  const fetchAttendanceOverview = async () => {
    setAttendanceLoading(true);
    try {
      const token = localStorage.getItem('token');
      const apiUrl = process.env.REACT_APP_API_URL || '/api';
      
      const response = await axios.post(
        `${apiUrl}/payroll/attendance-overview`,
        { 
          fromDate: attendanceFromDate, 
          toDate: attendanceToDate, 
          filterType: attendanceFilter 
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setAttendanceChart(response.data.chartData);
      setAttendanceList(response.data.detailedList);
    } catch (error) {
      console.error('Error fetching attendance:', error);
      toast.error('Failed to load attendance data');
    } finally {
      setAttendanceLoading(false);
    }
  };

  // SECTION 2: Fetch Performance Overview
  const fetchPerformanceOverview = async () => {
    setPerformanceLoading(true);
    try {
      const token = localStorage.getItem('token');
      const apiUrl = process.env.REACT_APP_API_URL || '/api';
      
      const response = await axios.post(
        `${apiUrl}/payroll/performance-overview`,
        { fromDate: performanceFromDate, toDate: performanceToDate },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setPerformanceData(response.data.performance);
    } catch (error) {
      console.error('Error fetching performance:', error);
      toast.error('Failed to load performance data');
    } finally {
      setPerformanceLoading(false);
    }
  };

  // SECTION 3: Fetch full Payroll Report (parent totals + nested daily rows)
  const fetchSalarySummary = async () => {
    setSalaryLoading(true);
    try {
      // Data flow: request date range + optional search; backend responds with totals and per-day details.
      const response = await payrollAPI.getPayrollReport(salaryFromDate, salaryToDate, salarySearch);
      setSalarySummary(response.report || []);
      setSalaryTotals(response.grandTotals || {});
    } catch (error) {
      console.error('Error fetching salary:', error);
      toast.error('Failed to load salary data');
    } finally {
      setSalaryLoading(false);
    }
  };

  const toggleEmployeeExpansion = (empId) => {
    setExpandedEmployees((prev) => ({ ...prev, [empId]: !prev[empId] }));
  };

  // Quick preset handlers
  const handleAttendancePreset = (preset) => {
    const today = new Date();
    let start, end;

    switch (preset) {
      case 'today':
        start = new Date(today);
        end = new Date(today);
        break;
      case 'week':
        start = new Date(today);
        start.setDate(start.getDate() - today.getDay());
        end = new Date(today);
        break;
      case 'month':
        const year = today.getFullYear();
        const month = today.getMonth();
        const day = today.getDate();
        if (day >= 18) {
          start = new Date(year, month, 18);
          end = new Date(year, month + 1, 17);
        } else {
          start = new Date(year, month - 1, 18);
          end = new Date(year, month, 17);
        }
        break;
      case 'lastMonth':
        start = new Date(today.getFullYear(), today.getMonth() - 1, 18);
        end = new Date(today.getFullYear(), today.getMonth(), 17);
        break;
      default:
        return;
    }

    setAttendanceFromDate(start.toISOString().split('T')[0]);
    setAttendanceToDate(end.toISOString().split('T')[0]);
  };

  const handlePerformancePreset = (preset) => {
    const today = new Date();
    let start, end;

    switch (preset) {
      case 'today':
        start = new Date(today);
        end = new Date(today);
        break;
      case 'week':
        start = new Date(today);
        start.setDate(start.getDate() - today.getDay());
        end = new Date(today);
        break;
      case 'month':
        const year = today.getFullYear();
        const month = today.getMonth();
        const day = today.getDate();
        if (day >= 18) {
          start = new Date(year, month, 18);
          end = new Date(year, month + 1, 17);
        } else {
          start = new Date(year, month - 1, 18);
          end = new Date(year, month, 17);
        }
        break;
      default:
        return;
    }

    setPerformanceFromDate(start.toISOString().split('T')[0]);
    setPerformanceToDate(end.toISOString().split('T')[0]);
  };

  const handleSalaryPreset = (preset) => {
    const today = new Date();
    let start, end;

    switch (preset) {
      case 'today':
        start = new Date(today);
        end = new Date(today);
        break;
      case 'month':
        const year = today.getFullYear();
        const month = today.getMonth();
        const day = today.getDate();
        if (day >= 18) {
          start = new Date(year, month, 18);
          end = new Date(year, month + 1, 17);
        } else {
          start = new Date(year, month - 1, 18);
          end = new Date(year, month, 17);
        }
        break;
      case 'lastMonth':
        start = new Date(today.getFullYear(), today.getMonth() - 1, 18);
        end = new Date(today.getFullYear(), today.getMonth(), 17);
        break;
      default:
        return;
    }

    setSalaryFromDate(start.toISOString().split('T')[0]);
    setSalaryToDate(end.toISOString().split('T')[0]);
  };

  const handleExport = (format) => {
    if (format === 'csv') {
      let csv = 'Employee Number,Name,Basic Earned,OT Total,Deductions,Net Payable\n';
      salarySummary.forEach(emp => {
        csv += `${emp.empNumber},"${emp.name}",${emp.totals.basePay},${emp.totals.otAmount},${emp.totals.deduction},${emp.totals.finalEarning}\n`;
      });

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `payroll-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('Report exported successfully');
    }
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white shadow sticky top-0 z-30">
          <div className="flex items-center justify-between p-4 md:p-6">
            <h1 className="text-2xl font-bold text-gray-800">Payroll Reports</h1>
            <button
              onClick={() => handleExport('csv')}
              className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              title="Export as CSV"
            >
              <Download size={20} />
            </button>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          <div className="p-4 md:p-6 space-y-8">
            {/* ========== SECTION 1: ATTENDANCE ========== */}
            <section className="bg-white rounded-lg shadow p-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-6">
                Section 1: Attendance & Discipline
              </h2>

              {/* Controls */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-2">From</label>
                  <div 
                    onClick={() => attFromRef.current.showPicker()}
                    className="flex items-center justify-between w-full px-4 py-2 border border-gray-300 rounded-lg focus-within:ring-2 focus-within:ring-blue-500 cursor-pointer bg-white"
                  >
                    <span className="text-gray-900">{formatDateToDisplay(attendanceFromDate)}</span>
                    <Calendar size={18} className="text-gray-400" />
                  </div>
                  <input
                    ref={attFromRef}
                    type="date"
                    value={attendanceFromDate}
                    onChange={(e) => setAttendanceFromDate(e.target.value)}
                    className="absolute opacity-0 pointer-events-none"
                  />
                </div>
                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-2">To</label>
                  <div 
                    onClick={() => attToRef.current.showPicker()}
                    className="flex items-center justify-between w-full px-4 py-2 border border-gray-300 rounded-lg focus-within:ring-2 focus-within:ring-blue-500 cursor-pointer bg-white"
                  >
                    <span className="text-gray-900">{formatDateToDisplay(attendanceToDate)}</span>
                    <Calendar size={18} className="text-gray-400" />
                  </div>
                  <input
                    ref={attToRef}
                    type="date"
                    value={attendanceToDate}
                    onChange={(e) => setAttendanceToDate(e.target.value)}
                    min={attendanceFromDate}
                    className="absolute opacity-0 pointer-events-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Filter</label>
                  <select
                    value={attendanceFilter}
                    onChange={(e) => setAttendanceFilter(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">All</option>
                    <option value="on-time">On-time</option>
                    <option value="late">Late</option>
                    <option value="leave">Leave</option>
                    <option value="absent">Absent</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <button
                    onClick={fetchAttendanceOverview}
                    disabled={attendanceLoading}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                  >
                    {attendanceLoading ? 'Loading...' : 'Load'}
                  </button>
                </div>
              </div>

              {/* Quick Presets */}
              <div className="flex flex-wrap gap-2 mb-6">
                <button
                  onClick={() => handleAttendancePreset('today')}
                  className="px-3 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition text-sm"
                >
                  Today
                </button>
                <button
                  onClick={() => handleAttendancePreset('week')}
                  className="px-3 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition text-sm"
                >
                  This Week
                </button>
                <button
                  onClick={() => handleAttendancePreset('month')}
                  className="px-3 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition text-sm"
                >
                  This Month
                </button>
              </div>

              {/* Chart & List */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Chart */}
                <div>
                  {attendanceChart.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={attendanceChart}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percentage }) => `${name}: ${percentage}%`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {attendanceChart.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-300 text-gray-500">
                      No data available
                    </div>
                  )}
                </div>

                {/* Legend */}
                <div className="space-y-2">
                  {attendanceChart.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                      ></div>
                      <span className="font-medium text-gray-800">{item.name}</span>
                      <span className="ml-auto text-gray-600">{item.value}</span>
                      <span className="text-gray-500">({item.percentage}%)</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Attendance List */}
              <div className="mt-6 border-t pt-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Filtered List</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-4 py-2 text-left">Date</th>
                        <th className="px-4 py-2 text-left">Employee</th>
                        <th className="px-4 py-2 text-left">Type</th>
                        <th className="px-4 py-2 text-left">Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {attendanceList.slice(0, 10).map((item, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-4 py-2">{formatDateToDisplay(item.date)}</td>
                          <td className="px-4 py-2">{item.name}</td>
                          <td className="px-4 py-2">
                            <span className={`px-2 py-1 rounded text-xs font-semibold ${
                              item.type === 'On-time' ? 'bg-green-100 text-green-800' :
                              item.type === 'Late' ? 'bg-yellow-100 text-yellow-800' :
                              item.type === 'Leave' ? 'bg-blue-100 text-blue-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {item.type}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-gray-600">{item.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {attendanceList.length > 10 && (
                  <p className="text-sm text-gray-600 mt-2">
                    Showing 10 of {attendanceList.length} records
                  </p>
                )}
              </div>
            </section>{/* ========== SECTION 2: PERFORMANCE ========== */}
            <section className="bg-white rounded-lg shadow p-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-6">
                Section 2: Performance Overview
              </h2>

              {/* Controls */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-2">From</label>
                  <div 
                    onClick={() => perfFromRef.current.showPicker()}
                    className="flex items-center justify-between w-full px-4 py-2 border border-gray-300 rounded-lg focus-within:ring-2 focus-within:ring-blue-500 cursor-pointer bg-white"
                  >
                    <span className="text-gray-900">{formatDateToDisplay(performanceFromDate)}</span>
                    <Calendar size={18} className="text-gray-400" />
                  </div>
                  <input
                    ref={perfFromRef}
                    type="date"
                    value={performanceFromDate}
                    onChange={(e) => setPerformanceFromDate(e.target.value)}
                    className="absolute opacity-0 pointer-events-none"
                  />
                </div>
                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-2">To</label>
                  <div 
                    onClick={() => perfToRef.current.showPicker()}
                    className="flex items-center justify-between w-full px-4 py-2 border border-gray-300 rounded-lg focus-within:ring-2 focus-within:ring-blue-500 cursor-pointer bg-white"
                  >
                    <span className="text-gray-900">{formatDateToDisplay(performanceToDate)}</span>
                    <Calendar size={18} className="text-gray-400" />
                  </div>
                  <input
                    ref={perfToRef}
                    type="date"
                    value={performanceToDate}
                    onChange={(e) => setPerformanceToDate(e.target.value)}
                    min={performanceFromDate}
                    className="absolute opacity-0 pointer-events-none"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    onClick={fetchPerformanceOverview}
                    disabled={performanceLoading}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                  >
                    {performanceLoading ? 'Loading...' : 'Load'}
                  </button>
                </div>
              </div>

              {/* Quick Presets */}
              <div className="flex flex-wrap gap-2 mb-6">
                <button
                  onClick={() => handlePerformancePreset('today')}
                  className="px-3 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition text-sm"
                >
                  Today
                </button>
                <button
                  onClick={() => handlePerformancePreset('week')}
                  className="px-3 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition text-sm"
                >
                  This Week
                </button>
                <button
                  onClick={() => handlePerformancePreset('month')}
                  className="px-3 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition text-sm"
                >
                  This Month
                </button>
              </div>

              {/* Performance List */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-4 py-2 text-left">Employee</th>
                      <th className="px-4 py-2 text-center">Score</th>
                      <th className="px-4 py-2 text-center">Present</th>
                      <th className="px-4 py-2 text-center">Absent</th>
                      <th className="px-4 py-2 text-center">Leave</th>
                      <th className="px-4 py-2 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {performanceData.map((emp) => (
                      <tr key={emp.empId} className="hover:bg-gray-50">
                        <td className="px-4 py-2 font-medium">{emp.name}</td>
                        <td className="px-4 py-2 text-center font-bold text-blue-600">
                          {emp.performanceScore}%
                        </td>
                        <td className="px-4 py-2 text-center text-green-600">{emp.present}</td>
                        <td className="px-4 py-2 text-center text-red-600">{emp.absent}</td>
                        <td className="px-4 py-2 text-center text-blue-600">{emp.leave}</td>
                        <td className="px-4 py-2">
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${
                            emp.status === 'Excellent' ? 'bg-green-100 text-green-800' :
                            emp.status === 'Good' ? 'bg-blue-100 text-blue-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {emp.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* ========== SECTION 3: SALARY ========== */}
            <section className="bg-white rounded-lg shadow p-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-6">
                Section 3: Salary & Payroll
              </h2>

              {/* Controls */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-2">From</label>
                  <div 
                    onClick={() => salFromRef.current.showPicker()}
                    className="flex items-center justify-between w-full px-4 py-2 border border-gray-300 rounded-lg focus-within:ring-2 focus-within:ring-blue-500 cursor-pointer bg-white"
                  >
                    <span className="text-gray-900">{formatDateToDisplay(salaryFromDate)}</span>
                    <Calendar size={18} className="text-gray-400" />
                  </div>
                  <input
                    ref={salFromRef}
                    type="date"
                    value={salaryFromDate}
                    onChange={(e) => setSalaryFromDate(e.target.value)}
                    className="absolute opacity-0 pointer-events-none"
                  />
                </div>
                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-2">To</label>
                  <div 
                    onClick={() => salToRef.current.showPicker()}
                    className="flex items-center justify-between w-full px-4 py-2 border border-gray-300 rounded-lg focus-within:ring-2 focus-within:ring-blue-500 cursor-pointer bg-white"
                  >
                    <span className="text-gray-900">{formatDateToDisplay(salaryToDate)}</span>
                    <Calendar size={18} className="text-gray-400" />
                  </div>
                  <input
                    ref={salToRef}
                    type="date"
                    value={salaryToDate}
                    onChange={(e) => setSalaryToDate(e.target.value)}
                    min={salaryFromDate}
                    className="absolute opacity-0 pointer-events-none"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    onClick={fetchSalarySummary}
                    disabled={salaryLoading}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                  >
                    {salaryLoading ? 'Loading...' : 'Load'}
                  </button>
                </div>
              </div>

              {/* Quick Presets */}
              <div className="flex flex-wrap gap-2 mb-6">
                <button
                  onClick={() => handleSalaryPreset('today')}
                  className="px-3 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition text-sm"
                >
                  Today
                </button>
                <button
                  onClick={() => handleSalaryPreset('month')}
                  className="px-3 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition text-sm"
                >
                  This Month
                </button>
                <button
                  onClick={() => handleSalaryPreset('lastMonth')}
                  className="px-3 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition text-sm"
                >
                  Last Month
                </button>
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <p className="text-sm text-gray-600">Total Basic Earned</p>
                  <p className="text-2xl font-bold text-blue-600 mt-2">
                    PKR {salaryTotals.basePay?.toFixed(2) || '0.00'}
                  </p>
                </div>
                <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                  <p className="text-sm text-gray-600">Total OT</p>
                  <p className="text-2xl font-bold text-green-600 mt-2">
                    PKR {salaryTotals.otAmount?.toFixed(2) || '0.00'}
                  </p>
                </div>
                <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                  <p className="text-sm text-gray-600">Total Deductions</p>
                  <p className="text-2xl font-bold text-red-600 mt-2">
                    PKR {salaryTotals.deduction?.toFixed(2) || '0.00'}
                  </p>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                  <p className="text-sm text-gray-600">Total Net Payable</p>
                  <p className="text-2xl font-bold text-purple-600 mt-2">
                    PKR {salaryTotals.finalEarning?.toFixed(2) || '0.00'}
                  </p>
                </div>
              </div>

              {/* Search by employee name or employee id */}
              <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-3"> 
                <input
                  type="text"
                  value={salarySearch}
                  onChange={(e) => setSalarySearch(e.target.value)}
                  placeholder="Search by name or employee ID"
                  className="w-full md:col-span-2 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={fetchSalarySummary}
                  disabled={salaryLoading}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:opacity-50"
                >
                  {salaryLoading ? 'Searching...' : 'Apply Search'}
                </button>
              </div>

              {/* Summary Table with expandable daily attendance details */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-4 py-2 text-left">Employee</th>
                      <th className="px-4 py-2 text-right">Total Salary</th>
                      <th className="px-4 py-2 text-right">Deductions</th>
                      <th className="px-4 py-2 text-right">OT</th>
                      <th className="px-4 py-2 text-right">Final Earnings</th>
                      <th className="px-4 py-2 text-left">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {salarySummary.map((emp) => (
                      <React.Fragment key={emp.empId}>
                        <tr className="hover:bg-gray-50">
                          <td className="px-4 py-2 font-medium">{emp.name} <span className="text-xs text-gray-500">({emp.empNumber})</span></td>
                          <td className="px-4 py-2 text-right">PKR {emp.totals.basePay.toFixed(2)}</td>
                          <td className="px-4 py-2 text-right text-red-600">PKR {emp.totals.deduction.toFixed(2)}</td>
                          <td className="px-4 py-2 text-right text-green-600">PKR {emp.totals.otAmount.toFixed(2)}</td>
                          <td className="px-4 py-2 text-right font-semibold text-blue-600">PKR {emp.totals.finalEarning.toFixed(2)}</td>
                          <td className="px-4 py-2">
                            <button
                              onClick={() => toggleEmployeeExpansion(emp.empId)}
                              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                            >
                              {expandedEmployees[emp.empId] ? 'Hide Details' : 'Details'}
                            </button>
                          </td>
                        </tr>
                        {expandedEmployees[emp.empId] && (
                          <tr>
                            <td colSpan={6} className="bg-blue-50 px-4 py-3">
                              <div className="overflow-x-auto">
                                <table className="w-full text-xs md:text-sm">
                                  <thead>
                                    <tr className="bg-white">
                                      <th className="px-3 py-2 text-left border">Date</th>
                                      <th className="px-3 py-2 text-left border">Status</th>
                                      <th className="px-3 py-2 text-left border">Check In</th>
                                      <th className="px-3 py-2 text-left border">Check Out</th>
                                      <th className="px-3 py-2 text-right border">Hours</th>
                                      <th className="px-3 py-2 text-right border">Base</th>
                                      <th className="px-3 py-2 text-right border">Deduction</th>
                                      <th className="px-3 py-2 text-right border">OT</th>
                                      <th className="px-3 py-2 text-right border">Final</th>
                                      <th className="px-3 py-2 text-left border">Deduction Details</th>
                                      <th className="px-3 py-2 text-left border">OT Details</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {emp.dailyAttendance.map((day, idx) => (
                                      <tr key={`${emp.empId}-${idx}`} className="bg-white">
                                        <td className="px-3 py-2 border">{day.date}</td>
                                        <td className="px-3 py-2 border">{day.status}</td>
                                        <td className="px-3 py-2 border">{day.inTime || '--'}</td>
                                        <td className="px-3 py-2 border">{day.outTime || '--'}</td>
                                        <td className="px-3 py-2 border text-right">{day.hoursPerDay.toFixed(2)}</td>
                                        <td className="px-3 py-2 border text-right">PKR {day.basePay.toFixed(2)}</td>
                                        <td className="px-3 py-2 border text-right text-red-600">PKR {day.deduction.toFixed(2)}</td>
                                        <td className="px-3 py-2 border text-right text-green-600">PKR {day.otAmount.toFixed(2)}</td>
                                        <td className="px-3 py-2 border text-right font-semibold">PKR {day.finalEarning.toFixed(2)}</td>
                                        <td className="px-3 py-2 border">{day.deductionDetails?.map((item) => `${item.reason}: PKR ${Number(item.amount || 0).toFixed(2)}`).join(', ') || '--'}</td>
                                        <td className="px-3 py-2 border">{day.otDetails?.map((item) => item.type === 'manual' ? `${item.reason}: PKR ${Number(item.amount || 0).toFixed(2)}` : `${item.reason}: ${Number(item.hours || 0).toFixed(2)}h x ${item.rate}x`).join(', ') || '--'}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}