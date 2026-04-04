import React, { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import {
  X,
  User,
  Calendar,
  Clock,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Wallet,
  Building2,
  CreditCard,
  FileText,
  Phone,
  Home,
  Shield,
  Eye,
  EyeOff,
  AlertCircle,
  Check,
} from "lucide-react";
import toast from "react-hot-toast";

// ─── helpers ─────────────────────────────────────────────────────────────────

const fmt = (n) => (n ?? 0).toLocaleString("en-PK");

const toApiDate = (isoStr) => {
  if (!isoStr) return "";
  const [y, m, d] = isoStr.split("-");
  return `${d}/${m}/${y}`;
};

const isoToDisplay = (isoStr) => {
  if (!isoStr) return "";
  const [y, m, d] = isoStr.split("-");
  return `${d}/${m}/${y}`;
};

const defaultFromDate = () => {
  const now = new Date();
  const day = now.getDate();
  const year = now.getFullYear();
  const month = now.getMonth();
  const start =
    day >= 18 ? new Date(year, month, 18) : new Date(year, month - 1, 18);
  return start.toISOString().split("T")[0];
};

const statusBadge = (status) =>
  ({
    Present: "bg-green-100 text-green-800",
    Late: "bg-yellow-100 text-yellow-800",
    Leave: "bg-blue-100 text-blue-800",
    Absent: "bg-gray-100 text-gray-600",
  })[status] ?? "bg-gray-100 text-gray-600";

// ─── DateRangePicker ──────────────────────────────────────────────────────────
function DateRangePicker({
  fromDate,
  setFromDate,
  toDate,
  setToDate,
  onApply,
  loading,
}) {
  const fromRef = useRef(null);
  const toRef = useRef(null);
  return (
    <div className="flex flex-wrap items-end gap-3 mb-5 pb-4 border-b border-gray-100">
      <div className="relative">
        <label className="block text-xs font-medium text-gray-500 mb-1">
          From
        </label>
        <div
          onClick={() => fromRef.current?.showPicker()}
          className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg cursor-pointer hover:border-blue-400 bg-white text-sm min-w-[130px]"
        >
          <Calendar size={14} className="text-gray-400" />
          <span>{isoToDisplay(fromDate)}</span>
        </div>
        <input
          ref={fromRef}
          type="date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          className="absolute opacity-0 pointer-events-none inset-0 w-full"
        />
      </div>
      <div className="relative">
        <label className="block text-xs font-medium text-gray-500 mb-1">
          To
        </label>
        <div
          onClick={() => toRef.current?.showPicker()}
          className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg cursor-pointer hover:border-blue-400 bg-white text-sm min-w-[130px]"
        >
          <Calendar size={14} className="text-gray-400" />
          <span>{isoToDisplay(toDate)}</span>
        </div>
        <input
          ref={toRef}
          type="date"
          value={toDate}
          min={fromDate}
          onChange={(e) => setToDate(e.target.value)}
          className="absolute opacity-0 pointer-events-none inset-0 w-full"
        />
      </div>
      <button
        onClick={onApply}
        disabled={loading}
        className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
      >
        {loading ? "Loading…" : "Apply"}
      </button>
    </div>
  );
}

// ─── InfoItem ─────────────────────────────────────────────────────────────────
function InfoItem({ label, value, icon: Icon }) {
  return (
    <div className="flex items-start gap-2.5">
      {Icon && (
        <div className="mt-0.5 p-1.5 bg-gray-100 rounded-lg shrink-0">
          <Icon size={13} className="text-gray-500" />
        </div>
      )}
      <div className="min-w-0">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
          {label}
        </p>
        <p className="text-sm text-gray-800 font-medium break-words">
          {value || "—"}
        </p>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function GhostModeView({ employee, onClose }) {
  const [activeSection, setActiveSection] = useState("dashboard");
  const [summaryData, setSummaryData] = useState(null);
  const [dailyBreakdown, setDailyBreakdown] = useState([]);
  const [profilePic, setProfilePic] = useState(null);
  const [fullEmpData, setFullEmpData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showSalary, setShowSalary] = useState(true);
  const fromRef = useRef(null);
  const toRef = useRef(null);

  const [fromDate, setFromDate] = useState(defaultFromDate);
  const [toDate, setToDate] = useState(
    () => new Date().toISOString().split("T")[0],
  );

  const fetchData = useCallback(async () => {
    if (!employee?._id) return;
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const h = { Authorization: `Bearer ${token}` };

      const [breakdownRes, picRes, empRes] = await Promise.allSettled([
        axios.get(`/api/payroll/employee-breakdown/${employee._id}`, {
          params: { fromDate: toApiDate(fromDate), toDate: toApiDate(toDate) },
          headers: h,
        }),
        axios.get(`/api/employees/${employee._id}/profile-picture`, {
          headers: h,
        }),
        axios.get(`/api/employees/${employee._id}`, { headers: h }),
      ]);

      if (
        breakdownRes.status === "fulfilled" &&
        breakdownRes.value.data.success
      ) {
        setDailyBreakdown(breakdownRes.value.data.dailyBreakdown ?? []);
        setSummaryData(breakdownRes.value.data.totals ?? null);
      }
      if (picRes.status === "fulfilled" && picRes.value.data.success) {
        setProfilePic(picRes.value.data.profilePicture?.data ?? null);
      }
      if (empRes.status === "fulfilled" && empRes.value.data.success) {
        setFullEmpData(empRes.value.data.employee ?? null);
      }
    } catch (err) {
      toast.error(
        err.response?.data?.message || "Failed to load employee data",
      );
    } finally {
      setLoading(false);
    }
  }, [employee?._id, fromDate, toDate]);

  useEffect(() => {
    fetchData();
  }, [employee?._id]);

  if (!employee) return null;

  // Merge API data with prop for richest available info
  const emp = fullEmpData ?? employee;
  const initials =
    `${emp.firstName?.[0] ?? ""}${emp.lastName?.[0] ?? ""}`.toUpperCase();

  const TABS = [
    { key: "dashboard", label: "Overview" },
    { key: "attendance", label: "Attendance" },
    { key: "salary", label: "Salary" },
    { key: "documents", label: "Documents" },
  ];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 md:p-6">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[94vh] flex flex-col overflow-hidden">
        {/* ── HEADER ──────────────────────────────────────────────────────── */}
        <div className="bg-gradient-to-r from-slate-800 to-slate-700 text-white flex-shrink-0">
          {/* Top notice bar */}
          <div className="flex items-center justify-between px-5 py-2.5 border-b border-white/10">
            <span className="flex items-center gap-1.5 text-xs text-slate-300">
              <Eye size={12} /> Read-only ghost mode preview
            </span>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-white/15 transition text-slate-300 hover:text-white"
              title="Close (Esc)"
            >
              <X size={18} />
            </button>
          </div>

          {/* Profile strip */}
          <div className="flex items-start gap-5 px-6 py-5">
            {/* Avatar */}
            <div className="relative shrink-0">
              <div className="w-20 h-20 rounded-xl ring-2 ring-white/20 overflow-hidden bg-slate-600 flex items-center justify-center shadow-lg">
                {profilePic ? (
                  <img
                    src={profilePic}
                    alt={initials}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-2xl font-bold text-white/80">
                    {initials}
                  </span>
                )}
              </div>
              <span
                className={`absolute -bottom-1 -right-1 w-4 h-4 border-2 border-slate-700 rounded-full ${
                  emp.status === "Active"
                    ? "bg-green-400"
                    : emp.status === "Frozen"
                      ? "bg-blue-400"
                      : "bg-gray-400"
                }`}
              />
            </div>

            {/* Name & meta */}
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold tracking-tight">
                {emp.firstName} {emp.lastName}
              </h2>
              <p className="text-slate-300 text-sm mt-0.5 truncate">
                {emp.email}
              </p>
              <div className="flex flex-wrap gap-2 mt-2.5">
                <span className="inline-flex items-center gap-1 bg-white/10 px-2.5 py-1 rounded-full text-xs font-medium">
                  <Shield size={10} /> {emp.employeeNumber}
                </span>
                <span className="inline-flex items-center gap-1 bg-white/10 px-2.5 py-1 rounded-full text-xs font-medium">
                  <Building2 size={10} /> {emp.department}
                </span>
                {emp.shift?.start && (
                  <span className="inline-flex items-center gap-1 bg-white/10 px-2.5 py-1 rounded-full text-xs font-medium">
                    <Clock size={10} /> {emp.shift.start} – {emp.shift.end}
                  </span>
                )}
              </div>
            </div>

            {/* Salary badge */}
            {emp.salaryType && (
              <div className="hidden md:flex flex-col items-end shrink-0">
                <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">
                  {emp.salaryType === "monthly"
                    ? "Monthly Salary"
                    : "Hourly Rate"}
                </p>
                <button
                  onClick={() => setShowSalary((v) => !v)}
                  className="flex items-center gap-1.5 text-base font-bold text-white hover:text-slate-200 transition"
                >
                  {showSalary
                    ? `PKR ${
                        emp.salaryType === "monthly"
                          ? (emp.monthlySalary ?? 0).toLocaleString()
                          : `${emp.hourlyRate ?? 0}/hr`
                      }`
                    : "••••••"}
                  {showSalary ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
              </div>
            )}
          </div>

          {/* Date range — always visible in header */}
          <div className="px-6 py-3 border-t border-white/10 flex flex-wrap items-end gap-3">
            <div className="relative">
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                From
              </label>
              <div
                onClick={() => fromRef.current?.showPicker()}
                className="flex items-center gap-2 px-3 py-1.5 border border-white/20 rounded-lg cursor-pointer hover:border-white/40 bg-white/10 text-white text-xs min-w-[120px]"
              >
                <Calendar size={12} className="text-slate-300" />
                <span>{isoToDisplay(fromDate)}</span>
              </div>
              <input
                ref={fromRef}
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="absolute opacity-0 pointer-events-none inset-0 w-full"
              />
            </div>
            <div className="relative">
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                To
              </label>
              <div
                onClick={() => toRef.current?.showPicker()}
                className="flex items-center gap-2 px-3 py-1.5 border border-white/20 rounded-lg cursor-pointer hover:border-white/40 bg-white/10 text-white text-xs min-w-[120px]"
              >
                <Calendar size={12} className="text-slate-300" />
                <span>{isoToDisplay(toDate)}</span>
              </div>
              <input
                ref={toRef}
                type="date"
                value={toDate}
                min={fromDate}
                onChange={(e) => setToDate(e.target.value)}
                className="absolute opacity-0 pointer-events-none inset-0 w-full"
              />
            </div>
            <button
              onClick={fetchData}
              disabled={loading}
              className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold rounded-lg transition disabled:opacity-50"
            >
              {loading ? "Loading…" : "Apply"}
            </button>
            <span className="text-[10px] text-slate-400 self-end pb-1.5">
              Data shown for selected period
            </span>
          </div>

          {/* Tab nav */}
          <div className="flex px-4 overflow-x-auto">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveSection(tab.key)}
                className={`px-5 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition ${
                  activeSection === tab.key
                    ? "border-blue-400 text-white"
                    : "border-transparent text-slate-400 hover:text-white"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── CONTENT ─────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto bg-gray-50 relative">
          {loading && (
            <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-10 flex items-center justify-center">
              <div className="w-7 h-7 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          {/* ── OVERVIEW ──────────────────────────────────────────────────── */}
          {activeSection === "dashboard" && (
            <div className="p-5 space-y-4">
              {/* Metric cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  {
                    label: "Net Payable",
                    value: `PKR ${fmt(summaryData?.netPayable)}`,
                    icon: Wallet,
                    color: "blue",
                  },
                  {
                    label: "Days Worked",
                    value: summaryData?.presentDays ?? "—",
                    icon: Calendar,
                    color: "green",
                  },
                  {
                    label: "OT Earned",
                    value: `PKR ${fmt(summaryData?.totalOt)}`,
                    icon: TrendingUp,
                    color: "purple",
                  },
                  {
                    label: "Deductions",
                    value: `PKR ${fmt(summaryData?.totalDeduction)}`,
                    icon: TrendingDown,
                    color: "red",
                  },
                ].map(({ label, value, icon: Icon, color }) => (
                  <div
                    key={label}
                    className="bg-white rounded-xl border border-gray-100 shadow-sm p-4"
                  >
                    <div
                      className={`inline-flex p-2 rounded-lg mb-2 ${
                        color === "blue"
                          ? "bg-blue-50"
                          : color === "green"
                            ? "bg-green-50"
                            : color === "purple"
                              ? "bg-purple-50"
                              : "bg-red-50"
                      }`}
                    >
                      <Icon
                        size={15}
                        className={
                          color === "blue"
                            ? "text-blue-600"
                            : color === "green"
                              ? "text-green-600"
                              : color === "purple"
                                ? "text-purple-600"
                                : "text-red-500"
                        }
                      />
                    </div>
                    <p className="text-xs text-gray-500">{label}</p>
                    <p className="text-base font-bold text-gray-800 truncate">
                      {value}
                    </p>
                  </div>
                ))}
              </div>

              {/* Personal + Work details */}
              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                  <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                    <User size={13} className="text-blue-500" /> Personal
                    Information
                  </h3>
                  <div className="space-y-3">
                    <InfoItem
                      label="Full Name"
                      value={`${emp.firstName} ${emp.lastName}`}
                      icon={User}
                    />
                    <InfoItem
                      label="Employee ID"
                      value={emp.employeeNumber}
                      icon={Shield}
                    />
                    <InfoItem label="Email" value={emp.email} icon={FileText} />
                    <InfoItem
                      label="Department"
                      value={emp.department}
                      icon={Building2}
                    />
                    <InfoItem label="Role" value={emp.role} icon={Shield} />
                    {emp.emergencyContact?.name && (
                      <InfoItem
                        label="Emergency Contact"
                        value={`${emp.emergencyContact.name}${emp.emergencyContact.relationship ? ` (${emp.emergencyContact.relationship})` : ""}`}
                        icon={Phone}
                      />
                    )}
                    {emp.emergencyContact?.phone && (
                      <InfoItem
                        label="Emergency Phone"
                        value={emp.emergencyContact.phone}
                        icon={Phone}
                      />
                    )}
                    {emp.address?.city && (
                      <InfoItem
                        label="City / Country"
                        value={[emp.address.city, emp.address.country]
                          .filter(Boolean)
                          .join(", ")}
                        icon={Home}
                      />
                    )}
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                  <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                    <Clock size={13} className="text-green-500" /> Work & Salary
                  </h3>
                  <div className="space-y-3">
                    <InfoItem
                      label="Shift"
                      value={`${emp.shift?.start ?? "—"} → ${emp.shift?.end ?? "—"}`}
                      icon={Clock}
                    />
                    <InfoItem
                      label="Salary Type"
                      value={
                        emp.salaryType === "monthly"
                          ? "Monthly Fixed"
                          : "Hourly"
                      }
                      icon={DollarSign}
                    />
                    {emp.salaryType === "monthly" ? (
                      <InfoItem
                        label="Monthly Salary"
                        value={`PKR ${(emp.monthlySalary ?? 0).toLocaleString()}`}
                        icon={Wallet}
                      />
                    ) : (
                      <InfoItem
                        label="Hourly Rate"
                        value={`PKR ${emp.hourlyRate ?? 0}/hr`}
                        icon={Wallet}
                      />
                    )}
                    <InfoItem label="Status" value={emp.status} icon={Shield} />
                    {summaryData && (
                      <>
                        <InfoItem
                          label="Present Days"
                          value={summaryData.presentDays}
                          icon={Calendar}
                        />
                        <InfoItem
                          label="Absent Days"
                          value={summaryData.absentDays}
                          icon={AlertCircle}
                        />
                        <InfoItem
                          label="Leave Days"
                          value={summaryData.leaveDays}
                          icon={Calendar}
                        />
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
          {/* ── ATTENDANCE ────────────────────────────────────────────────── */}
          {activeSection === "attendance" && (
            <div className="p-5">
              {/* <DateRangePicker
                fromDate={fromDate} setFromDate={setFromDate}
                toDate={toDate}     setToDate={setToDate}
                onApply={fetchData} loading={loading}
              /> */}

              {summaryData && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
                  {[
                    {
                      label: "Working Days",
                      value: summaryData.workingDays,
                      cls: "text-gray-700",
                    },
                    {
                      label: "Present",
                      value: summaryData.presentDays,
                      cls: "text-green-600",
                    },
                    {
                      label: "Late",
                      value: summaryData.lateDays,
                      cls: "text-yellow-600",
                    },
                    {
                      label: "Absent",
                      value: summaryData.absentDays,
                      cls: "text-red-500",
                    },
                    {
                      label: "Leave",
                      value: summaryData.leaveDays,
                      cls: "text-blue-600",
                    },
                  ].map(({ label, value, cls }) => (
                    <div
                      key={label}
                      className="bg-white rounded-xl border border-gray-100 p-3 text-center shadow-sm"
                    >
                      <p className={`text-2xl font-bold ${cls}`}>
                        {value ?? "—"}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
                    </div>
                  ))}
                </div>
              )}

              <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b text-gray-500 text-xs">
                      <tr>
                        {[
                          "Date",
                          "Status",
                          "In / Out",
                          "Hours",
                          "OT",
                          "Deduction",
                          "Day Earning",
                        ].map((h) => (
                          <th
                            key={h}
                            className="px-4 py-3 text-left font-semibold"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {dailyBreakdown.length === 0 ? (
                        <tr>
                          <td
                            colSpan={7}
                            className="px-4 py-10 text-center text-gray-400 text-sm"
                          >
                            No records in this period
                          </td>
                        </tr>
                      ) : (
                        dailyBreakdown.map((day, idx) => (
                          <tr key={idx} className="hover:bg-gray-50 transition">
                            <td className="px-4 py-2.5 font-medium text-gray-800">
                              {day.date}
                            </td>
                            <td className="px-4 py-2.5">
                              <span
                                className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusBadge(day.status)}`}
                              >
                                {day.status ?? "Absent"}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-gray-600 font-mono text-xs">
                              {day.inTime || day.outTime ? (
                                `${day.inTime} / ${day.outTime}`
                              ) : (
                                <span className="text-gray-300">— / —</span>
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-gray-700">
                              {(day.hoursWorked ?? 0).toFixed(2)}
                            </td>
                            <td className="px-4 py-2.5 text-green-600">
                              {(day.otAmount ?? 0) > 0
                                ? `PKR ${fmt(day.otAmount)}`
                                : "—"}
                            </td>
                            <td className="px-4 py-2.5 text-red-500">
                              {(day.deduction ?? 0) > 0
                                ? `PKR ${fmt(day.deduction)}`
                                : "—"}
                            </td>
                            <td className="px-4 py-2.5 font-semibold text-blue-600">
                              PKR {fmt(day.finalDayEarning)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
          {/* ── SALARY ────────────────────────────────────────────────────── */}
          {activeSection === "salary" && (
            <div className="p-5">
              {/* <DateRangePicker
                fromDate={fromDate} setFromDate={setFromDate}
                toDate={toDate}     setToDate={setToDate}
                onApply={fetchData} loading={loading}
              /> */}

              {summaryData ? (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                    {[
                      {
                        label: "Base Salary",
                        v: summaryData.baseSalary,
                        accent: false,
                      },
                      {
                        label: "OT Amount",
                        v: summaryData.totalOt,
                        accent: false,
                      },
                      {
                        label: "Total Deductions",
                        v: summaryData.totalDeduction,
                        accent: false,
                      },
                      {
                        label: "Net Payable",
                        v: summaryData.netPayable,
                        accent: true,
                      },
                    ].map(({ label, v, accent }) => (
                      <div
                        key={label}
                        className={`rounded-xl border p-4 shadow-sm ${accent ? "bg-blue-600 border-blue-600" : "bg-white border-gray-100"}`}
                      >
                        <p
                          className={`text-xs mb-1 ${accent ? "text-blue-100" : "text-gray-500"}`}
                        >
                          {label}
                        </p>
                        <p
                          className={`text-lg font-bold truncate ${accent ? "text-white" : "text-gray-800"}`}
                        >
                          PKR {fmt(v)}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="px-5 py-3 border-b bg-gray-50 flex items-center justify-between">
                      <h3 className="text-sm font-bold text-gray-700">
                        Daily Breakdown
                      </h3>
                      <span className="text-xs text-gray-400">
                        {dailyBreakdown.length} records
                      </span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b text-gray-500 text-xs">
                          <tr>
                            {[
                              "Date",
                              "Status",
                              "In / Out",
                              "Base Pay",
                              "OT",
                              "Deduction",
                              "Final Earning",
                            ].map((h) => (
                              <th
                                key={h}
                                className="px-4 py-3 text-left font-semibold"
                              >
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {dailyBreakdown.length === 0 ? (
                            <tr>
                              <td
                                colSpan={7}
                                className="px-4 py-10 text-center text-gray-400"
                              >
                                No records in this period
                              </td>
                            </tr>
                          ) : (
                            dailyBreakdown.map((day, idx) => (
                              <tr
                                key={idx}
                                className="hover:bg-gray-50 transition"
                              >
                                <td className="px-4 py-2.5 font-medium">
                                  {day.date}
                                </td>
                                <td className="px-4 py-2.5">
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusBadge(day.status)}`}
                                  >
                                    {day.status}
                                  </span>
                                </td>
                                <td className="px-4 py-2.5 text-gray-600 font-mono text-xs">
                                  {day.inTime && day.outTime
                                    ? `${day.inTime} / ${day.outTime}`
                                    : "— / —"}
                                </td>
                                <td className="px-4 py-2.5">
                                  PKR {fmt(day.basePay)}
                                </td>
                                <td className="px-4 py-2.5 text-green-600">
                                  {(day.otAmount ?? 0) > 0
                                    ? `PKR ${fmt(day.otAmount)}`
                                    : "—"}
                                </td>
                                <td className="px-4 py-2.5 text-red-500">
                                  {(day.deduction ?? 0) > 0
                                    ? `PKR ${fmt(day.deduction)}`
                                    : "—"}
                                </td>
                                <td className="px-4 py-2.5 font-bold text-blue-700">
                                  PKR {fmt(day.finalDayEarning)}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                        <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                          <tr>
                            <td
                              colSpan={3}
                              className="px-4 py-3 font-semibold text-gray-700 text-sm"
                            >
                              Total
                            </td>
                            <td className="px-4 py-3 font-bold text-sm">
                              PKR {fmt(summaryData.baseSalary)}
                            </td>
                            <td className="px-4 py-3 font-bold text-green-600 text-sm">
                              PKR {fmt(summaryData.totalOt)}
                            </td>
                            <td className="px-4 py-3 font-bold text-red-500 text-sm">
                              PKR {fmt(summaryData.totalDeduction)}
                            </td>
                            <td className="px-4 py-3 font-bold text-blue-700 text-sm">
                              PKR {fmt(summaryData.netPayable)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-12 text-gray-400">
                  No salary data for the selected period
                </div>
              )}
            </div>
          )}
          {/* ── DOCUMENTS ─────────────────────────────────────────────────── */}
          {activeSection === "documents" && (
            <div className="p-5 space-y-4">
              {/* Bank */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                  <CreditCard size={13} className="text-green-500" /> Bank
                  Details
                </h3>
                {emp.bank?.bankName ? (
                  <div className="grid md:grid-cols-3 gap-4">
                    <InfoItem
                      label="Bank Name"
                      value={emp.bank.bankName}
                      icon={Building2}
                    />
                    <InfoItem
                      label="Account Name"
                      value={emp.bank.accountName}
                      icon={User}
                    />
                    <InfoItem
                      label="IBAN"
                      value={emp.bank.accountNumber}
                      icon={CreditCard}
                    />
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 italic">
                    No bank details on file
                  </p>
                )}
              </div>

              {/* Emergency contact */}
              {(emp.emergencyContact?.name || emp.emergencyContact?.phone) && (
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                  <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                    <Phone size={13} className="text-red-500" /> Emergency
                    Contact
                  </h3>
                  <div className="grid md:grid-cols-3 gap-4">
                    <InfoItem
                      label="Name"
                      value={emp.emergencyContact.name}
                      icon={User}
                    />
                    <InfoItem
                      label="Relationship"
                      value={emp.emergencyContact.relationship}
                      icon={Shield}
                    />
                    <InfoItem
                      label="Phone"
                      value={emp.emergencyContact.phone}
                      icon={Phone}
                    />
                  </div>
                </div>
              )}

              {/* Address */}
              {emp.address?.city && (
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                  <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                    <Home size={13} className="text-yellow-500" /> Address
                  </h3>
                  <div className="grid md:grid-cols-2 gap-4">
                    {emp.address.street && (
                      <InfoItem
                        label="Street"
                        value={emp.address.street}
                        icon={Home}
                      />
                    )}
                    {emp.address.city && (
                      <InfoItem
                        label="City"
                        value={emp.address.city}
                        icon={Building2}
                      />
                    )}
                    {emp.address.state && (
                      <InfoItem
                        label="State"
                        value={emp.address.state}
                        icon={Building2}
                      />
                    )}
                    {emp.address.zip && (
                      <InfoItem
                        label="ZIP"
                        value={emp.address.zip}
                        icon={FileText}
                      />
                    )}
                    {emp.address.country && (
                      <InfoItem
                        label="Country"
                        value={emp.address.country}
                        icon={Home}
                      />
                    )}
                  </div>
                </div>
              )}

              {/* ID Card (CNIC) - Images Only */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                  <FileText size={13} className="text-purple-500" /> ID Card
                  (CNIC)
                </h3>
                {emp.idCard?.front?.url || emp.idCard?.back?.url ? (
                  <div className="grid md:grid-cols-2 gap-4">
                    {["front", "back"].map((side) => {
                      const card = emp.idCard?.[side];
                      if (!card?.url)
                        return (
                          <div
                            key={side}
                            className="border-2 border-dashed border-gray-200 rounded-xl h-44 flex items-center justify-center"
                          >
                            <div className="text-center text-gray-400">
                              <FileText
                                size={24}
                                className="mx-auto mb-2 opacity-40"
                              />
                              <p className="text-xs capitalize">
                                {side} side — not uploaded
                              </p>
                            </div>
                          </div>
                        );

                      // ✅ Check if it's a valid image (base64 image)
                      const isValidImage = card.url.startsWith("data:image/");
                      const isPDF = card.url.startsWith("data:application/pdf");

                      // ✅ For PDFs or invalid formats, show error message
                      if (!isValidImage || isPDF) {
                        return (
                          <div
                            key={side}
                            className="rounded-xl overflow-hidden border border-red-200 bg-red-50"
                          >
                            <div className="bg-red-100 border-b border-red-200 px-4 py-2 text-xs font-semibold text-red-700 capitalize flex items-center justify-between">
                              <span>{side} Side</span>
                              <span className="text-red-600 text-[10px] bg-red-200 px-2 py-0.5 rounded-full">
                                Invalid format
                              </span>
                            </div>
                            <div className="h-44 flex items-center justify-center bg-red-50/30">
                              <div className="text-center text-red-500">
                                <AlertCircle
                                  size={32}
                                  className="mx-auto mb-2 opacity-60"
                                />
                                <p className="text-xs font-medium">
                                  Only image files supported
                                </p>
                                <p className="text-[10px] mt-1 text-red-400">
                                  Please upload JPEG, PNG, GIF, or WebP
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      }

                      // ✅ Valid image display
                      return (
                        <div
                          key={side}
                          className="rounded-xl overflow-hidden border border-gray-200 bg-white"
                        >
                          <div className="bg-gray-50 border-b border-gray-200 px-4 py-2 text-xs font-semibold text-gray-600 capitalize flex items-center justify-between">
                            <span>{side} Side</span>
                            <span className="text-green-600 text-[10px] bg-green-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                              <Check size={10} /> Image
                            </span>
                          </div>
                          <div className="relative h-44 bg-gray-100">
                            <img
                              src={card.url}
                              alt={`ID Card ${side}`}
                              className="w-full h-full object-contain"
                              onError={(e) => {
                                e.target.onerror = null;
                                e.target.parentElement.innerHTML = `
                        <div class="h-44 flex items-center justify-center bg-red-50">
                          <div class="text-center text-red-500">
                            <AlertCircle size="32" class="mx-auto mb-2 opacity-60" />
                            <p class="text-xs font-medium">Failed to load image</p>
                          </div>
                        </div>
                      `;
                              }}
                            />
                          </div>
                          {card.fileName && (
                            <div className="px-3 py-1.5 bg-gray-50 border-t border-gray-100">
                              <p className="text-[10px] text-gray-500 truncate">
                                {card.fileName}
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-400">
                    <FileText size={32} className="mx-auto mb-2 opacity-30" />
                    <p className="text-sm italic">
                      No ID card documents on file
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      ID card images will appear here once uploaded
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── FOOTER ──────────────────────────────────────────────────────── */}
        <div className="flex-shrink-0 bg-white border-t border-gray-200 px-5 py-3 flex items-center justify-between">
          <p className="text-xs text-gray-400 flex items-center gap-1.5">
            <Eye size={12} /> Read-only preview — ghost mode
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 text-white text-sm font-medium rounded-lg hover:bg-slate-700 transition"
          >
            Close Preview
          </button>
        </div>
      </div>
    </div>
  );
}
