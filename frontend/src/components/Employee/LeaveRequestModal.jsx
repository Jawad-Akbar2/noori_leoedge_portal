import React, { useState, useRef, useEffect } from "react";
import axios from "axios";
import {
  X,
  Calendar,
  Loader2,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import toast from "react-hot-toast";

const LEAVE_TYPES = [
  {
    value: "Sick Leave",
    label: "Sick Leave",
    quota: 7,
    color: "orange",
    description: "Medical or health-related absence",
    icon: "🤒",
  },
  {
    value: "Holiday Leave",
    label: "Holiday Leave",
    quota: 13,
    color: "blue",
    description: "Annual holiday or personal time off",
    icon: "🌴",
  },
];

const colorMap = {
  orange: {
    card: "border-orange-200 bg-orange-50",
    selected: "border-orange-500 bg-orange-50 ring-2 ring-orange-300",
    badge: "bg-orange-100 text-orange-700",
    bar: "bg-orange-400",
    barBg: "bg-orange-100",
    text: "text-orange-700",
    icon: "bg-orange-100",
  },
  blue: {
    card: "border-blue-200 bg-blue-50",
    selected: "border-blue-500 bg-blue-50 ring-2 ring-blue-300",
    badge: "bg-blue-100 text-blue-700",
    bar: "bg-blue-500",
    barBg: "bg-blue-100",
    text: "text-blue-700",
    icon: "bg-blue-100",
  },
};

export default function LeaveRequestModal({
  onClose,
  onSubmit,
  initialDate = "",
}) {
  const fromDateRef = useRef(null);
  const toDateRef = useRef(null);

  const [formData, setFormData] = useState({
    fromDate: initialDate,
    toDate: initialDate,
    leaveType: "Holiday Leave",
    reason: "",
    isNewEmployeeRequest: false,
  });

  const [showNewEmpCheckbox, setShowNewEmpCheckbox] = useState(false);

  const [loading, setLoading] = useState(false);
  const [quotaLoading, setQuotaLoading] = useState(true);
  const [quota, setQuota] = useState({
    spent: { "Sick Leave": 0, "Holiday Leave": 0 },
    remaining: { "Sick Leave": 7, "Holiday Leave": 13 },
    yearStart: "",
    yearEnd: "",
  });

  // ── fetch quota on mount ───────────────────────────────────────────────────
  useEffect(() => {
    const fetchQuota = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await axios.get("/api/requests/leave/quota", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.data.success) {
          setQuota({
            spent: res.data.spent,
            remaining: res.data.remaining,
            yearStart: res.data.yearStart,
            yearEnd: res.data.yearEnd,
          });
        }
      } catch {
        // non-fatal — UI still works without quota
      } finally {
        setQuotaLoading(false);
      }
    };
    fetchQuota();
  }, []);

  const formatDateToDisplay = (dateStr) => {
    if (!dateStr) return "";
    const [year, month, day] = dateStr.split("-");
    return `${day}/${month}/${year}`;
  };

  // ── days selected in the date range ───────────────────────────────────────
  const selectedDays = (() => {
    if (!formData.fromDate || !formData.toDate) return 0;
    const diff =
      (new Date(formData.toDate) - new Date(formData.fromDate)) / 86_400_000;
    return Math.max(0, Math.floor(diff) + 1);
  })();

  const activeType = LEAVE_TYPES.find((t) => t.value === formData.leaveType);
  const quota_total = activeType?.quota ?? 0;
  const quota_spent = quota.spent[formData.leaveType] ?? 0;
  const quota_remain = quota.remaining[formData.leaveType] ?? quota_total;
  const willExceed = selectedDays > quota_remain;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.fromDate || !formData.toDate) {
      toast.error("Please select both dates");
      return;
    }
    if (new Date(formData.fromDate) > new Date(formData.toDate)) {
      toast.error("From date must be before to date");
      return;
    }
    if (!formData.reason.trim()) {
      toast.error("Please provide a reason");
      return;
    }
    if (willExceed) {
      toast.error(
        `Only ${quota_remain} ${formData.leaveType} day(s) remaining`,
      );
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      await axios.post("/api/requests/leave/submit", formData, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success("Leave request submitted successfully");
      onSubmit();
      onClose();
    } catch (error) {
      const data = error.response?.data;
      if (data?.requiresNewEmployeeAck) {
        // Backend told us they're a new employee — show the checkbox instead of hard-blocking
        setShowNewEmpCheckbox(true);
        toast.error(data.message);
      } else {
        toast.error(data?.message || "Failed to submit leave request");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-xl font-bold text-gray-800">Apply for Leave</h2>
            {quota.yearStart && (
              <p className="text-xs text-gray-400 mt-0.5">
                Leave year: {quota.yearStart} → {quota.yearEnd}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <X size={22} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5 max-h-[80vh] overflow-y-auto">
          {/* ── Leave type selector ── */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Leave Type
            </label>
            <div className="grid grid-cols-2 gap-3">
              {LEAVE_TYPES.map((lt) => {
                const c = colorMap[lt.color];
                const isActive = formData.leaveType === lt.value;
                const rem = quota.remaining[lt.value] ?? lt.quota;
                const spent = quota.spent[lt.value] ?? 0;
                const pct = Math.min(100, (spent / lt.quota) * 100);

                return (
                  <button
                    key={lt.value}
                    type="button"
                    onClick={() =>
                      setFormData((prev) => ({ ...prev, leaveType: lt.value }))
                    }
                    className={`text-left p-4 rounded-xl border-2 transition-all ${
                      isActive
                        ? c.selected
                        : "border-gray-200 bg-white hover:border-gray-300"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className={`w-8 h-8 rounded-lg ${c.icon} flex items-center justify-center text-lg`}
                      >
                        {lt.icon}
                      </span>
                      <span className="font-semibold text-sm text-gray-800">
                        {lt.label}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mb-3">
                      {lt.description}
                    </p>

                    {quotaLoading ? (
                      <div className="h-3 bg-gray-100 rounded-full animate-pulse" />
                    ) : (
                      <>
                        {/* Progress bar */}
                        <div className={`h-1.5 rounded-full ${c.barBg} mb-2`}>
                          <div
                            className={`h-full rounded-full ${c.bar} transition-all`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        {/* Counts */}
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500">
                            <span className="font-semibold text-gray-700">
                              {rem}
                            </span>{" "}
                            remaining
                          </span>
                          <span className={`font-medium ${c.text}`}>
                            {spent}/{lt.quota} used
                          </span>
                        </div>
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Active type quota summary strip ── */}
          {!quotaLoading && activeType && (
            <div
              className={`rounded-xl p-3 flex items-center gap-3 ${
                willExceed
                  ? "bg-red-50 border border-red-200"
                  : quota_remain === 0
                    ? "bg-red-50 border border-red-200"
                    : "bg-gray-50 border border-gray-200"
              }`}
            >
              {willExceed || quota_remain === 0 ? (
                <AlertTriangle size={16} className="text-red-500 shrink-0" />
              ) : (
                <CheckCircle2 size={16} className="text-green-500 shrink-0" />
              )}
              <div className="flex-1 text-xs">
                {quota_remain === 0 ? (
                  <span className="text-red-600 font-medium">
                    No {formData.leaveType} days remaining this year.
                  </span>
                ) : willExceed ? (
                  <span className="text-red-600 font-medium">
                    Requesting {selectedDays} day(s) but only {quota_remain}{" "}
                    remaining.
                  </span>
                ) : selectedDays > 0 ? (
                  <span className="text-gray-600">
                    Requesting{" "}
                    <span className="font-semibold text-gray-800">
                      {selectedDays} day(s)
                    </span>{" "}
                    · {quota_remain - selectedDays} will remain after this
                    request.
                  </span>
                ) : (
                  <span className="text-gray-500">
                    {quota_remain} of {quota_total} {formData.leaveType} day(s)
                    available.
                  </span>
                )}
              </div>
              {selectedDays > 0 && (
                <span
                  className={`text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ${
                    willExceed
                      ? "bg-red-100 text-red-700"
                      : colorMap[activeType.color].badge
                  }`}
                >
                  {selectedDays}d
                </span>
              )}
            </div>
          )}

          {/* ── Date pickers ── */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                From Date
              </label>
              <div className="relative">
                <div
                  onClick={() => fromDateRef.current?.showPicker()}
                  className="flex items-center justify-between w-full px-3 py-2.5 border border-gray-300 rounded-xl cursor-pointer bg-white hover:border-blue-400 transition"
                >
                  <span
                    className={
                      formData.fromDate
                        ? "text-gray-900 text-sm"
                        : "text-gray-400 text-sm"
                    }
                  >
                    {formData.fromDate
                      ? formatDateToDisplay(formData.fromDate)
                      : "dd/mm/yyyy"}
                  </span>
                  <Calendar size={16} className="text-gray-400" />
                </div>
                <input
                  ref={fromDateRef}
                  type="date"
                  name="fromDate"
                  value={formData.fromDate}
                  onChange={handleChange}
                  className="absolute opacity-0 pointer-events-none inset-0 w-full"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                To Date
              </label>
              <div className="relative">
                <div
                  onClick={() => toDateRef.current?.showPicker()}
                  className="flex items-center justify-between w-full px-3 py-2.5 border border-gray-300 rounded-xl cursor-pointer bg-white hover:border-blue-400 transition"
                >
                  <span
                    className={
                      formData.toDate
                        ? "text-gray-900 text-sm"
                        : "text-gray-400 text-sm"
                    }
                  >
                    {formData.toDate
                      ? formatDateToDisplay(formData.toDate)
                      : "dd/mm/yyyy"}
                  </span>
                  <Calendar size={16} className="text-gray-400" />
                </div>
                <input
                  ref={toDateRef}
                  type="date"
                  name="toDate"
                  value={formData.toDate}
                  min={formData.fromDate}
                  onChange={handleChange}
                  className="absolute opacity-0 pointer-events-none inset-0 w-full"
                />
              </div>
            </div>
          </div>

          {showNewEmpCheckbox && (
            <div className="rounded-xl p-4 bg-yellow-50 border border-yellow-200">
              <div className="flex items-start gap-3">
                <AlertTriangle
                  size={16}
                  className="text-yellow-600 mt-0.5 shrink-0"
                />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-yellow-800 mb-1">
                    You are within your probation period
                  </p>
                  <p className="text-xs text-yellow-700 mb-3">
                    You haven't completed 90 days of service. Your request will
                    be flagged for admin review as a new employee leave
                    application.
                  </p>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isNewEmployeeRequest}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          isNewEmployeeRequest: e.target.checked,
                        }))
                      }
                      className="w-4 h-4 rounded border-yellow-400 text-yellow-600 focus:ring-yellow-400"
                    />
                    <span className="text-xs font-medium text-yellow-800">
                      I understand this is a new employee leave request and
                      admin approval is required
                    </span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* ── Reason ── */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Reason
            </label>
            <textarea
              name="reason"
              value={formData.reason}
              onChange={handleChange}
              rows={3}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm resize-none"
              placeholder="Provide reason for leave…"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition text-sm font-medium"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={
              loading ||
              quota_remain === 0 ||
              willExceed ||
              (showNewEmpCheckbox && !formData.isNewEmployeeRequest)
            }
            className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 size={15} className="animate-spin" /> Submitting…
              </>
            ) : (
              "Submit Request"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
