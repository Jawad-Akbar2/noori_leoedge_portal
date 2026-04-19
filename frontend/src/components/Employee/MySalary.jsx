import React, { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import {
  Calendar,
  Download,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Wallet,
  Eye,
  X,
} from "lucide-react";
import toast from "react-hot-toast";

// ── date helpers ──────────────────────────────────────────────────────────────

/** "YYYY-MM-DD" → "dd/mm/yyyy"  (what /api/payroll/my/summary expects) */
const toApiDate = (isoStr) => {
  if (!isoStr) return "";
  const [y, m, d] = isoStr.split("-");
  return `${d}/${m}/${y}`;
};

/** "YYYY-MM-DD" → "dd/mm/yyyy"  (display in date picker button) */
const isoToDisplay = (isoStr) => {
  if (!isoStr) return "";
  const [y, m, d] = isoStr.split("-");
  return `${d}/${m}/${y}`;
};

/** PKR number formatter */
const pkr = (val) => (val ?? 0).toLocaleString("en-PK", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

/** Default pay-period start: 18th of current (or prior) month */
const defaultFromDate = () => {
  const now = new Date();
  const day = now.getDate();
  const year = now.getFullYear();
  const month = now.getMonth();
  const start =
    day >= 18 ? new Date(year, month, 18) : new Date(year, month - 1, 18);
  return start.toISOString().split("T")[0];
};

// ─────────────────────────────────────────────────────────────────────────────

export default function MySalary() {
  const fromDateRef = useRef(null);
  const toDateRef = useRef(null);

  const [fromDate, setFromDate] = useState(defaultFromDate);
  const [toDate, setToDate] = useState(
    () => new Date().toISOString().split("T")[0],
  );

  // FIX 6: separate loading state; don't gate the whole page on salaryData
  const [summary, setSummary] = useState(null);
  const [dailyBreakdown, setDailyBreakdown] = useState([]);
  const [loading, setLoading] = useState(false);
  const [detailsModal, setDetailsModal] = useState(null);

  // FIX 1: correct route  → GET /api/payroll/my/summary  (employeeAuth, no :id)
  // FIX 2: correct params → startDate / endDate
  const fetchSalaryData = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");

      const response = await axios.get("/api/payroll/my/summary", {
        params: {
          startDate: toApiDate(fromDate),
          endDate: toApiDate(toDate),
        },
        headers: { Authorization: `Bearer ${token}` },
      });

      setSummary(response.data.summary ?? null);
      setDailyBreakdown(response.data.dailyBreakdown ?? []);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to fetch salary data");
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate]);

  useEffect(() => {
    fetchSalaryData();
  }, [fetchSalaryData]);

  const handleDownloadPDF = () => {
    toast("PDF download coming soon", { icon: "📄" });
  };

  // ── summary card definitions (FIX 3: correct field names) ────────────────
  const summaryCards = summary
    ? [
        {
          label: "Total Basic Earned",
          // FIX 3: baseSalary (not basicEarned)
          value: `PKR ${pkr(summary.baseSalary)}`,
          icon: <DollarSign size={18} className="text-blue-600" />,
          bg: "bg-blue-50",
          color: "text-gray-800",
        },
        {
          label: "Overtime Total",
          // FIX 3: totalOtAmount (not otTotal)
          value: `PKR ${pkr(summary.totalOtAmount)}`,
          icon: <TrendingUp size={18} className="text-green-600" />,
          bg: "bg-green-50",
          color: "text-green-700",
        },
        {
          label: "Total Deductions",
          // FIX 3: totalDeduction (not deductionTotal)
          value: `PKR ${pkr(summary.totalDeduction)}`,
          icon: <TrendingDown size={18} className="text-red-500" />,
          bg: "bg-red-50",
          color: "text-red-600",
        },
        {
          label: "Net Payable",
          value: `PKR ${pkr(summary.netSalary)}`,
          icon: <Wallet size={18} className="text-white" />,
          bg: "",
          color: "text-white",
          accent: true,
        },
      ]
    : [];

  return (
    <div className="p-4 md:p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800">
          My Salary
        </h1>
        <button
          onClick={handleDownloadPDF}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium"
        >
          <Download size={16} />
          Download PDF
        </button>
      </div>

      {/* Date filter — always visible (FIX 6) */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 md:p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              From Date
            </label>
            <div
              onClick={() => fromDateRef.current?.showPicker()}
              className="flex items-center justify-between w-full px-4 py-2 border border-gray-300 rounded-lg cursor-pointer bg-white hover:border-blue-400 transition"
            >
              <span className="text-gray-800">{isoToDisplay(fromDate)}</span>
              <Calendar size={16} className="text-gray-400" />
            </div>
            <input
              ref={fromDateRef}
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="absolute opacity-0 pointer-events-none inset-0 w-full"
            />
          </div>

          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              To Date
            </label>
            <div
              onClick={() => toDateRef.current?.showPicker()}
              className="flex items-center justify-between w-full px-4 py-2 border border-gray-300 rounded-lg cursor-pointer bg-white hover:border-blue-400 transition"
            >
              <span className="text-gray-800">{isoToDisplay(toDate)}</span>
              <Calendar size={16} className="text-gray-400" />
            </div>
            <input
              ref={toDateRef}
              type="date"
              value={toDate}
              min={fromDate}
              onChange={(e) => setToDate(e.target.value)}
              className="absolute opacity-0 pointer-events-none inset-0 w-full"
            />
          </div>

          <div className="flex items-end">
            <button
              onClick={fetchSalaryData}
              disabled={loading}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium disabled:opacity-60"
            >
              {loading ? "Loading…" : "Update"}
            </button>
          </div>
        </div>
      </div>

      {loading && !summary ? (
        <div className="py-16 text-center text-gray-400">
          Loading salary data…
        </div>
      ) : summary ? (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            {summaryCards.map((card) => (
              <div
                key={card.label}
                className={`rounded-xl shadow-sm border p-5 ${
                  card.accent
                    ? "bg-blue-600 border-blue-600"
                    : "bg-white border-gray-100"
                }`}
              >
                <div
                  className={`inline-flex p-2 rounded-lg ${card.accent ? "bg-blue-500" : card.bg} mb-3`}
                >
                  {card.icon}
                </div>
                <p
                  className={`text-sm mb-1 ${card.accent ? "text-blue-100" : "text-gray-500"}`}
                >
                  {card.label}
                </p>
                <p className={`text-xl font-bold ${card.color}`}>
                  {card.value}
                </p>
              </div>
            ))}
          </div>

          {/* Attendance quick-stats */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-6">
            <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-4">
              Period Summary
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
              {[
                {
                  label: "Working Days",
                  value: summary.totalWorkingDays ?? "—",
                },
                {
                  label: "Present",
                  value: summary.presentDays ?? "—",
                  color: "text-green-600",
                },
                {
                  label: "Late",
                  value: summary.lateDays ?? "—",
                  color: "text-yellow-600",
                },
                {
                  label: "Off Day",
                  value: summary.OffDayDays ?? "—",
                  color: "text-red-500",
                },
                {
                  label: "Leave",
                  value: summary.leaveDays ?? "—",
                  color: "text-blue-600",
                },
                {
                  label: "NCNS",
                  value: summary.ncnsDays ?? "—",
                  color: "text-gray-600",
                },
              ].map((s) => (
                <div key={s.label}>
                  <p
                    className={`text-2xl font-bold ${s.color ?? "text-gray-800"}`}
                  >
                    {s.value}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">{s.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Daily breakdown table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 border-b bg-gray-50 flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-800">
                Daily Breakdown
              </h2>
              <span className="text-sm text-gray-400">
                {dailyBreakdown.length} records
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b text-gray-600">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Date</th>
                    <th className="px-4 py-3 text-left font-semibold">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left font-semibold">
                      In / Out
                    </th>
                    {/* FIX 4: hoursWorked (not hoursPerDay) */}
                    <th className="px-4 py-3 text-right font-semibold">
                      Base Pay
                    </th>
                    <th className="px-4 py-3 text-right font-semibold">OT</th>
                    <th className="px-4 py-3 text-right font-semibold">
                      Deduction
                    </th>
                    {/* FIX 4: finalDayEarning (not dailyEarning) */}
                    <th className="px-4 py-3 text-right font-semibold">
                      Day Earning
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {dailyBreakdown.map((day, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      {/* FIX 5: day.date is already "dd/mm/yyyy" — no reformatting */}
                      <td className="px-4 py-3 font-medium text-gray-800">
                        {day.date}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                            day.status === "Present"
                              ? "bg-green-100 text-green-700"
                              : day.status === "Late"
                                ? "bg-yellow-100 text-yellow-700"
                                : day.status === "Leave"
                                  ? "bg-blue-100 text-blue-700"
                                  : day.status === "OffDay"
                                    ? "bg-red-100 text-red-500"
                                    : day.status === "ncns"
                                      ? "bg-purple-100 text-purple-700"
                                      : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {day.status ?? "OffDay"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {/* FIX 4: inTime / outTime (not inOut.in / inOut.out) */}
                        {day.inTime && day.outTime ? (
                          `${day.inTime} / ${day.outTime}`
                        ) : (
                          <span className="text-gray-400">— / —</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-800">
                        PKR {pkr(day.basePay)}
                      </td>
                      <td className="px-4 py-3 text-right text-green-600">
                        {(day.otAmount ?? 0) > 0 ? (
                          <button
                            type="button"
                            onClick={() => setDetailsModal({ type: "ot", day })}
                            className="inline-flex items-center gap-1 hover:text-green-800"
                          >
                            PKR {pkr(day.otAmount)} <Eye size={12} />
                          </button>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-red-500">
                        {(day.deduction ?? 0) > 0 ? (
                          <button
                            type="button"
                            onClick={() =>
                              setDetailsModal({ type: "deduction", day })
                            }
                            className="inline-flex items-center gap-1 hover:text-red-700"
                          >
                            PKR {pkr(day.deduction)} <Eye size={12} />
                          </button>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-blue-600">
                        {/* FIX 4: finalDayEarning (not dailyEarning) */}
                        PKR {pkr(day.finalDayEarning)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                  <tr>
                    <td
                      colSpan="3"
                      className="px-4 py-3 font-semibold text-gray-700"
                    >
                      Total
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">
                      PKR {pkr(summary.baseSalary)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-green-600">
                      PKR {pkr(summary.totalOtAmount)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-red-500">
                      PKR {pkr(summary.totalDeduction)}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-blue-700">
                      PKR {pkr(summary.netSalary)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="py-16 text-center text-gray-400">
          No salary data found for the selected period.
        </div>
      )}
      {/* OT / Deduction detail popup */}
      {detailsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-3 border-b">
              <h3 className="font-semibold text-gray-800">
                {detailsModal.type === "ot"
                  ? "OT Details"
                  : "Deduction Details"}{" "}
                — {detailsModal.day.date}
              </h3>
              <button
                onClick={() => setDetailsModal(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-4 space-y-2 max-h-80 overflow-auto">
              {(() => {
                const entries =
                  detailsModal.type === "ot"
                    ? detailsModal.day.otDetails
                    : detailsModal.day.deductionDetails;
                if (!entries?.length)
                  return (
                    <p className="text-sm text-gray-500">
                      No detail entries found.
                    </p>
                  );
                return entries.map((entry, i) => (
                  <div
                    key={i}
                    className="border rounded-lg p-2 text-sm bg-gray-50"
                  >
                    {detailsModal.type === "ot" ? (
                      <p>
                        {entry.type === "manual"
                          ? `Amount: PKR ${entry.amount}`
                          : `Hours: ${entry.hours} × ${entry.rate}x`}
                        {" · "}
                        {entry.reason}
                      </p>
                    ) : (
                      <p>
                        Amount: PKR {entry.amount} · {entry.reason}
                      </p>
                    )}
                  </div>
                ));
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
