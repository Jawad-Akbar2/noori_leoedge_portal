// AdminDashboard.jsx
// Full-featured superadmin/admin/owner dashboard — light theme matching Login.jsx design system

import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import ProfileHeader from "../Common/ProfileHeader";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  Users,
  Clock,
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  CheckCircle,
  XCircle,
  Activity,
  Award,
  Calendar,
  FileText,
  RefreshCw,
  Zap,
  Star,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";

// ─── Design tokens — mirrors Login.jsx blue/indigo/purple palette ─────────────
const C = {
  blue: "#2563eb", // blue-600  (primary — same as Login button)
  blueLt: "#3b82f6", // blue-500
  indigo: "#4f46e5", // indigo-600
  purple: "#7c3aed", // purple-600
  emerald: "#059669",
  amber: "#d97706",
  rose: "#e11d48",
  cyan: "#0891b2",
  teal: "#0d9488",
  slate: "#64748b",
};

const PIE_PALETTE = [C.blue, C.purple, C.emerald, C.amber, C.rose, C.cyan];
const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n, d = 0) => Number((n || 0).toFixed(d)).toLocaleString();
const fmtPKR = (n) => `PKR ${fmt(n, 0)}`;
const monthLabel = ({ year, month }) =>
  `${MONTH_NAMES[(month || 1) - 1]} ${year || ""}`;

// ─── Chart shared styles ──────────────────────────────────────────────────────
const axisStyle = { fontSize: 10, fill: "#94a3b8" };
const gridProps = { strokeDasharray: "3 3", stroke: "#f1f5f9" };

// ─── UI primitives ────────────────────────────────────────────────────────────

/** White card with subtle shadow — same as Login card */
const Card = ({ children, className = "", onClick }) => (
  <div
    onClick={onClick}
    className={`bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden
      ${onClick ? "cursor-pointer hover:shadow-md hover:border-blue-100 transition-all duration-200" : ""}
      ${className}`}
  >
    {children}
  </div>
);

/** Coloured 1px top accent — identical to Login card gradient bar */
const Accent = ({ from = C.blue, via = C.purple, to = C.indigo }) => (
  <div
    className="h-1"
    style={{ background: `linear-gradient(to right, ${from}, ${via}, ${to})` }}
  />
);

const P = ({ children, className = "" }) => (
  <div className={`p-5 ${className}`}>{children}</div>
);

const SectionTitle = ({ icon: Icon, title, sub, color = C.blue }) => (
  <div className="flex items-center gap-3 mb-5">
    <div
      className="w-10 h-10 rounded-xl flex items-center justify-center shadow-sm"
      style={{ background: color + "15" }}
    >
      <Icon size={18} style={{ color }} />
    </div>

    <div>
      <h2 className="text-sm font-bold text-gray-800 leading-tight">{title}</h2>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  </div>
);

