import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import {
  Plus, Download, Upload, AlertCircle, RefreshCw, X, Save, Pencil, Calendar, Eye
} from 'lucide-react';
import toast from 'react-hot-toast';
import CSVImportModal from './CSVImportModal.jsx';
import { getDateMinusDays, getTodayDate, parseDate } from '../../utils/dateFormatter.js';

const PRIVILEGED_ROLES = ['admin', 'superadmin'];

function getCurrentUserRole() {
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return user.role || localStorage.getItem('role') || '';
  } catch {
    return localStorage.getItem('role') || '';
  }
}

// FIX 1 — null-safe time display helper.
// Backend returns null for missing times (not '--'). Guard both so this works
// before and after the backend deploy.
const displayTime = (val) => (val && val !== '--') ? val : '--';

// ─── Attendance Form Modal (Add & Edit) ──────────────────────────────────────
function AttendanceFormModal({ mode = 'add', record = null, onClose, onSuccess, currentUserRole }) {
  const isEdit        = mode === 'edit';
  const hiddenDateRef = useRef(null);

  // FIX 2 — inTime/outTime pre-fill in edit mode.
  // Old code: record?.inTime !== '--' ? record?.inTime : ''
  // When backend returns null the condition is truthy, so null gets passed to the
  // input value and the field renders the text "null". Fix: treat both null and '--'.
  const parseTime = (val) => (val && val !== '--') ? val : '';

  const [form, setForm] = useState({
    empId:            '',   // only used in Add mode; Edit resolves empId in handleSubmit
    date:             isEdit ? (record?.dateFormatted || '') : getTodayDate(),
    status:           isEdit ? (record?.status || 'Present') : 'Present',
    inTime:           isEdit ? parseTime(record?.inTime)  : '',
    outTime:          isEdit ? parseTime(record?.outTime) : '',
    outNextDay:       isEdit ? (record?.outNextDay || false) : false,
    deductionDetails: isEdit ? (record?.financials?.deductionDetails || []) : [],
    otDetails:        isEdit ? (record?.financials?.otDetails        || []) : [],
  });

  const [deductionDraft, setDeductionDraft] = useState({ amount: '', reason: '' });
  const [otDraft,        setOtDraft]        = useState({ type: 'calc', amount: '', hours: '', rate: '1.5', reason: '' });
  const [employees,      setEmployees]      = useState([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [saving,         setSaving]         = useState(false);

  useEffect(() => {
    if (!isEdit) {
      setLoadingEmployees(true);
      const token = localStorage.getItem('token');
      axios.get('/api/employees?status=Active', { headers: { Authorization: `Bearer ${token}` } })
        .then(res => {
          let list = res.data?.employees || [];
          if (currentUserRole === 'admin') {
            list = list.filter(emp => !PRIVILEGED_ROLES.includes(emp.role));
          }
          setEmployees(list);
        })
        .catch(() => toast.error('Failed to load employees'))
        .finally(() => setLoadingEmployees(false));
    }
  }, [isEdit, currentUserRole]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleHiddenDateChange = (e) => {
    const val = e.target.value;
    if (!val) return;
    const [y, m, d] = val.split('-');
    setForm(prev => ({ ...prev, date: `${d}/${m}/${y}` }));
  };

  const addDeduction = () => {
    const amount = parseFloat(deductionDraft.amount);
    if (!amount || amount < 0)         return toast.error('Enter a valid deduction amount');
    if (!deductionDraft.reason.trim()) return toast.error('Deduction reason is required');
    setForm(prev => ({
      ...prev,
      deductionDetails: [...prev.deductionDetails, { amount, reason: deductionDraft.reason.trim() }]
    }));
    setDeductionDraft({ amount: '', reason: '' });
  };

  const addOT = () => {
    if (!otDraft.reason.trim()) return toast.error('OT reason is required');
    if (otDraft.type === 'manual') {
      const amount = parseFloat(otDraft.amount);
      if (!amount || amount < 0) return toast.error('Enter a valid OT amount');
      setForm(prev => ({ ...prev, otDetails: [...prev.otDetails, { type: 'manual', amount, reason: otDraft.reason.trim() }] }));
   } else {
  const hours = parseFloat(otDraft.hours);
  const rate  = parseFloat(otDraft.rate) || 1;  // ✅ already correct
  if (!hours || hours <= 0) return toast.error('Enter valid OT hours');
  setForm(prev => ({ ...prev, otDetails: [...prev.otDetails, { 
    type: 'calc', 
    hours,           // number ✅
    rate,            // number ✅ (parseFloat converts "1.5" → 1.5)
    reason: otDraft.reason.trim() 
  }] }));
}
    setOtDraft({ type: 'calc', amount: '', hours: '', rate: '1.5', reason: '' });
  };

// Replace removeDetail with this in AttendanceFormModal:

const removeDetail = async (key, index) => {
  const updated = form[key].filter((_, i) => i !== index);
  setForm(prev => ({ ...prev, [key]: updated }));

  // Only auto-save in edit mode — in add mode user hasn't saved yet
  if (!isEdit) return;

  try {
    const token = localStorage.getItem('token');
    const raw = record?.empId;
    let resolvedEmpId;
    if (typeof raw === 'object' && raw !== null) {
      resolvedEmpId = raw._id?.toString?.() || String(raw);
    } else {
      resolvedEmpId = String(raw);
    }

    const payload = {
      empId:            resolvedEmpId,
      date:             form.date,
      status:           form.status,
      inTime:           form.inTime  || null,
      outTime:          form.outTime || null,
      outNextDay:       form.outNextDay || false,
      deductionDetails: key === 'deductionDetails' ? updated : form.deductionDetails,
      otDetails:        key === 'otDetails'        ? updated : form.otDetails,
    };

    await axios.post('/api/attendance/save-row', payload, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    });

    toast.success('Removed and saved');
    onSuccess(); // refresh the table so earning updates live
  } catch (err) {
    toast.error(err.response?.data?.message || 'Failed to save after removal');
  }
};

  const handleSubmit = async () => {
    if (!isEdit && !form.empId) return toast.error('Please select an employee');
    if (!form.date)             return toast.error('Please enter a date');
    if (!form.status)           return toast.error('Please select a status');

    setSaving(true);
    try {
      const token = localStorage.getItem('token');

      // FIX 3 — empId resolution for edit mode.
      // Old code: record?.empId?._id || record?.empId
      // Problem: after the /range endpoint populates empId and it is JSON-serialised
      // to the frontend, the empId field in the attendance record can be either:
      //   (a) a plain string ObjectId  — when lean() is used
      //   (b) a populated object { _id, firstName, … } — when lean() is not used
      // The old code record?.empId?._id only works for case (b). For case (a),
      // record?.empId?._id is undefined and falls back to record?.empId which is the
      // full object — causing the backend to receive an object instead of a string ID.
      // Fix: handle both shapes explicitly.
      let resolvedEmpId;
      if (isEdit) {
        const raw = record?.empId;
        if (!raw) {
          toast.error('Cannot resolve employee ID — please reload and try again.');
          setSaving(false);
          return;
        }
        if (typeof raw === 'object' && raw !== null) {
          // populated object shape: { _id: ObjectId|string, firstName, … }
          resolvedEmpId = raw._id?.toString?.() || String(raw);
        } else {
          // plain string or stringified ObjectId
          resolvedEmpId = String(raw);
        }
      } else {
        resolvedEmpId = form.empId;
      }





const payload = {
  empId:      resolvedEmpId,
  date:       form.date,
  status:     form.status,
  inTime:     form.inTime  || null,
  outTime:    form.outTime || null,
  outNextDay: form.outNextDay || false,
  otDetails:  form.otDetails,
  // Only send deductionDetails if editing OR admin added manual entries
  ...(isEdit || form.deductionDetails.length > 0
    ? { deductionDetails: form.deductionDetails }
    : {}),
};

      await axios.post('/api/attendance/save-row', payload, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
      });

      toast.success(isEdit ? 'Attendance updated successfully' : 'Attendance added successfully');
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save attendance');
    } finally {
      setSaving(false);
    }
  };

  const showTimes = ['Present', 'Late'].includes(form.status);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">

        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-bold text-gray-800">
            {isEdit ? 'Edit Attendance Record' : 'Add Attendance Record'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition"><X size={20} /></button>
        </div>

        <div className="px-6 py-5 space-y-4 overflow-auto flex-1">

          {!isEdit && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Employee *</label>
              {loadingEmployees ? (
                <p className="text-sm text-gray-400">Loading employees...</p>
              ) : (
                <select name="empId" value={form.empId} onChange={handleChange}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500">
                  <option value="">-- Select Employee --</option>
                  {employees.map(emp => (
                    <option key={emp._id} value={emp._id}>
                      {emp.employeeNumber} — {emp.firstName} {emp.lastName} ({emp.department})
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {isEdit && (
            <div className="bg-blue-50 rounded-lg px-4 py-3">
              <p className="text-sm font-semibold text-blue-800">{record?.empName}</p>
              <p className="text-xs text-blue-600">ID: {record?.empNumber} · {record?.department}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date * (dd/mm/yyyy)</label>
            <div className="relative">
              <input type="text" name="date" value={form.date} onChange={handleChange} placeholder="dd/mm/yyyy"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 pr-10" />
              <input type="date" ref={hiddenDateRef} className="absolute opacity-0 pointer-events-none"
                onChange={handleHiddenDateChange} />
              <button type="button"
                onClick={() => { try { hiddenDateRef.current?.showPicker(); } catch { hiddenDateRef.current?.focus(); } }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-blue-500">
                <Calendar size={16} />
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status *</label>
            <select name="status" value={form.status} onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500">
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">In Time (HH:mm)</label>
                  <input type="text" name="inTime" value={form.inTime} onChange={handleChange} placeholder="09:00"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Out Time (HH:mm)</label>
                  <input type="text" name="outTime" value={form.outTime} onChange={handleChange} placeholder="17:00"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
                <input type="checkbox" name="outNextDay" checked={form.outNextDay} onChange={handleChange}
                  className="w-4 h-4 rounded border-gray-300" />
                Out time is next calendar day (night shift)
              </label>
            </>
          )}

          {/* Deductions */}
          <div className="border rounded-lg p-3 bg-gray-50 space-y-2">
            <p className="text-sm font-semibold text-gray-700">Deductions</p>
            <div className="grid grid-cols-2 gap-2">
              <input type="number" min="0" placeholder="Amount" value={deductionDraft.amount}
                onChange={e => setDeductionDraft(prev => ({ ...prev, amount: e.target.value }))}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              <input type="text" placeholder="Reason" value={deductionDraft.reason}
                onChange={e => setDeductionDraft(prev => ({ ...prev, reason: e.target.value }))}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <button type="button" onClick={addDeduction}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg">
              <Plus size={12} /> Add Deduction
            </button>
            <div className="space-y-1">
              {form.deductionDetails.map((entry, idx) => (
                <div key={`d-${idx}`} className="flex justify-between text-xs bg-white border rounded px-2 py-1">
                  <span>PKR {entry.amount} — {entry.reason}</span>
                  <button type="button" onClick={() => removeDetail('deductionDetails', idx)}
                    className="text-red-600 hover:text-red-800">Remove</button>
                </div>
              ))}
            </div>
          </div>

          {/* OT */}
          <div className="border rounded-lg p-3 bg-gray-50 space-y-2">
            <p className="text-sm font-semibold text-gray-700">Overtime (OT)</p>
            <div className="grid grid-cols-2 gap-2">
              <select value={otDraft.type} onChange={e => setOtDraft(prev => ({ ...prev, type: e.target.value }))}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
                <option value="calc">Calculated</option>
                <option value="manual">Manual Amount</option>
              </select>
              <input type="text" placeholder="Reason" value={otDraft.reason}
                onChange={e => setOtDraft(prev => ({ ...prev, reason: e.target.value }))}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              {otDraft.type === 'manual' ? (
                <input type="number" min="0" placeholder="Amount" value={otDraft.amount}
                  onChange={e => setOtDraft(prev => ({ ...prev, amount: e.target.value }))}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm col-span-2" />
              ) : (
                <>
                  <input type="number" min="0" step="0.5" placeholder="Hours" value={otDraft.hours}
                    onChange={e => setOtDraft(prev => ({ ...prev, hours: e.target.value }))}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                  <select value={otDraft.rate} onChange={e => setOtDraft(prev => ({ ...prev, rate: e.target.value }))}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
                    <option value="1">1.0x</option>
                    <option value="1.5">1.5x</option>
                    <option value="2">2.0x</option>
                  </select>
                </>
              )}
            </div>
            <button type="button" onClick={addOT}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg">
              <Plus size={12} /> Add OT
            </button>
            <div className="space-y-1">
              {form.otDetails.map((entry, idx) => (
                <div key={`ot-${idx}`} className="flex justify-between text-xs bg-white border rounded px-2 py-1">
                  <span>
                    {entry.type === 'manual' ? `PKR ${entry.amount}` : `${entry.hours}h × ${entry.rate}x`}
                    {' — '}{entry.reason}
                  </span>
                  <button type="button" onClick={() => removeDetail('otDetails', idx)}
                    className="text-red-600 hover:text-red-800">Remove</button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-2xl">
          <button onClick={onClose} disabled={saving}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition disabled:opacity-50">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={saving}
            className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition disabled:opacity-50">
            <Save size={15} />
            {saving ? 'Saving...' : isEdit ? 'Update' : 'Add Record'}
          </button>
        </div>
      </div>
    </div>
  );
}


// ─── Main Component ───────────────────────────────────────────────────────────
export default function ManualAttendance() {
  const [attendance,      setAttendance]      = useState([]);
  const [loading,         setLoading]         = useState(false);
  const [fromDate,        setFromDate]        = useState(getDateMinusDays(30));
  const [toDate,          setToDate]          = useState(getTodayDate());
  const [showImportModal, setShowImportModal] = useState(false);
  const [refreshing,      setRefreshing]      = useState(false);

  const hiddenFromDateRef = useRef(null);
  const hiddenToDateRef   = useRef(null);

  const [showAddModal, setShowAddModal] = useState(false);
  const [editRecord,   setEditRecord]   = useState(null);
  const [detailsModal, setDetailsModal] = useState(null);

  const userRole     = getCurrentUserRole();
  const isSuperAdmin = userRole === 'superadmin';
  const isAdmin      = userRole === 'admin' || isSuperAdmin;

  const fetchAttendance = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) { toast.error('Authentication required'); return; }

      const response = await axios.get(
        `/api/attendance/range?fromDate=${fromDate}&toDate=${toDate}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      let records = response.data?.attendance || [];

      if (userRole === 'admin') {
        records = records.filter(r => !PRIVILEGED_ROLES.includes(r.empRole));
      }

      setAttendance(records);
    } catch (error) {
      if      (error.response?.status === 401) toast.error('Unauthorized. Please login again.');
      else if (error.response?.status === 403) toast.error('You do not have permission to access this page.');
      else                                     toast.error('Failed to load attendance data');
      setAttendance([]);
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, userRole]);

  useEffect(() => { fetchAttendance(); }, [fetchAttendance]);

  const handleDateRangeChange = () => {
    const from = parseDate(fromDate);
    const to   = parseDate(toDate);
    if (!from || !to) { toast.error('Invalid date format. Use dd/mm/yyyy'); return; }
    if (from > to)    { toast.error('From date cannot be after to date'); return; }
    fetchAttendance();
  };

  const handleImportSuccess = () => {
    setRefreshing(true);
    setTimeout(() => { fetchAttendance(); setRefreshing(false); }, 1500);
  };

  const handleShowPicker = (ref) => {
    try { ref.current?.showPicker(); } catch { ref.current?.focus(); }
  };

  const handleHiddenDateChange = (e, setter) => {
    const val = e.target.value;
    if (!val) return;
    const [y, m, d] = val.split('-');
    setter(`${d}/${m}/${y}`);
  };

  const canEditRecord = (record) => {
    if (isSuperAdmin) return true;
    if (userRole === 'admin') return !PRIVILEGED_ROLES.includes(record.empRole);
    return false;
  };

  const handleEditClick = (record) => {
    if (!canEditRecord(record)) {
      toast.error('You do not have permission to edit attendance for admin or superadmin accounts');
      return;
    }
    setEditRecord(record);
  };

  const handleExport = () => {
    if (!attendance.length) { toast.error('No attendance data to export'); return; }

    const csv = [
      ['Date','Employee ID','Name','Department','Status','In Time','Out Time',
       'Hours Worked','OT Amount','Total Deduction','Daily Earning','Last Modified'].join(',')
    ];
    attendance.forEach(record => {
      // FIX 4 — export: null-safe time fields; quote-escape name for CSV safety
      csv.push([
        `"${record.dateFormatted                              || '--'}"`,
        `"${record.empNumber                                  || '--'}"`,
        `"${(record.empName || '--').replace(/"/g, '""')}"`,
        `"${record.department                                 || '--'}"`,
        `"${record.status                                     || '--'}"`,
        `"${record.inTime  ?? '--'}"`,
        `"${record.outTime ?? '--'}"`,
        `"${(record.financials?.hoursWorked?.toFixed(2))     || '0.00'}"`,
        `"${(record.financials?.otAmount?.toFixed(2))        || '0.00'}"`,
        `"${(record.financials?.deduction?.toFixed(2))       || '0.00'}"`,
        `"${(record.financials?.finalDayEarning?.toFixed(2)) || '0.00'}"`,
        `"${record.lastModified                              || '--'}"`,
      ].join(','));
    });

    const blob = new Blob([csv.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url  = window.URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `attendance-${fromDate}-to-${toDate}.csv`; a.click();
    window.URL.revokeObjectURL(url);
    toast.success('Attendance exported successfully');
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Present': return 'bg-green-100 text-green-800';
      case 'Late':    return 'bg-yellow-100 text-yellow-800';
      case 'Leave':   return 'bg-blue-100 text-blue-800';
      case 'Absent':  return 'bg-red-100 text-red-800';
      default:        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="p-4 md:p-6">

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Manual Attendance</h1>
        <div className="flex gap-2 w-full md:w-auto flex-wrap">
          {isAdmin && (
            <>
              <button onClick={() => setShowAddModal(true)} disabled={loading}
                className="flex items-center gap-2 px-3 md:px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:opacity-50 text-sm">
                <Plus size={18} /><span className="hidden sm:inline">Add Record</span>
              </button>
              <button onClick={() => setShowImportModal(true)} disabled={loading || refreshing}
                className="flex items-center gap-2 px-3 md:px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50 text-sm">
                <Upload size={18} /><span className="hidden sm:inline">Import CSV</span>
              </button>
            </>
          )}
          <button onClick={handleExport} disabled={loading || !attendance.length}
            className="flex items-center gap-2 px-3 md:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 text-sm">
            <Download size={18} /><span className="hidden sm:inline">Export</span>
          </button>
          <button onClick={() => { setRefreshing(true); fetchAttendance().finally(() => setRefreshing(false)); }}
            disabled={loading || refreshing}
            className="flex items-center gap-2 px-3 md:px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition disabled:opacity-50 text-sm">
            <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Date Range Filter */}
      <div className="bg-white rounded-lg shadow p-4 md:p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 md:gap-4">
          <div>
            <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1 md:mb-2">From Date (dd/mm/yyyy)</label>
            <div className="relative">
              <input type="text" value={fromDate} onChange={e => setFromDate(e.target.value)} placeholder="dd/mm/yyyy"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm pr-8" />
              <input type="date" ref={hiddenFromDateRef} className="absolute opacity-0 pointer-events-none"
                onChange={e => handleHiddenDateChange(e, setFromDate)} />
              <button type="button" onClick={() => handleShowPicker(hiddenFromDateRef)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-blue-500">
                <Calendar size={14} />
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1 md:mb-2">To Date (dd/mm/yyyy)</label>
            <div className="relative">
              <input type="text" value={toDate} onChange={e => setToDate(e.target.value)} placeholder="dd/mm/yyyy"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm pr-8" />
              <input type="date" ref={hiddenToDateRef} className="absolute opacity-0 pointer-events-none"
                onChange={e => handleHiddenDateChange(e, setToDate)} />
              <button type="button" onClick={() => handleShowPicker(hiddenToDateRef)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-blue-500">
                <Calendar size={14} />
              </button>
            </div>
          </div>
          <div className="flex items-end">
            <button onClick={handleDateRangeChange} disabled={loading}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 text-sm font-medium">
              {loading ? 'Loading...' : 'Apply'}
            </button>
          </div>
          <div className="flex items-end md:col-span-2">
            <div className="w-full text-xs text-gray-600 p-2 bg-gray-50 rounded">Total Records: {attendance.length}</div>
          </div>
        </div>
      </div>

      {/* Attendance Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading && !attendance.length ? (
          <div className="p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4" />
            <p className="text-gray-600 font-medium">Loading attendance data...</p>
          </div>
        ) : attendance.length === 0 ? (
          <div className="p-12 text-center text-gray-600">
            <AlertCircle className="mx-auto mb-4 text-gray-400" size={48} />
            <p>No attendance records found for selected date range</p>
          </div>
        ) : (
          <>
            {/* Desktop */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Date</th>
                    <th className="px-4 py-3 text-left font-semibold">Employee ID</th>
                    <th className="px-4 py-3 text-left font-semibold">Name</th>
                    <th className="px-4 py-3 text-left font-semibold">Department</th>
                    <th className="px-4 py-3 text-left font-semibold">Status</th>
                    <th className="px-4 py-3 text-center font-semibold">In Time</th>
                    <th className="px-4 py-3 text-center font-semibold">Out Time</th>
                    <th className="px-4 py-3 text-right font-semibold">Hours</th>
                    <th className="px-4 py-3 text-right font-semibold">OT</th>
                    <th className="px-4 py-3 text-right font-semibold">Deduction</th>
                    <th className="px-4 py-3 text-right font-semibold">Earning</th>
                    <th className="px-4 py-3 text-left font-semibold">Last Modified</th>
                    {isAdmin && <th className="px-4 py-3 text-center font-semibold">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {attendance.map((record, idx) => {
                    const editable = canEditRecord(record);
                    return (
                      <tr key={record._id || idx} className="hover:bg-gray-50">
                        <td className="px-4 py-3">{record.dateFormatted}</td>
                        <td className="px-4 py-3 font-medium">{record.empNumber}</td>
                        <td className="px-4 py-3">{record.empName}</td>
                        <td className="px-4 py-3">{record.department}</td>
                        <td className="px-4 py-3">
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(record.status)}`}>
                            {record.status}
                          </span>
                        </td>
                        {/* FIX 1 applied — null-safe display */}
                        <td className="px-4 py-3 text-center">{displayTime(record.inTime)}</td>
                        <td className="px-4 py-3 text-center">
                          {displayTime(record.outTime)}
                          {record.outNextDay && record.outTime &&
                            <span className="ml-1 text-xs text-orange-500 font-medium">(+1)</span>
                          }
                        </td>
                        <td className="px-4 py-3 text-right">{(record.financials?.hoursWorked || 0).toFixed(2)}</td>
                        <td className="px-4 py-3 text-right">
                          <button type="button" onClick={() => setDetailsModal({ type: 'ot', record })}
                            className="inline-flex items-center gap-1 text-blue-700 hover:text-blue-900">
                            PKR {(record.financials?.otAmount || 0).toFixed(2)} <Eye size={12} />
                          </button>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button type="button" onClick={() => setDetailsModal({ type: 'deduction', record })}
                            className="inline-flex items-center gap-1 text-red-700 hover:text-red-900">
                            PKR {(record.financials?.deduction || 0).toFixed(2)} <Eye size={12} />
                          </button>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold">
                          PKR {(record.financials?.finalDayEarning || 0).toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-600">{record.lastModified || '--'}</td>
                        {isAdmin && (
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => handleEditClick(record)}
                              disabled={!editable}
                              title={!editable ? 'No permission to edit privileged account attendance' : undefined}
                              className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg transition ${
                                editable
                                  ? 'text-indigo-700 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100'
                                  : 'text-gray-400 bg-gray-50 border border-gray-200 opacity-50 cursor-not-allowed'
                              }`}>
                              <Pencil size={13} /> Edit
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile */}
            <div className="md:hidden space-y-3 p-4">
              {attendance.map((record, idx) => {
                const editable = canEditRecord(record);
                return (
                  <div key={record._id || idx} className="border rounded-lg p-4 bg-gray-50">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-semibold text-gray-900">{record.empName}</p>
                        <p className="text-xs text-gray-600">ID: {record.empNumber}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${getStatusColor(record.status)}`}>
                          {record.status}
                        </span>
                        {isAdmin && (
                          <button
                            onClick={() => handleEditClick(record)}
                            disabled={!editable}
                            className={`p-1.5 rounded-lg border transition ${
                              editable
                                ? 'text-indigo-600 bg-indigo-50 border-indigo-200 hover:bg-indigo-100'
                                : 'text-gray-300 bg-gray-50 border-gray-200 opacity-50 cursor-not-allowed'
                            }`}>
                            <Pencil size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="space-y-1 text-sm">
                      <p><span className="font-medium">Date:</span> {record.dateFormatted}</p>
                      <p><span className="font-medium">Dept:</span> {record.department}</p>
                      <p>
                        {/* FIX 1 applied — mobile null-safe display */}
                        <span className="font-medium">In/Out:</span> {displayTime(record.inTime)} — {displayTime(record.outTime)}
                        {record.outNextDay && record.outTime &&
                          <span className="ml-1 text-xs text-orange-500">(+1 day)</span>
                        }
                      </p>
                      <p><span className="font-medium">Hours:</span> {(record.financials?.hoursWorked || 0).toFixed(2)}</p>
                      <p><span className="font-medium">OT:</span> PKR {(record.financials?.otAmount || 0).toFixed(2)}</p>
                      <p><span className="font-medium">Deduction:</span> PKR {(record.financials?.deduction || 0).toFixed(2)}</p>
                      <p><span className="font-medium">Earning:</span> PKR {(record.financials?.finalDayEarning || 0).toFixed(2)}</p>
                      <p className="text-xs text-gray-500">
                        <span className="font-medium">Modified:</span> {record.lastModified || '--'}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Modals */}
      {showImportModal && (
        <CSVImportModal onClose={() => setShowImportModal(false)} onSuccess={handleImportSuccess} />
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

      {/* OT / Deduction detail popup */}
      {detailsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-3 border-b">
              <h3 className="font-semibold text-gray-800">
                {detailsModal.type === 'ot' ? 'OT Details' : 'Deduction Details'} — {detailsModal.record.empName}
              </h3>
              <button onClick={() => setDetailsModal(null)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>
            <div className="p-4 space-y-2 max-h-80 overflow-auto">
              {(() => {
                const entries = detailsModal.type === 'ot'
                  ? detailsModal.record.financials?.otDetails
                  : detailsModal.record.financials?.deductionDetails;
                if (!entries?.length) return <p className="text-sm text-gray-500">No detail entries found.</p>;
                return entries.map((entry, i) => (
                  <div key={i} className="border rounded-lg p-2 text-sm bg-gray-50">
                    {detailsModal.type === 'ot' ? (
                      <p>{entry.type === 'manual' ? `Amount: PKR ${entry.amount}` : `Hours: ${entry.hours} × ${entry.rate}x`} · {entry.reason}</p>
                    ) : (
                      <p>Amount: PKR {entry.amount} · {entry.reason}</p>
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