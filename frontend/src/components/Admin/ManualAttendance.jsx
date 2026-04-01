import React, { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";
import {
  Plus,
  Download,
  Upload,
  AlertCircle,
  RefreshCw,
  X,
  Save,
  Pencil,
  Calendar,
  Eye,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Search,
  CheckCircle2,
  Circle,
  Loader2,
  RotateCcw,
} from "lucide-react";
import toast from "react-hot-toast";
import CSVImportModal from "./CSVImportModal.jsx";
import {
  getDateMinusDays,
  getTodayDate,
  parseDate,
} from "../../utils/dateFormatter.js";
import TimePicker from "../Common/TimePicker.jsx";
import { useEscape } from "../../context/EscapeStack";

// ─── Constants ────────────────────────────────────────────────────────────────
const PRIVILEGED_ROLES = ["admin", "superadmin", "owner"];
const STATUS_OPTIONS = ["Present", "Late", "Absent", "Leave"];
const STATUS_STYLES = {
  Present: "bg-green-100  text-green-800  border-green-200",
  Late: "bg-yellow-100 text-yellow-800 border-yellow-200",
  Leave: "bg-blue-100   text-blue-800   border-blue-200",
  Absent: "bg-red-100    text-red-800    border-red-200",
  "": "bg-gray-100   text-gray-500   border-gray-200",
};

// ─── Auth helpers ─────────────────────────────────────────────────────────────
function getCurrentUserRole() {
  try {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    return user.role || localStorage.getItem("role") || "";
  } catch {
    return localStorage.getItem("role") || "";
  }
}
const authHeader = () => ({
  Authorization: `Bearer ${localStorage.getItem("token")}`,
  "Content-Type": "application/json",
});

// ─── Pure helpers ─────────────────────────────────────────────────────────────
const safeTime = (v) => (v && v !== "--" ? v : "--");
const emptyTime = (v) => (v && v !== "--" ? v : "");
const pkr = (v) => `PKR ${Number(v || 0).toFixed(2)}`;
const displayTime = (val) => (val && val !== "--" ? val : "--");

function resolveEmpId(raw) {
  if (!raw) return "";
  return typeof raw === "object"
    ? raw._id?.toString?.() || String(raw)
    : String(raw);
}

async function saveRowApi({
  empId,
  date,
  status,
  inTime,
  outTime,
  outNextDay,
}) {
  const res = await axios.post(
    "/api/attendance/save-row",
    {
      empId,
      date,
      status,
      inTime: inTime || null,
      outTime: outTime || null,
      outNextDay: Boolean(outNextDay),
    },
    { headers: authHeader() },
  );
  return res.data;
}

// ─── DateNavigator (single date) ─────────────────────────────────────────────
function DateNavigator({
  value,
  onChange,
  label,
  showTodayBadge = false,
  maxDate = null,
}) {
  const hiddenRef = useRef(null);
  const isToday = value === getTodayDate();
  // helper to compare dd/mm/yyyy strings
  const isAfterMax = (dateStr) => {
    if (!maxDate || !dateStr) return false;
    const [d, m, y] = dateStr.split("/").map(Number);
    const [md, mm, my] = maxDate.split("/").map(Number);
    const a = new Date(y, m - 1, d);
    const b = new Date(my, mm - 1, md);
    return a > b;
  };

  const shift = (dir) => {
    if (!value) return;
    const [d, m, y] = value.split("/").map(Number);
    if (!d || !m || !y) return;
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() + dir);
    const next = `${String(dt.getDate()).padStart(2, "0")}/${String(dt.getMonth() + 1).padStart(2, "0")}/${dt.getFullYear()}`;
    if (isAfterMax(next)) return; // block forward navigation past maxDate
    onChange(next);
  };

  const handleTextChange = (val) => {
    if (isAfterMax(val)) return; // block manual typing past maxDate
    onChange(val);
  };

  const handlePickerChange = (e) => {
    const [y, m, d] = e.target.value.split("-");
    const formatted = `${d}/${m}/${y}`;
    if (isAfterMax(formatted)) return;
    onChange(formatted);
  };

  return (
    <div>
      {label && (
        <label className="block text-xs font-medium text-gray-700 mb-1">
          {label}
        </label>
      )}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => shift(-1)}
          className="p-2 rounded-lg border border-gray-300 hover:bg-gray-100 transition text-gray-600 flex-shrink-0"
        >
          <ChevronLeft size={15} />
        </button>
        <div className="relative flex-1 min-w-[130px]">
          <input
            type="text"
            value={value}
            onChange={(e) => handleTextChange(e.target.value)}
            placeholder="dd/mm/yyyy"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 pr-8 text-center"
          />
          <input
            type="date"
            ref={hiddenRef}
            className="absolute opacity-0 pointer-events-none w-0 h-0"
            max={
              maxDate
                ? (() => {
                    const [d, m, y] = maxDate.split("/");
                    return `${y}-${m}-${d}`;
                  })()
                : undefined
            }
            onChange={handlePickerChange}
          />
          <button
            type="button"
            onClick={() => {
              try {
                hiddenRef.current?.showPicker();
              } catch {
                hiddenRef.current?.focus();
              }
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-blue-500"
          >
            <Calendar size={14} />
          </button>
        </div>
        <button
          type="button"
          onClick={() => shift(1)}
          className="p-2 rounded-lg border border-gray-300 hover:bg-gray-100 transition text-gray-600 flex-shrink-0"
        >
          <ChevronRight size={15} />
        </button>
        {showTodayBadge && isToday && (
          <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded-full flex-shrink-0">
            Today
          </span>
        )}
      </div>
    </div>
  );
}

// ─── DateRangePicker ──────────────────────────────────────────────────────────
function DateRangePicker({
  fromDate,
  setFromDate,
  toDate,
  setToDate,
  rangeEnabled,
  setRangeEnabled,
  label1,
  label2,
}) {
  const toggleRange = (checked) => {
    setRangeEnabled(checked);
    if (!checked) setToDate(fromDate);
  };

  return (
    <div className="flex flex-wrap items-end gap-4">
      <DateNavigator
        value={fromDate}
        onChange={setFromDate}
        label={label1 || "Date (dd/mm/yyyy)"}
      />
      <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none pb-0.5">
        <input
          type="checkbox"
          checked={rangeEnabled}
          onChange={(e) => toggleRange(e.target.checked)}
          className="w-4 h-4 rounded border-gray-300"
        />
        Date range
      </label>
      {rangeEnabled && (
        <DateNavigator
          value={toDate}
          onChange={setToDate}
          label={label2 || "To Date (dd/mm/yyyy)"}
        />
      )}
    </div>
  );
}

// ─── SearchBar ────────────────────────────────────────────────────────────────
function SearchBar({ value, onChange, placeholder = "Search..." }) {
  return (
    <div className="relative">
      <Search
        size={15}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
        >
          <X size={13} />
        </button>
      )}
    </div>
  );
}

function filterRecords(records, query) {
  if (!query.trim()) return records;
  const q = query.toLowerCase();
  return records.filter(
    (r) =>
      (r.empName || "").toLowerCase().includes(q) ||
      (r.empNumber || "").toLowerCase().includes(q) ||
      (r.department || "").toLowerCase().includes(q) ||
      (r.status || "").toLowerCase().includes(q) ||
      (r.dateFormatted || "").includes(q),
  );
}

// ─── StatusSelect ─────────────────────────────────────────────────────────────
function StatusSelect({ value, onChange, disabled, readOnly }) {
  if (readOnly) {
    return (
      <span
        className={`text-xs font-semibold px-2 py-1 rounded-full border ${STATUS_STYLES[value] || STATUS_STYLES[""]}`}
      >
        {value || "—"}
      </span>
    );
  }
  return (
    <select
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className={`text-xs font-semibold rounded-md border px-2 py-1 focus:ring-2 focus:ring-blue-400 focus:outline-none disabled:opacity-60 cursor-pointer transition ${STATUS_STYLES[value] || STATUS_STYLES[""]}`}
    >
      {STATUS_OPTIONS.map((s) => (
        <option key={s} value={s}>
          {s}
        </option>
      ))}
    </select>
  );
}

function TimeInput({ value, onChange, placeholder, disabled, readOnly }) {
  // readOnly mode: plain text display (unchanged)
  if (readOnly) {
    return (
      <span className="text-xs text-gray-500">
        {value && value !== "--" ? value : "--"}
      </span>
    );
  }
  // Edit mode: use the TimePicker popover
  return (
    <TimePicker
      value={value || ""}
      onChange={onChange}
      placeholder={placeholder || "HH:mm"}
      disabled={disabled}
    />
  );
}

