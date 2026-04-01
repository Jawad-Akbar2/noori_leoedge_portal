import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer
} from 'recharts';
import { Calendar, Download } from 'lucide-react';
import toast from 'react-hot-toast';

const COLORS = ['#10b981', '#f59e0b', '#3b82f6', '#ef4444'];
const PRIVILEGED_ROLES = ['admin', 'superadmin', 'owner'];

const formatDateToDisplay = (dateStr) => {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
};

const toBackendDate = (isoStr) => {
  if (!isoStr) return '';
  const [year, month, day] = isoStr.split('-');
  return `${day}/${month}/${year}`;
};

function getCurrentUserRole() {
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return user.role || localStorage.getItem('role') || '';
  } catch {
    return localStorage.getItem('role') || '';
  }
}

export default function PayrollReports() {
  const attFromRef = useRef(null);
  const attToRef   = useRef(null);
  const indFromRef = useRef(null);
  const indToRef   = useRef(null);
  const salFromRef = useRef(null);
  const salToRef   = useRef(null);

  const userRole     = getCurrentUserRole();
  const getToken     = () => localStorage.getItem('token');

  // ── Live employee list ─────────────────────────────────────────────────────
  const [employees, setEmployees] = useState([]);

  const fetchEmployees = useCallback(async () => {
    try {
      const res = await axios.get('/api/employees?includeFrozen=true', {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      let list = res.data?.employees || [];
      if (userRole === 'admin') {
        list = list.filter(emp => !PRIVILEGED_ROLES.includes(emp.role));
      }
      setEmployees(list);
    } catch {
      // non-fatal
    }
  }, [userRole]);

  useEffect(() => { fetchEmployees(); }, [fetchEmployees]);

  // ══════════════════════════════════════════════════════════════════════════
  // SECTION 1 — All Employees state
  // ══════════════════════════════════════════════════════════════════════════
  const [s1FromDate,       setS1FromDate]       = useState(new Date().toISOString().split('T')[0]);
  const [s1ToDate,         setS1ToDate]         = useState(new Date().toISOString().split('T')[0]);
  const [s1Filter,         setS1Filter]         = useState('Attendance');
  const [s1Loading,        setS1Loading]        = useState(false);
  const [s1AttChart,       setS1AttChart]       = useState([]);
  const [s1AttList,        setS1AttList]        = useState([]);
  const [s1PerfData,       setS1PerfData]       = useState([]);
  const [s1ClickedType,    setS1ClickedType]    = useState(null);

  const fetchS1Attendance = async () => {
    setS1Loading(true);
    try {
      const res = await axios.post(
        '/api/payroll/attendance-overview',
        { fromDate: toBackendDate(s1FromDate), toDate: toBackendDate(s1ToDate) },
        { headers: { Authorization: `Bearer ${getToken()}` } }
      );
      setS1AttChart(res.data.chartData   || []);
      setS1AttList(res.data.detailedList || []);
      setS1ClickedType(null);
    } catch {
      toast.error('Failed to load attendance data');
    } finally {
      setS1Loading(false);
    }
  };

  const fetchS1Performance = async () => {
    setS1Loading(true);
    try {
      const res = await axios.post(
        '/api/payroll/performance-overview',
        { fromDate: toBackendDate(s1FromDate), toDate: toBackendDate(s1ToDate) },
        { headers: { Authorization: `Bearer ${getToken()}` } }
      );
      setS1PerfData(res.data.performance || []);
    } catch {
      toast.error('Failed to load performance data');
    } finally {
      setS1Loading(false);
    }
  };

  const loadS1Data = () => {
    if (s1Filter === 'Attendance') fetchS1Attendance();
    else fetchS1Performance();
  };

  // ══════════════════════════════════════════════════════════════════════════
  // SECTION 2 — Individual Employee state
  // ══════════════════════════════════════════════════════════════════════════
  const [s2FromDate,          setS2FromDate]          = useState(new Date().toISOString().split('T')[0]);
  const [s2ToDate,            setS2ToDate]            = useState(new Date().toISOString().split('T')[0]);
  const [s2Filter,            setS2Filter]            = useState('Attendance');
  const [s2Loading,           setS2Loading]           = useState(false);
  const [s2AttChart,          setS2AttChart]          = useState([]);
  const [s2AttList,           setS2AttList]           = useState([]);
  const [s2PerfData,          setS2PerfData]          = useState([]);
  const [s2ClickedType,       setS2ClickedType]       = useState(null);
  const [selectedEmployee,    setSelectedEmployee]    = useState('');
  const [selectedEmployeeId,  setSelectedEmployeeId]  = useState('');
  const [employeeDropdownOpen,setEmployeeDropdownOpen]= useState(false);

  useEffect(() => {
    console.log( selectedEmployeeId)
  })


  const fetchS2Attendance = async () => {
    setS2Loading(true);
    try {
      // Pass the selected employee name as a filter so backend returns only that employee's data
      const body = {
        fromDate: toBackendDate(s2FromDate),
        toDate:   toBackendDate(s2ToDate),
      };
      // If a specific employee is selected, filter server-side via empId if available,
      // otherwise we filter client-side below
      const res = await axios.post(
        '/api/payroll/attendance-overview',
        body,
        { headers: { Authorization: `Bearer ${getToken()}` } }
      );

      const rawChart = res.data.chartData   || [];
      const rawList  = res.data.detailedList || [];

      // If an employee is selected, filter the detailed list and recompute chart counts
      if (selectedEmployee) {
        const filtered = rawList.filter(item =>
          item.name.toLowerCase().includes(selectedEmployee.toLowerCase())
        );

        // Recompute chart totals from filtered list
        const statusCount = { 'On-time': 0, Late: 0, Leave: 0, Absent: 0 };
        filtered.forEach(item => {
          if (statusCount[item.type] !== undefined) statusCount[item.type]++;
        });
        const total = Object.values(statusCount).reduce((a, b) => a + b, 0);
        const filteredChart = Object.entries(statusCount).map(([name, value]) => ({
          name, value,
          percentage: total > 0 ? ((value / total) * 100).toFixed(1) : '0.0'
        }));

        setS2AttChart(filteredChart);
        setS2AttList(filtered);
      } else {
        setS2AttChart(rawChart);
        setS2AttList(rawList);
      }
      setS2ClickedType(null);
    } catch {
      toast.error('Failed to load attendance data');
    } finally {
      setS2Loading(false);
    }
  };

  const fetchS2Performance = async () => {
    setS2Loading(true);
    try {
      const res = await axios.post(
        '/api/payroll/performance-overview',
        { fromDate: toBackendDate(s2FromDate), toDate: toBackendDate(s2ToDate) },
        { headers: { Authorization: `Bearer ${getToken()}` } }
      );

      const rawPerf = res.data.performance || [];

      // Filter to selected employee if one is chosen
      const filtered = selectedEmployee
        ? rawPerf.filter(emp => emp.name.toLowerCase().includes(selectedEmployee.toLowerCase()))
        : rawPerf;

      setS2PerfData(filtered);
    } catch {
      toast.error('Failed to load performance data');
    } finally {
      setS2Loading(false);
    }
  };

  const loadS2Data = () => {
    if (s2Filter === 'Attendance') fetchS2Attendance();
    else fetchS2Performance();
  };

  // ── Salary ─────────────────────────────────────────────────────────────────
  const [salaryFromDate, setSalaryFromDate] = useState(new Date().toISOString().split('T')[0]);
  const [salaryToDate,   setSalaryToDate]   = useState(new Date().toISOString().split('T')[0]);
  const [salarySummary,  setSalarySummary]  = useState([]);
  const [salaryTotals,   setSalaryTotals]   = useState({
    totalBaseSalary: 0, totalOT: 0, totalDeductions: 0, totalNetPayable: 0
  });
  const [salaryLoading,      setSalaryLoading]      = useState(false);
  const [salarySearch,       setSalarySearch]       = useState('');
  const [expandedEmployees,  setExpandedEmployees]  = useState({});

  const toggleEmployeeExpansion = (empId) =>
    setExpandedEmployees(prev => ({ ...prev, [empId]: !prev[empId] }));

  // ── Presets ────────────────────────────────────────────────────────────────
  const toISO = (d) => d.toISOString().split('T')[0];
  const todayISO = () => toISO(new Date());

  /**
   * Pay period: 18th of month → 17th of next month.
   * If today >= 18  → period start = 18th of THIS month,  end = 17th of NEXT month
   * If today <= 17  → period start = 18th of LAST month,  end = 17th of THIS month
   */
  const getCurrentPayPeriod = () => {
    const now   = new Date();
    const day   = now.getDate();
    const yr    = now.getFullYear();
    const mo    = now.getMonth(); // 0-based

    let from, to;
    if (day >= 18) {
      // e.g. today = Mar 19  → 18 Mar – 17 Apr
      from = new Date(yr, mo,     19);
      to   = new Date(yr, mo + 1, 18);
    } else {
      // e.g. today = Mar 3   → 18 Feb – 17 Mar
      from = new Date(yr, mo - 1, 19);
      to   = new Date(yr, mo,     18);
    }
    return { from: toISO(from), to: toISO(to) };
  };

  const getLastPayPeriod = () => {
    const now = new Date();
    const day = now.getDate();
    const yr  = now.getFullYear();
    const mo  = now.getMonth();

    let from, to;
    if (day >= 18) {
      // current period is 18 this month → 17 next; last = 18 last month → 17 this month
      from = new Date(yr, mo - 1, 19);
      to   = new Date(yr, mo,     18);
    } else {
      // current period is 18 two months ago → 17 last month
      from = new Date(yr, mo - 2, 19);
      to   = new Date(yr, mo - 1, 18);
    }
    return { from: toISO(from), to: toISO(to) };
  };

  /**
   * Current week: Monday → Sunday (ISO week).
   * If today IS Sunday (getDay()===0) we treat it as day 7, so Monday is -6 days.
   */
  const getCurrentWeek = () => {
    const now     = new Date();
    const dayOfWk = now.getDay(); // 0=Sun … 6=Sat
    const diffToMon = dayOfWk === 0 ? -6 : 1 - dayOfWk;
    const mon = new Date(now);
    mon.setDate(now.getDate() + diffToMon);
    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);
    return { from: toISO(mon), to: toISO(sun) };
  };

  const resolvePreset = (preset) => {
    if (preset === 'today')     return { from: todayISO(), to: todayISO() };
    if (preset === 'week')      return getCurrentWeek();
    if (preset === 'month')     return getCurrentPayPeriod();
    if (preset === 'lastMonth') return getLastPayPeriod();
    return null;
  };

  const applyPresetS1 = (preset) => {
    const range = resolvePreset(preset);
    if (range) { setS1FromDate(range.from); setS1ToDate(range.to); }
  };

  const applyPresetS2 = (preset) => {
    const range = resolvePreset(preset);
    if (range) { setS2FromDate(range.from); setS2ToDate(range.to); }
  };

  const applyPresetSalary = (preset) => {
    const range = resolvePreset(preset);
    if (range) { setSalaryFromDate(range.from); setSalaryToDate(range.to); }
  };

  // ── Salary fetch ───────────────────────────────────────────────────────────
  const fetchSalarySummary = async () => {
    setSalaryLoading(true);
    try {
      const res = await axios.post(
        '/api/payroll/report',
        { fromDate: toBackendDate(salaryFromDate), toDate: toBackendDate(salaryToDate), search: salarySearch },
        { headers: { Authorization: `Bearer ${getToken()}` } }
      );
      setSalarySummary(res.data.report     || []);
      setSalaryTotals(res.data.grandTotals || { totalBaseSalary: 0, totalOT: 0, totalDeductions: 0, totalNetPayable: 0 });
    } catch {
      toast.error('Failed to load salary data');
    } finally {
      setSalaryLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      const res = await axios.post(
        '/api/payroll/export',
        { fromDate: toBackendDate(salaryFromDate), toDate: toBackendDate(salaryToDate), format: 'csv' },
        { headers: { Authorization: `Bearer ${getToken()}` }, responseType: 'blob' }
      );
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a   = document.createElement('a');
      a.href = url;
      a.download = `payroll-${salaryFromDate}-${salaryToDate}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('Report exported');
    } catch {
      toast.error('Export failed');
    }
  };

  // ── Shared components ──────────────────────────────────────────────────────
  const DatePickerField = ({ label, value, onChange, pickerRef, minDate }) => (
    <div className="relative">
      <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
      <div onClick={() => pickerRef.current?.showPicker()}
        className="flex items-center justify-between w-full px-4 py-2 border border-gray-300 rounded-lg cursor-pointer bg-white hover:border-blue-400 transition">
        <span>{formatDateToDisplay(value) || 'Select date'}</span>
        <Calendar size={16} className="text-gray-400" />
      </div>
      <input ref={pickerRef} type="date" value={value} min={minDate}
        onChange={e => onChange(e.target.value)}
        className="absolute opacity-0 pointer-events-none" />
    </div>
  );

  const ratingColor = (rating) => {
    switch (rating) {
      case 'Excellent': return 'bg-green-100 text-green-800';
      case 'Good':      return 'bg-blue-100 text-blue-800';
      case 'Average':   return 'bg-yellow-100 text-yellow-800';
      default:          return 'bg-red-100 text-red-800';
    }
  };

  // ── Attendance chart + table block (reusable for both sections) ────────────
  const AttendanceBlock = ({ chart, list, clickedType, setClickedType, employeeLabel }) => (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          {chart.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={chart} cx="50%" cy="50%" outerRadius={80}
                  labelLine={false}
                  label={({ name, percentage }) => `${name}: ${percentage}%`}
                  dataKey="value"
                  onClick={entry => setClickedType(entry.name)}>
                  {chart.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-400">No data — click Load</div>
          )}
        </div>
        <div className="space-y-2">
          {chart.map((item, i) => (
            <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <div className="w-4 h-4 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
              <span className="font-medium text-gray-800">{item.name}</span>
              <span className="ml-auto text-gray-600">{item.value}</span>
              <span className="text-gray-500">({item.percentage}%)</span>
            </div>
          ))}
        </div>
      </div>

      {clickedType && list.length > 0 && (
        <div className="mt-6 border-t pt-6 max-h-96 overflow-y-auto">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            {clickedType}{employeeLabel ? ` — ${employeeLabel}` : ''}
          </h3>
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
              {list
                .filter(item => item.type.toLowerCase() === clickedType.toLowerCase())
                .map((item, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-2">{item.date}</td>
                    <td className="px-4 py-2">{item.name}</td>
                    <td className="px-4 py-2">{item.type}</td>
                    <td className="px-4 py-2 text-gray-500">{item.reason || '—'}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );

  const PerformanceBlock = ({ data }) => (
    data.length > 0 ? (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-4 py-2 text-left">Employee</th>
              <th className="px-4 py-2 text-center">Score</th>
              <th className="px-4 py-2 text-center">Present</th>
              <th className="px-4 py-2 text-center">Absent</th>
              <th className="px-4 py-2 text-center">Late</th>
              <th className="px-4 py-2 text-center">Leave</th>
              <th className="px-4 py-2 text-left">Rating</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {data.map(emp => (
              <tr key={emp.empId} className="hover:bg-gray-50">
                <td className="px-4 py-2 font-medium">
                  {emp.name} <span className="text-xs text-gray-500">({emp.empId})</span>
                </td>
                <td className="px-4 py-2 text-center font-bold text-blue-600">{emp.performanceScore}</td>
                <td className="px-4 py-2 text-center text-green-600">{emp.presentDays}</td>
                <td className="px-4 py-2 text-center text-red-600">{emp.absentDays}</td>
                <td className="px-4 py-2 text-center text-yellow-600">{emp.lateDays}</td>
                <td className="px-4 py-2 text-center text-blue-600">{emp.leaveDays}</td>
                <td className="px-4 py-2">
                  <span className={`px-2 py-1 rounded text-xs font-semibold ${ratingColor(emp.rating)}`}>
                    {emp.rating}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ) : (
      <div className="text-center py-8 text-gray-400">No data — select a date range and click Load</div>
    )
  );

  return (
    <div className="flex-1 flex flex-col overflow-hidden">

      {/* Header */}
      <header className="bg-white shadow sticky top-0 z-30">
        <div className="flex items-center justify-between p-4 md:p-6">
          <h1 className="text-2xl font-bold text-gray-800">Payroll Reports</h1>
          <button onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
            <Download size={18} /> Export CSV
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-auto p-4 md:p-6 space-y-8">

        {/* ═══ Section 1: ALL Employees — Attendance & Performance ════════════ */}
        <section className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-6">Section 1: Attendance &amp; Performance Overview (All Employees)</h2>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
            <DatePickerField label="From" value={s1FromDate} onChange={setS1FromDate} pickerRef={attFromRef} />
            <DatePickerField label="To"   value={s1ToDate}   onChange={setS1ToDate}   pickerRef={attToRef}   minDate={s1FromDate} />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">View</label>
              <select value={s1Filter} onChange={e => setS1Filter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white">
                <option value="Attendance">Attendance</option>
                <option value="Performance">Performance</option>
              </select>
            </div>

            <div /> {/* spacer */}

            <div className="flex items-end">
              <button onClick={loadS1Data} disabled={s1Loading}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50">
                {s1Loading ? 'Loading...' : 'Load'}
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mb-6">
            {[['today','Today'],['week','This Week'],['month','This Month']].map(([p, label]) => (
              <button key={p} onClick={() => applyPresetS1(p)}
                className="px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm">
                {label}
              </button>
            ))}
          </div>

          {s1Filter === 'Attendance' && (
            <AttendanceBlock
              chart={s1AttChart}
              list={s1AttList}
              clickedType={s1ClickedType}
              setClickedType={setS1ClickedType}
              employeeLabel={null}
            />
          )}
          {s1Filter === 'Performance' && <PerformanceBlock data={s1PerfData} />}
        </section>

        {/* ═══ Section 2: INDIVIDUAL Employee — Attendance & Performance ════ */}
        <section className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-6">Section 2: Individual Attendance &amp; Performance</h2>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
            <DatePickerField label="From" value={s2FromDate} onChange={setS2FromDate} pickerRef={indFromRef} />
            <DatePickerField label="To"   value={s2ToDate}   onChange={setS2ToDate}   pickerRef={indToRef}   minDate={s2FromDate} />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">View</label>
              <select value={s2Filter} onChange={e => setS2Filter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white">
                <option value="Attendance">Attendance</option>
                <option value="Performance">Performance</option>
              </select>
            </div>

            {/* Live employee search dropdown */}
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-2">Employee</label>
              <input type="text" placeholder="Type to search..."
                value={selectedEmployee}
                onChange={e => { setSelectedEmployee(e.target.value); setSelectedEmployeeId(''); setEmployeeDropdownOpen(true); }}
                onFocus={() => setEmployeeDropdownOpen(true)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500" />

              {employeeDropdownOpen && (
                <ul className="absolute z-50 w-full max-h-48 overflow-y-auto bg-white border border-gray-300 rounded-lg mt-1 shadow-lg">
                  <li onClick={() => { setSelectedEmployee(''); setSelectedEmployeeId(''); setEmployeeDropdownOpen(false); }}
                    className="px-3 py-2 cursor-pointer hover:bg-blue-50 text-sm text-gray-500 italic border-b">
                    All employees
                  </li>
                  {employees
                    .filter(emp =>
                      !selectedEmployee ||
                      `${emp.firstName} ${emp.lastName}`.toLowerCase().includes(selectedEmployee.toLowerCase()) ||
                      emp.employeeNumber.toLowerCase().includes(selectedEmployee.toLowerCase())
                    )
                    .map(emp => (
                      <li key={emp._id}
                        onClick={() => {
                          setSelectedEmployee(`${emp.firstName} ${emp.lastName}`);
                          setSelectedEmployeeId(emp._id);
                          setEmployeeDropdownOpen(false);
                        }}
                        className="px-3 py-2 cursor-pointer hover:bg-gray-100 text-sm">
                        {emp.firstName} {emp.lastName}
                        <span className="ml-1 text-xs text-gray-500">({emp.employeeNumber})</span>
                      </li>
                    ))
                  }
                  {employees.filter(emp =>
                    !selectedEmployee ||
                    `${emp.firstName} ${emp.lastName}`.toLowerCase().includes(selectedEmployee.toLowerCase())
                  ).length === 0 && (
                    <li className="px-3 py-2 text-gray-400 text-sm">No employee found</li>
                  )}
                </ul>
              )}
            </div>

            <div className="flex items-end">
              <button onClick={loadS2Data} disabled={s2Loading}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50">
                {s2Loading ? 'Loading...' : 'Load'}
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mb-6">
            {[['today','Today'],['week','This Week'],['month','This Month']].map(([p, label]) => (
              <button key={p} onClick={() => applyPresetS2(p)}
                className="px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm">
                {label}
              </button>
            ))}
          </div>

          {s2Filter === 'Attendance' && (
            <AttendanceBlock
              chart={s2AttChart}
              list={s2AttList}
              clickedType={s2ClickedType}
              setClickedType={setS2ClickedType}
              employeeLabel={selectedEmployee || 'All Employees'}
            />
          )}
          {s2Filter === 'Performance' && <PerformanceBlock data={s2PerfData} />}
        </section>

        {/* ═══ Section 3: Salary & Payroll ══════════════════════════════════ */}
        <section className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-6">Section 3: Salary &amp; Payroll</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <DatePickerField label="From" value={salaryFromDate} onChange={setSalaryFromDate} pickerRef={salFromRef} />
            <DatePickerField label="To"   value={salaryToDate}   onChange={setSalaryToDate}   pickerRef={salToRef}   minDate={salaryFromDate} />
            <div className="flex items-end">
              <button onClick={fetchSalarySummary} disabled={salaryLoading}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50">
                {salaryLoading ? 'Loading...' : 'Load'}
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mb-6">
            {[['today','Today'],['month','This Month'],['lastMonth','Last Month']].map(([p, label]) => (
              <button key={p} onClick={() => applyPresetSalary(p)}
                className="px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm">
                {label}
              </button>
            ))}
          </div>

          {/* Totals */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[
              { label: 'Total Base Salary', key: 'totalBaseSalary', color: 'blue'   },
              { label: 'Total OT',          key: 'totalOT',         color: 'green'  },
              { label: 'Total Deductions',  key: 'totalDeductions', color: 'red'    },
              { label: 'Total Net Payable', key: 'totalNetPayable', color: 'purple' }
            ].map(({ label, key, color }) => (
              <div key={key} className={`bg-${color}-50 p-4 rounded-lg border border-${color}-200`}>
                <p className="text-sm text-gray-600">{label}</p>
                <p className={`text-2xl font-bold text-${color}-600 mt-2`}>
                PKR {(salaryTotals[key] || 0).toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
            ))}
          </div>

          {/* Search */}
          <div className="mb-4 flex gap-3">
            <input type="text" value={salarySearch} onChange={e => setSalarySearch(e.target.value)}
              placeholder="Search by name or employee number"
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
            <button onClick={fetchSalarySummary} disabled={salaryLoading}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:opacity-50">
              {salaryLoading ? 'Searching...' : 'Search'}
            </button>
          </div>

          {/* Salary table */}
          {salarySummary.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-2 text-left">Employee</th>
                    <th className="px-4 py-2 text-right">Base Salary</th>
                    <th className="px-4 py-2 text-right">Deductions</th>
                    <th className="px-4 py-2 text-right">OT</th>
                    <th className="px-4 py-2 text-right">Net Payable</th>
                    <th className="px-4 py-2 text-left">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {salarySummary.map(emp => (
                    <React.Fragment key={emp.empId}>
                      <tr className="hover:bg-gray-50">
                        <td className="px-4 py-2 font-medium">
                          {emp.name} <span className="text-xs text-gray-500">({emp.empNumber})</span>
                        </td>
                        <td className="px-4 py-2 text-right">PKR {emp.baseSalary.toFixed(2)}</td>
                        <td className="px-4 py-2 text-right text-red-600">PKR {emp.totalDeduction.toFixed(2)}</td>
                        <td className="px-4 py-2 text-right text-green-600">PKR {emp.totalOt.toFixed(2)}</td>
                        <td className="px-4 py-2 text-right font-semibold text-blue-600">PKR {emp.netPayable.toFixed(2)}</td>
                        <td className="px-4 py-2">
                          <button onClick={() => toggleEmployeeExpansion(emp.empId)}
                            className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                            {expandedEmployees[emp.empId] ? 'Hide' : 'Details'}
                          </button>
                        </td>
                      </tr>

                      {expandedEmployees[emp.empId] && (
                        <tr>
                          <td colSpan={6} className="bg-blue-50 px-4 py-3">
                            <div className="overflow-x-auto">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="bg-white">
                                    {['Date','Status','In','Out','Hours','Base','Deduction','OT','Final'].map(h => (
                                      <th key={h} className="px-3 py-2 text-left border">{h}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {emp.dailyAttendance.map((day, i) => (
                                    <tr key={i} className="bg-white">
                                      <td className="px-3 py-2 border">{day.date}</td>
                                      <td className="px-3 py-2 border">{day.status}</td>
                                      <td className="px-3 py-2 border">{day.inTime}</td>
                                      <td className="px-3 py-2 border">{day.outTime}</td>
                                      <td className="px-3 py-2 border text-right">{day.hoursWorked.toFixed(2)}</td>
                                      <td className="px-3 py-2 border text-right">PKR {day.basePay.toFixed(2)}</td>
                                      <td className="px-3 py-2 border text-right text-red-600">PKR {day.deduction.toFixed(2)}</td>
                                      <td className="px-3 py-2 border text-right text-green-600">PKR {day.otAmount.toFixed(2)}</td>
                                      <td className="px-3 py-2 border text-right font-semibold">PKR {day.finalDayEarning.toFixed(2)}</td>
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
          ) : (
            <div className="text-center py-8 text-gray-400">No data — select a date range and click Load</div>
          )}
        </section>

      </div>
    </div>
  );
}