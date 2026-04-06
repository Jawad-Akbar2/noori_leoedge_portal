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
  MapPin,
  Mail,
  Hash,
  Briefcase,
  UserCircle,
  Activity,
  PieChart,
  Download,
} from "lucide-react";
import toast from "react-hot-toast";
import { useEscape } from "../../context/EscapeStack";

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
    Present:
      "bg-gradient-to-r from-green-100 to-green-200 text-green-800 border border-green-200/50",
    Late: "bg-gradient-to-r from-yellow-100 to-yellow-200 text-yellow-800 border border-yellow-200/50",
    Leave:
      "bg-gradient-to-r from-blue-100 to-blue-200 text-blue-800 border border-blue-200/50",
    Absent:
      "bg-gradient-to-r from-gray-100 to-gray-200 text-gray-600 border border-gray-200/50",
    ncns: "bg-gradient-to-r from-gray-100 to-gray-200 text-gray-600 border border-gray-200/50",
  })[status] ??
  "bg-gradient-to-r from-gray-100 to-gray-200 text-gray-600 border border-gray-200/50";

// ─── InfoItem ─────────────────────────────────────────────────────────────────
function InfoItem({ label, value, icon: Icon, highlight = false }) {
  return (
    <div
      className={`flex items-start gap-3 p-2 rounded-lg transition-all ${highlight ? "bg-blue-50/50" : "hover:bg-gray-50"}`}
    >
      {Icon && (
        <div className="mt-0.5 p-1.5 bg-white rounded-lg shadow-sm shrink-0">
          <Icon size={14} className="text-gray-500" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
          {label}
        </p>
        <p
          className={`text-sm font-medium break-words ${highlight ? "text-blue-700" : "text-gray-800"}`}
        >
          {value || "—"}
        </p>
      </div>
    </div>
  );
}

// ─── StatCard ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, icon: Icon, color, trend, trendValue }) {
  const colorClasses = {
    blue: "from-blue-50 to-blue-100/50 border-blue-200 text-blue-700",
    green: "from-green-50 to-green-100/50 border-green-200 text-green-700",
    purple: "from-purple-50 to-purple-100/50 border-purple-200 text-purple-700",
    red: "from-red-50 to-red-100/50 border-red-200 text-red-700",
    orange: "from-orange-50 to-orange-100/50 border-orange-200 text-orange-700",
  };

  return (
    <div
      className={`bg-gradient-to-r ${colorClasses[color]} rounded-xl border p-4 shadow-sm`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="p-1.5 bg-white/50 rounded-lg">
          <Icon size={16} />
        </div>
        {trend && (
          <span
            className={`text-[10px] font-semibold flex items-center gap-0.5 ${trend > 0 ? "text-green-600" : "text-red-600"}`}
          >
            {trend > 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
            {Math.abs(trend)}%
          </span>
        )}
      </div>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function GhostModeView({ employee, onClose }) {
   useEscape(onClose);
  const [activeSection, setActiveSection] = useState("overview");
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

  const emp = fullEmpData ?? employee;
  const initials =
    `${emp.firstName?.[0] ?? ""}${emp.lastName?.[0] ?? ""}`.toUpperCase();

  const sections = [
    { key: "overview", label: "Overview", icon: PieChart },
    { key: "attendance", label: "Attendance", icon: Calendar },
    { key: "salary", label: "Salary Breakdown", icon: DollarSign },
    { key: "documents", label: "Documents", icon: FileText },
  ];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 md:p-6 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[94vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        {/* ── HEADER ──────────────────────────────────────────────────────── */}
        <div className="bg-gradient-to-r from-slate-800 to-slate-900 text-white flex-shrink-0">
          {/* Ghost mode badge */}
          <div className="flex items-center justify-between px-6 py-2.5 border-b border-white/10">
            <div className="flex items-center gap-2">
              <div className="p-1 rounded-lg bg-blue-500/20">
                <Eye size={12} className="text-blue-300" />
              </div>
              <span className="text-xs text-slate-300 font-medium">
                Read-only ghost mode preview
              </span>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-white/15 transition text-slate-300 hover:text-white"
              title="Close (Esc)"
            >
              <X size={18} />
            </button>
          </div>

          {/* Profile section */}
          <div className="px-6 py-5">
            <div className="flex flex-col md:flex-row md:items-center gap-5">
              {/* Avatar */}
              <div className="relative shrink-0 self-start">
                <div className="w-20 h-20 rounded-xl ring-2 ring-white/20 overflow-hidden bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center shadow-lg">
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
                  className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 border-2 border-slate-800 rounded-full ${
                    emp.status === "Active"
                      ? "bg-green-400"
                      : emp.status === "Frozen"
                        ? "bg-blue-400"
                        : "bg-gray-400"
                  }`}
                />
              </div>

              {/* Name & details */}
              <div className="flex-1 min-w-0">
                <h2 className="text-2xl font-bold tracking-tight">
                  {emp.firstName} {emp.lastName}
                </h2>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
                  <p className="text-slate-300 text-sm flex items-center gap-1">
                    <Mail size={12} /> {emp.email}
                  </p>
                  <p className="text-slate-300 text-sm flex items-center gap-1">
                    <Hash size={12} /> ID: {emp.employeeNumber}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 mt-3">
                  <span className="inline-flex items-center gap-1.5 bg-white/10 px-3 py-1 rounded-full text-xs font-medium">
                    <Building2 size={10} /> {emp.department}
                  </span>
                  <span className="inline-flex items-center gap-1.5 bg-white/10 px-3 py-1 rounded-full text-xs font-medium">
                    <Shield size={10} /> {emp.role || "Employee"}
                  </span>
                  {emp.shift?.start && (
                    <span className="inline-flex items-center gap-1.5 bg-white/10 px-3 py-1 rounded-full text-xs font-medium">
                      <Clock size={10} /> {emp.shift.start} – {emp.shift.end}
                    </span>
                  )}
                </div>
              </div>

              {/* Salary badge - desktop */}
              {emp.salaryType && (
                <div className="hidden lg:flex flex-col items-end shrink-0">
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">
                    {emp.salaryType === "monthly"
                      ? "Monthly Salary"
                      : "Hourly Rate"}
                  </p>
                  <button
                    onClick={() => setShowSalary((v) => !v)}
                    className="flex items-center gap-2 text-xl font-bold text-white hover:text-slate-200 transition"
                  >
                    {showSalary
                      ? emp.salaryType === "monthly"
                        ? `PKR ${(emp.monthlySalary ?? 0).toLocaleString()}`
                        : `PKR ${emp.hourlyRate ?? 0}/hr`
                      : "••••••"}
                    {showSalary ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              )}
            </div>

            {/* Date range selector - integrated */}
            <div className="flex flex-wrap items-end gap-3 mt-5 pt-3 border-t border-white/10">
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
                className="px-4 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold rounded-lg transition disabled:opacity-50 shadow-sm"
              >
                {loading ? "Loading..." : "Apply Range"}
              </button>
              <span className="text-[10px] text-slate-400 hidden sm:inline">
                Data shown for selected period
              </span>
            </div>
          </div>

          {/* Navigation tabs */}
          <div className="flex px-6 gap-1 overflow-x-auto scrollbar-hide">
            {sections.map((section) => (
              <button
                key={section.key}
                onClick={() => setActiveSection(section.key)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-all duration-200 ${
                  activeSection === section.key
                    ? "border-blue-400 text-white"
                    : "border-transparent text-slate-400 hover:text-white hover:border-slate-600"
                }`}
              >
                <section.icon size={14} />
                {section.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── CONTENT ─────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto bg-gradient-to-br from-gray-50 to-white relative">
          {loading && (
            <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-10 flex items-center justify-center">
              <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {/* ══ OVERVIEW ══════════════════════════════════════════════════════ */}
          {activeSection === "overview" && (
            <div className="p-5 space-y-5">
              {/* Stats grid */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatCard
                  label="Net Payable"
                  value={`PKR ${fmt(summaryData?.netPayable)}`}
                  icon={Wallet}
                  color="blue"
                />
                <StatCard
                  label="Days Worked"
                  value={summaryData?.presentDays ?? "—"}
                  icon={Calendar}
                  color="green"
                />
                <StatCard
                  label="OT Earned"
                  value={`PKR ${fmt(summaryData?.totalOt)}`}
                  icon={TrendingUp}
                  color="purple"
                />
                <StatCard
                  label="Deductions"
                  value={`PKR ${fmt(summaryData?.totalDeduction)}`}
                  icon={TrendingDown}
                  color="red"
                />
              </div>

              {/* Two-column info grid */}
              <div className="grid lg:grid-cols-2 gap-5">
                {/* Personal Information Card */}
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="px-5 py-3 bg-gradient-to-r from-gray-50 to-white border-b border-gray-100">
                    <div className="flex items-center gap-2">
                      <div className="p-1 rounded-lg bg-blue-100">
                        <UserCircle size={14} className="text-blue-600" />
                      </div>
                      <h3 className="font-semibold text-gray-800 text-sm">
                        Personal Information
                      </h3>
                    </div>
                  </div>
                  <div className="p-4 space-y-1">
                    <InfoItem
                      label="Full Name"
                      value={`${emp.firstName} ${emp.lastName}`}
                      icon={User}
                    />
                    <InfoItem
                      label="Employee ID"
                      value={emp.employeeNumber}
                      icon={Hash}
                    />
                    <InfoItem
                      label="Email Address"
                      value={emp.email}
                      icon={Mail}
                    />
                    <InfoItem
                      label="Department"
                      value={emp.department}
                      icon={Building2}
                    />
                    <InfoItem
                      label="Role"
                      value={emp.role || "Employee"}
                      icon={Shield}
                    />
                    <InfoItem
                      label="Status"
                      value={emp.status}
                      icon={Activity}
                    />
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
                        label="Location"
                        value={[emp.address.city, emp.address.country]
                          .filter(Boolean)
                          .join(", ")}
                        icon={MapPin}
                      />
                    )}
                  </div>
                </div>

                {/* Work & Salary Card */}
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="px-5 py-3 bg-gradient-to-r from-gray-50 to-white border-b border-gray-100">
                    <div className="flex items-center gap-2">
                      <div className="p-1 rounded-lg bg-green-100">
                        <Briefcase size={14} className="text-green-600" />
                      </div>
                      <h3 className="font-semibold text-gray-800 text-sm">
                        Work & Compensation
                      </h3>
                    </div>
                  </div>
                  <div className="p-4 space-y-1">
                    <InfoItem
                      label="Shift Schedule"
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
                        highlight
                      />
                    ) : (
                      <InfoItem
                        label="Hourly Rate"
                        value={`PKR ${emp.hourlyRate ?? 0}/hr`}
                        icon={Wallet}
                        highlight
                      />
                    )}
                    {summaryData && (
                      <>
                        <div className="border-t border-gray-100 my-2" />
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
                        <InfoItem
                          label="Late Days"
                          value={summaryData.lateDays}
                          icon={Clock}
                        />
                        <InfoItem
                          label="NCNS Days"
                          value={summaryData.ncnsDays}
                          icon={AlertCircle}
                        />
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Recent activity preview */}
              {dailyBreakdown.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="px-5 py-3 bg-gradient-to-r from-gray-50 to-white border-b border-gray-100">
                    <div className="flex items-center gap-2">
                      <div className="p-1 rounded-lg bg-purple-100">
                        <Activity size={14} className="text-purple-600" />
                      </div>
                      <h3 className="font-semibold text-gray-800 text-sm">
                        Recent Activity
                      </h3>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-gray-500 text-xs">
                        <tr>
                          <th className="px-4 py-2.5 text-left font-semibold">
                            Date
                          </th>
                          <th className="px-4 py-2.5 text-left font-semibold">
                            Status
                          </th>
                          <th className="px-4 py-2.5 text-left font-semibold">
                            Hours
                          </th>
                          <th className="px-4 py-2.5 text-left font-semibold">
                            Earnings
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {dailyBreakdown.slice(0, 5).map((day, idx) => (
                          <tr key={idx} className="hover:bg-gray-50 transition">
                            <td className="px-4 py-2 font-medium text-gray-800">
                              {day.date}
                            </td>
                            <td className="px-4 py-2">
                              <span
                                className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusBadge(day.status)}`}
                              >
                                {day.status ?? "Absent"}
                              </span>
                            </td>
                            <td className="px-4 py-2 text-gray-700">
                              {(day.hoursWorked ?? 0).toFixed(2)} hrs
                            </td>
                            <td className="px-4 py-2 font-semibold text-blue-600">
                              PKR {fmt(day.finalDayEarning)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {dailyBreakdown.length > 5 && (
                    <div className="px-4 py-2 border-t border-gray-100 text-center">
                      <button
                        onClick={() => setActiveSection("attendance")}
                        className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                      >
                        View all {dailyBreakdown.length} records →
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ══ ATTENDANCE ════════════════════════════════════════════════════ */}
          {activeSection === "attendance" && (
            <div className="p-5 space-y-4">
              {/* Summary cards */}
              {summaryData && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {[
                    {
                      label: "Working Days",
                      value: summaryData.workingDays,
                      color: "gray",
                    },
                    {
                      label: "Present",
                      value: summaryData.presentDays,
                      color: "green",
                    },
                    {
                      label: "Late",
                      value: summaryData.lateDays,
                      color: "yellow",
                    },
                    {
                      label: "Absent",
                      value: summaryData.absentDays,
                      color: "red",
                    },
                    {
                      label: "Leave",
                      value: summaryData.leaveDays,
                      color: "blue",
                    },
                    {
                      label: "NCNS",
                      value: summaryData.ncnsDays,
                      color: "gray",
                    }
                  ].map(({ label, value, color }) => (
                    <div
                      key={label}
                      className={`bg-white rounded-xl border border-gray-100 p-3 text-center shadow-sm ${
                        color === "green"
                          ? "border-l-4 border-l-green-500"
                          : color === "yellow"
                            ? "border-l-4 border-l-yellow-500"
                            : color === "red"
                              ? "border-l-4 border-l-red-500"
                              : color === "blue"
                                ? "border-l-4 border-l-blue-500"
                                : ""
                      }`}
                    >
                      <p
                        className={`text-2xl font-bold ${
                          color === "green"
                            ? "text-green-600"
                            : color === "yellow"
                              ? "text-yellow-600"
                              : color === "red"
                                ? "text-red-500"
                                : color === "blue"
                                  ? "text-blue-600"
                                  : "text-gray-800"
                        }`}
                      >
                        {value ?? "—"}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Attendance table */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-3 bg-gradient-to-r from-gray-50 to-white border-b border-gray-100">
                  <h3 className="font-semibold text-gray-800 text-sm">
                    Daily Attendance Log
                  </h3>
                </div>
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
                          "Earnings",
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
                            No attendance records in this period
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
                              {day.inTime || day.outTime
                                ? `${day.inTime || "—"} / ${day.outTime || "—"}`
                                : "— / —"}
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

          {/* ══ SALARY BREAKDOWN ══════════════════════════════════════════════ */}
          {activeSection === "salary" && (
            <div className="p-5 space-y-4">
              {summaryData ? (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <StatCard
                      label="Base Salary"
                      value={`PKR ${fmt(summaryData.baseSalary)}`}
                      icon={Wallet}
                      color="blue"
                    />
                    <StatCard
                      label="OT Amount"
                      value={`PKR ${fmt(summaryData.totalOt)}`}
                      icon={TrendingUp}
                      color="purple"
                    />
                    <StatCard
                      label="Deductions"
                      value={`PKR ${fmt(summaryData.totalDeduction)}`}
                      icon={TrendingDown}
                      color="red"
                    />
                    <StatCard
                      label="Net Payable"
                      value={`PKR ${fmt(summaryData.netPayable)}`}
                      icon={DollarSign}
                      color="green"
                    />
                  </div>

                  <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="px-5 py-3 bg-gradient-to-r from-gray-50 to-white border-b border-gray-100 flex items-center justify-between">
                      <h3 className="font-semibold text-gray-800 text-sm">
                        Daily Salary Breakdown
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
                              "Base Pay",
                              "OT",
                              "Deduction",
                              "Final",
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
                                colSpan={6}
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
                                <td className="px-4 py-2.5 font-medium text-gray-800">
                                  {day.date}
                                </td>
                                <td className="px-4 py-2.5">
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusBadge(day.status)}`}
                                  >
                                    {day.status}
                                  </span>
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
                              colSpan={2}
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
                <div className="text-center py-12 bg-white rounded-xl border border-gray-100">
                  <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-gray-100 flex items-center justify-center">
                    <DollarSign size={28} className="text-gray-400" />
                  </div>
                  <p className="text-gray-500 font-medium">
                    No salary data for the selected period
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    Try adjusting the date range
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ══ DOCUMENTS ═════════════════════════════════════════════════════ */}
          {activeSection === "documents" && (
            <div className="p-5 space-y-5">
              {/* Bank Details */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-3 bg-gradient-to-r from-gray-50 to-white border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <div className="p-1 rounded-lg bg-green-100">
                      <CreditCard size={14} className="text-green-600" />
                    </div>
                    <h3 className="font-semibold text-gray-800 text-sm">
                      Bank Details
                    </h3>
                  </div>
                </div>
                <div className="p-4">
                  {emp.bank?.bankName ? (
                    <div className="grid md:grid-cols-3 gap-4">
                      <InfoItem
                        label="Bank Name"
                        value={emp.bank.bankName}
                        icon={Building2}
                      />
                      <InfoItem
                        label="Account Title"
                        value={emp.bank.accountName}
                        icon={User}
                      />
                      <InfoItem
                        label="IBAN / Account #"
                        value={emp.bank.accountNumber}
                        icon={CreditCard}
                      />
                    </div>
                  ) : (
                    <div className="text-center py-6 text-gray-400">
                      <CreditCard
                        size={28}
                        className="mx-auto mb-2 opacity-30"
                      />
                      <p className="text-sm italic">No bank details on file</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Emergency Contact */}
              {(emp.emergencyContact?.name || emp.emergencyContact?.phone) && (
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="px-5 py-3 bg-gradient-to-r from-gray-50 to-white border-b border-gray-100">
                    <div className="flex items-center gap-2">
                      <div className="p-1 rounded-lg bg-red-100">
                        <Phone size={14} className="text-red-600" />
                      </div>
                      <h3 className="font-semibold text-gray-800 text-sm">
                        Emergency Contact
                      </h3>
                    </div>
                  </div>
                  <div className="p-4">
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
                </div>
              )}

              {/* Address */}
              {emp.address?.city && (
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="px-5 py-3 bg-gradient-to-r from-gray-50 to-white border-b border-gray-100">
                    <div className="flex items-center gap-2">
                      <div className="p-1 rounded-lg bg-yellow-100">
                        <Home size={14} className="text-yellow-600" />
                      </div>
                      <h3 className="font-semibold text-gray-800 text-sm">
                        Residential Address
                      </h3>
                    </div>
                  </div>
                  <div className="p-4">
                    <div className="grid md:grid-cols-2 gap-4">
                      {emp.address.street && (
                        <InfoItem
                          label="Street"
                          value={emp.address.street}
                          icon={MapPin}
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
                          label="State/Province"
                          value={emp.address.state}
                          icon={Building2}
                        />
                      )}
                      {emp.address.zip && (
                        <InfoItem
                          label="ZIP Code"
                          value={emp.address.zip}
                          icon={Hash}
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
                </div>
              )}

              {/* ID Card Documents */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-3 bg-gradient-to-r from-gray-50 to-white border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <div className="p-1 rounded-lg bg-purple-100">
                      <FileText size={14} className="text-purple-600" />
                    </div>
                    <h3 className="font-semibold text-gray-800 text-sm">
                      ID Card (CNIC)
                    </h3>
                  </div>
                </div>
                <div className="p-4">
                  {emp.idCard?.front?.url || emp.idCard?.back?.url ? (
                    <div className="grid md:grid-cols-2 gap-4">
                      {["front", "back"].map((side) => {
                        const card = emp.idCard?.[side];
                        if (!card?.url) {
                          return (
                            <div
                              key={side}
                              className="border-2 border-dashed border-gray-200 rounded-xl h-44 flex items-center justify-center bg-gray-50/30"
                            >
                              <div className="text-center text-gray-400">
                                <FileText
                                  size={28}
                                  className="mx-auto mb-2 opacity-40"
                                />
                                <p className="text-xs capitalize">
                                  {side} side — not uploaded
                                </p>
                              </div>
                            </div>
                          );
                        }

                        const isValidImage = card.url.startsWith("data:image/");
                        const isPDF = card.url.startsWith(
                          "data:application/pdf",
                        );

                        if (!isValidImage || isPDF) {
                          return (
                            <div
                              key={side}
                              className="rounded-xl overflow-hidden border border-red-200 bg-red-50/30"
                            >
                              <div className="bg-red-100 border-b border-red-200 px-4 py-2 text-xs font-semibold text-red-700 capitalize flex items-center justify-between">
                                <span>{side} Side</span>
                                <span className="text-red-600 text-[10px] bg-red-200 px-2 py-0.5 rounded-full">
                                  Invalid format
                                </span>
                              </div>
                              <div className="h-44 flex items-center justify-center">
                                <div className="text-center text-red-500">
                                  <AlertCircle
                                    size={32}
                                    className="mx-auto mb-2 opacity-60"
                                  />
                                  <p className="text-xs font-medium">
                                    Only image files supported
                                  </p>
                                  <p className="text-[10px] mt-1 text-red-400">
                                    JPEG, PNG, GIF, or WebP
                                  </p>
                                </div>
                              </div>
                            </div>
                          );
                        }

                        return (
                          <div
                            key={side}
                            className="rounded-xl overflow-hidden border border-gray-200 bg-white shadow-sm"
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
                                  e.target.src =
                                    'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="%23999"%3E%3Crect x="2" y="2" width="20" height="20" rx="2"/%3E%3Cpath d="M8 2v20M16 2v20M2 8h20M2 16h20"/%3E%3C/svg%3E';
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
                    <div className="text-center py-10 text-gray-400">
                      <FileText size={40} className="mx-auto mb-3 opacity-30" />
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
            </div>
          )}
        </div>

        {/* ── FOOTER ──────────────────────────────────────────────────────── */}
        <div className="flex-shrink-0 bg-white border-t border-gray-200 px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1 rounded-lg bg-blue-50">
              <Eye size={12} className="text-blue-500" />
            </div>
            <p className="text-xs text-gray-400">
              Read-only ghost mode — no changes can be made
            </p>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gradient-to-r from-slate-700 to-slate-800 text-white text-sm font-medium rounded-lg hover:from-slate-800 hover:to-slate-900 transition shadow-sm"
          >
            Close Preview
          </button>
        </div>
      </div>
    </div>
  );
}