function StatusDot({ isDirty, isSaved, isSaving, isVirtual }) {
  if (isSaving)
    return <Loader2 size={14} className="text-blue-500 animate-spin" />;
  if (isSaved) return <CheckCircle2 size={14} className="text-green-500" />;
  if (isDirty)
    return <Circle size={14} className="text-amber-500 fill-amber-400" />;
  if (isVirtual) return <Circle size={14} className="text-gray-300" />;
  return <CheckCircle2 size={14} className="text-gray-300" />;
}

// ─── OT & Deduction Edit Modal ────────────────────────────────────────────────
function OTDeductionEditModal({
  onClose,
  record,
  type,
  currentUserRole,
  onSuccess,
}) {
  useEscape(onClose);

  const isHybrid = currentUserRole === "hybrid";
  const empId = resolveEmpId(record?.empId);
  const date = record?.dateFormatted;

  const [otDetails, setOtDetails] = useState(
    record?.financials?.otDetails || [],
  );
  const [deductionDetails, setDeductionDetails] = useState(
    record?.financials?.deductionDetails || [],
  );
  const [otDraft, setOtDraft] = useState({
    type: "calc",
    amount: "",
    hours: "",
    rate: "1.5",
    reason: "",
  });
  const [deductionDraft, setDeductionDraft] = useState({
    amount: "",
    reason: "",
  });
  const [saving, setSaving] = useState(false);

  const persist = async (ot = otDetails, ded = deductionDetails) => {
    setSaving(true);
    try {
      await axios.post(
        "/api/attendance/save-row",
        {
          empId,
          date,
          status: record.status,
          inTime: emptyTime(record.inTime) || null,
          outTime: emptyTime(record.outTime) || null,
          outNextDay: record.outNextDay || false,
          otDetails: ot,
          deductionDetails: ded,
        },
        { headers: authHeader() },
      );
      toast.success("Saved");
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const addDeduction = () => {
    const amount = parseFloat(deductionDraft.amount);
    if (!amount || amount < 0)
      return toast.error("Enter a valid deduction amount");
    if (!deductionDraft.reason.trim())
      return toast.error("Deduction reason is required");
    setDeductionDetails((prev) => [
      ...prev,
      { amount, reason: deductionDraft.reason.trim() },
    ]);
    setDeductionDraft({ amount: "", reason: "" });
  };

  const addOT = () => {
    if (!otDraft.reason.trim()) return toast.error("OT reason is required");
    if (otDraft.type === "manual") {
      const amount = parseFloat(otDraft.amount);
      if (!amount || amount < 0) return toast.error("Enter a valid OT amount");
      setOtDetails((prev) => [
        ...prev,
        { type: "manual", amount, reason: otDraft.reason.trim() },
      ]);
    } else {
      const hours = parseFloat(otDraft.hours);
      const rate = parseFloat(otDraft.rate) || 1;
      if (!hours || hours <= 0) return toast.error("Enter valid OT hours");
      setOtDetails((prev) => [
        ...prev,
        { type: "calc", hours, rate, reason: otDraft.reason.trim() },
      ]);
    }
    setOtDraft({
      type: "calc",
      amount: "",
      hours: "",
      rate: "1.5",
      reason: "",
    });
  };

  const removeDeduction = async (i) => {
    const updated = deductionDetails.filter((_, x) => x !== i);
    setDeductionDetails(updated);
    await persist(otDetails, updated);
  };

  const removeOT = async (i) => {
    const updated = otDetails.filter((_, x) => x !== i);
    setOtDetails(updated);
    await persist(updated, deductionDetails);
  };

  const title = type === "ot" ? "Overtime (OT)" : "Deductions";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-bold text-gray-800">{title}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X size={20} />
          </button>
        </div>
        <div className="px-6 pt-4">
          <div className="bg-blue-50 rounded-lg px-4 py-3 mb-4">
            <p className="text-sm font-semibold text-blue-800">
              {record?.empName}
            </p>
            <p className="text-xs text-blue-600">
              ID: {record?.empNumber} · {record?.department} · {date}
            </p>
          </div>
        </div>
        <div className="px-6 pb-5 space-y-4 overflow-auto flex-1">
          {type === "ot" && !isHybrid && (
            <div className="border rounded-lg p-3 bg-gray-50 space-y-2">
              <p className="text-sm font-semibold text-gray-700">
                Overtime (OT)
              </p>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={otDraft.type}
                  onChange={(e) =>
                    setOtDraft((prev) => ({ ...prev, type: e.target.value }))
                  }
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="calc">Calculated</option>
                  <option value="manual">Manual Amount</option>
                </select>
                <input
                  type="text"
                  placeholder="Reason"
                  value={otDraft.reason}
                  onChange={(e) =>
                    setOtDraft((prev) => ({ ...prev, reason: e.target.value }))
                  }
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
                {otDraft.type === "manual" ? (
                  <input
                    type="number"
                    min="0"
                    placeholder="Amount"
                    value={otDraft.amount}
                    onChange={(e) =>
                      setOtDraft((prev) => ({
                        ...prev,
                        amount: e.target.value,
                      }))
                    }
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm col-span-2"
                  />
                ) : (
                  <>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      placeholder="Hours"
                      value={otDraft.hours}
                      onChange={(e) =>
                        setOtDraft((prev) => ({
                          ...prev,
                          hours: e.target.value,
                        }))
                      }
                      className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    />
                    <select
                      value={otDraft.rate}
                      onChange={(e) =>
                        setOtDraft((prev) => ({
                          ...prev,
                          rate: e.target.value,
                        }))
                      }
                      className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    >
                      <option value="1">1.0x</option>
                      <option value="1.5">1.5x</option>
                      <option value="2">2.0x</option>
                    </select>
                  </>
                )}
              </div>
              <button
                type="button"
                onClick={addOT}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg"
              >
                <Plus size={12} /> Add OT
              </button>
              <div className="space-y-1">
                {otDetails.map((entry, idx) => (
                  <div
                    key={`ot-${idx}`}
                    className="flex justify-between text-xs bg-white border rounded px-2 py-1"
                  >
                    <span>
                      {entry.type === "manual"
                        ? `PKR ${entry.amount}`
                        : `${entry.hours}h × ${entry.rate}x`}{" "}
                      — {entry.reason}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeOT(idx)}
                      className="text-red-600 hover:text-red-800"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          {type === "deduction" && !isHybrid && (
            <div className="border rounded-lg p-3 bg-gray-50 space-y-2">
              <p className="text-sm font-semibold text-gray-700">Deductions</p>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  min="0"
                  placeholder="Amount"
                  value={deductionDraft.amount}
                  onChange={(e) =>
                    setDeductionDraft((prev) => ({
                      ...prev,
                      amount: e.target.value,
                    }))
                  }
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
                <input
                  type="text"
                  placeholder="Reason"
                  value={deductionDraft.reason}
                  onChange={(e) =>
                    setDeductionDraft((prev) => ({
                      ...prev,
                      reason: e.target.value,
                    }))
                  }
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <button
                type="button"
                onClick={addDeduction}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg"
              >
                <Plus size={12} /> Add Deduction
              </button>
              <div className="space-y-1">
                {deductionDetails.map((entry, idx) => (
                  <div
                    key={`d-${idx}`}
                    className="flex justify-between text-xs bg-white border rounded px-2 py-1"
                  >
                    <span>
                      PKR {entry.amount} — {entry.reason}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeDeduction(idx)}
                      className="text-red-600 hover:text-red-800"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-2xl">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={() => persist()}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
          >
            <Save size={15} /> {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Attendance Form Modal ────────────────────────────────────────────────────
function AttendanceFormModal({
  onClose,
  mode = "add",
  record = null,
  onSuccess,
  currentUserRole,
}) {
  useEscape(onClose);
  const isEdit = mode === "edit";
  const parseTime = (val) => (val && val !== "--" ? val : "");
  const [selectedEmpLeftDate, setSelectedEmpLeftDate] = useState(null);

  const [form, setForm] = useState({
    empId: "",
    date: isEdit ? record?.dateFormatted || "" : getTodayDate(),
    status: isEdit ? record?.status || "Present" : "Present",
    inTime: isEdit ? parseTime(record?.inTime) : "",
    outTime: isEdit ? parseTime(record?.outTime) : "",
    outNextDay: isEdit ? record?.outNextDay || false : false,
    deductionDetails: isEdit ? record?.financials?.deductionDetails || [] : [],
    otDetails: isEdit ? record?.financials?.otDetails || [] : [],
  });
  const [deductionDraft, setDeductionDraft] = useState({
    amount: "",
    reason: "",
  });
  const [otDraft, setOtDraft] = useState({
    type: "calc",
    amount: "",
    hours: "",
    rate: "1.5",
    reason: "",
  });
  const [employees, setEmployees] = useState([]);
  const [loadingEmp, setLoadingEmp] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isEdit) {
      setLoadingEmp(true);
      axios
        .get("/api/employees?includeFrozen=true", { headers: authHeader() })
        .then((res) => {
          let list = res.data?.employees || [];
          if (currentUserRole === "admin")
            list = list.filter((emp) => !PRIVILEGED_ROLES.includes(emp.role));
          setEmployees(list);
        })
        .catch(() => toast.error("Failed to load employees"))
        .finally(() => setLoadingEmp(false));
    }
  }, [isEdit, currentUserRole]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    // When employee selection changes, update left date constraint
    if (name === "empId") {
      const emp = employees.find((e) => e._id === value);
      if (emp?.leftBusiness?.isLeft && emp?.leftBusiness?.leftDate) {
        const ld = new Date(emp.leftBusiness.leftDate);
        const dd = String(ld.getDate()).padStart(2, "0");
        const mm = String(ld.getMonth() + 1).padStart(2, "0");
        const yyyy = ld.getFullYear();
        setSelectedEmpLeftDate(`${dd}/${mm}/${yyyy}`);
      } else {
        setSelectedEmpLeftDate(null);
      }
    }

    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const addDeduction = () => {
    const amount = parseFloat(deductionDraft.amount);
    if (!amount || amount < 0)
      return toast.error("Enter a valid deduction amount");
    if (!deductionDraft.reason.trim())
      return toast.error("Deduction reason is required");
    setForm((prev) => ({
      ...prev,
      deductionDetails: [
        ...prev.deductionDetails,
        { amount, reason: deductionDraft.reason.trim() },
      ],
    }));
    setDeductionDraft({ amount: "", reason: "" });
  };

  const addOT = () => {
    if (!otDraft.reason.trim()) return toast.error("OT reason is required");
    if (otDraft.type === "manual") {
      const amount = parseFloat(otDraft.amount);
      if (!amount || amount < 0) return toast.error("Enter a valid OT amount");
      setForm((prev) => ({
        ...prev,
        otDetails: [
          ...prev.otDetails,
          { type: "manual", amount, reason: otDraft.reason.trim() },
        ],
      }));
    } else {
      const hours = parseFloat(otDraft.hours);
      const rate = parseFloat(otDraft.rate) || 1;
      if (!hours || hours <= 0) return toast.error("Enter valid OT hours");
      setForm((prev) => ({
        ...prev,
        otDetails: [
          ...prev.otDetails,
          { type: "calc", hours, rate, reason: otDraft.reason.trim() },
        ],
      }));
    }
    setOtDraft({
      type: "calc",
      amount: "",
      hours: "",
      rate: "1.5",
      reason: "",
    });
  };

  const removeDetail = async (key, index) => {
    const updated = form[key].filter((_, i) => i !== index);
    setForm((prev) => ({ ...prev, [key]: updated }));
    if (!isEdit) return;
    try {
      const resolvedEmpId = resolveEmpId(record?.empId);
      await axios.post(
        "/api/attendance/save-row",
        {
          empId: resolvedEmpId,
          date: form.date,
          status: form.status,
          inTime: form.inTime || null,
          outTime: form.outTime || null,
          outNextDay: form.outNextDay || false,
          deductionDetails:
            key === "deductionDetails" ? updated : form.deductionDetails,
          otDetails: key === "otDetails" ? updated : form.otDetails,
        },
        { headers: authHeader() },
      );
      toast.success("Removed and saved");
      onSuccess();
    } catch (err) {
      toast.error(
        err.response?.data?.message || "Failed to save after removal",
      );
    }
  };

  const handleSubmit = async () => {
    if (!isEdit && !form.empId) return toast.error("Please select an employee");
    if (!form.date) return toast.error("Please enter a date");
    if (!form.status) return toast.error("Please select a status");
    setSaving(true);
    try {
      let resolvedEmpId;
      if (isEdit) {
        const raw = record?.empId;
        if (!raw) {
          toast.error("Cannot resolve employee — please reload.");
          setSaving(false);
          return;
        }
        resolvedEmpId = resolveEmpId(raw);
      } else {
        resolvedEmpId = form.empId;
      }

      if (!isEdit && selectedEmpLeftDate) {
        const [fd, fm, fy] = form.date.split("/").map(Number);
        const [ld, lm, ly] = selectedEmpLeftDate.split("/").map(Number);
        if (new Date(fy, fm - 1, fd) > new Date(ly, lm - 1, ld)) {
          return toast.error(
            "Cannot add attendance after employee's last working date",
          );
        }
      }

      await axios.post(
        "/api/attendance/save-row",
        {
          empId: resolvedEmpId,
          date: form.date,
          status: form.status,
          inTime: form.inTime || null,
          outTime: form.outTime || null,
          outNextDay: form.outNextDay || false,
          otDetails: form.otDetails,
          ...(isEdit || form.deductionDetails.length > 0
            ? { deductionDetails: form.deductionDetails }
            : {}),
        },
        { headers: authHeader() },
      );
      toast.success(isEdit ? "Attendance updated" : "Attendance added");
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save attendance");
    } finally {
      setSaving(false);
    }
  };

  const showTimes = ["Present", "Late"].includes(form.status);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-bold text-gray-800">
            {isEdit ? "Edit Attendance Record" : "Add Attendance Record"}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X size={20} />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4 overflow-auto flex-1">
          {!isEdit && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Employee *
              </label>
              {loadingEmp ? (
                <p className="text-sm text-gray-400">Loading employees...</p>
              ) : (
                <select
                  name="empId"
                  value={form.empId}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Select Employee --</option>
                  {employees.map((emp) => (
                    <option key={emp._id} value={emp._id}>
                      {emp.employeeNumber} — {emp.firstName} {emp.lastName} (
                      {emp.department})
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}
          {isEdit && (
            <div className="bg-blue-50 rounded-lg px-4 py-3">
              <p className="text-sm font-semibold text-blue-800">
                {record?.empName}
              </p>
              <p className="text-xs text-blue-600">
                ID: {record?.empNumber} · {record?.department}
              </p>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date *
            </label>
            <DateNavigator
              value={form.date}
              onChange={(val) => setForm((prev) => ({ ...prev, date: val }))}
              maxDate={!isEdit ? selectedEmpLeftDate : null}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status *
            </label>
            <select
              name="status"
              value={form.status}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
            >
              <option value="Present">Present</option>
              <option value="Late">Late</option>
              <option value="Absent">Absent</option>
              <option value="Leave">Leave</option>
            </select>
          </div>
          {showTimes && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    In Time
                  </label>
                  <TimePicker
                    value={form.inTime}
                    onChange={(val) =>
                      setForm((prev) => ({ ...prev, inTime: val }))
                    }
                    placeholder="09:00"
                    disabled={saving}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Out Time
                  </label>
                  <TimePicker
                    value={form.outTime}
                    onChange={(val) =>
                      setForm((prev) => ({ ...prev, outTime: val }))
                    }
                    placeholder="17:00"
                    disabled={saving}
                    className="w-full"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  name="outNextDay"
                  checked={form.outNextDay}
                  onChange={handleChange}
                  className="w-4 h-4 rounded border-gray-300"
                />
                Out time is next calendar day (night shift)
              </label>
            </>
          )}
          {currentUserRole !== "hybrid" && (
            <div className="border rounded-lg p-3 bg-gray-50 space-y-2">
              <p className="text-sm font-semibold text-gray-700">Deductions</p>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  min="0"
                  placeholder="Amount"
                  value={deductionDraft.amount}
                  onChange={(e) =>
                    setDeductionDraft((prev) => ({
                      ...prev,
                      amount: e.target.value,
                    }))
                  }
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
                <input
                  type="text"
                  placeholder="Reason"
                  value={deductionDraft.reason}
                  onChange={(e) =>
                    setDeductionDraft((prev) => ({
                      ...prev,
                      reason: e.target.value,
                    }))
                  }
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <button
                type="button"
                onClick={addDeduction}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg"
              >
                <Plus size={12} /> Add Deduction
              </button>
              <div className="space-y-1">
                {form.deductionDetails.map((entry, idx) => (
                  <div
                    key={`d-${idx}`}
                    className="flex justify-between text-xs bg-white border rounded px-2 py-1"
                  >
                    <span>
                      PKR {entry.amount} — {entry.reason}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeDetail("deductionDetails", idx)}
                      className="text-red-600 hover:text-red-800"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          {currentUserRole !== "hybrid" && (
            <div className="border rounded-lg p-3 bg-gray-50 space-y-2">
              <p className="text-sm font-semibold text-gray-700">
                Overtime (OT)
              </p>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={otDraft.type}
                  onChange={(e) =>
                    setOtDraft((prev) => ({ ...prev, type: e.target.value }))
                  }
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="calc">Calculated</option>
                  <option value="manual">Manual Amount</option>
                </select>
                <input
                  type="text"
                  placeholder="Reason"
                  value={otDraft.reason}
                  onChange={(e) =>
                    setOtDraft((prev) => ({ ...prev, reason: e.target.value }))
                  }
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
                {otDraft.type === "manual" ? (
                  <input
                    type="number"
                    min="0"
                    placeholder="Amount"
                    value={otDraft.amount}
                    onChange={(e) =>
                      setOtDraft((prev) => ({
                        ...prev,
                        amount: e.target.value,
                      }))
                    }
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm col-span-2"
                  />
                ) : (
                  <>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      placeholder="Hours"
                      value={otDraft.hours}
                      onChange={(e) =>
                        setOtDraft((prev) => ({
                          ...prev,
                          hours: e.target.value,
                        }))
                      }
                      className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    />
                    <select
                      value={otDraft.rate}
                      onChange={(e) =>
                        setOtDraft((prev) => ({
                          ...prev,
                          rate: e.target.value,
                        }))
                      }
                      className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    >
                      <option value="1">1.0x</option>
                      <option value="1.5">1.5x</option>
                      <option value="2">2.0x</option>
                    </select>
                  </>
                )}
              </div>
              <button
                type="button"
                onClick={addOT}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg"
              >
                <Plus size={12} /> Add OT
              </button>
              <div className="space-y-1">
                {form.otDetails.map((entry, idx) => (
                  <div
                    key={`ot-${idx}`}
                    className="flex justify-between text-xs bg-white border rounded px-2 py-1"
                  >
                    <span>
                      {entry.type === "manual"
                        ? `PKR ${entry.amount}`
                        : `${entry.hours}h × ${entry.rate}x`}{" "}
                      — {entry.reason}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeDetail("otDetails", idx)}
                      className="text-red-600 hover:text-red-800"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-2xl">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
          >
            <Save size={15} />{" "}
            {saving ? "Saving..." : isEdit ? "Update" : "Add Record"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Delete Confirm Modal ─────────────────────────────────────────────────────
function DeleteConfirmModal({ record, onClose, onConfirm, deleting }) {
  useEscape(onClose);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-bold text-gray-800">Delete Record</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X size={20} />
          </button>
        </div>
        <div className="px-6 py-5">
          <p className="text-sm text-gray-700 mb-1">
            Are you sure you want to delete the attendance record for:
          </p>
          <p className="text-sm font-semibold text-gray-900">
            {record?.empName}
          </p>
          <p className="text-xs text-gray-500">
            {record?.dateFormatted} · {record?.department}
          </p>
          <p className="text-xs text-red-600 mt-3">
            This action cannot be undone.
          </p>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-2xl">
          <button
            onClick={onClose}
            disabled={deleting}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={deleting}
            className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
          >
            <Trash2 size={15} /> {deleting ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// ─── MARK TAB ─────────────────────────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════

function MarkTab({ userRole, isSuperAdmin, isAdmin, isHybrid }) {
  // Single date only — no range in Mark tab
  const [markDate, setMarkDate] = useState(getTodayDate());
  const [rows, setRows] = useState([]);
  const [origRows, setOrigRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState(null);
  const [savingAll, setSavingAll] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [otDedModal, setOtDedModal] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // ── Load worksheet ──────────────────────────────────────────────────────────
  const loadWorksheet = useCallback(
    async (date) => {
      setLoading(true);
      try {
        const [empRes, attRes] = await Promise.all([
          axios.get("/api/employees?includeFrozen=true", {
            headers: authHeader(),
          }),
          axios.get(`/api/attendance/range?fromDate=${date}&toDate=${date}`, {
            headers: authHeader(),
          }),
        ]);

        let employees = empRes.data?.employees || [];
        let saved = attRes.data?.attendance || [];

        if (userRole === "admin") {
          employees = employees.filter(
            (e) => !PRIVILEGED_ROLES.includes(e.role),
          );
          saved = saved.filter((r) => !PRIVILEGED_ROLES.includes(r.empRole));
        }

        const savedMap = {};
        for (const rec of saved) savedMap[resolveEmpId(rec.empId)] = rec;

        const worksheet = employees.map((emp) => {
          const key = emp._id?.toString?.() || String(emp._id);
          const ex = savedMap[key];
          if (ex) {
            return {
              ...ex,
              empId: key,
              shiftStart: emp.shift?.start || null,
              shiftEnd: emp.shift?.end || null,
              inTime: emptyTime(ex.inOut?.in),
              outTime: emptyTime(ex.inOut?.out),
              outNextDay: ex.inOut?.outNextDay || false,
              __isVirtual: false,
              __dirty: false,
              __saved: false,
            };
          }
          return {
            empId: key,
            empNumber: emp.employeeNumber,
            empName: `${emp.firstName} ${emp.lastName}`,
            department: emp.department,
            empRole: emp.role,
            shiftStart: emp.shift?.start || null,
            shiftEnd: emp.shift?.end || null,
            status: "Absent",
            inTime: "",
            outTime: "",
            outNextDay: false,
            financials: {
              finalDayEarning: 0,
              hoursWorked: 0,
              otAmount: 0,
              deduction: 0,
              otDetails: [],
              deductionDetails: [],
            },
            lastModified: null,
            __isVirtual: true,
            __dirty: false,
            __saved: false,
          };
        });

        setRows(worksheet);
        setOrigRows(JSON.parse(JSON.stringify(worksheet)));
      } catch {
        toast.error("Failed to load worksheet");
        setRows([]);
      } finally {
        setLoading(false);
      }
    },
    [userRole],
  );

  useEffect(() => {
    loadWorksheet(markDate);
  }, [markDate, loadWorksheet]);

  const handleChange = useCallback((empId, changes) => {
    setRows((prev) =>
      prev.map((r) =>
        r.empId === empId
          ? { ...r, ...changes, __dirty: true, __saved: false }
          : r,
      ),
    );
  }, []);

  const handleStatusChange = useCallback(
    (empId, val) => {
      const clearTimes = !["Present", "Late"].includes(val);
      handleChange(empId, {
        status: val,
        ...(clearTimes ? { inTime: "", outTime: "", outNextDay: false } : {}),
      });
    },
    [handleChange],
  );

  const handleDiscard = useCallback(
    (empId) => {
      const orig = origRows.find((r) => r.empId === empId);
      if (orig)
        setRows((prev) =>
          prev.map((r) =>
            r.empId === empId ? { ...orig, __dirty: false, __saved: false } : r,
          ),
        );
    },
    [origRows],
  );

  const handleSaveRow = useCallback(
    async (empId) => {
      const row = rows.find((r) => r.empId === empId);
      if (!row || !row.status)
        return toast.error(`${row?.empName || ""}: set a status first`);
      setSavingId(empId);
      try {
        await saveRowApi({
          empId: row.empId,
          date: row.dateFormatted || markDate,
          status: row.status,
          inTime: row.inTime,
          outTime: row.outTime,
          outNextDay: row.outNextDay,
        });
        toast.success(`${row.empName} saved`);
        loadWorksheet(markDate);
      } catch (err) {
        toast.error(
          err.response?.data?.message || `Failed to save ${row.empName}`,
        );
      } finally {
        setSavingId(null);
      }
    },
    [rows, markDate, loadWorksheet],
  );

  const handleSaveAll = async () => {
    const dirty = rows.filter((r) => r.__dirty);
    if (!dirty.length) {
      toast("Nothing to save");
      return;
    }
    const invalid = dirty.filter((r) => !r.status);
    if (invalid.length)
      return toast.error(`${invalid.length} rows missing status`);
    setSavingAll(true);
    let ok = 0,
      fail = 0;
    const BATCH = 50;
    for (let i = 0; i < dirty.length; i += BATCH) {
      await Promise.allSettled(
        dirty.slice(i, i + BATCH).map(async (row) => {
          try {
            await saveRowApi({
              empId: row.empId,
              date: row.dateFormatted || markDate,
              status: row.status,
              inTime: row.inTime,
              outTime: row.outTime,
              outNextDay: row.outNextDay,
            });
            setRows((prev) =>
              prev.map((r) =>
                r.empId === row.empId
                  ? {
                      ...r,
                      __dirty: false,
                      __saved: true,
                      __isVirtual: false,
                      lastModified: "just now",
                    }
                  : r,
              ),
            );
            ok++;
          } catch {
            fail++;
          }
        }),
      );
    }
    setSavingAll(false);
    fail === 0
      ? toast.success(`${ok} records saved`)
      : toast.error(`${ok} saved, ${fail} failed`);
    loadWorksheet(markDate);
  };

  const handleDelete = async () => {
    if (!deleteTarget?._id) return;
    setDeleting(true);
    try {
      await axios.delete(`/api/attendance/${deleteTarget._id}`, {
        headers: authHeader(),
      });
      toast.success("Record deleted");
      setDeleteTarget(null);
      loadWorksheet(markDate);
    } catch (err) {
      toast.error(err.response?.data?.message || "Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  const handleExport = () => {
    if (!rows.length) return toast.error("No data to export");
    const nonVirtual = rows.filter((r) => !r.__isVirtual);
    if (!nonVirtual.length) return toast.error("No saved records to export");
    const hdr = [
      "Date",
      "Emp #",
      "Name",
      "Department",
      "Status",
      "In",
      "Out",
      "Hours",
      "OT",
      "Deduction",
      "Earning",
      "Modified",
    ];
    const lines = nonVirtual.map((r) =>
      [
        `"${r.dateFormatted || markDate}"`,
        `"${r.empNumber || ""}"`,
        `"${(r.empName || "").replace(/"/g, '""')}"`,
        `"${r.department || ""}"`,
        `"${r.status || ""}"`,
        `"${r.inTime || ""}"`,
        `"${r.outTime || ""}"`,
        (r.financials?.hoursWorked || 0).toFixed(2),
        (r.financials?.otAmount || 0).toFixed(2),
        (r.financials?.deduction || 0).toFixed(2),
        (r.financials?.finalDayEarning || 0).toFixed(2),
        `"${r.lastModified || ""}"`,
      ].join(","),
    );
    const blob = new Blob([[hdr.join(","), ...lines].join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `attendance-mark-${markDate}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast.success("Exported");
  };

  const canEdit = (row) =>
    isSuperAdmin ||
    (userRole === "admin" && !PRIVILEGED_ROLES.includes(row.empRole));
  const dirtyCount = rows.filter((r) => r.__dirty).length;
  const savedCount = rows.filter((r) => !r.__isVirtual && !r.__dirty).length;
  const filt = filterRecords(rows, searchQuery);
  const colCount = 8 + (isHybrid ? 0 : 4) + (isAdmin ? 1 : 0);

  // ── Desktop row ─────────────────────────────────────────────────────────────
  const renderDesktopRow = (row) => {
    const editable = canEdit(row);
    const isSaving = savingId === row.empId;
    const showTimes = ["Present", "Late"].includes(row.status);
    const inPh = row.shiftStart || "09:00";
    const outPh = row.shiftEnd || "17:00";
    const rowBg = row.__dirty
      ? "bg-amber-50"
      : row.__saved
        ? "bg-green-50"
        : row.__isVirtual
          ? "bg-gray-50/50"
          : "bg-white";

    return (
      <tr
        key={row.empId}
        className={`border-b transition-colors ${rowBg} hover:bg-blue-50/20`}
      >
        <td className="pl-3 pr-1 py-2 w-6">
          <StatusDot
            isDirty={row.__dirty}
            isSaved={row.__saved}
            isSaving={isSaving}
            isVirtual={row.__isVirtual}
          />
        </td>
        <td className="px-3 py-2 text-xs font-mono text-gray-600 whitespace-nowrap">
          {row.empNumber}
        </td>
        <td className="px-3 py-2 text-sm font-medium text-gray-900 whitespace-nowrap">
          {row.empName}
        </td>
        <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">
          {row.department}
        </td>
        <td className="px-2 py-2">
          <StatusSelect
            value={row.status}
            readOnly={!editable}
            disabled={isSaving}
            onChange={(v) => handleStatusChange(row.empId, v)}
          />
        </td>
        <td className="px-2 py-2">
          {showTimes ? (
            <TimeInput
              value={row.inTime}
              placeholder={inPh}
              disabled={isSaving}
              readOnly={!editable}
              onChange={(v) => handleChange(row.empId, { inTime: v })}
            />
          ) : (
            <span className="text-xs text-gray-300">—</span>
          )}
        </td>
        <td className="px-2 py-2">
          {showTimes ? (
            editable ? (
              <div className="flex items-center gap-1">
                <TimeInput
                  value={row.outTime}
                  placeholder={outPh}
                  disabled={isSaving}
                  readOnly={false}
                  onChange={(v) => handleChange(row.empId, { outTime: v })}
                />
                <label
                  className="flex items-center gap-0.5 cursor-pointer select-none"
                  title="Out next day"
                >
                  <input
                    type="checkbox"
                    checked={row.outNextDay || false}
                    disabled={isSaving}
                    onChange={(e) =>
                      handleChange(row.empId, { outNextDay: e.target.checked })
                    }
                    className="w-3.5 h-3.5 rounded border-gray-300"
                  />
                  <span className="text-xs text-gray-400">+1</span>
                </label>
              </div>
            ) : (
              <span className="text-xs text-gray-500">
                {safeTime(row.outTime)}
                {row.outNextDay && row.outTime && (
                  <span className="ml-1 text-orange-500">(+1)</span>
                )}
              </span>
            )
          ) : (
            <span className="text-xs text-gray-300">—</span>
          )}
        </td>
        {!isHybrid && (
          <td className="px-3 py-2 text-right text-xs text-gray-600 whitespace-nowrap">
            {row.__isVirtual && !row.__dirty
              ? "—"
              : (row.financials?.hoursWorked || 0).toFixed(2)}
          </td>
        )}
        {!isHybrid && (
          <td className="px-3 py-2 text-right text-xs whitespace-nowrap">
            {row.__isVirtual && !row.__saved ? (
              <span className="text-gray-300">—</span>
            ) : (
              <div className="flex items-center justify-end gap-1">
                <span className="text-blue-700">
                  {(row.financials?.otAmount || 0).toFixed(2)}
                </span>
                {editable && isAdmin && (
                  <button
                    onClick={() =>
                      setOtDedModal({
                        record: { ...row, dateFormatted: markDate },
                        type: "ot",
                      })
                    }
                    title="Edit OT"
                    className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-xs text-indigo-600 bg-indigo-50 border border-indigo-200 rounded hover:bg-indigo-100 transition"
                  >
                    <Pencil size={10} />
                  </button>
                )}
              </div>
            )}
          </td>
        )}
        {!isHybrid && (
          <td className="px-3 py-2 text-right text-xs whitespace-nowrap">
            {row.__isVirtual && !row.__saved ? (
              <span className="text-gray-300">—</span>
            ) : (
              <div className="flex items-center justify-end gap-1">
                <span className="text-red-700">
                  {(row.financials?.deduction || 0).toFixed(2)}
                </span>
                {editable && isAdmin && (
                  <button
                    onClick={() =>
                      setOtDedModal({
                        record: { ...row, dateFormatted: markDate },
                        type: "deduction",
                      })
                    }
                    title="Edit Deductions"
                    className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-xs text-indigo-600 bg-indigo-50 border border-indigo-200 rounded hover:bg-indigo-100 transition"
                  >
                    <Pencil size={10} />
                  </button>
                )}
              </div>
            )}
          </td>
        )}
        {!isHybrid && (
          <td className="px-3 py-2 text-right text-xs font-semibold text-gray-700 whitespace-nowrap">
            {row.__isVirtual && !row.__dirty ? (
              <span className="text-gray-300">—</span>
            ) : (
              pkr(row.financials?.finalDayEarning)
            )}
          </td>
        )}
        <td className="px-3 py-2 text-xs text-gray-400 whitespace-nowrap">
          {row.__isVirtual && !row.__saved ? "—" : row.lastModified || "—"}
        </td>
        {isAdmin && (
          <td className="px-2 py-2">
            {editable && (
              <div className="flex items-center justify-center gap-1 flex-nowrap">
                <button
                  onClick={() => handleSaveRow(row.empId)}
                  disabled={isSaving || !row.__dirty}
                  title={row.__dirty ? "Save row" : "No changes"}
                  className={`inline-flex items-center gap-1 px-2 py-1.5 text-xs font-medium rounded-lg transition ${
                    row.__dirty
                      ? "text-white bg-blue-600 hover:bg-blue-700 border border-blue-600"
                      : "text-gray-300 bg-gray-50 border border-gray-200 cursor-not-allowed"
                  } disabled:opacity-50`}
                >
                  {isSaving ? (
                    <Loader2 size={11} className="animate-spin" />
                  ) : (
                    <Save size={11} />
                  )}{" "}
                  Save
                </button>
                {row.__dirty && (
                  <button
                    onClick={() => handleDiscard(row.empId)}
                    title="Discard changes"
                    className="p-1.5 text-gray-400 hover:text-gray-600 bg-gray-50 border border-gray-200 rounded-lg transition"
                  >
                    <RotateCcw size={11} />
                  </button>
                )}
                {!row.__isVirtual && (
                  <button
                    onClick={() =>
                      setDeleteTarget({ ...row, dateFormatted: markDate })
                    }
                    title="Delete record"
                    className="p-1.5 text-red-500 hover:text-red-700 bg-red-50 border border-red-200 rounded-lg transition"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            )}
          </td>
        )}
      </tr>
    );
  };

  // ── Mobile card ─────────────────────────────────────────────────────────────
  const renderMobileCard = (row) => {
    const editable = canEdit(row);
    const isSaving = savingId === row.empId;
    const showTimes = ["Present", "Late"].includes(row.status);
    const inPh = row.shiftStart || "09:00";
    const outPh = row.shiftEnd || "17:00";

    return (
      <div
        key={row.empId}
        className={`border rounded-xl p-3 transition-colors ${
          row.__dirty
            ? "border-amber-300 bg-amber-50"
            : row.__saved
              ? "border-green-300 bg-green-50"
              : row.__isVirtual
                ? "border-gray-200 bg-gray-50"
                : "border-gray-200 bg-white"
        }`}
      >
        <div className="flex justify-between items-start mb-2">
          <div>
            <p className="font-semibold text-gray-900 text-sm">{row.empName}</p>
            <p className="text-xs text-gray-500">
              #{row.empNumber} · {row.department}
            </p>
            {row.shiftStart && (
              <p className="text-xs text-gray-400">
                Shift {row.shiftStart}–{row.shiftEnd}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {isAdmin && editable && !row.__isVirtual && (
              <button
                onClick={() =>
                  setDeleteTarget({ ...row, dateFormatted: markDate })
                }
                className="p-1 text-red-400 hover:text-red-600 rounded"
              >
                <Trash2 size={13} />
              </button>
            )}
            <StatusDot
              isDirty={row.__dirty}
              isSaved={row.__saved}
              isSaving={isSaving}
              isVirtual={row.__isVirtual}
            />
          </div>
        </div>
        {editable ? (
          <div className="space-y-2">
            <StatusSelect
              value={row.status}
              readOnly={false}
              disabled={isSaving}
              onChange={(v) => handleStatusChange(row.empId, v)}
            />
            {showTimes && (
              <div className="flex gap-2 items-center">
                <input
                  type="text"
                  value={row.inTime || ""}
                  placeholder={inPh}
                  disabled={isSaving}
                  onChange={(e) =>
                    handleChange(row.empId, { inTime: e.target.value })
                  }
                  className="flex-1 border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-blue-400 placeholder:text-gray-300"
                />
                <input
                  type="text"
                  value={row.outTime || ""}
                  placeholder={outPh}
                  disabled={isSaving}
                  onChange={(e) =>
                    handleChange(row.empId, { outTime: e.target.value })
                  }
                  className="flex-1 border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-blue-400 placeholder:text-gray-300"
                />
                <label className="flex items-center gap-0.5 text-xs text-gray-500 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={row.outNextDay || false}
                    disabled={isSaving}
                    onChange={(e) =>
                      handleChange(row.empId, { outNextDay: e.target.checked })
                    }
                    className="w-3.5 h-3.5"
                  />{" "}
                  +1
                </label>
              </div>
            )}
            {!isHybrid && !row.__isVirtual && (
              <div className="flex items-center justify-between text-xs text-gray-500 bg-white border rounded-lg px-2 py-1.5">
                <span>
                  {(row.financials?.hoursWorked || 0).toFixed(2)}h ·{" "}
                  <strong>{pkr(row.financials?.finalDayEarning)}</strong>
                </span>
                {isAdmin && editable && (
                  <div className="flex gap-1">
                    <button
                      onClick={() =>
                        setOtDedModal({
                          record: { ...row, dateFormatted: markDate },
                          type: "ot",
                        })
                      }
                      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-xs text-blue-600 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100"
                    >
                      <Pencil size={9} /> OT
                    </button>
                    <button
                      onClick={() =>
                        setOtDedModal({
                          record: { ...row, dateFormatted: markDate },
                          type: "deduction",
                        })
                      }
                      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-xs text-red-600 bg-red-50 border border-red-200 rounded hover:bg-red-100"
                    >
                      <Pencil size={9} /> Ded
                    </button>
                  </div>
                )}
              </div>
            )}
            {isAdmin && (
              <div className="flex gap-2">
                <button
                  onClick={() => handleSaveRow(row.empId)}
                  disabled={isSaving || !row.__dirty}
                  className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-medium ${row.__dirty ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-400 cursor-not-allowed"} disabled:opacity-50`}
                >
                  {isSaving ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Save size={12} />
                  )}{" "}
                  Save
                </button>
                {row.__dirty && (
                  <button
                    onClick={() => handleDiscard(row.empId)}
                    className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs border border-gray-200"
                  >
                    <RotateCcw size={12} />
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="mt-1 space-y-0.5">
            <span
              className={`inline-block px-2 py-0.5 rounded-full font-semibold border text-xs ${STATUS_STYLES[row.status] || STATUS_STYLES[""]}`}
            >
              {row.status || "—"}
            </span>
            {row.inTime && (
              <p className="text-xs text-gray-500">
                In: {row.inTime} · Out: {safeTime(row.outTime)}
                {row.outNextDay && row.outTime && (
                  <span className="ml-1 text-orange-500">(+1)</span>
                )}
              </p>
            )}
            {!isHybrid && (
              <p className="text-xs text-gray-500">
                Earning: {pkr(row.financials?.finalDayEarning)}
              </p>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      <div className="flex gap-2 flex-wrap mb-4">
        {isAdmin && (
          <>
            <button
              onClick={() => setShowAddModal(true)}
              disabled={loading}
              className="flex items-center gap-2 px-3 md:px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:opacity-50 text-sm"
            >
              <Plus size={18} />
              <span className="hidden sm:inline">Add Record</span>
            </button>
            <button
              onClick={() => setShowImport(true)}
              disabled={loading}
              className="flex items-center gap-2 px-3 md:px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50 text-sm"
            >
              <Download size={18} />
              <span className="hidden sm:inline">Import CSV</span>
            </button>
          </>
        )}
        <button
          onClick={handleExport}
          disabled={loading || !rows.some((r) => !r.__isVirtual)}
          className="flex items-center gap-2 px-3 md:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 text-sm"
        >
          <Upload size={18} />
          <span className="hidden sm:inline">Export</span>
        </button>
        <button
          onClick={() => loadWorksheet(markDate)}
          disabled={loading || savingAll}
          className="flex items-center gap-2 px-3 md:px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition disabled:opacity-50 text-sm"
        >
          <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Date navigator — single date */}
      <div className="bg-white rounded-lg shadow p-4 mb-4">
        <div className="flex flex-wrap items-end gap-4">
          <DateNavigator
            value={markDate}
            onChange={setMarkDate}
            label="Date (dd/mm/yyyy)"
            showTodayBadge
          />
          <div className="flex items-center gap-3 text-xs pb-1">
            <span className="text-gray-500">{rows.length} employees</span>
            <span className="text-green-600 font-medium">
              {savedCount} saved
            </span>
            {dirtyCount > 0 && (
              <span className="text-amber-600 font-medium">
                {dirtyCount} unsaved
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex-1 min-w-[200px] max-w-sm">
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search name, ID, dept, status…"
          />
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <div className="hidden lg:flex items-center gap-3 text-xs text-gray-400 mr-1">
            <span className="flex items-center gap-1">
              <Circle size={10} className="text-amber-400 fill-amber-400" />{" "}
              Unsaved
            </span>
            <span className="flex items-center gap-1">
              <CheckCircle2 size={10} className="text-green-500" /> Saved
            </span>
          </div>
          {isAdmin && (
            <button
              onClick={handleSaveAll}
              disabled={savingAll || loading || dirtyCount === 0}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 text-sm font-medium"
            >
              {savingAll ? (
                <>
                  <Loader2 size={15} className="animate-spin" /> Saving…
                </>
              ) : (
                <>
                  <Save size={15} /> Save All
                  {dirtyCount > 0 ? ` (${dirtyCount})` : ""}
                </>
              )}
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4" />
            <p className="text-gray-600 font-medium">Loading employees…</p>
          </div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center text-gray-600">
            <AlertCircle className="mx-auto mb-4 text-gray-400" size={48} />
            <p>No active employees found</p>
          </div>
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100 border-b">
                  <tr>
                    <th className="pl-3 pr-1 py-3 w-6" />
                    {[
                      "Emp #",
                      "Name",
                      "Department",
                      "Status",
                      "In Time",
                      "Out Time",
                    ].map((h) => (
                      <th
                        key={h}
                        className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ))}
                    {!isHybrid &&
                      ["Hours", "OT", "Deduction", "Earning"].map((h) => (
                        <th
                          key={h}
                          className="px-3 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap"
                        >
                          {h}
                        </th>
                      ))}
                    <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                      Modified
                    </th>
                    {isAdmin && (
                      <th className="px-2 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        Actions
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {filt.length === 0 ? (
                    <tr>
                      <td
                        colSpan={colCount}
                        className="px-4 py-10 text-center text-gray-400 text-sm"
                      >
                        No employees match your search
                      </td>
                    </tr>
                  ) : (
                    filt.map(renderDesktopRow)
                  )}
                </tbody>
              </table>
            </div>
            <div className="md:hidden space-y-2 p-3">
              {filt.length === 0 ? (
                <p className="text-center text-sm text-gray-400 py-6">
                  No employees match your search
                </p>
              ) : (
                filt.map(renderMobileCard)
              )}
            </div>
          </>
        )}
      </div>

      {showAddModal && (
        <AttendanceFormModal
          mode="add"
          currentUserRole={userRole}
          onClose={() => setShowAddModal(false)}
          onSuccess={() => loadWorksheet(markDate)}
        />
      )}
      {showImport && (
        <CSVImportModal
          onClose={() => setShowImport(false)}
          onSuccess={() => {
            setTimeout(() => loadWorksheet(markDate), 1500);
          }}
        />
      )}
      {otDedModal && (
        <OTDeductionEditModal
          record={otDedModal.record}
          type={otDedModal.type}
          currentUserRole={userRole}
          onClose={() => setOtDedModal(null)}
          onSuccess={() => loadWorksheet(markDate)}
        />
      )}
      {deleteTarget && (
        <DeleteConfirmModal
          record={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
          deleting={deleting}
        />
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// ─── MANAGE TAB ───────────────────────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════

function ManageTab({ userRole, isSuperAdmin, isAdmin, isHybrid }) {
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fromDate, setFromDate] = useState(getDateMinusDays(30));
  const [toDate, setToDate] = useState(getTodayDate());
  const [rangeEnabled, setRangeEnabled] = useState(true);
  const [showImportModal, setShowImportModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editRecord, setEditRecord] = useState(null);
  const [detailsModal, setDetailsModal] = useState(null);
  const [deleteRecord, setDeleteRecord] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchAttendance = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        toast.error("Authentication required");
        return;
      }
      // When range is disabled, use fromDate as both start and end
      const effectiveToDate = rangeEnabled ? toDate : fromDate;
      const response = await axios.get(
        `/api/attendance/range?fromDate=${fromDate}&toDate=${effectiveToDate}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      let records = response.data?.attendance || [];
      if (userRole === "admin")
        records = records.filter((r) => !PRIVILEGED_ROLES.includes(r.empRole));
      setAttendance(records);
    } catch (error) {
      if (error.response?.status === 401)
        toast.error("Unauthorized. Please login again.");
      else if (error.response?.status === 403)
        toast.error("You do not have permission.");
      else toast.error("Failed to load attendance data");
      setAttendance([]);
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, rangeEnabled, userRole]);

  useEffect(() => {
    fetchAttendance();
  }, [fetchAttendance]);

  const handleDateRangeChange = () => {
    const from = parseDate(fromDate);
    const effectiveTo = rangeEnabled ? parseDate(toDate) : from;
    if (!from || !effectiveTo) {
      toast.error("Invalid date format. Use dd/mm/yyyy");
      return;
    }
    if (from > effectiveTo) {
      toast.error("From date cannot be after to date");
      return;
    }
    fetchAttendance();
  };

  const canEditRecord = (record) => {
    if (isSuperAdmin) return true;
    if (userRole === "admin") return !PRIVILEGED_ROLES.includes(record.empRole);
    return false;
  };

  const handleDeleteConfirm = async () => {
    if (!deleteRecord?._id) return;
    setDeleting(true);
    try {
      const token = localStorage.getItem("token");
      await axios.delete(`/api/attendance/${deleteRecord._id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success("Record deleted successfully");
      setDeleteRecord(null);
      fetchAttendance();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to delete record");
    } finally {
      setDeleting(false);
    }
  };

  const handleExport = () => {
    if (!attendance.length) {
      toast.error("No attendance data to export");
      return;
    }
    const effectiveToDate = rangeEnabled ? toDate : fromDate;
    const csv = [
      [
        "Date",
        "Employee ID",
        "Name",
        "Department",
        "Status",
        "In Time",
        "Out Time",
        "Hours Worked",
        "OT Amount",
        "Total Deduction",
        "Daily Earning",
        "Last Modified",
      ].join(","),
    ];
    attendance.forEach((record) => {
      csv.push(
        [
          `"${record.dateFormatted || "--"}"`,
          `"${record.empNumber || "--"}"`,
          `"${(record.empName || "--").replace(/"/g, '""')}"`,
          `"${record.department || "--"}"`,
          `"${record.status || "--"}"`,
          `"${record.inTime ?? "--"}"`,
          `"${record.outTime ?? "--"}"`,
          `"${record.financials?.hoursWorked?.toFixed(2) || "0.00"}"`,
          `"${record.financials?.otAmount?.toFixed(2) || "0.00"}"`,
          `"${record.financials?.deduction?.toFixed(2) || "0.00"}"`,
          `"${record.financials?.finalDayEarning?.toFixed(2) || "0.00"}"`,
          `"${record.lastModified || "--"}"`,
        ].join(","),
      );
    });
    const blob = new Blob([csv.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendance-${fromDate}-to-${effectiveToDate}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success("Attendance exported");
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "Present":
        return "bg-green-100 text-green-800";
      case "Late":
        return "bg-yellow-100 text-yellow-800";
      case "Leave":
        return "bg-blue-100 text-blue-800";
      case "Absent":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const filtered = filterRecords(attendance, searchQuery);

  return (
    <div>
      <div className="flex gap-2 flex-wrap mb-6">
        {isAdmin && (
          <>
            <button
              onClick={() => setShowAddModal(true)}
              disabled={loading}
              className="flex items-center gap-2 px-3 md:px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:opacity-50 text-sm"
            >
              <Plus size={18} />
              <span className="hidden sm:inline">Add Record</span>
            </button>
            <button
              onClick={() => setShowImportModal(true)}
              disabled={loading || refreshing}
              className="flex items-center gap-2 px-3 md:px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50 text-sm"
            >
              <Download size={18} />
              <span className="hidden sm:inline">Import CSV</span>
            </button>
          </>
        )}
        <button
          onClick={handleExport}
          disabled={loading || !attendance.length}
          className="flex items-center gap-2 px-3 md:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 text-sm"
        >
          <Upload size={18} />
          <span className="hidden sm:inline">Export</span>
        </button>
        <button
          onClick={() => {
            setRefreshing(true);
            fetchAttendance().finally(() => setRefreshing(false));
          }}
          disabled={loading || refreshing}
          className="flex items-center gap-2 px-3 md:px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition disabled:opacity-50 text-sm"
        >
          <RefreshCw size={18} className={refreshing ? "animate-spin" : ""} />
        </button>
      </div>

      <div className="bg-white rounded-lg shadow p-4 md:p-6 mb-6">
        <div className="flex flex-wrap items-end gap-4">
          <DateRangePicker
            fromDate={fromDate}
            setFromDate={setFromDate}
            toDate={toDate}
            setToDate={setToDate}
            rangeEnabled={rangeEnabled}
            setRangeEnabled={setRangeEnabled}
            label1="From Date (dd/mm/yyyy)"
            label2="To Date (dd/mm/yyyy)"
          />
          <button
            onClick={handleDateRangeChange}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 text-sm font-medium"
          >
            {loading ? "Loading..." : "Apply"}
          </button>
          <div className="text-xs text-gray-600 p-2 bg-gray-50 rounded">
            Total: {attendance.length}
            {searchQuery && ` · Showing: ${filtered.length}`}
          </div>
        </div>
      </div>

      <div className="mb-4">
        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search by name, employee ID, department, status, or date..."
        />
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading && !attendance.length ? (
          <div className="p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4" />
            <p className="text-gray-600 font-medium">
              Loading attendance data...
            </p>
          </div>
        ) : attendance.length === 0 ? (
          <div className="p-12 text-center text-gray-600">
            <AlertCircle className="mx-auto mb-4 text-gray-400" size={48} />
            <p>No attendance records found for selected date range</p>
          </div>
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Date</th>
                    <th className="px-4 py-3 text-left font-semibold">Emp #</th>
                    <th className="px-4 py-3 text-left font-semibold">Name</th>
                    <th className="px-4 py-3 text-left font-semibold">
                      Department
                    </th>
                    <th className="px-4 py-3 text-left font-semibold">
                      Status
                    </th>
                    <th className="px-4 py-3 text-center font-semibold">In</th>
                    <th className="px-4 py-3 text-center font-semibold">Out</th>
                    {!isHybrid && (
                      <th className="px-4 py-3 text-right font-semibold">
                        Hours
                      </th>
                    )}
                    {!isHybrid && (
                      <th className="px-4 py-3 text-right font-semibold">OT</th>
                    )}
                    {!isHybrid && (
                      <th className="px-4 py-3 text-right font-semibold">
                        Deduction
                      </th>
                    )}
                    {!isHybrid && (
                      <th className="px-4 py-3 text-right font-semibold">
                        Earning
                      </th>
                    )}
                    <th className="px-4 py-3 text-left font-semibold">
                      Modified
                    </th>
                    {isAdmin && (
                      <th className="px-4 py-3 text-center font-semibold">
                        Actions
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.length === 0 ? (
                    <tr>
                      <td
                        colSpan={13}
                        className="px-4 py-8 text-center text-gray-500 text-sm"
                      >
                        No records match your search
                      </td>
                    </tr>
                  ) : (
                    filtered.map((record, idx) => {
                      const editable = canEditRecord(record);
                      return (
                        <tr
                          key={record._id || idx}
                          className="hover:bg-gray-50"
                        >
                          <td className="px-4 py-3">{record.dateFormatted}</td>
                          <td className="px-4 py-3 font-mono text-xs">
                            {record.empNumber}
                          </td>
                          <td className="px-4 py-3">{record.empName}</td>
                          <td className="px-4 py-3">{record.department}</td>
                          <td className="px-4 py-3">
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(record.status)}`}
                            >
                              {record.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            {displayTime(record.inTime)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {displayTime(record.outTime)}
                            {record.outNextDay && record.outTime && (
                              <span className="ml-1 text-xs text-orange-500 font-medium">
                                (+1)
                              </span>
                            )}
                          </td>
                          {!isHybrid && (
                            <td className="px-4 py-3 text-right">
                              {(record.financials?.hoursWorked || 0).toFixed(2)}
                            </td>
                          )}
                          {!isHybrid && (
                            <td className="px-4 py-3 text-right">
                              <button
                                onClick={() =>
                                  setDetailsModal({ type: "ot", record })
                                }
                                className="inline-flex items-center gap-1 text-blue-700 hover:text-blue-900"
                              >
                                PKR{" "}
                                {(record.financials?.otAmount || 0).toFixed(2)}{" "}
                                <Eye size={12} />
                              </button>
                            </td>
                          )}
                          {!isHybrid && (
                            <td className="px-4 py-3 text-right">
                              <button
                                onClick={() =>
                                  setDetailsModal({ type: "deduction", record })
                                }
                                className="inline-flex items-center gap-1 text-red-700 hover:text-red-900"
                              >
                                PKR{" "}
                                {(record.financials?.deduction || 0).toFixed(2)}{" "}
                                <Eye size={12} />
                              </button>
                            </td>
                          )}
                          {!isHybrid && (
                            <td className="px-4 py-3 text-right font-semibold">
                              PKR{" "}
                              {(
                                record.financials?.finalDayEarning || 0
                              ).toFixed(2)}
                            </td>
                          )}
                          <td className="px-4 py-3 text-xs text-gray-600">
                            {record.lastModified || "--"}
                          </td>
                          {isAdmin && (
                            <td className="px-4 py-3 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  onClick={() =>
                                    editable && setEditRecord(record)
                                  }
                                  disabled={!editable}
                                  className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg transition ${editable ? "text-indigo-700 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100" : "text-gray-400 bg-gray-50 border border-gray-200 opacity-50 cursor-not-allowed"}`}
                                >
                                  <Pencil size={13} /> Edit
                                </button>
                                <button
                                  onClick={() =>
                                    editable && setDeleteRecord(record)
                                  }
                                  disabled={!editable}
                                  className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg transition ${editable ? "text-red-700 bg-red-50 border border-red-200 hover:bg-red-100" : "text-gray-400 bg-gray-50 border border-gray-200 opacity-50 cursor-not-allowed"}`}
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="md:hidden space-y-3 p-4">
              {filtered.length === 0 ? (
                <p className="text-center text-sm text-gray-500 py-6">
                  No records match your search
                </p>
              ) : (
                filtered.map((record, idx) => {
                  const editable = canEditRecord(record);
                  return (
                    <div
                      key={record._id || idx}
                      className="border rounded-lg p-4 bg-gray-50"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-semibold text-gray-900">
                            {record.empName}
                          </p>
                          <p className="text-xs text-gray-600">
                            #{record.empNumber}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-1 rounded text-xs font-semibold ${getStatusColor(record.status)}`}
                          >
                            {record.status}
                          </span>
                          {isAdmin && (
                            <>
                              <button
                                onClick={() =>
                                  editable && setEditRecord(record)
                                }
                                disabled={!editable}
                                className={`p-1.5 rounded-lg border ${editable ? "text-indigo-600 bg-indigo-50 border-indigo-200" : "text-gray-300 bg-gray-50 border-gray-200 opacity-50 cursor-not-allowed"}`}
                              >
                                <Pencil size={13} />
                              </button>
                              <button
                                onClick={() =>
                                  editable && setDeleteRecord(record)
                                }
                                disabled={!editable}
                                className={`p-1.5 rounded-lg border ${editable ? "text-red-600 bg-red-50 border-red-200" : "text-gray-300 bg-gray-50 border-gray-200 opacity-50 cursor-not-allowed"}`}
                              >
                                <Trash2 size={13} />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="space-y-1 text-sm">
                        <p>
                          <span className="font-medium">Date:</span>{" "}
                          {record.dateFormatted}
                        </p>
                        <p>
                          <span className="font-medium">Dept:</span>{" "}
                          {record.department}
                        </p>
                        <p>
                          <span className="font-medium">In/Out:</span>{" "}
                          {displayTime(record.inTime)} —{" "}
                          {displayTime(record.outTime)}
                          {record.outNextDay && record.outTime && (
                            <span className="ml-1 text-xs text-orange-500">
                              (+1 day)
                            </span>
                          )}
                        </p>
                        {!isHybrid && (
                          <p>
                            <span className="font-medium">Earning:</span> PKR{" "}
                            {(record.financials?.finalDayEarning || 0).toFixed(
                              2,
                            )}
                          </p>
                        )}
                        <p className="text-xs text-gray-500">
                          <span className="font-medium">Modified:</span>{" "}
                          {record.lastModified || "--"}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}
      </div>

      {showImportModal && (
        <CSVImportModal
          onClose={() => setShowImportModal(false)}
          onSuccess={() => {
            setRefreshing(true);
            setTimeout(() => {
              fetchAttendance();
              setRefreshing(false);
            }, 1500);
          }}
        />
      )}
      {showAddModal && (
        <AttendanceFormModal
          mode="add"
          currentUserRole={userRole}
          onClose={() => setShowAddModal(false)}
          onSuccess={fetchAttendance}
        />
      )}
      {editRecord && (
        <AttendanceFormModal
          mode="edit"
          record={editRecord}
          currentUserRole={userRole}
          onClose={() => setEditRecord(null)}
          onSuccess={fetchAttendance}
        />
      )}
      {deleteRecord && (
        <DeleteConfirmModal
          record={deleteRecord}
          onClose={() => setDeleteRecord(null)}
          onConfirm={handleDeleteConfirm}
          deleting={deleting}
        />
      )}

      {detailsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-3 border-b">
              <h3 className="font-semibold text-gray-800">
                {detailsModal.type === "ot"
                  ? "OT Details"
                  : "Deduction Details"}{" "}
                — {detailsModal.record.empName}
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
                    ? detailsModal.record.financials?.otDetails
                    : detailsModal.record.financials?.deductionDetails;
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
                          : `Hours: ${entry.hours} × ${entry.rate}x`}{" "}
                        · {entry.reason}
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

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function ManualAttendance() {
  const [activeTab, setActiveTab] = useState("manage");
  const userRole = getCurrentUserRole();
  const isSuperAdmin = userRole === "superadmin"  || userRole === "owner";
  const isAdmin = userRole === "admin" || isSuperAdmin;
  const isOwner = userRole === "owner";
  const isHybrid = userRole === "hybrid";
  
  const tabProps = { userRole, isSuperAdmin, isAdmin, isHybrid };

  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800">
          Manual Attendance
        </h1>
      </div>
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab("manage")}
          className={`px-5 py-2 rounded-md text-sm font-medium transition ${activeTab === "manage" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-800"}`}
        >
          Manage
        </button>
        <button
          onClick={() => setActiveTab("mark")}
          className={`px-5 py-2 rounded-md text-sm font-medium transition ${activeTab === "mark" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-800"}`}
        >
          Mark
        </button>
      </div>
      {activeTab === "manage" ? (
        <ManageTab {...tabProps} />
      ) : (
        <MarkTab {...tabProps} />
      )}
    </div>
  );
}
