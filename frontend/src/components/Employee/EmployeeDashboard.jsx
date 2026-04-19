// EmployeeStatsDashboard.jsx
// Personal stats dashboard for employees — same design system as AdminDashboard.jsx

import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  LineChart, Line, RadialBarChart, RadialBar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  Clock, DollarSign, TrendingUp, TrendingDown, AlertCircle,
  CheckCircle, XCircle, Calendar, FileText, RefreshCw, Zap,
  Star, Award, ArrowUpRight, Activity, LogIn, LogOut,
  ChevronRight, Eye, EyeOff, Target, Percent,
  Circle,
} from "lucide-react";

// ─── Design tokens (mirrors AdminDashboard palette) ───────────────────────────
const C = {
  blue:    "#2563eb",
  blueLt:  "#3b82f6",
  indigo:  "#4f46e5",
  purple:  "#7c3aed",
  emerald: "#059669",
  amber:   "#d97706",
  rose:    "#e11d48",
  cyan:    "#0891b2",
  teal:    "#0d9488",
  slate:   "#64748b",
};

const PIE_PALETTE = [C.blue, C.purple, C.emerald, C.amber, C.rose, C.cyan];
const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const fmt        = (n, d = 0) => Number((n || 0).toFixed(d)).toLocaleString();
const fmtPKR     = (n)        => `PKR ${fmt(n, 0)}`;
const monthLabel = ({ year, month }) => `${MONTH_NAMES[(month || 1) - 1]} ${year || ""}`;

const axisStyle = { fontSize: 10, fill: "#94a3b8" };
const gridProps = { strokeDasharray: "3 3", stroke: "#f1f5f9" };

// ─── UI primitives ────────────────────────────────────────────────────────────

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

const Accent = ({ from = C.blue, via = C.purple, to = C.indigo }) => (
  <div className="h-1" style={{ background: `linear-gradient(to right, ${from}, ${via}, ${to})` }} />
);

const P = ({ children, className = "" }) => (
  <div className={`p-5 ${className}`}>{children}</div>
);