const Badge = ({ label, color = "gray" }) => {
  const map = {
    green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    red: "bg-rose-50 text-rose-700 ring-rose-200",
    yellow: "bg-amber-50 text-amber-700 ring-amber-200",
    blue: "bg-blue-50 text-blue-700 ring-blue-200",
    purple: "bg-purple-50 text-purple-700 ring-purple-200",
    gray: "bg-gray-100 text-gray-600 ring-gray-200",
  };
  return (
    <span
      className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full ring-1 ${map[color] || map.gray}`}
    >
      {label}
    </span>
  );
};

const KpiCard = ({
  title,
  value,
  sub,
  icon: Icon,
  accent = C.blue,
  delta,
  onClick,
}) => (
  <div
    onClick={onClick}
    className={`bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden
      ${onClick ? "cursor-pointer hover:shadow-md hover:border-blue-100 transition-all duration-200" : ""}`}
  >
    <div className="h-0.5" style={{ background: accent }} />
    <div className="p-5">
      <div className="flex items-start justify-between mb-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: accent + "12" }}
        >
          <Icon size={18} style={{ color: accent }} />
        </div>
        {delta !== undefined && (
          <span
            className={`flex items-center gap-0.5 text-xs font-semibold
            ${delta >= 0 ? "text-emerald-600" : "text-rose-600"}`}
          >
            {delta >= 0 ? (
              <ArrowUpRight size={13} />
            ) : (
              <ArrowDownRight size={13} />
            )}
            {Math.abs(delta)}%
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-gray-900 leading-none">{value}</p>
      <p className="text-xs text-gray-500 mt-1.5 font-medium">{title}</p>
      {sub && <p className="text-[11px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  </div>
);

const StatusRow = ({ label, value, total, color }) => {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="mb-3">
      <div className="flex justify-between text-xs mb-1.5">
        <span className="text-gray-500 font-medium">{label}</span>
        <span className="text-gray-800 font-semibold">
          {value} <span className="text-gray-400 font-normal">({pct}%)</span>
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  );
};

const CustomTooltip = ({
  active,
  payload,
  label,
  prefix = "",
  suffix = "",
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-lg text-xs">
      <p className="text-gray-500 mb-2 font-semibold">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="font-bold">
          {p.name}: {prefix}
          {typeof p.value === "number" ? fmt(p.value, 1) : p.value}
          {suffix}
        </p>
      ))}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// SECTIONS
// ═══════════════════════════════════════════════════════════════════════════════

function EmployeeSection({ data, navigate }) {
  if (!data) return null;
  const { summary, departmentWise = [], joiningTrends = [] } = data;
  const deptData = departmentWise.map((d) => ({
    name: d._id,
    Total: d.total,
    Active: d.active,
  }));
  const trendData = joiningTrends.map((t) => ({
    name: monthLabel(t._id),
    "New Hires": t.count,
  }));

  return (
    <section>
      <SectionTitle
        icon={Users}
        title="Workforce Overview"
        sub="Employee headcount & distribution"
        color={C.blue}
      />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KpiCard
          title="Total Employees"
          value={fmt(summary.total)}
          icon={Users}
          accent={C.blue}
          onClick={() => navigate("/admin/employees")}
        />
        <KpiCard
          title="Active"
          value={fmt(summary.active)}
          icon={CheckCircle}
          accent={C.emerald}
        />
        <KpiCard
          title="New This Month"
          value={fmt(summary.newThisMonth)}
          icon={TrendingUp}
          accent={C.cyan}
        />
        <KpiCard
          title="Left Business"
          value={fmt(summary.leftBusiness)}
          icon={TrendingDown}
          accent={C.rose}
          sub={`Turnover: ${summary.turnoverRate}%`}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <Accent from={C.blue} via={C.indigo} to={C.purple} />
          <P>
            <p className="text-xs text-gray-400 font-semibold mb-4 uppercase tracking-wider">
              Department Headcount
            </p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart
                data={deptData}
                margin={{ top: 0, right: 0, left: -20, bottom: 0 }}
              >
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="name" tick={axisStyle} />
                <YAxis tick={axisStyle} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11, color: "#94a3b8" }} />
                <Bar dataKey="Total" fill={C.blue} radius={[4, 4, 0, 0]} />
                <Bar dataKey="Active" fill={C.emerald} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </P>
        </Card>

        <Card>
          <Accent from={C.cyan} via={C.blue} to={C.indigo} />
          <P>
            <p className="text-xs text-gray-400 font-semibold mb-4 uppercase tracking-wider">
              Hiring Trend (6 Mo)
            </p>
            {trendData.length > 0 ? (
              <ResponsiveContainer width="100%" height={170}>
                <AreaChart
                  data={trendData}
                  margin={{ top: 0, right: 0, left: -20, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="hireGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={C.blue} stopOpacity={0.15} />
                      <stop offset="95%" stopColor={C.blue} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid {...gridProps} />
                  <XAxis dataKey="name" tick={axisStyle} />
                  <YAxis tick={axisStyle} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="New Hires"
                    stroke={C.blue}
                    fill="url(#hireGrad)"
                    strokeWidth={2}
                    dot={{ r: 3, fill: C.blue }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-44 flex items-center justify-center text-gray-400 text-xs">
                No hiring data yet
              </div>
            )}
            <div className="mt-4 flex gap-5 text-xs flex-wrap">
              {[
                ["Hourly", summary.hourly],
                ["Monthly", summary.monthly],
                ["Frozen", summary.frozen],
                ["Inactive", summary.inactive],
              ].map(([l, v]) => (
                <div key={l}>
                  <span className="text-gray-400">{l}: </span>
                  <span className="text-gray-800 font-semibold">{v}</span>
                </div>
              ))}
            </div>
          </P>
        </Card>
      </div>
    </section>
  );
}

function AttendanceSection({ data, navigate }) {
  if (!data) return null;
  const {
    today,
    thisMonth,
    departmentAttendance = [],
    lateTrends = [],
    averageHours,
  } = data;
  const lateTrendData = lateTrends.map((l) => ({
    name: l._id?.slice(5) || l._id,
    Late: l.lateCount,
  }));
  const deptData = departmentAttendance.map((d) => ({
    name: d._id,
    Rate: parseFloat((d.attendanceRate || 0).toFixed(1)),
  }));

  return (
    <section>
      <SectionTitle
        icon={Clock}
        title="Attendance"
        sub="Today, this month & trends"
        color={C.indigo}
      />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KpiCard
          title="Present Today"
          value={today.present}
          icon={CheckCircle}
          accent={C.emerald}
          onClick={() => navigate("/admin/attendance")}
        />
        <KpiCard
          title="Late Today"
          value={today.late}
          icon={AlertCircle}
          accent={C.amber}
        />
        <KpiCard
          title="Absent Today"
          value={today.absent}
          icon={XCircle}
          accent={C.rose}
        />
        <KpiCard
          title="On Leave"
          value={today.onLeave}
          icon={Calendar}
          accent={C.blue}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <Card>
          <Accent from={C.emerald} via={C.teal} to={C.cyan} />
          <P>
            <p className="text-xs text-gray-400 font-semibold mb-4 uppercase tracking-wider">
              This Month Status
            </p>
            <StatusRow
              label="Present"
              value={thisMonth.presentCount}
              total={
                thisMonth.presentCount +
                thisMonth.absentCount +
                thisMonth.leaveCount
              }
              color={C.emerald}
            />
            <StatusRow
              label="Late"
              value={thisMonth.lateCount}
              total={thisMonth.presentCount || 1}
              color={C.amber}
            />
            <StatusRow
              label="Absent"
              value={thisMonth.absentCount}
              total={
                thisMonth.presentCount +
                thisMonth.absentCount +
                thisMonth.leaveCount
              }
              color={C.rose}
            />
            <StatusRow
              label="Leave"
              value={thisMonth.leaveCount}
              total={
                thisMonth.presentCount +
                thisMonth.absentCount +
                thisMonth.leaveCount
              }
              color={C.blue}
            />
            <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-2 gap-3 text-xs">
              {[
                ["Att. Rate", `${thisMonth.attendanceRate}%`],
                ["Avg Late", `${thisMonth.avgLateMinutes} min`],
                ["Total Hrs", fmt(thisMonth.totalHours)],
                ["OT Hrs", fmt(thisMonth.totalOtHours)],
              ].map(([l, v]) => (
                <div key={l}>
                  <span className="text-gray-400">{l}</span>
                  <p className="text-gray-900 font-bold text-sm mt-0.5">{v}</p>
                </div>
              ))}
            </div>
          </P>
        </Card>

        <Card>
          <Accent from={C.amber} via={C.rose} to={C.purple} />
          <P>
            <p className="text-xs text-gray-400 font-semibold mb-4 uppercase tracking-wider">
              Late Arrivals (7 Days)
            </p>
            {lateTrendData.length > 0 ? (
              <ResponsiveContainer width="100%" height={190}>
                <BarChart
                  data={lateTrendData}
                  margin={{ top: 0, right: 0, left: -20, bottom: 0 }}
                >
                  <CartesianGrid {...gridProps} />
                  <XAxis dataKey="name" tick={axisStyle} />
                  <YAxis tick={axisStyle} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="Late" fill={C.amber} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-48 flex items-center justify-center text-gray-400 text-xs">
                No late data this week
              </div>
            )}
          </P>
        </Card>

        <Card>
          <Accent from={C.teal} via={C.cyan} to={C.blue} />
          <P>
            <p className="text-xs text-gray-400 font-semibold mb-4 uppercase tracking-wider">
              Dept Attendance Rate
            </p>
            {deptData.length > 0 ? (
              <ResponsiveContainer width="100%" height={190}>
                <BarChart
                  data={deptData}
                  layout="vertical"
                  margin={{ top: 0, right: 10, left: 0, bottom: 0 }}
                >
                  <CartesianGrid {...gridProps} />
                  <XAxis
                    type="number"
                    domain={[0, 100]}
                    tick={axisStyle}
                    unit="%"
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={axisStyle}
                    width={72}
                  />
                  <Tooltip content={<CustomTooltip suffix="%" />} />
                  <Bar dataKey="Rate" fill={C.cyan} radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-48 flex items-center justify-center text-gray-400 text-xs">
                No data yet
              </div>
            )}
          </P>
        </Card>
      </div>

      <Card>
        <P>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            {[
              { l: "Avg hrs/day", v: `${averageHours.perDay}h`, c: C.blue },
              { l: "Avg OT/day", v: `${averageHours.otPerDay}h`, c: C.indigo },
              {
                l: "Month OT hrs",
                v: fmt(thisMonth.totalOtHours),
                c: C.purple,
              },
              {
                l: "Month OT pay",
                v: fmtPKR(thisMonth.totalOtAmount),
                c: C.emerald,
              },
            ].map(({ l, v, c }) => (
              <div key={l} className="flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: c + "12" }}
                >
                  <Zap size={14} style={{ color: c }} />
                </div>
                <div>
                  <p className="text-gray-400">{l}</p>
                  <p className="text-gray-900 font-bold mt-0.5">{v}</p>
                </div>
              </div>
            ))}
          </div>
        </P>
      </Card>
    </section>
  );
}

function PayrollSection({ data, navigate }) {
  if (!data) return null;
  const {
    currentMonth: cm,
    monthlyTrends = [],
    departmentWise = [],
    salaryDistribution = [],
  } = data;
  const trendData = monthlyTrends.map((t) => ({
    name: monthLabel(t._id),
    Gross: t.totalGross,
    Net: t.totalNet,
  }));
  const distData = salaryDistribution.map((b) => ({
    name: b._id === "150000+" ? "150k+" : `${b._id / 1000}k`,
    Employees: b.count,
  }));

  return (
    <section>
      <SectionTitle
        icon={DollarSign}
        title="Payroll"
        sub="Current month & historical trends"
        color={C.emerald}
      />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KpiCard
          title="Net Payroll"
          value={fmtPKR(cm.totalNet)}
          icon={DollarSign}
          accent={C.emerald}
          onClick={() => navigate("/admin/payroll")}
        />
        <KpiCard
          title="Gross Payroll"
          value={fmtPKR(cm.totalGross)}
          icon={TrendingUp}
          accent={C.blue}
        />
        <KpiCard
          title="Total Deductions"
          value={fmtPKR(cm.totalDeductions)}
          icon={TrendingDown}
          accent={C.rose}
        />
        <KpiCard
          title="OT Paid"
          value={fmtPKR(cm.totalOtAmount)}
          icon={Zap}
          accent={C.amber}
          sub={`${fmt(cm.totalOtHours, 1)} hrs`}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <Card className="md:col-span-2">
          <Accent from={C.emerald} via={C.blue} to={C.indigo} />
          <P>
            <p className="text-xs text-gray-400 font-semibold mb-4 uppercase tracking-wider">
              Payroll Trends (6 Mo)
            </p>
            {trendData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart
                  data={trendData}
                  margin={{ top: 0, right: 0, left: -5, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="netGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="5%"
                        stopColor={C.emerald}
                        stopOpacity={0.2}
                      />
                      <stop
                        offset="95%"
                        stopColor={C.emerald}
                        stopOpacity={0}
                      />
                    </linearGradient>
                    <linearGradient id="grossGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={C.blue} stopOpacity={0.12} />
                      <stop offset="95%" stopColor={C.blue} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid {...gridProps} />
                  <XAxis dataKey="name" tick={axisStyle} />
                  <YAxis
                    tick={axisStyle}
                    tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip content={<CustomTooltip prefix="PKR " />} />
                  <Legend wrapperStyle={{ fontSize: 11, color: "#94a3b8" }} />
                  <Area
                    type="monotone"
                    dataKey="Gross"
                    stroke={C.blue}
                    fill="url(#grossGrad)"
                    strokeWidth={1.5}
                  />
                  <Area
                    type="monotone"
                    dataKey="Net"
                    stroke={C.emerald}
                    fill="url(#netGrad)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-56 flex items-center justify-center text-gray-400 text-xs">
                No payroll data yet
              </div>
            )}
          </P>
        </Card>

        <Card>
          <Accent from={C.blue} via={C.indigo} to={C.purple} />
          <P>
            <p className="text-xs text-gray-400 font-semibold mb-4 uppercase tracking-wider">
              Payroll Status
            </p>
            <StatusRow
              label="Paid"
              value={cm.paid}
              total={cm.employeesProcessed || 1}
              color={C.emerald}
            />
            <StatusRow
              label="Approved"
              value={cm.approved}
              total={cm.employeesProcessed || 1}
              color={C.blue}
            />
            <StatusRow
              label="Draft"
              value={cm.draft}
              total={cm.employeesProcessed || 1}
              color={C.amber}
            />
            <div className="mt-4 pt-4 border-t border-gray-100 space-y-2 text-xs">
              {[
                ["Employees processed", cm.employeesProcessed],
                ["Avg net salary", fmtPKR(cm.avgSalary)],
                ["Total hrs worked", fmt(cm.totalHoursWorked)],
              ].map(([l, v]) => (
                <div key={l} className="flex justify-between">
                  <span className="text-gray-400">{l}</span>
                  <span className="text-gray-800 font-semibold">{v}</span>
                </div>
              ))}
            </div>
          </P>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <Accent from={C.purple} via={C.indigo} to={C.blue} />
          <P>
            <p className="text-xs text-gray-400 font-semibold mb-4 uppercase tracking-wider">
              Department Payroll
            </p>
            {departmentWise.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart
                  data={departmentWise.map((d) => ({
                    name: d._id,
                    Payroll: d.totalPayroll,
                  }))}
                  margin={{ top: 0, right: 0, left: -5, bottom: 0 }}
                >
                  <CartesianGrid {...gridProps} />
                  <XAxis dataKey="name" tick={axisStyle} />
                  <YAxis
                    tick={axisStyle}
                    tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip content={<CustomTooltip prefix="PKR " />} />
                  <Bar
                    dataKey="Payroll"
                    fill={C.purple}
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-44 flex items-center justify-center text-gray-400 text-xs">
                No data
              </div>
            )}
          </P>
        </Card>
        <Card>
          <Accent from={C.indigo} via={C.blue} to={C.cyan} />
          <P>
            <p className="text-xs text-gray-400 font-semibold mb-4 uppercase tracking-wider">
              Salary Distribution
            </p>
            {distData.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart
                  data={distData}
                  margin={{ top: 0, right: 0, left: -20, bottom: 0 }}
                >
                  <CartesianGrid {...gridProps} />
                  <XAxis dataKey="name" tick={axisStyle} />
                  <YAxis tick={axisStyle} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar
                    dataKey="Employees"
                    fill={C.indigo}
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-44 flex items-center justify-center text-gray-400 text-xs">
                No distribution data
              </div>
            )}
          </P>
        </Card>
      </div>
    </section>
  );
}

function PerformanceSection({ data }) {
  if (!data) return null;
  const {
    overall,
    ratingDistribution = {},
    topPerformers = [],
    performanceTrends = [],
  } = data;
  const ratingPieData = Object.entries(ratingDistribution).map(([k, v]) => ({
    name: k,
    value: v.count,
  }));
  const RATING_COLORS = {
    Excellent: C.emerald,
    Good: C.blue,
    Average: C.amber,
    Poor: C.rose,
  };
  const trendData = performanceTrends.map((t) => ({
    name: t._id,
    Score: parseFloat((t.avgScore || 0).toFixed(1)),
    Attendance: parseFloat((t.avgAttendance || 0).toFixed(1)),
    Punctuality: parseFloat((t.avgPunctuality || 0).toFixed(1)),
  }));

  return (
    <section>
      <SectionTitle
        icon={Award}
        title="Performance"
        sub="Scores, ratings & department analysis"
        color={C.amber}
      />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KpiCard
          title="Avg Score"
          value={`${overall.averageScore}/100`}
          icon={Star}
          accent={C.amber}
        />
        <KpiCard
          title="Excellent"
          value={overall.excellentCount}
          icon={Award}
          accent={C.emerald}
        />
        <KpiCard
          title="Avg Attendance"
          value={`${overall.averageAttendance}%`}
          icon={CheckCircle}
          accent={C.blue}
        />
        <KpiCard
          title="Poor Performers"
          value={overall.poorCount}
          icon={AlertCircle}
          accent={C.rose}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <Card>
          <Accent from={C.emerald} via={C.teal} to={C.blue} />
          <P>
            <p className="text-xs text-gray-400 font-semibold mb-4 uppercase tracking-wider">
              Rating Distribution
            </p>
            {ratingPieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={190}>
                <PieChart>
                  <Pie
                    data={ratingPieData}
                    cx="50%"
                    cy="50%"
                    outerRadius={72}
                    dataKey="value"
                    label={({ name, percent }) =>
                      `${name} ${(percent * 100).toFixed(0)}%`
                    }
                    labelLine={false}
                  >
                    {ratingPieData.map((e) => (
                      <Cell
                        key={e.name}
                        fill={RATING_COLORS[e.name] || C.slate}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-48 flex items-center justify-center text-gray-400 text-xs">
                No performance data
              </div>
            )}
          </P>
        </Card>

        <Card className="md:col-span-2">
          <Accent from={C.amber} via={C.blue} to={C.emerald} />
          <P>
            <p className="text-xs text-gray-400 font-semibold mb-4 uppercase tracking-wider">
              Performance Trends
            </p>
            {trendData.length > 0 ? (
              <ResponsiveContainer width="100%" height={190}>
                <LineChart
                  data={trendData}
                  margin={{ top: 0, right: 0, left: -20, bottom: 0 }}
                >
                  <CartesianGrid {...gridProps} />
                  <XAxis dataKey="name" tick={axisStyle} />
                  <YAxis domain={[0, 100]} tick={axisStyle} />
                  <Tooltip content={<CustomTooltip suffix="%" />} />
                  <Legend wrapperStyle={{ fontSize: 11, color: "#94a3b8" }} />
                  <Line
                    type="monotone"
                    dataKey="Score"
                    stroke={C.amber}
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="Attendance"
                    stroke={C.emerald}
                    strokeWidth={1.5}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="Punctuality"
                    stroke={C.blue}
                    strokeWidth={1.5}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-48 flex items-center justify-center text-gray-400 text-xs">
                No trend data yet
              </div>
            )}
          </P>
        </Card>
      </div>

      {topPerformers.length > 0 && (
        <Card>
          <Accent from={C.blue} via={C.purple} to={C.rose} />
          <P>
            <p className="text-xs text-gray-400 font-semibold mb-3 uppercase tracking-wider">
              Top Performers
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-400 border-b border-gray-100">
                    {["#", "Employee", "Dept", "Score", "Rating", "Att.%"].map(
                      (h) => (
                        <th
                          key={h}
                          className={`pb-2 font-semibold ${h === "Score" || h === "Rating" || h === "Att.%" ? "text-center" : "text-left"}`}
                        >
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {topPerformers.slice(0, 7).map((p, i) => (
                    <tr
                      key={i}
                      className="border-b border-gray-50 hover:bg-blue-50/40 transition-colors"
                    >
                      <td className="py-2.5 text-gray-400 font-medium">
                        {i + 1}
                      </td>
                      <td className="py-2.5 text-gray-800 font-semibold">
                        {p.empName}
                      </td>
                      <td className="py-2.5 text-gray-500">{p.department}</td>
                      <td
                        className="py-2.5 text-center font-bold"
                        style={{ color: C.amber }}
                      >
                        {p.performanceScore}
                      </td>
                      <td className="py-2.5 text-center">
                        <Badge
                          label={p.rating}
                          color={
                            {
                              Excellent: "green",
                              Good: "blue",
                              Average: "yellow",
                              Poor: "red",
                            }[p.rating] || "gray"
                          }
                        />
                      </td>
                      <td
                        className="py-2.5 text-center font-semibold"
                        style={{ color: C.emerald }}
                      >
                        {parseFloat(p.attendanceRate || 0).toFixed(0)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </P>
        </Card>
      )}
    </section>
  );
}

function LeaveCorrectionSection({ leaves, corrections, navigate }) {
  if (!leaves || !corrections) return null;
  const { summary: ls, typeDistribution = [], monthlyTrends: lm = [] } = leaves;
  const { summary: cs, pendingCorrections = [] } = corrections;
  const leaveTrendData = lm.map((t) => ({
    name: monthLabel(t._id),
    Requests: t.totalRequests,
  }));
  const leaveTypeData = typeDistribution.map((t) => ({
    name: t._id?.replace(" Leave", ""),
    value: t.count,
  }));

  return (
    <section>
      <SectionTitle
        icon={FileText}
        title="Leaves & Corrections"
        sub="Requests overview & pending items"
        color={C.purple}
      />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KpiCard
          title="Leave Requests"
          value={ls.totalRequests}
          icon={Calendar}
          accent={C.blue}
          onClick={() => navigate("/admin/leaves")}
        />
        <KpiCard
          title="Pending Leaves"
          value={ls.pending}
          icon={AlertCircle}
          accent={C.amber}
        />
        <KpiCard
          title="Approval Rate"
          value={`${ls.approvalRate}%`}
          icon={CheckCircle}
          accent={C.emerald}
        />
        <KpiCard
          title="Correction Pending"
          value={cs.pending}
          icon={FileText}
          accent={C.rose}
          onClick={() => navigate("/admin/corrections")}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <Card>
          <Accent from={C.blue} via={C.purple} to={C.rose} />
          <P>
            <p className="text-xs text-gray-400 font-semibold mb-4 uppercase tracking-wider">
              Leave Types
            </p>
            {leaveTypeData.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={leaveTypeData}
                    cx="50%"
                    cy="50%"
                    outerRadius={65}
                    dataKey="value"
                    label={({ name, percent }) =>
                      `${name} ${(percent * 100).toFixed(0)}%`
                    }
                    labelLine={false}
                  >
                    {leaveTypeData.map((_, i) => (
                      <Cell
                        key={i}
                        fill={PIE_PALETTE[i % PIE_PALETTE.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-44 flex items-center justify-center text-gray-400 text-xs">
                No data
              </div>
            )}
            <div className="mt-3 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-400">Total leave days</span>
                <span className="text-gray-800 font-semibold">
                  {ls.totalLeaveDays}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Approved / Rejected</span>
                <span className="text-gray-800 font-semibold">
                  {ls.approved} / {ls.rejected}
                </span>
              </div>
            </div>
          </P>
        </Card>

        <Card>
          <Accent from={C.indigo} via={C.blue} to={C.cyan} />
          <P>
            <p className="text-xs text-gray-400 font-semibold mb-4 uppercase tracking-wider">
              Leave Trend (6 Mo)
            </p>
            {leaveTrendData.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart
                  data={leaveTrendData}
                  margin={{ top: 0, right: 0, left: -20, bottom: 0 }}
                >
                  <CartesianGrid {...gridProps} />
                  <XAxis dataKey="name" tick={axisStyle} />
                  <YAxis tick={axisStyle} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="Requests" fill={C.blue} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-44 flex items-center justify-center text-gray-400 text-xs">
                No data
              </div>
            )}
          </P>
        </Card>

        <Card>
          <Accent from={C.rose} via={C.amber} to={C.blue} />
          <P>
            <p className="text-xs text-gray-400 font-semibold mb-3 uppercase tracking-wider">
              Correction Stats
            </p>
            <StatusRow
              label="Approved"
              value={cs.approved}
              total={cs.total || 1}
              color={C.emerald}
            />
            <StatusRow
              label="Pending"
              value={cs.pending}
              total={cs.total || 1}
              color={C.amber}
            />
            <StatusRow
              label="Rejected"
              value={cs.rejected}
              total={cs.total || 1}
              color={C.rose}
            />
            <div className="mt-3 pt-3 border-t border-gray-100 space-y-1.5 text-xs">
              {[
                ["Approval rate", `${cs.approvalRate}%`],
                ["From employees", cs.fromEmployees],
                ["From admin", cs.fromAdmin],
                [
                  "In / Out / Both",
                  `${corrections.typeDistribution?.In || 0} / ${corrections.typeDistribution?.Out || 0} / ${corrections.typeDistribution?.Both || 0}`,
                ],
              ].map(([l, v]) => (
                <div key={l} className="flex justify-between">
                  <span className="text-gray-400">{l}</span>
                  <span className="text-gray-800 font-semibold">{v}</span>
                </div>
              ))}
            </div>
          </P>
        </Card>
      </div>

      {pendingCorrections.length > 0 && (
        <Card>
          <Accent from={C.amber} via={C.rose} to={C.purple} />
          <P>
            <p className="text-xs text-gray-400 font-semibold mb-3 uppercase tracking-wider">
              Pending Corrections
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-400 border-b border-gray-100">
                    {["Employee", "Dept", "Type", "Reason", "Submitted"].map(
                      (h, i) => (
                        <th
                          key={h}
                          className={`pb-2 font-semibold ${i === 2 ? "text-center" : i === 4 ? "text-right" : "text-left"}`}
                        >
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {pendingCorrections.slice(0, 5).map((c, i) => (
                    <tr
                      key={i}
                      className="border-b border-gray-50 hover:bg-blue-50/40 transition-colors"
                    >
                      <td className="py-2.5 text-gray-800 font-medium">
                        {c.empName}
                      </td>
                      <td className="py-2.5 text-gray-500">{c.department}</td>
                      <td className="py-2.5 text-center">
                        <Badge label={c.correctionType} color="blue" />
                      </td>
                      <td className="py-2.5 text-gray-500 truncate max-w-[180px]">
                        {c.reason}
                      </td>
                      <td className="py-2.5 text-right text-gray-400">
                        {new Date(c.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </P>
        </Card>
      )}
    </section>
  );
}

function RecentActivity({ activities = [] }) {
  const TYPE_CONFIG = {
    payroll: { color: C.emerald, icon: DollarSign },
    leave: { color: C.blue, icon: Calendar },
    correction: { color: C.amber, icon: FileText },
    employee: { color: C.purple, icon: Users },
  };
  return (
    <Card>
      <Accent from={C.blue} via={C.purple} to={C.indigo} />
      <P>
        <SectionTitle
          icon={Activity}
          title="Recent Activity"
          sub="Last 20 events across the system"
          color={C.blue}
        />
        <div className="space-y-1 max-h-80 overflow-y-auto pr-1">
          {activities.length === 0 && (
            <p className="text-gray-400 text-xs text-center py-8">
              No recent activity
            </p>
          )}
          {activities.map((a, i) => {
            const cfg = TYPE_CONFIG[a.type] || TYPE_CONFIG.employee;
            const Icon = cfg.icon;
            return (
              <div
                key={i}
                className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-blue-50/50 transition-colors"
              >
                <div
                  className="w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center"
                  style={{ background: cfg.color + "12" }}
                >
                  <Icon size={12} style={{ color: cfg.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-700 leading-snug truncate">
                    {a.description}
                  </p>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    {a.department} · {new Date(a.timestamp).toLocaleString()}
                  </p>
                </div>
                {a.amount != null && (
                  <span
                    className="text-[10px] font-semibold flex-shrink-0"
                    style={{ color: C.emerald }}
                  >
                    {fmtPKR(a.amount)}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </P>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);
  const navigate = useNavigate();

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };
      const [meRes, statsRes] = await Promise.all([
        axios.get("/api/employees/me", { headers }),
        axios.get("/api/stats/system", { headers }),
      ]);
      if (meRes.data.success) setEmployee(meRes.data.employee);
      if (statsRes.data.success) setStats(statsRes.data.data);
      else setError("Failed to load stats");
      setLastRefresh(new Date());
    } catch (err) {
      console.error(err);
      setError("Could not connect to the server. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading)
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-14 h-14 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500 text-sm font-medium">
            Loading dashboard…
          </p>
        </div>
      </div>
    );

  // ── Error ──────────────────────────────────────────────────────────────────
  if (error)
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 text-center max-w-sm">
          <div className="w-14 h-14 bg-rose-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <AlertCircle size={28} className="text-rose-500" />
          </div>
          <p className="text-gray-800 font-bold mb-1">Something went wrong</p>
          <p className="text-gray-500 text-sm mb-5">{error}</p>
          <button
            onClick={fetchAll}
            className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white text-sm font-semibold rounded-xl transition-all duration-200 shadow-sm"
          >
            Retry
          </button>
        </div>
      </div>
    );

  const d = stats || {};

  return (
    // Light gradient background — same palette as Login page
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* Profile Header (your existing component) */}
      {employee && <ProfileHeader employee={employee} mode="view" />}

      {/* ── Main content ──────────────────────────────────────────────────── */}
      <main className="max-w-7xl mx-auto px-4 md:px-6 py-8 space-y-12">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-lg font-bold text-gray-900">Dashboard</h1>
            <p className="text-xs text-gray-400">
              Overview of system performance
            </p>
          </div>

          <button
            onClick={fetchAll}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white text-xs font-semibold rounded-xl transition-all duration-200 shadow-sm"
          >
            <RefreshCw size={14} />
            Refresh Data
          </button>
        </div>

        <EmployeeSection data={d.employees} navigate={navigate} />
        <hr className="border-blue-100" />
        <AttendanceSection data={d.attendance} navigate={navigate} />
        <hr className="border-blue-100" />
        <PayrollSection data={d.payroll} navigate={navigate} />
        <hr className="border-blue-100" />
        <PerformanceSection data={d.performance} />
        <hr className="border-blue-100" />
        <LeaveCorrectionSection
          leaves={d.leaves}
          corrections={d.corrections}
          navigate={navigate}
        />
        <hr className="border-blue-100" />
        <RecentActivity activities={d.recentActivity || []} />
        <p className="text-center text-xs text-gray-300 pb-4">
          © 2026 NOORI HR Portal. All rights reserved.
        </p>
      </main>
    </div>
  );
}
