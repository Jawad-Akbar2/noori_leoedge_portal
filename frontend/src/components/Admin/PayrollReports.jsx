import React, { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import {
  Calendar,
  Download,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  Clock,
  UserCheck,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Search,
  Filter,
  RefreshCw,
  Loader2,
} from "lucide-react";
import toast from "react-hot-toast";

const COLORS = ["#10b981", "#f59e0b", "#3b82f6", "#ef4444"];
const PRIVILEGED_ROLES = ["admin", "superadmin", "owner"];

const formatDateToDisplay = (dateStr) => {
  if (!dateStr) return "";
  const [year, month, day] = dateStr.split("-");
  return `${day}/${month}/${year}`;
};

const toBackendDate = (isoStr) => {
  if (!isoStr) return "";
  const [year, month, day] = isoStr.split("-");
  return `${day}/${month}/${year}`;
};

function getCurrentUserRole() {
  try {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    return user.role || localStorage.getItem("role") || "";
  } catch {
    return localStorage.getItem("role") || "";
  }
}

// ─── Modern Stat Card ────────────────────────────────────────────────────────
function StatCard({ label, value, icon: Icon, color }) {
  const colorClasses = {
    blue: "from-blue-50 to-blue-100/50 border-blue-200 text-blue-700",
    green: "from-green-50 to-green-100/50 border-green-200 text-green-700",
    purple: "from-purple-50 to-purple-100/50 border-purple-200 text-purple-700",
    orange: "from-orange-50 to-orange-100/50 border-orange-200 text-orange-700",
    red: "from-red-50 to-red-100/50 border-red-200 text-red-700",
  };

  return (
    <div
      className={`bg-gradient-to-r ${colorClasses[color]} rounded-xl border p-4 shadow-sm`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="p-1.5 bg-white/50 rounded-lg">
          <Icon size={16} />
        </div>
      </div>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
    </div>
  );
}

// ─── Modern Date Picker ──────────────────────────────────────────────────────
function DatePickerField({ label, value, onChange, pickerRef, minDate }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">
        {label}
      </label>
      <div className="relative">
        <div
          onClick={() => pickerRef.current?.showPicker()}
          className="flex items-center justify-between w-full px-3 py-2 border border-gray-200 rounded-xl cursor-pointer bg-white shadow-sm hover:border-blue-400 transition"
        >
          <span className="text-sm text-gray-700">
            {formatDateToDisplay(value) || "Select date"}
          </span>
          <Calendar size={16} className="text-gray-400" />
        </div>
        <input
          ref={pickerRef}
          type="date"
          value={value}
          min={minDate}
          onChange={(e) => onChange(e.target.value)}
          className="absolute opacity-0 pointer-events-none"
        />
      </div>
    </div>
  );
}

// ─── Modern Section Card ─────────────────────────────────────────────────────
function SectionCard({ title, children, className = "" }) {
  return (
    <section
      className={`bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden ${className}`}
    >
      <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
        <h2 className="text-lg font-bold text-gray-800">{title}</h2>
      </div>
      <div className="p-6">{children}</div>
    </section>
  );
}

export default function PayrollReports() {
  const attFromRef = useRef(null);
  const attToRef = useRef(null);
  const indFromRef = useRef(null);
  const indToRef = useRef(null);
  const salFromRef = useRef(null);
  const salToRef = useRef(null);

  const userRole = getCurrentUserRole();
  const getToken = () => localStorage.getItem("token");

  const [employees, setEmployees] = useState([]);

  const fetchEmployees = useCallback(async () => {
    try {
      const res = await axios.get("/api/employees?images=false", {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      let list = res.data?.employees || [];
      if (userRole === "admin") {
        list = list.filter((emp) => !PRIVILEGED_ROLES.includes(emp.role));
      }
      setEmployees(list);
    } catch {
      // non-fatal
    }
  }, [userRole]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  // ══════════════════════════════════════════════════════════════════════════
  // SECTION 1 — All Employees state
  // ══════════════════════════════════════════════════════════════════════════
  const [s1FromDate, setS1FromDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [s1ToDate, setS1ToDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [s1Filter, setS1Filter] = useState("Attendance");
  const [s1Loading, setS1Loading] = useState(false);
  const [s1AttChart, setS1AttChart] = useState([]);
  const [s1AttList, setS1AttList] = useState([]);
  const [s1PerfData, setS1PerfData] = useState([]);
  const [s1ClickedType, setS1ClickedType] = useState(null);
  const [bonusModalOpen, setBonusModalOpen] = useState(false);
  const [selectedEmpForBonus, setSelectedEmpForBonus] = useState(null);
  const [bonusItems, setBonusItems] = useState([
    { amount: "", reason: "", type: "manual" },
  ]);

  const fetchS1Attendance = async () => {
    setS1Loading(true);
    try {
      const res = await axios.post(
        "/api/payroll/attendance-overview",
        {
          fromDate: toBackendDate(s1FromDate),
          toDate: toBackendDate(s1ToDate),
        },
        { headers: { Authorization: `Bearer ${getToken()}` } },
      );
      setS1AttChart(res.data.chartData || []);
      setS1AttList(res.data.detailedList || []);
      setS1ClickedType(null);
    } catch {
      toast.error("Failed to load attendance data");
    } finally {
      setS1Loading(false);
    }
  };

  const fetchS1Performance = async () => {
    setS1Loading(true);
    try {
      const res = await axios.post(
        "/api/payroll/performance-overview",
        {
          fromDate: toBackendDate(s1FromDate),
          toDate: toBackendDate(s1ToDate),
        },
        { headers: { Authorization: `Bearer ${getToken()}` } },
      );
      setS1PerfData(res.data.performance || []);
    } catch {
      toast.error("Failed to load performance data");
    } finally {
      setS1Loading(false);
    }
  };

  const loadS1Data = () => {
    if (s1Filter === "Attendance") fetchS1Attendance();
    else fetchS1Performance();
  };

  const openBonusModal = (emp) => {
    setSelectedEmpForBonus(emp);
    setBonusItems([{ amount: "", reason: "", type: "manual" }]);
    setBonusModalOpen(true);
  };


  const viewBonusDetails = (emp) => {
  if (!emp.bonusDetails || emp.bonusDetails.length === 0) {
    toast('No bonus details found');
    return;
  }

  const msg = emp.bonusDetails
    .map(b => `PKR ${b.amount} — ${b.reason} (${b.type})`)
    .join('\n');

  alert(msg); // later replace with modal
};

  // ══════════════════════════════════════════════════════════════════════════
  // SECTION 2 — Individual Employee state
  // ══════════════════════════════════════════════════════════════════════════
  const [s2FromDate, setS2FromDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [s2ToDate, setS2ToDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [s2Filter, setS2Filter] = useState("Attendance");
  const [s2Loading, setS2Loading] = useState(false);
  const [s2AttChart, setS2AttChart] = useState([]);
  const [s2AttList, setS2AttList] = useState([]);
  const [s2PerfData, setS2PerfData] = useState([]);
  const [s2ClickedType, setS2ClickedType] = useState(null);
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [employeeDropdownOpen, setEmployeeDropdownOpen] = useState(false);

  const fetchS2Attendance = async () => {
    setS2Loading(true);
    try {
      const body = {
        fromDate: toBackendDate(s2FromDate),
        toDate: toBackendDate(s2ToDate),
      };
      const res = await axios.post("/api/payroll/attendance-overview", body, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });

      const rawChart = res.data.chartData || [];
      const rawList = res.data.detailedList || [];

      if (selectedEmployee) {
        const filtered = rawList.filter((item) =>
          item.name.toLowerCase().includes(selectedEmployee.toLowerCase()),
        );

        const statusCount = {
          "On-time": 0,
          Late: 0,
          Leave: 0,
          OffDay: 0,
          ncns: 0,
        };
        filtered.forEach((item) => {
          if (statusCount[item.type] !== undefined) statusCount[item.type]++;
        });
        const total = Object.values(statusCount).reduce((a, b) => a + b, 0);
        const filteredChart = Object.entries(statusCount).map(
          ([name, value]) => ({
            name,
            value,
            percentage: total > 0 ? ((value / total) * 100).toFixed(1) : "0.0",
          }),
        );

        setS2AttChart(filteredChart);
        setS2AttList(filtered);
      } else {
        setS2AttChart(rawChart);
        setS2AttList(rawList);
      }
      setS2ClickedType(null);
    } catch {
      toast.error("Failed to load attendance data");
    } finally {
      setS2Loading(false);
    }
  };

  const saveBonus = async () => {
    try {
      const payload = {
        empId: selectedEmpForBonus.empId,
        periodStart: toBackendDate(salaryFromDate),
        periodEnd: toBackendDate(salaryToDate),
        bonusDetails: bonusItems.map((b) => ({
          amount: Number(b.amount),
          reason: b.reason,
          type: b.type,
        })),
      };

      await axios.post("/api/payroll/update-bonus", payload, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });

      toast.success("Bonus saved");

      setBonusModalOpen(false);
      fetchSalarySummary(); // refresh table
    } catch (err) {
      toast.error("Failed to save bonus");
    }
  };

  const fetchS2Performance = async () => {
    setS2Loading(true);
    try {
      const res = await axios.post(
        "/api/payroll/performance-overview",
        {
          fromDate: toBackendDate(s2FromDate),
          toDate: toBackendDate(s2ToDate),
        },
        { headers: { Authorization: `Bearer ${getToken()}` } },
      );

      const rawPerf = res.data.performance || [];
      const filtered = selectedEmployee
        ? rawPerf.filter((emp) =>
            emp.name.toLowerCase().includes(selectedEmployee.toLowerCase()),
          )
        : rawPerf;

      setS2PerfData(filtered);
    } catch {
      toast.error("Failed to load performance data");
    } finally {
      setS2Loading(false);
    }
  };

  const loadS2Data = () => {
    if (s2Filter === "Attendance") fetchS2Attendance();
    else fetchS2Performance();
  };

  // ── Salary ─────────────────────────────────────────────────────────────────
  const [salaryFromDate, setSalaryFromDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [salaryToDate, setSalaryToDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [salarySummary, setSalarySummary] = useState([]);
  const [salaryTotals, setSalaryTotals] = useState({
    totalBaseSalary: 0,
    totalOT: 0,
    totalDeductions: 0,
    totalNetPayable: 0,
  });
  const [salaryLoading, setSalaryLoading] = useState(false);
  const [salarySearch, setSalarySearch] = useState("");
  const [expandedEmployees, setExpandedEmployees] = useState({});

  const toggleEmployeeExpansion = (empId) =>
    setExpandedEmployees((prev) => ({ ...prev, [empId]: !prev[empId] }));

  // ── Presets ────────────────────────────────────────────────────────────────
  const toISO = (d) => d.toISOString().split("T")[0];
  const todayISO = () => toISO(new Date());

  const getCurrentPayPeriod = () => {
    const now = new Date();
    const day = now.getDate();
    const yr = now.getFullYear();
    const mo = now.getMonth();

    let from, to;
    if (day >= 18) {
      from = new Date(yr, mo, 19);
      to = new Date(yr, mo + 1, 18);
    } else {
      from = new Date(yr, mo - 1, 19);
      to = new Date(yr, mo, 18);
    }
    return { from: toISO(from), to: toISO(to) };
  };

  const getLastPayPeriod = () => {
    const now = new Date();
    const day = now.getDate();
    const yr = now.getFullYear();
    const mo = now.getMonth();

    let from, to;
    if (day >= 18) {
      from = new Date(yr, mo - 1, 19);
      to = new Date(yr, mo, 18);
    } else {
      from = new Date(yr, mo - 2, 19);
      to = new Date(yr, mo - 1, 18);
    }
    return { from: toISO(from), to: toISO(to) };
  };

  const getCurrentWeek = () => {
    const now = new Date();
    const dayOfWk = now.getDay();
    const diffToMon = dayOfWk === 0 ? -6 : 1 - dayOfWk;
    const mon = new Date(now);
    mon.setDate(now.getDate() + diffToMon);
    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);
    return { from: toISO(mon), to: toISO(sun) };
  };

  const resolvePreset = (preset) => {
    if (preset === "today") return { from: todayISO(), to: todayISO() };
    if (preset === "week") return getCurrentWeek();
    if (preset === "month") return getCurrentPayPeriod();
    if (preset === "lastMonth") return getLastPayPeriod();
    return null;
  };

  const applyPresetS1 = (preset) => {
    const range = resolvePreset(preset);
    if (range) {
      setS1FromDate(range.from);
      setS1ToDate(range.to);
    }
  };

  const applyPresetS2 = (preset) => {
    const range = resolvePreset(preset);
    if (range) {
      setS2FromDate(range.from);
      setS2ToDate(range.to);
    }
  };

  const applyPresetSalary = (preset) => {
    const range = resolvePreset(preset);
    if (range) {
      setSalaryFromDate(range.from);
      setSalaryToDate(range.to);
    }
  };

  // ── Salary fetch ───────────────────────────────────────────────────────────
  const fetchSalarySummary = async () => {
    setSalaryLoading(true);
    try {
      const res = await axios.post(
        "/api/payroll/report",
        {
          fromDate: toBackendDate(salaryFromDate),
          toDate: toBackendDate(salaryToDate),
          search: salarySearch,
        },
        { headers: { Authorization: `Bearer ${getToken()}` } },
      );
      setSalarySummary(res.data.report || []);
      setSalaryTotals(
        res.data.grandTotals || {
          totalBaseSalary: 0,
          totalOT: 0,
          totalDeductions: 0,
          totalNetPayable: 0,
        },
      );
    } catch {
      toast.error("Failed to load salary data");
    } finally {
      setSalaryLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      const res = await axios.post(
        "/api/payroll/export",
        {
          fromDate: toBackendDate(salaryFromDate),
          toDate: toBackendDate(salaryToDate),
          format: "csv",
        },
        {
          headers: { Authorization: `Bearer ${getToken()}` },
          responseType: "blob",
        },
      );
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = `payroll-${salaryFromDate}-${salaryToDate}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success("Report exported");
    } catch {
      toast.error("Export failed");
    }
  };

  const ratingColor = (rating) => {
    switch (rating) {
      case "Excellent":
        return "bg-green-100 text-green-800";
      case "Good":
        return "bg-blue-100 text-blue-800";
      case "Average":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-red-100 text-red-800";
    }
  };

  // ── Attendance chart + table block ────────────────────────────────────────
  const AttendanceBlock = ({
    chart,
    list,
    clickedType,
    setClickedType,
    employeeLabel,
  }) => (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          {chart.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={chart}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  labelLine={false}
                  label={({ name, percentage }) => `${name}: ${percentage}%`}
                  dataKey="value"
                  onClick={(entry) => setClickedType(entry.name)}
                  cursor="pointer"
                >
                  {chart.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-400 bg-gray-50 rounded-xl">
              <div className="text-center">
                <AlertCircle className="mx-auto mb-2" size={32} />
                <p className="text-sm">No data — click Load</p>
              </div>
            </div>
          )}
        </div>
        <div className="space-y-2">
          {chart.map((item, i) => (
            <div
              key={i}
              onClick={() => setClickedType(item.name)}
              className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition"
            >
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: COLORS[i % COLORS.length] }}
              />
              <span className="font-medium text-gray-800">{item.name}</span>
              <span className="ml-auto text-gray-600">{item.value}</span>
              <span className="text-xs text-gray-400">
                ({item.percentage}%)
              </span>
            </div>
          ))}
        </div>
      </div>

      {clickedType && list.length > 0 && (
        <div className="mt-6 border-t border-gray-200 pt-6 max-h-96 overflow-y-auto">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <UserCheck size={14} />
            {clickedType}
            {employeeLabel ? ` — ${employeeLabel}` : ""}
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">
                    Date
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">
                    Employee
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">
                    Type
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">
                    Reason
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {list
                  .filter(
                    (item) =>
                      item.type.toLowerCase() === clickedType.toLowerCase(),
                  )
                  .map((item, i) => (
                    <tr key={i} className="hover:bg-gray-50/50">
                      <td className="px-4 py-2 text-sm">{item.date}</td>
                      <td className="px-4 py-2 text-sm font-medium text-gray-700">
                        {item.name}
                      </td>
                      <td className="px-4 py-2 text-sm">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                            item.type === "On-time"
                              ? "bg-green-100 text-green-700"
                              : item.type === "Late"
                                ? "bg-yellow-100 text-yellow-700"
                                : item.type === "Leave"
                                  ? "bg-blue-100 text-blue-700"
                                  : item.type === "NCNS"
                                    ? "bg-gray-100 text-gray-700"
                                    : "bg-red-100 text-red-700"
                          }`}
                        >
                          {item.type}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-500">
                        {item.reason || "—"}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );

  const PerformanceBlock = ({ data }) =>
    data.length > 0 ? (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">
                Employee
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500">
                Score
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500">
                Present
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500">
                Off Day
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500">
                Late
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500">
                Leave
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500">
                NCNS
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">
                Rating
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data.map((emp) => (
              <tr key={emp.empId} className="hover:bg-gray-50/50 transition">
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-900">{emp.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    ID: {emp.empId}
                  </p>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold text-sm">
                    {emp.performanceScore}
                  </span>
                </td>
                <td className="px-4 py-3 text-center text-green-600 font-medium">
                  {emp.presentDays}
                </td>
                <td className="px-4 py-3 text-center text-red-600 font-medium">
                  {emp.OffDayDays}
                </td>
                <td className="px-4 py-3 text-center text-yellow-600 font-medium">
                  {emp.lateDays}
                </td>
                <td className="px-4 py-3 text-center text-blue-600 font-medium">
                  {emp.leaveDays}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold ${ratingColor(emp.rating)}`}
                  >
                    {emp.rating}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ) : (
      <div className="text-center py-12 text-gray-400 bg-gray-50 rounded-xl">
        <AlertCircle className="mx-auto mb-2" size={32} />
        <p>No data — select a date range and click Load</p>
      </div>
    );

  return (
    <div className="p-4 md:p-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800 tracking-tight">
            Payroll Reports
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Track employee attendance, performance, and salary reports
          </p>
        </div>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 transition shadow-sm text-sm font-medium"
        >
          <Download size={16} /> Export CSV
        </button>
      </div>

      {/* Section 1: All Employees */}
      <SectionCard title="Section 1: Attendance & Performance Overview (All Employees)">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
          <DatePickerField
            label="From Date"
            value={s1FromDate}
            onChange={setS1FromDate}
            pickerRef={attFromRef}
          />
          <DatePickerField
            label="To Date"
            value={s1ToDate}
            onChange={setS1ToDate}
            pickerRef={attToRef}
            minDate={s1FromDate}
          />

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">
              View
            </label>
            <select
              value={s1Filter}
              onChange={(e) => setS1Filter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl bg-white shadow-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm"
            >
              <option value="Attendance">Attendance</option>
              <option value="Performance">Performance</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={loadS1Data}
              disabled={s1Loading}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition shadow-sm text-sm font-medium disabled:opacity-50"
            >
              {s1Loading ? (
                <Loader2 size={16} className="animate-spin mx-auto" />
              ) : (
                "Load Report"
              )}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          {[
            ["today", "Today"],
            ["week", "This Week"],
            ["month", "This Month"],
          ].map(([p, label]) => (
            <button
              key={p}
              onClick={() => applyPresetS1(p)}
              className="px-3 py-1 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition text-xs font-medium"
            >
              {label}
            </button>
          ))}
        </div>

        {s1Filter === "Attendance" && (
          <AttendanceBlock
            chart={s1AttChart}
            list={s1AttList}
            clickedType={s1ClickedType}
            setClickedType={setS1ClickedType}
            employeeLabel={null}
          />
        )}
        {s1Filter === "Performance" && <PerformanceBlock data={s1PerfData} />}
      </SectionCard>

      {/* Section 2: Individual Employee */}
      <SectionCard
        title="Section 2: Individual Attendance & Performance"
        className="mt-6"
      >
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
          <DatePickerField
            label="From Date"
            value={s2FromDate}
            onChange={setS2FromDate}
            pickerRef={indFromRef}
          />
          <DatePickerField
            label="To Date"
            value={s2ToDate}
            onChange={setS2ToDate}
            pickerRef={indToRef}
            minDate={s2FromDate}
          />

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">
              View
            </label>
            <select
              value={s2Filter}
              onChange={(e) => setS2Filter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl bg-white shadow-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm"
            >
              <option value="Attendance">Attendance</option>
              <option value="Performance">Performance</option>
            </select>
          </div>

          <div className="relative">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Employee
            </label>
            <input
              type="text"
              placeholder="Search employee..."
              value={selectedEmployee}
              onChange={(e) => {
                setSelectedEmployee(e.target.value);
                setSelectedEmployeeId("");
                setEmployeeDropdownOpen(true);
              }}
              onFocus={() => setEmployeeDropdownOpen(true)}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl bg-white shadow-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm"
            />
            {employeeDropdownOpen && (
              <ul className="absolute z-50 w-full max-h-56 overflow-y-auto bg-white border border-gray-200 rounded-xl mt-1 shadow-lg">
                <li
                  onClick={() => {
                    setSelectedEmployee("");
                    setSelectedEmployeeId("");
                    setEmployeeDropdownOpen(false);
                  }}
                  className="px-3 py-2 cursor-pointer hover:bg-blue-50 text-sm text-gray-500 italic border-b border-gray-100"
                >
                  All employees
                </li>
                {employees
                  .filter(
                    (emp) =>
                      !selectedEmployee ||
                      `${emp.firstName} ${emp.lastName}`
                        .toLowerCase()
                        .includes(selectedEmployee.toLowerCase()) ||
                      emp.employeeNumber
                        .toLowerCase()
                        .includes(selectedEmployee.toLowerCase()),
                  )
                  .map((emp) => (
                    <li
                      key={emp._id}
                      onClick={() => {
                        setSelectedEmployee(`${emp.firstName} ${emp.lastName}`);
                        setSelectedEmployeeId(emp._id);
                        setEmployeeDropdownOpen(false);
                      }}
                      className="px-3 py-2 cursor-pointer hover:bg-gray-100 text-sm transition"
                    >
                      {emp.firstName} {emp.lastName}
                      <span className="ml-1 text-xs text-gray-400">
                        ({emp.employeeNumber})
                      </span>
                    </li>
                  ))}
              </ul>
            )}
          </div>

          <div className="flex items-end">
            <button
              onClick={loadS2Data}
              disabled={s2Loading}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition shadow-sm text-sm font-medium disabled:opacity-50"
            >
              {s2Loading ? (
                <Loader2 size={16} className="animate-spin mx-auto" />
              ) : (
                "Load Report"
              )}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          {[
            ["today", "Today"],
            ["week", "This Week"],
            ["month", "This Month"],
          ].map(([p, label]) => (
            <button
              key={p}
              onClick={() => applyPresetS2(p)}
              className="px-3 py-1 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition text-xs font-medium"
            >
              {label}
            </button>
          ))}
        </div>

        {s2Filter === "Attendance" && (
          <AttendanceBlock
            chart={s2AttChart}
            list={s2AttList}
            clickedType={s2ClickedType}
            setClickedType={setS2ClickedType}
            employeeLabel={selectedEmployee || "All Employees"}
          />
        )}
        {s2Filter === "Performance" && <PerformanceBlock data={s2PerfData} />}
      </SectionCard>

      {/* Section 3: Salary & Payroll */}
      <SectionCard title="Section 3: Salary & Payroll" className="mt-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <DatePickerField
            label="From Date"
            value={salaryFromDate}
            onChange={setSalaryFromDate}
            pickerRef={salFromRef}
          />
          <DatePickerField
            label="To Date"
            value={salaryToDate}
            onChange={setSalaryToDate}
            pickerRef={salToRef}
            minDate={salaryFromDate}
          />
          <div className="flex items-end">
            <button
              onClick={fetchSalarySummary}
              disabled={salaryLoading}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition shadow-sm text-sm font-medium disabled:opacity-50"
            >
              {salaryLoading ? (
                <Loader2 size={16} className="animate-spin mx-auto" />
              ) : (
                "Load Report"
              )}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          {[
            ["today", "Today"],
            ["month", "This Month"],
            ["lastMonth", "Last Month"],
          ].map(([p, label]) => (
            <button
              key={p}
              onClick={() => applyPresetSalary(p)}
              className="px-3 py-1 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition text-xs font-medium"
            >
              {label}
            </button>
          ))}
        </div>

        {/* Totals */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard
            label="Total Base Salary"
            value={`PKR ${(salaryTotals.totalBaseSalary || 0).toLocaleString("en-PK", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
            icon={DollarSign}
            color="blue"
          />
          <StatCard
            label="Total OT"
            value={`PKR ${(salaryTotals.totalOT || 0).toLocaleString("en-PK", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
            icon={TrendingUp}
            color="green"
          />
          <StatCard
            label="Total Deductions"
            value={`PKR ${(salaryTotals.totalDeductions || 0).toLocaleString("en-PK", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
            icon={TrendingDown}
            color="red"
          />
          <StatCard
            label="Total Net Payable"
            value={`PKR ${(salaryTotals.totalNetPayable || 0).toLocaleString("en-PK", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
            icon={Users}
            color="purple"
          />
        </div>

        {/* Search */}
        <div className="mb-4 flex gap-3">
          <div className="relative flex-1">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              value={salarySearch}
              onChange={(e) => setSalarySearch(e.target.value)}
              placeholder="Search by name or employee number..."
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl bg-white shadow-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm"
            />
          </div>
          <button
            onClick={fetchSalarySummary}
            disabled={salaryLoading}
            className="px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition shadow-sm text-sm font-medium disabled:opacity-50"
          >
            {salaryLoading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              "Search"
            )}
          </button>
        </div>

        {/* Salary table */}
        {salarySummary.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">
                    Employee
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">
                    Base Salary
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">
                    Deductions
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">
                    OT
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">
                    Net Payable
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500">
                    Details
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {salarySummary.map((emp) => (
                  <React.Fragment key={emp.empId}>
                    <tr className="hover:bg-gray-50/50 transition">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{emp.name}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          ID: {emp.empNumber}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        PKR{" "}
                        {emp.baseSalary.toLocaleString("en-PK", {
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 0,
                        })}
                      </td>
                      <td className="px-4 py-3 text-right text-red-600">
                        PKR{" "}
                        {emp.totalDeduction.toLocaleString("en-PK", {
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 0,
                        })}
                      </td>
                      <td className="px-4 py-3 text-right text-green-600">
                        PKR{" "}
                        {emp.totalOt.toLocaleString("en-PK", {
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 0,
                        })}
                      </td>
                   <td className="px-4 py-3 text-right">
  <div className="flex flex-col items-end gap-1">
    
    <span className="font-semibold text-blue-600">
      PKR {emp.netPayable.toLocaleString()}
    </span>

    {/* SHOW BONUS */}
    {emp.totalBonus > 0 && (
      <>
        <span className="text-xs text-green-600">
          + Bonus: PKR {emp.totalBonus.toLocaleString()}
        </span>

        <button
          onClick={() => viewBonusDetails(emp)}
          className="text-xs text-gray-500 underline"
        >
          View Bonus
        </button>
      </>
    )}

    {/* ADD BONUS */}
    <button
      onClick={() => openBonusModal(emp)}
      className="text-xs text-indigo-600 hover:underline"
    >
      + Add Bonus
    </button>

  </div>
</td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => toggleEmployeeExpansion(emp.empId)}
                          className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 text-sm font-medium"
                        >
                          {expandedEmployees[emp.empId] ? (
                            <ChevronUp size={14} />
                          ) : (
                            <ChevronDown size={14} />
                          )}
                          {expandedEmployees[emp.empId] ? "Hide" : "Details"}
                        </button>
                      </td>
                    </tr>

                    {expandedEmployees[emp.empId] && (
                      <tr>
                        <td colSpan={6} className="bg-blue-50/30 px-4 py-3">
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="bg-white rounded-lg">
                                  {[
                                    "Date",
                                    "Status",
                                    "In",
                                    "Out",
                                    "Hours",
                                    "Base",
                                    "Deduction",
                                    "OT",
                                    "Final",
                                  ].map((h) => (
                                    <th
                                      key={h}
                                      className="px-3 py-2 text-left text-xs font-semibold text-gray-500 border-b"
                                    >
                                      {h}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {emp.dailyAttendance.map((day, i) => (
                                  <tr
                                    key={i}
                                    className="border-b border-gray-100"
                                  >
                                    <td className="px-3 py-2 text-gray-600">
                                      {day.date}
                                    </td>
                                    <td className="px-3 py-2">
                                      <span
                                        className={`inline-flex px-1.5 py-0.5 rounded-full text-xs font-medium ${
                                          day.status === "Present"
                                            ? "bg-green-100 text-green-700"
                                            : day.status === "Late"
                                              ? "bg-yellow-100 text-yellow-700"
                                              : day.status === "Leave"
                                                ? "bg-blue-100 text-blue-700"
                                                : day.status === "NCNS"
                                                  ? "bg-gray-100 text-gray-700"
                                                  : "bg-red-100 text-red-700"
                                        }`}
                                      >
                                        {day.status}
                                      </span>
                                    </td>
                                    <td className="px-3 py-2 text-gray-600">
                                      {day.inTime || "--"}
                                    </td>
                                    <td className="px-3 py-2 text-gray-600">
                                      {day.outTime || "--"}
                                    </td>
                                    <td className="px-3 py-2 text-right text-gray-600">
                                      {day.hoursWorked.toFixed(2)}
                                    </td>
                                    <td className="px-3 py-2 text-right text-gray-600">
                                      PKR {day.basePay.toLocaleString("en-PK")}
                                    </td>
                                    <td className="px-3 py-2 text-right text-red-600">
                                      PKR{" "}
                                      {day.deduction.toLocaleString("en-PK", {
                                        minimumFractionDigits: 0,
                                        maximumFractionDigits: 0,
                                      })}
                                    </td>
                                    <td className="px-3 py-2 text-right text-green-600">
                                      PKR{" "}
                                      {day.otAmount.toLocaleString("en-PK", {
                                        minimumFractionDigits: 0,
                                        maximumFractionDigits: 0,
                                      })}
                                    </td>
                                    <td className="px-3 py-2 text-right font-semibold text-blue-600">
                                      PKR{" "}
                                      {day.finalDayEarning.toLocaleString(
                                        "en-PK",
                                        {
                                          minimumFractionDigits: 0,
                                          maximumFractionDigits: 0,
                                        },
                                      )}
                                    </td>
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
          <div className="text-center py-12 text-gray-400 bg-gray-50 rounded-xl">
            <AlertCircle className="mx-auto mb-2" size={32} />
            <p>No data — select a date range and click Load</p>
          </div>
        )}
      </SectionCard>

      {bonusModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-lg p-6 shadow-xl">
            <h2 className="text-lg font-bold mb-4">
              Add Bonus — {selectedEmpForBonus?.name}
            </h2>

            <div className="space-y-3 max-h-64 overflow-y-auto">
              {bonusItems.map((item, index) => (
                <div key={index} className="grid grid-cols-3 gap-2">
                  <input
                    type="number"
                    placeholder="Amount"
                    value={item.amount}
                    onChange={(e) => {
                      const updated = [...bonusItems];
                      updated[index].amount = e.target.value;
                      setBonusItems(updated);
                    }}
                    className="border rounded px-2 py-1 text-sm"
                  />

                  <input
                    type="text"
                    placeholder="Reason"
                    value={item.reason}
                    onChange={(e) => {
                      const updated = [...bonusItems];
                      updated[index].reason = e.target.value;
                      setBonusItems(updated);
                    }}
                    className="border rounded px-2 py-1 text-sm"
                  />

                  <select
                    value={item.type}
                    onChange={(e) => {
                      const updated = [...bonusItems];
                      updated[index].type = e.target.value;
                      setBonusItems(updated);
                    }}
                    className="border rounded px-2 py-1 text-sm"
                  >
                    <option value="manual">Manual</option>
                    <option value="performance">Performance</option>
                    <option value="attendance">Attendance</option>
                  </select>
                </div>
              ))}
            </div>

            <button
              onClick={() =>
                setBonusItems([
                  ...bonusItems,
                  { amount: "", reason: "", type: "manual" },
                ])
              }
              className="mt-3 text-sm text-blue-600"
            >
              + Add Another
            </button>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setBonusModalOpen(false)}
                className="px-3 py-1 bg-gray-200 rounded"
              >
                Cancel
              </button>

              <button
                onClick={saveBonus}
                className="px-3 py-1 bg-blue-600 text-white rounded"
              >
                Save Bonus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