const SectionTitle = ({ icon: Icon, title, sub, color = C.blue }) => (
  <div className="flex items-center gap-3 mb-5">
    <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-sm"
      style={{ background: color + "15" }}>
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
    green:  "bg-emerald-50 text-emerald-700 ring-emerald-200",
    red:    "bg-rose-50 text-rose-700 ring-rose-200",
    yellow: "bg-amber-50 text-amber-700 ring-amber-200",
    blue:   "bg-blue-50 text-blue-700 ring-blue-200",
    purple: "bg-purple-50 text-purple-700 ring-purple-200",
    gray:   "bg-gray-100 text-gray-600 ring-gray-200",
  };
  return (
    <span className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full ring-1 ${map[color] || map.gray}`}>
      {label}
    </span>
  );
};

const KpiCard = ({ title, value, sub, icon: Icon, accent = C.blue, onClick, masked }) => (
  <div
    onClick={onClick}
    className={`bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden
      ${onClick ? "cursor-pointer hover:shadow-md hover:border-blue-100 transition-all duration-200" : ""}`}
  >
    <div className="h-0.5" style={{ background: accent }} />
    <div className="p-5">
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: accent + "12" }}>
          <Icon size={18} style={{ color: accent }} />
        </div>
      </div>
      <p className="text-2xl font-bold text-gray-900 leading-none">
        {masked ? "••••••" : value}
      </p>
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
        <div className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
};

const CustomTooltip = ({ active, payload, label, prefix = "", suffix = "" }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-lg text-xs">
      <p className="text-gray-500 mb-2 font-semibold">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="font-bold">
          {p.name}: {prefix}{typeof p.value === "number" ? fmt(p.value, 1) : p.value}{suffix}
        </p>
      ))}
    </div>
  );
};

const StatusBadge = ({ status }) => {
  const map = {
    Pending:  ["yellow", "Pending"],
    Approved: ["green",  "Approved"],
    Rejected: ["red",    "Rejected"],
    Present:  ["green",  "Present"],
    Late:     ["yellow", "Late"],
    OffDay:   ["red",    "OffDay"],
    Leave:    ["blue",   "Leave"],
    ncns:     ["gray",   "NCNS"],
  };
  const [color, label] = map[status] || ["gray", status];
  return <Badge label={label} color={color} />;
};

// ═══════════════════════════════════════════════════════════════════════════════
// TODAY CARD
// ═══════════════════════════════════════════════════════════════════════════════

function TodayCard({ today }) {
  if (!today) {
    return (
      <Card>
        <Accent from={C.cyan} via={C.blue} to={C.indigo} />
        <P>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: C.blue + "12" }}>
              <Clock size={18} style={{ color: C.blue }} />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-800">Today</p>
              <p className="text-xs text-gray-400">No attendance record yet</p>
            </div>
          </div>
        </P>
      </Card>
    );
  }

  const statusColor = { Present: C.emerald, Late: C.amber, OffDay: C.rose, Leave: C.blue, ncns: C.gray }[today.status] || C.slate;

  return (
    <Card>
      <div className="h-1" style={{ background: statusColor }} />
      <P>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: statusColor + "15" }}>
              <Activity size={18} style={{ color: statusColor }} />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-800">Today</p>
              <p className="text-xs text-gray-400">{new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</p>
            </div>
          </div>
          <StatusBadge status={today.status} />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { icon: LogIn,   label: "Check In",   value: today.inTime  || "—", color: C.emerald },
            { icon: LogOut,  label: "Check Out",  value: today.outTime || "—", color: C.rose    },
            { icon: Clock,   label: "Hours",       value: `${fmt(today.hoursWorked, 1)}h`, color: C.blue },
            { icon: Zap,     label: "OT Hours",    value: `${fmt(today.otHours, 1)}h`,     color: C.amber },
          ].map(({ icon: Icon, label, value, color }) => (
            <div key={label} className="flex items-center gap-2.5 bg-gray-50 rounded-xl p-3">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: color + "15" }}>
                <Icon size={13} style={{ color }} />
              </div>
              <div>
                <p className="text-[10px] text-gray-400">{label}</p>
                <p className="text-sm font-bold text-gray-800">{value}</p>
              </div>
            </div>
          ))}
        </div>

        {(today.lateMinutes > 0 || today.deduction > 0) && (
          <div className="mt-3 flex gap-3 flex-wrap">
            {today.lateMinutes > 0 && (
              <div className="flex items-center gap-1.5 text-xs bg-amber-50 text-amber-700 px-3 py-1.5 rounded-full">
                <AlertCircle size={11} /> {today.lateMinutes} min late
              </div>
            )}
            {today.deduction > 0 && (
              <div className="flex items-center gap-1.5 text-xs bg-rose-50 text-rose-700 px-3 py-1.5 rounded-full">
                <TrendingDown size={11} /> Deduction: {fmtPKR(today.deduction)}
              </div>
            )}
            {today.finalEarning > 0 && (
              <div className="flex items-center gap-1.5 text-xs bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-full">
                <DollarSign size={11} /> Earned today: {fmtPKR(today.finalEarning)}
              </div>
            )}
          </div>
        )}
      </P>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CURRENT PERIOD EARNINGS
// ═══════════════════════════════════════════════════════════════════════════════

function EarningsCard({ period, showEarnings, setShowEarnings }) {
  const nextPayDate = () => {
    const now = new Date();
    const d   = now.getDate();
    const y   = now.getFullYear();
    const m   = now.getMonth();
    const end = d >= 18 ? new Date(y, m + 1, 17) : new Date(y, m, 17);
    return end.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  };

  return (
    <div className="bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-700 text-white rounded-2xl shadow-lg overflow-hidden">
      <div className="p-6">
        <div className="flex items-start justify-between mb-1">
          <div>
            <p className="text-blue-200 text-xs font-medium mb-1">Current Period Earnings</p>
            <p className="text-3xl font-bold tracking-tight">
              {showEarnings ? fmtPKR(period?.netEarnings || 0) : "••••••"}
            </p>
          </div>
          <button
            onClick={() => setShowEarnings(!showEarnings)}
            className="p-2.5 bg-white/15 rounded-xl hover:bg-white/25 transition"
          >
            {showEarnings ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        </div>
        <p className="text-blue-300 text-xs mb-5">Next payout: <span className="text-white font-semibold">{nextPayDate()}</span></p>

        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Days Worked",  value: period?.daysWorked || 0,                    suffix: " days" },
            { label: "OT Hours",     value: fmt(period?.totalOtHours || 0, 1),           suffix: "h"    },
            { label: "Deductions",   value: showEarnings ? fmtPKR(period?.totalDeductions || 0) : "••••", suffix: "" },
          ].map(({ label, value, suffix }) => (
            <div key={label} className="bg-white/10 rounded-xl p-3">
              <p className="text-blue-200 text-[10px] mb-1">{label}</p>
              <p className="text-white font-bold text-sm">{value}{suffix}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ATTENDANCE SECTION
// ═══════════════════════════════════════════════════════════════════════════════

function AttendanceSection({ att, navigate }) {
  if (!att) return null;
  const { thisMonth: tm, trend6Months = [], recentRecords = [], thisWeek } = att;

  const trendData = trend6Months.map((t) => ({
    name: monthLabel(t._id),
    Present: t.presentDays,
    Late:    t.lateDays,
    OffDay:  t.OffDayDays,
    Hours:   parseFloat((t.hoursWorked || 0).toFixed(1)),
  }));

  const weekDays = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const todayDow = new Date().getDay();

  return (
    <section>
      <SectionTitle icon={Clock} title="Attendance" sub="Your monthly & weekly records" color={C.indigo} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
        <KpiCard title="Present Days"   value={tm.presentDays}      icon={CheckCircle} accent={C.emerald} />
        <KpiCard title="Late Days"      value={tm.lateDays}         icon={AlertCircle} accent={C.amber}   />
        <KpiCard title="Off Days"    value={tm.OffDayDays}       icon={XCircle}     accent={C.rose}    />
        <KpiCard title="Leave Days"     value={tm.leaveDays}        icon={Calendar}    accent={C.blue}    />
        <KpiCard title="NCNS Days"      value={tm.ncnsDays}         icon={Circle}      accent={C.gray}    />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        {/* Month stats */}
        <Card>
          <Accent from={C.emerald} via={C.teal} to={C.cyan} />
          <P>
            <p className="text-xs text-gray-400 font-semibold mb-4 uppercase tracking-wider">This Month</p>
            <StatusRow label="Present"  value={tm.presentDays} total={tm.presentDays + tm.OffDayDays + tm.leaveDays} color={C.emerald} />
            <StatusRow label="Late"     value={tm.lateDays}    total={tm.presentDays || 1} color={C.amber}   />
            <StatusRow label="Off Day"   value={tm.OffDayDays}  total={tm.presentDays + tm.OffDayDays + tm.leaveDays} color={C.rose}    />
            <StatusRow label="Leave"    value={tm.leaveDays}   total={tm.presentDays + tm.OffDayDays + tm.leaveDays} color={C.blue} 
               />
            <StatusRow label="NCNS"     value={tm.ncnsDays}  total={tm.presentDays + tm.OffDayDays + tm.leaveDays} color={C.gray} 
               />
            <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-2 gap-3 text-xs">
              {[
                ["Att. Rate",   `${tm.attendanceRate}%`  ],
                ["Punctuality", `${tm.punctualityRate}%` ],
                ["Total Hrs",   `${fmt(tm.totalHoursWorked, 1)}h`],
                ["Avg Late",    `${tm.avgLateMinutes} min`],
              ].map(([l, v]) => (
                <div key={l}>
                  <span className="text-gray-400">{l}</span>
                  <p className="text-gray-900 font-bold text-sm mt-0.5">{v}</p>
                </div>
              ))}
            </div>
          </P>
        </Card>

        {/* 6-month trend */}
        <Card className="md:col-span-2">
          <Accent from={C.blue} via={C.indigo} to={C.purple} />
          <P>
            <p className="text-xs text-gray-400 font-semibold mb-4 uppercase tracking-wider">Attendance Trend (6 Mo)</p>
            {trendData.length > 0 ? (
              <ResponsiveContainer width="100%" height={190}>
                <BarChart data={trendData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid {...gridProps} />
                  <XAxis dataKey="name" tick={axisStyle} />
                  <YAxis tick={axisStyle} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11, color: "#94a3b8" }} />
                  <Bar dataKey="Present" fill={C.emerald} radius={[3,3,0,0]} stackId="a" />
                  <Bar dataKey="Late"    fill={C.amber}   radius={[3,3,0,0]} stackId="a" />
                  <Bar dataKey="OffDay"  fill={C.rose}    radius={[3,3,0,0]} stackId="a" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-48 flex items-center justify-center text-gray-400 text-xs">No data yet</div>
            )}
          </P>
        </Card>
      </div>

      {/* OT + earnings summary */}
      <Card className="mb-4">
        <P>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            {[
              { l: "Total OT hrs",    v: `${fmt(tm.totalOtHours, 1)}h`,   c: C.indigo  },
              { l: "OT Earnings",     v: fmtPKR(tm.totalOtAmount),         c: C.emerald },
              { l: "Total Deductions",v: fmtPKR(tm.totalDeductions),       c: C.rose    },
              { l: "Net Earned",      v: fmtPKR(tm.netEarning),            c: C.blue    },
            ].map(({ l, v, c }) => (
              <div key={l} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: c + "12" }}>
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

      {/* Recent 7 days */}
      {recentRecords.length > 0 && (
        <Card>
          <Accent from={C.teal} via={C.cyan} to={C.blue} />
          <P>
            <p className="text-xs text-gray-400 font-semibold mb-3 uppercase tracking-wider">Recent Records</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-400 border-b border-gray-100">
                    {["Date","Status","In","Out","Hours","OT","Deduction","Earned"].map((h, i) => (
                      <th key={h} className={`pb-2 font-semibold ${i >= 4 ? "text-right" : "text-left"}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recentRecords.map((r, i) => (
                    <tr key={i} className="border-b border-gray-50 hover:bg-blue-50/40 transition-colors">
                      <td className="py-2.5 text-gray-600 font-medium">
                        {new Date(r.date).toLocaleDateString("en-US", { month:"short", day:"numeric" })}
                      </td>
                      <td className="py-2.5"><StatusBadge status={r.status} /></td>
                      <td className="py-2.5 text-gray-500">{r.inOut?.in  || "—"}</td>
                      <td className="py-2.5 text-gray-500">{r.inOut?.out || "—"}</td>
                      <td className="py-2.5 text-right text-gray-700 font-medium">{fmt(r.financials?.hoursWorked, 1)}h</td>
                      <td className="py-2.5 text-right font-semibold" style={{ color: C.indigo }}>{fmt(r.financials?.otHours, 1)}h</td>
                      <td className="py-2.5 text-right font-semibold" style={{ color: C.rose }}>{fmtPKR(r.financials?.deduction)}</td>
                      <td className="py-2.5 text-right font-bold" style={{ color: C.emerald }}>{fmtPKR(r.financials?.finalDayEarning)}</td>
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

// ═══════════════════════════════════════════════════════════════════════════════
// PAYROLL SECTION
// ═══════════════════════════════════════════════════════════════════════════════

function PayrollSection({ payroll, navigate }) {
  if (!payroll?.history) return null;
  const history = payroll.history;

  const trendData = [...history].reverse().map((p) => ({
    name:       p.periodLabel || "—",
    Net:        p.netSalary   || 0,
    Deductions: p.totalDeduction || 0,
    OT:         p.totalOtAmount  || 0,
  }));

  return (
    <section>
      <SectionTitle icon={DollarSign} title="Payroll History" sub="Last 6 pay periods" color={C.emerald}
        onClick={() => navigate("/employee/salary")} />

      {history.length > 0 ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <Card>
              <Accent from={C.emerald} via={C.blue} to={C.indigo} />
              <P>
                <p className="text-xs text-gray-400 font-semibold mb-4 uppercase tracking-wider">Earnings Trend</p>
                <ResponsiveContainer width="100%" height={210}>
                  <AreaChart data={trendData} margin={{ top: 0, right: 0, left: -5, bottom: 0 }}>
                    <defs>
                      <linearGradient id="empNetGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor={C.emerald} stopOpacity={0.2} />
                        <stop offset="95%" stopColor={C.emerald} stopOpacity={0}   />
                      </linearGradient>
                    </defs>
                    <CartesianGrid {...gridProps} />
                    <XAxis dataKey="name" tick={axisStyle} />
                    <YAxis tick={axisStyle} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip content={<CustomTooltip prefix="PKR " />} />
                    <Legend wrapperStyle={{ fontSize: 11, color: "#94a3b8" }} />
                    <Area type="monotone" dataKey="Net"        stroke={C.emerald} fill="url(#empNetGrad)" strokeWidth={2} />
                    <Area type="monotone" dataKey="Deductions" stroke={C.rose}    fill="transparent"       strokeWidth={1.5} strokeDasharray="4 2" />
                  </AreaChart>
                </ResponsiveContainer>
              </P>
            </Card>

            <Card>
              <Accent from={C.blue} via={C.purple} to={C.indigo} />
              <P>
                <p className="text-xs text-gray-400 font-semibold mb-3 uppercase tracking-wider">Pay Period Breakdown</p>
                <div className="space-y-3">
                  {history.slice(0, 4).map((p, i) => (
                    <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 transition-colors">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: C.blue + "12" }}>
                        <FileText size={13} style={{ color: C.blue }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-800 truncate">{p.periodLabel}</p>
                        <p className="text-[10px] text-gray-400">
                          {p.presentDays || 0}d present · {fmt(p.totalHoursWorked, 0)}h
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold" style={{ color: C.emerald }}>{fmtPKR(p.netSalary)}</p>
                        <Badge
                          label={p.status}
                          color={{ paid: "green", approved: "blue", draft: "yellow" }[p.status] || "gray"}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </P>
            </Card>
          </div>
        </>
      ) : (
        <Card>
          <P>
            <div className="h-24 flex items-center justify-center text-gray-400 text-xs">No payroll records yet</div>
          </P>
        </Card>
      )}
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PERFORMANCE SECTION
// ═══════════════════════════════════════════════════════════════════════════════

function PerformanceSection({ perf }) {
  if (!perf) return null;
  const { latest, history = [] } = perf;
  if (!latest && history.length === 0) return null;

  const trendData = [...history].reverse().map((p) => ({
    name:        p.periodLabel || "—",
    Score:       parseFloat((p.performanceScore || 0).toFixed(1)),
    Attendance:  parseFloat((p.attendanceRate   || 0).toFixed(1)),
    Punctuality: parseFloat((p.punctualityRate  || 0).toFixed(1)),
  }));

  const RATING_COLOR = { Excellent: C.emerald, Good: C.blue, Average: C.amber, Poor: C.rose };
  const RATING_BADGE = { Excellent: "green", Good: "blue", Average: "yellow", Poor: "red" };

  return (
    <section>
      <SectionTitle icon={Award} title="Performance" sub="Your scores & trends" color={C.amber} />

      {latest && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
          <KpiCard title="Performance Score" value={`${latest.performanceScore}/100`} icon={Star}        accent={C.amber}   />
          <KpiCard title="Attendance Rate"   value={`${fmt(latest.attendanceRate, 1)}%`}  icon={CheckCircle} accent={C.emerald} />
          <KpiCard title="Punctuality Rate"  value={`${fmt(latest.punctualityRate, 1)}%`} icon={Target}      accent={C.blue}    />
          <KpiCard title="Rating"            value={latest.rating}                         icon={Award}       accent={RATING_COLOR[latest.rating] || C.slate} />
        </div>
      )}

      {trendData.length > 0 && (
        <Card>
          <Accent from={C.amber} via={C.blue} to={C.emerald} />
          <P>
            <p className="text-xs text-gray-400 font-semibold mb-4 uppercase tracking-wider">Performance Trends</p>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={trendData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="name" tick={axisStyle} />
                <YAxis domain={[0, 100]} tick={axisStyle} />
                <Tooltip content={<CustomTooltip suffix="%" />} />
                <Legend wrapperStyle={{ fontSize: 11, color: "#94a3b8" }} />
                <Line type="monotone" dataKey="Score"       stroke={C.amber}   strokeWidth={2}   dot={{ r: 3, fill: C.amber   }} />
                <Line type="monotone" dataKey="Attendance"  stroke={C.emerald} strokeWidth={1.5} dot={false} />
                <Line type="monotone" dataKey="Punctuality" stroke={C.blue}    strokeWidth={1.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </P>
        </Card>
      )}
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// LEAVES SECTION
// ═══════════════════════════════════════════════════════════════════════════════

function LeavesSection({ leaves, navigate }) {
  if (!leaves) return null;
  const { summary, typeBreakdown = [], recent = [], trend6Months = [] } = leaves;

  const trendData = trend6Months.map((t) => ({
    name:  monthLabel(t._id),
    Days:  t.totalDays,
    Count: t.count,
  }));

  const typeData = typeBreakdown.map((t) => ({
    name:  t._id?.replace(" Leave", "") || t._id,
    value: t.count,
  }));

  return (
    <section>
      <SectionTitle icon={Calendar} title="Leave Requests" sub="History & current status" color={C.blue} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
        <KpiCard title="Total Requests"  value={summary.total}          icon={Calendar}    accent={C.blue}    />
        <KpiCard title="Approved"        value={summary.approved}       icon={CheckCircle} accent={C.emerald} />
        <KpiCard title="Pending"         value={summary.pending}        icon={AlertCircle} accent={C.amber}   />
        <KpiCard title="Total Days Taken" value={summary.totalLeaveDays} icon={TrendingDown} accent={C.rose}  />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        {/* Leave type pie */}
        <Card>
          <Accent from={C.blue} via={C.purple} to={C.rose} />
          <P>
            <p className="text-xs text-gray-400 font-semibold mb-4 uppercase tracking-wider">Leave Types</p>
            {typeData.length > 0 ? (
              <ResponsiveContainer width="100%" height={175}>
                <PieChart>
                  <Pie data={typeData} cx="50%" cy="50%" outerRadius={65} dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}>
                    {typeData.map((_, i) => (
                      <Cell key={i} fill={PIE_PALETTE[i % PIE_PALETTE.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-44 flex items-center justify-center text-gray-400 text-xs">No leave data</div>
            )}
            <div className="mt-2 space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-400">Approval rate</span>
                <span className="text-gray-800 font-semibold">{summary.approvalRate}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Rejected</span>
                <span className="text-rose-600 font-semibold">{summary.rejected}</span>
              </div>
            </div>
          </P>
        </Card>

        {/* Trend chart */}
        <Card>
          <Accent from={C.indigo} via={C.blue} to={C.cyan} />
          <P>
            <p className="text-xs text-gray-400 font-semibold mb-4 uppercase tracking-wider">Leave Trend (6 Mo)</p>
            {trendData.length > 0 ? (
              <ResponsiveContainer width="100%" height={175}>
                <BarChart data={trendData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid {...gridProps} />
                  <XAxis dataKey="name" tick={axisStyle} />
                  <YAxis tick={axisStyle} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="Days" fill={C.blue} radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-44 flex items-center justify-center text-gray-400 text-xs">No data</div>
            )}
          </P>
        </Card>

        {/* Recent leaves */}
        <Card>
          <Accent from={C.rose} via={C.amber} to={C.blue} />
          <P>
            <p className="text-xs text-gray-400 font-semibold mb-3 uppercase tracking-wider">Recent Requests</p>
            {recent.length > 0 ? (
              <div className="space-y-2.5">
                {recent.map((l, i) => (
                  <div key={i} className="flex items-start gap-2.5 p-2 rounded-xl hover:bg-gray-50 transition-colors">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: C.blue + "12" }}>
                      <Calendar size={12} style={{ color: C.blue }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-semibold text-gray-700 truncate">{l.leaveType}</p>
                      <p className="text-[10px] text-gray-400">
                        {new Date(l.fromDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        {l.totalDays > 1 ? ` · ${l.totalDays}d` : ""}
                      </p>
                    </div>
                    <StatusBadge status={l.status} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-32 flex items-center justify-center text-gray-400 text-xs">No recent leaves</div>
            )}
          </P>
        </Card>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CORRECTIONS SECTION
// ═══════════════════════════════════════════════════════════════════════════════

function CorrectionsSection({ corrections, navigate }) {
  if (!corrections) return null;
  const { summary, recent = [] } = corrections;
  if (summary.total === 0) return null;

  return (
    <section>
      <SectionTitle icon={FileText} title="Correction Requests" sub="Time correction history" color={C.purple} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
        <KpiCard title="Total"    value={summary.total}    icon={FileText}    accent={C.purple}  />
        <KpiCard title="Approved" value={summary.approved} icon={CheckCircle} accent={C.emerald} />
        <KpiCard title="Pending"  value={summary.pending}  icon={AlertCircle} accent={C.amber}   />
        <KpiCard title="Approval Rate" value={`${summary.approvalRate}%`} icon={Percent} accent={C.blue} />
      </div>

      {recent.length > 0 && (
        <Card>
          <Accent from={C.purple} via={C.indigo} to={C.blue} />
          <P>
            <p className="text-xs text-gray-400 font-semibold mb-3 uppercase tracking-wider">Recent Corrections</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-400 border-b border-gray-100">
                    {["Date","Type","Original","Corrected","Reason","Status"].map((h, i) => (
                      <th key={h} className={`pb-2 font-semibold ${i === 5 ? "text-center" : "text-left"}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recent.map((c, i) => {
                    const orig = c.correctionType === "In"   ? c.originalInTime
                               : c.correctionType === "Out"  ? c.originalOutTime
                               : `${c.originalInTime || "—"} / ${c.originalOutTime || "—"}`;
                    const corr = c.correctionType === "In"   ? c.correctedInTime
                               : c.correctionType === "Out"  ? c.correctedOutTime
                               : `${c.correctedInTime || "—"} / ${c.correctedOutTime || "—"}`;
                    return (
                      <tr key={i} className="border-b border-gray-50 hover:bg-blue-50/40 transition-colors">
                        <td className="py-2.5 text-gray-600">
                          {new Date(c.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </td>
                        <td className="py-2.5"><Badge label={c.correctionType} color="blue" /></td>
                        <td className="py-2.5 text-gray-500">{orig || "—"}</td>
                        <td className="py-2.5 font-medium text-gray-700">{corr || "—"}</td>
                        <td className="py-2.5 text-gray-400 truncate max-w-[120px]">{c.reason}</td>
                        <td className="py-2.5 text-center"><StatusBadge status={c.status} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </P>
        </Card>
      )}
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════

export default function EmployeeStatsDashboard() {
  const [data, setData]               = useState(null);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);
  const [showEarnings, setShowEarnings] = useState(true);
  const navigate                      = useNavigate();

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get("/api/stats/employee", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data.success) setData(res.data.data);
      else setError("Failed to load stats");
    } catch (err) {
      setError("Could not connect to the server.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  if (loading)
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-14 h-14 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500 text-sm font-medium">Loading your stats…</p>
        </div>
      </div>
    );

  if (error)
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 text-center max-w-sm">
          <div className="w-14 h-14 bg-rose-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <AlertCircle size={28} className="text-rose-500" />
          </div>
          <p className="text-gray-800 font-bold mb-1">Something went wrong</p>
          <p className="text-gray-500 text-sm mb-5">{error}</p>
          <button onClick={fetchStats}
            className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white text-sm font-semibold rounded-xl transition-all duration-200 shadow-sm">
            Retry
          </button>
        </div>
      </div>
    );

  const d = data || {};

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <main className="max-w-7xl mx-auto px-4 md:px-6 py-8 space-y-10">

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900">My Dashboard</h1>
            <p className="text-xs text-gray-400">Your personal stats & activity</p>
          </div>
          <button onClick={fetchStats}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white text-xs font-semibold rounded-xl transition-all duration-200 shadow-sm">
            <RefreshCw size={14} /> Refresh
          </button>
        </div>

        {/* ── Earnings hero + today card ────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <EarningsCard
            period={d.currentPeriod}
            showEarnings={showEarnings}
            setShowEarnings={setShowEarnings}
          />
          <TodayCard today={d.attendance?.today} />
        </div>

        <hr className="border-blue-100" />
        <AttendanceSection att={d.attendance} navigate={navigate} />
        <hr className="border-blue-100" />
        <PerformanceSection perf={d.performance} />
        <hr className="border-blue-100" />
        <PayrollSection payroll={d.payroll} navigate={navigate} />
        <hr className="border-blue-100" />
        <LeavesSection leaves={d.leaves} navigate={navigate} />
        {d.corrections?.summary?.total > 0 && (
          <>
            <hr className="border-blue-100" />
            <CorrectionsSection corrections={d.corrections} navigate={navigate} />
          </>
        )}

        <p className="text-center text-xs text-gray-300 pb-4">
          © 2026 NOORI HR Portal. All rights reserved.
        </p>
      </main>
    </div>
  );
}