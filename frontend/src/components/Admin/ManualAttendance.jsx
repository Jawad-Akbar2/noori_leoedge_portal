import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import {
  Plus, Download, Upload, AlertCircle, RefreshCw, X, Save, Pencil,
  Calendar, Eye, Trash2, ChevronLeft, ChevronRight, Search, CheckCircle2,
  Circle, Loader2
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

const displayTime = (val) => (val && val !== '--') ? val : '--';

// ─── Shared DateNavigator ─────────────────────────────────────────────────────
function DateNavigator({ value, onChange, label, showTodayBadge = false }) {
  const hiddenRef = useRef(null);
  const isToday = value === getTodayDate();

  const shiftDate = (dir) => {
    if (!value) return;
    const [d, m, y] = value.split('/').map(Number);
    if (!d || !m || !y) return;
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() + dir);
    const nd = String(dt.getDate()).padStart(2, '0');
    const nm = String(dt.getMonth() + 1).padStart(2, '0');
    onChange(`${nd}/${nm}/${dt.getFullYear()}`);
  };

  const handleHiddenChange = (e) => {
    const val = e.target.value;
    if (!val) return;
    const [y, m, d] = val.split('-');
    onChange(`${d}/${m}/${y}`);
  };

  const openPicker = () => {
    try { hiddenRef.current?.showPicker(); } catch { hiddenRef.current?.focus(); }
  };

  return (
    <div>
      {label && <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>}
      <div className="flex items-center gap-1">
        <button type="button" onClick={() => shiftDate(-1)}
          className="p-2 rounded-lg border border-gray-300 hover:bg-gray-100 transition text-gray-600 flex-shrink-0">
          <ChevronLeft size={15} />
        </button>
        <div className="relative flex-1 min-w-[130px]">
          <input type="text" value={value} onChange={e => onChange(e.target.value)}
            placeholder="dd/mm/yyyy"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 pr-8 text-center" />
          <input type="date" ref={hiddenRef} className="absolute opacity-0 pointer-events-none w-0 h-0"
            onChange={handleHiddenChange} />
          <button type="button" onClick={openPicker}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-blue-500">
            <Calendar size={14} />
          </button>
        </div>
        <button type="button" onClick={() => shiftDate(1)}
          className="p-2 rounded-lg border border-gray-300 hover:bg-gray-100 transition text-gray-600 flex-shrink-0">
          <ChevronRight size={15} />
        </button>
        {showTodayBadge && isToday && (
          <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded-full flex-shrink-0">Today</span>
        )}
      </div>
    </div>
  );
}

// ─── SearchBar ────────────────────────────────────────────────────────────────
function SearchBar({ value, onChange, placeholder = 'Search...' }) {
  return (
    <div className="relative">
      <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
      <input type="text" value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
      {value && (
        <button type="button" onClick={() => onChange('')}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
          <X size={13} />
        </button>
      )}
    </div>
  );
}

function filterRecords(records, query) {
  if (!query.trim()) return records;
  const q = query.toLowerCase();
  return records.filter(r =>
    (r.empName     || '').toLowerCase().includes(q) ||
    (r.empNumber   || '').toLowerCase().includes(q) ||
    (r.department  || '').toLowerCase().includes(q) ||
    (r.status      || '').toLowerCase().includes(q) ||
    (r.dateFormatted || '').includes(q)
  );
}

// ─── Attendance Form Modal (Add & Edit) ──────────────────────────────────────
function AttendanceFormModal({ mode = 'add', record = null, onClose, onSuccess, currentUserRole }) {
  const isEdit = mode === 'edit';
  const parseTime = (val) => (val && val !== '--') ? val : '';

  const [form, setForm] = useState({
    empId:            '',
    date:             isEdit ? (record?.dateFormatted || '') : getTodayDate(),
    status:           isEdit ? (record?.status || 'Present') : 'Present',
    inTime:           isEdit ? parseTime(record?.inTime)  : '',
    outTime:          isEdit ? parseTime(record?.outTime) : '',
    outNextDay:       isEdit ? (record?.outNextDay || false) : false,
    deductionDetails: isEdit ? (record?.financials?.deductionDetails || []) : [],
    otDetails:        isEdit ? (record?.financials?.otDetails        || []) : [],
  });
  const [deductionDraft, setDeductionDraft] = useState({ amount: '', reason: '' });
  const [otDraft, setOtDraft] = useState({ type: 'calc', amount: '', hours: '', rate: '1.5', reason: '' });
  const [employees, setEmployees] = useState([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isEdit) {
      setLoadingEmployees(true);
      const token = localStorage.getItem('token');
      axios.get('/api/employees?status=Active', { headers: { Authorization: `Bearer ${token}` } })
        .then(res => {
          let list = res.data?.employees || [];
          if (currentUserRole === 'admin') list = list.filter(emp => !PRIVILEGED_ROLES.includes(emp.role));
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

  const addDeduction = () => {
    const amount = parseFloat(deductionDraft.amount);
    if (!amount || amount < 0) return toast.error('Enter a valid deduction amount');
    if (!deductionDraft.reason.trim()) return toast.error('Deduction reason is required');
    setForm(prev => ({ ...prev, deductionDetails: [...prev.deductionDetails, { amount, reason: deductionDraft.reason.trim() }] }));
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
      const rate  = parseFloat(otDraft.rate) || 1;
      if (!hours || hours <= 0) return toast.error('Enter valid OT hours');
      setForm(prev => ({ ...prev, otDetails: [...prev.otDetails, { type: 'calc', hours, rate, reason: otDraft.reason.trim() }] }));
    }
    setOtDraft({ type: 'calc', amount: '', hours: '', rate: '1.5', reason: '' });
  };

  const removeDetail = async (key, index) => {
    const updated = form[key].filter((_, i) => i !== index);
    setForm(prev => ({ ...prev, [key]: updated }));
    if (!isEdit) return;
    try {
      const raw = record?.empId;
      const resolvedEmpId = typeof raw === 'object' && raw !== null ? (raw._id?.toString?.() || String(raw)) : String(raw);
      await axios.post('/api/attendance/save-row', {
        empId: resolvedEmpId, date: form.date, status: form.status,
        inTime: form.inTime || null, outTime: form.outTime || null, outNextDay: form.outNextDay || false,
        deductionDetails: key === 'deductionDetails' ? updated : form.deductionDetails,
        otDetails:        key === 'otDetails'        ? updated : form.otDetails,
      }, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' } });
      toast.success('Removed and saved'); onSuccess();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to save after removal'); }
  };

  const handleSubmit = async () => {
    if (!isEdit && !form.empId) return toast.error('Please select an employee');
    if (!form.date)   return toast.error('Please enter a date');
    if (!form.status) return toast.error('Please select a status');
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      let resolvedEmpId;
      if (isEdit) {
        const raw = record?.empId;
        if (!raw) { toast.error('Cannot resolve employee — please reload.'); setSaving(false); return; }
        resolvedEmpId = typeof raw === 'object' && raw !== null ? (raw._id?.toString?.() || String(raw)) : String(raw);
      } else { resolvedEmpId = form.empId; }
      await axios.post('/api/attendance/save-row', {
        empId: resolvedEmpId, date: form.date, status: form.status,
        inTime: form.inTime || null, outTime: form.outTime || null, outNextDay: form.outNextDay || false,
        otDetails: form.otDetails,
        ...(isEdit || form.deductionDetails.length > 0 ? { deductionDetails: form.deductionDetails } : {}),
      }, { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } });
      toast.success(isEdit ? 'Attendance updated' : 'Attendance added');
      onSuccess(); onClose();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to save attendance'); }
    finally { setSaving(false); }
  };

  const showTimes = ['Present', 'Late'].includes(form.status);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-bold text-gray-800">{isEdit ? 'Edit Attendance Record' : 'Add Attendance Record'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>
        <div className="px-6 py-5 space-y-4 overflow-auto flex-1">
          {!isEdit && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Employee *</label>
              {loadingEmployees ? <p className="text-sm text-gray-400">Loading employees...</p> : (
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
            <DateNavigator value={form.date} onChange={(val) => setForm(prev => ({ ...prev, date: val }))} />
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
                <input type="checkbox" name="outNextDay" checked={form.outNextDay} onChange={handleChange} className="w-4 h-4 rounded border-gray-300" />
                Out time is next calendar day (night shift)
              </label>
            </>
          )}
          {currentUserRole !== 'hybrid' && (
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
                    <button type="button" onClick={() => removeDetail('deductionDetails', idx)} className="text-red-600 hover:text-red-800">Remove</button>
                  </div>
                ))}
              </div>
            </div>
          )}
          {currentUserRole !== 'hybrid' && (
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
                    <span>{entry.type === 'manual' ? `PKR ${entry.amount}` : `${entry.hours}h × ${entry.rate}x`} — {entry.reason}</span>
                    <button type="button" onClick={() => removeDetail('otDetails', idx)} className="text-red-600 hover:text-red-800">Remove</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-2xl">
          <button onClick={onClose} disabled={saving}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition disabled:opacity-50">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={saving}
            className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition disabled:opacity-50">
            <Save size={15} /> {saving ? 'Saving...' : isEdit ? 'Update' : 'Add Record'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Delete Confirm Modal ─────────────────────────────────────────────────────
function DeleteConfirmModal({ record, onClose, onConfirm, deleting }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-bold text-gray-800">Delete Record</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>
        <div className="px-6 py-5">
          <p className="text-sm text-gray-700 mb-1">Are you sure you want to delete the attendance record for:</p>
          <p className="text-sm font-semibold text-gray-900">{record?.empName}</p>
          <p className="text-xs text-gray-500">{record?.dateFormatted} · {record?.department}</p>
          <p className="text-xs text-red-600 mt-3">This action cannot be undone.</p>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-2xl">
          <button onClick={onClose} disabled={deleting}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={deleting}
            className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50">
            <Trash2 size={15} /> {deleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// ─── MARK TAB — Inline Worksheet ─────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════

const STATUS_COLORS = {
  Present: 'bg-green-100 text-green-800 border-green-200',
  Late:    'bg-yellow-100 text-yellow-800 border-yellow-200',
  Leave:   'bg-blue-100 text-blue-800 border-blue-200',
  Absent:  'bg-red-100 text-red-800 border-red-200',
  '':      'bg-gray-100 text-gray-500 border-gray-200',
};

function WorksheetRow({ row, isAdmin, isHybrid, canEdit, onRowChange, onSaveRow, savingRowId }) {
  const isSaving  = savingRowId === row.empId;
  const isDirty   = row.__dirty;
  const isSaved   = row.__saved;
  const showTimes = ['Present', 'Late'].includes(row.status);

  const handleStatusChange = (val) => {
    const clearTimes = !['Present', 'Late'].includes(val);
    onRowChange(row.empId, {
      status: val,
      ...(clearTimes ? { inTime: '', outTime: '', outNextDay: false } : {}),
    });
  };

  return (
    <tr className={`border-b transition-colors ${
      isDirty         ? 'bg-amber-50'     :
      isSaved         ? 'bg-green-50'     :
      row.__isVirtual ? 'bg-gray-50/40'   : 'bg-white'
    } hover:bg-blue-50/20`}>

      {/* Status dot */}
      <td className="pl-3 pr-1 py-2 w-6">
        {isSaving ? (
          <Loader2 size={14} className="text-blue-500 animate-spin" />
        ) : isSaved ? (
          <CheckCircle2 size={14} className="text-green-500" />
        ) : isDirty ? (
          <Circle size={14} className="text-amber-500 fill-amber-400" />
        ) : row.__isVirtual ? (
          <Circle size={14} className="text-gray-300" />
        ) : (
          <CheckCircle2 size={14} className="text-gray-300" />
        )}
      </td>

      <td className="px-3 py-2 text-xs font-mono text-gray-600 whitespace-nowrap">{row.empNumber}</td>
      <td className="px-3 py-2 text-sm font-medium text-gray-900 whitespace-nowrap">{row.empName}</td>
      <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">{row.department}</td>

      {/* Status dropdown */}
      <td className="px-2 py-2">
        {canEdit ? (
          <select value={row.status} onChange={e => handleStatusChange(e.target.value)} disabled={isSaving}
            className={`text-xs font-semibold rounded-md border px-2 py-1 focus:ring-2 focus:ring-blue-400 focus:outline-none disabled:opacity-60 cursor-pointer ${STATUS_COLORS[row.status] || STATUS_COLORS['']}`}>
            <option value="Absent">Absent</option>
            <option value="Present">Present</option>
            <option value="Late">Late</option>
            <option value="Leave">Leave</option>
          </select>
        ) : (
          <span className={`text-xs font-semibold px-2 py-1 rounded-full border ${STATUS_COLORS[row.status] || STATUS_COLORS['']}`}>
            {row.status || '—'}
          </span>
        )}
      </td>

      {/* In Time */}
      <td className="px-2 py-2">
        {canEdit && showTimes ? (
          <input type="text" value={row.inTime || ''} onChange={e => onRowChange(row.empId, { inTime: e.target.value })}
            placeholder="09:00" disabled={isSaving}
            className="w-20 border border-gray-300 rounded-md px-2 py-1 text-xs focus:ring-2 focus:ring-blue-400 focus:outline-none disabled:opacity-60" />
        ) : (
          <span className="text-xs text-gray-400">{showTimes ? displayTime(row.inTime) : '—'}</span>
        )}
      </td>

      {/* Out Time + Next Day */}
      <td className="px-2 py-2">
        {canEdit && showTimes ? (
          <div className="flex items-center gap-1">
            <input type="text" value={row.outTime || ''} onChange={e => onRowChange(row.empId, { outTime: e.target.value })}
              placeholder="17:00" disabled={isSaving}
              className="w-20 border border-gray-300 rounded-md px-2 py-1 text-xs focus:ring-2 focus:ring-blue-400 focus:outline-none disabled:opacity-60" />
            <label className="flex items-center gap-0.5 cursor-pointer select-none group" title="Out next calendar day (night shift)">
              <input type="checkbox" checked={row.outNextDay || false} onChange={e => onRowChange(row.empId, { outNextDay: e.target.checked })}
                disabled={isSaving} className="w-3.5 h-3.5 rounded border-gray-300" />
              <span className="text-xs text-gray-400 group-hover:text-orange-500">+1</span>
            </label>
          </div>
        ) : (
          <span className="text-xs text-gray-400">
            {showTimes ? (
              <>
                {displayTime(row.outTime)}
                {row.outNextDay && row.outTime && <span className="ml-1 text-orange-500">(+1)</span>}
              </>
            ) : '—'}
          </span>
        )}
      </td>

      {/* Earning */}
      {!isHybrid && (
        <td className="px-3 py-2 text-right text-xs font-semibold text-gray-700 whitespace-nowrap">
          {row.__isVirtual && !isDirty
            ? <span className="text-gray-300">—</span>
            : `PKR ${(row.financials?.finalDayEarning || 0).toFixed(2)}`
          }
        </td>
      )}

      {/* Modified */}
      <td className="px-3 py-2 text-xs text-gray-400 whitespace-nowrap">
        {row.__isVirtual && !isSaved ? '—' : (row.lastModified || '—')}
      </td>

      {/* Save button */}
      {isAdmin && (
        <td className="px-2 py-2 text-center">
          {canEdit && (
            <button onClick={() => onSaveRow(row.empId)}
              disabled={isSaving || !isDirty}
              title={!isDirty ? 'No changes to save' : 'Save this row'}
              className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg transition ${
                isDirty
                  ? 'text-white bg-blue-600 border border-blue-600 hover:bg-blue-700'
                  : 'text-gray-300 bg-gray-50 border border-gray-200 cursor-not-allowed'
              } disabled:opacity-50`}>
              {isSaving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
              Save
            </button>
          )}
        </td>
      )}
    </tr>
  );
}

function MarkTab({ userRole, isSuperAdmin, isAdmin, isHybrid }) {
  const [markDate,    setMarkDate]    = useState(getTodayDate());
  const [rows,        setRows]        = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [savingRowId, setSavingRowId] = useState(null);
  const [savingAll,   setSavingAll]   = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editModal,   setEditModal]   = useState(null);

  // ── Load: merge all-employees list with existing saved records ──────────────
  const loadWorksheet = useCallback(async (date) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const [empRes, attRes] = await Promise.all([
        axios.get('/api/employees?status=Active', { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`/api/attendance/range?fromDate=${date}&toDate=${date}`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      let employees = empRes.data?.employees || [];
      let saved     = attRes.data?.attendance || [];

      if (userRole === 'admin') {
        employees = employees.filter(e => !PRIVILEGED_ROLES.includes(e.role));
        saved     = saved.filter(r => !PRIVILEGED_ROLES.includes(r.empRole));
      }

      // Build lookup of saved records keyed by empId string
      const savedMap = {};
      for (const rec of saved) {
        const key = rec.empId?._id?.toString?.() || rec.empId?.toString?.() || String(rec.empId);
        savedMap[key] = rec;
      }

      const worksheet = employees.map(emp => {
        const key      = emp._id?.toString?.() || String(emp._id);
        const existing = savedMap[key];

        if (existing) {
          return {
            ...existing,
            empId:       key,
            inTime:      existing.inOut?.in  || '',
            outTime:     existing.inOut?.out || '',
            outNextDay:  existing.inOut?.outNextDay || false,
            __isVirtual: false,
            __dirty:     false,
            __saved:     false,
          };
        }

        // Virtual row — not yet saved, defaults to Absent
        return {
          empId:       key,
          empNumber:   emp.employeeNumber,
          empName:     `${emp.firstName} ${emp.lastName}`,
          department:  emp.department,
          empRole:     emp.role,
          status:      'Absent',
          inTime:      '',
          outTime:     '',
          outNextDay:  false,
          financials:  { finalDayEarning: 0 },
          lastModified: null,
          __isVirtual: true,
          __dirty:     false,
          __saved:     false,
        };
      });

      setRows(worksheet);
    } catch {
      toast.error('Failed to load worksheet');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [userRole]);

  useEffect(() => { loadWorksheet(markDate); }, [markDate, loadWorksheet]);

  // ── Inline field change → marks row dirty ──────────────────────────────────
  const handleRowChange = useCallback((empId, changes) => {
    setRows(prev => prev.map(r =>
      r.empId === empId ? { ...r, ...changes, __dirty: true, __saved: false } : r
    ));
  }, []);

  // ── Save single row ────────────────────────────────────────────────────────
  const handleSaveRow = useCallback(async (empId) => {
    const row = rows.find(r => r.empId === empId);
    if (!row) return;
    if (!row.status) return toast.error(`${row.empName}: please set a status before saving`);

    setSavingRowId(empId);
    try {
      const token = localStorage.getItem('token');
      await axios.post('/api/attendance/save-row', {
        empId:      row.empId,
        date:       markDate,
        status:     row.status,
        inTime:     row.inTime  || null,
        outTime:    row.outTime || null,
        outNextDay: row.outNextDay || false,
      }, { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } });

      setRows(prev => prev.map(r =>
        r.empId === empId
          ? { ...r, __dirty: false, __saved: true, __isVirtual: false, lastModified: 'just now' }
          : r
      ));
      toast.success(`${row.empName} saved`);
    } catch (err) {
      toast.error(err.response?.data?.message || `Failed to save ${row.empName}`);
    } finally { setSavingRowId(null); }
  }, [rows, markDate]);

  // ── Save All dirty rows only ────────────────────────────────────────────────
  const handleSaveAll = async () => {
    // Only rows that are dirty (user changed something)
    const dirtyRows = rows.filter(r => r.__dirty);
    if (!dirtyRows.length) {
      toast('Nothing to save — no unsaved changes');
      return;
    }

    const invalid = dirtyRows.filter(r => !r.status);
    if (invalid.length) {
      return toast.error(`${invalid.length} row(s) have no status. Please set a status before saving.`);
    }

    setSavingAll(true);
    const token = localStorage.getItem('token');
    let saved = 0, failed = 0;

    // Batches of 50
    const BATCH = 50;
    for (let i = 0; i < dirtyRows.length; i += BATCH) {
      const batch = dirtyRows.slice(i, i + BATCH);
      await Promise.allSettled(
        batch.map(async (row) => {
          try {
            await axios.post('/api/attendance/save-row', {
              empId:      row.empId,
              date:       markDate,
              status:     row.status,
              inTime:     row.inTime  || null,
              outTime:    row.outTime || null,
              outNextDay: row.outNextDay || false,
            }, { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } });

            setRows(prev => prev.map(r =>
              r.empId === row.empId
                ? { ...r, __dirty: false, __saved: true, __isVirtual: false, lastModified: 'just now' }
                : r
            ));
            saved++;
          } catch { failed++; }
        })
      );
    }

    setSavingAll(false);
    if (failed === 0) toast.success(`${saved} record${saved !== 1 ? 's' : ''} saved successfully`);
    else              toast.error(`${saved} saved, ${failed} failed`);
  };

  const canEditRecord = (row) => {
    if (isSuperAdmin) return true;
    if (userRole === 'admin') return !PRIVILEGED_ROLES.includes(row.empRole);
    return false;
  };

  const dirtyCount = rows.filter(r => r.__dirty).length;
  const savedCount = rows.filter(r => !r.__isVirtual && !r.__dirty).length;
  const filtered   = filterRecords(rows, searchQuery);

  return (
    <div>
      {/* Date navigator */}
      <div className="bg-white rounded-lg shadow p-4 mb-4">
        <div className="flex flex-wrap items-end gap-4">
          <DateNavigator value={markDate} onChange={setMarkDate} label="Date (dd/mm/yyyy)" showTodayBadge />
          <div className="flex items-center gap-3 text-xs pb-1">
            <span className="text-gray-500">{rows.length} employee{rows.length !== 1 ? 's' : ''}</span>
            <span className="text-green-600 font-medium">{savedCount} saved</span>
            {dirtyCount > 0 && <span className="text-amber-600 font-medium">{dirtyCount} unsaved change{dirtyCount !== 1 ? 's' : ''}</span>}
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex-1 min-w-[200px] max-w-sm">
          <SearchBar value={searchQuery} onChange={setSearchQuery} placeholder="Search name, ID, department, status..." />
        </div>

        <div className="flex items-center gap-2 ml-auto">
          {/* Legend */}
          <div className="hidden lg:flex items-center gap-3 text-xs text-gray-400 mr-1">
            <span className="flex items-center gap-1"><Circle size={10} className="text-amber-400 fill-amber-400" /> Unsaved</span>
            <span className="flex items-center gap-1"><CheckCircle2 size={10} className="text-green-500" /> Saved</span>
            <span className="flex items-center gap-1"><Circle size={10} className="text-gray-300" /> Not changed</span>
          </div>

          <button onClick={() => loadWorksheet(markDate)} disabled={loading || savingAll}
            className="flex items-center gap-2 px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition disabled:opacity-50 text-sm">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>

          {isAdmin && (
            <button onClick={handleSaveAll} disabled={savingAll || loading || dirtyCount === 0}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 text-sm font-medium">
              {savingAll
                ? <><Loader2 size={15} className="animate-spin" /> Saving…</>
                : <><Save size={15} /> Save All{dirtyCount > 0 ? ` (${dirtyCount})` : ''}</>
              }
            </button>
          )}
        </div>
      </div>

      {/* Worksheet table */}
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
            {/* Desktop */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100 border-b">
                  <tr>
                    <th className="pl-3 pr-1 py-3 w-6" />
                    <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Emp #</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Department</th>
                    <th className="px-2 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                    <th className="px-2 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">In Time</th>
                    <th className="px-2 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Out Time</th>
                    {!isHybrid && <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Earning</th>}
                    <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Modified</th>
                    {isAdmin && <th className="px-2 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Action</th>}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={10} className="px-4 py-10 text-center text-gray-400 text-sm">No employees match your search</td></tr>
                  ) : filtered.map(row => (
                    <WorksheetRow key={row.empId} row={row} isAdmin={isAdmin} isHybrid={isHybrid}
                      canEdit={canEditRecord(row)} onRowChange={handleRowChange}
                      onSaveRow={handleSaveRow} savingRowId={savingRowId} />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile card list */}
            <div className="md:hidden space-y-2 p-3">
              {filtered.length === 0 ? (
                <p className="text-center text-sm text-gray-400 py-6">No employees match your search</p>
              ) : filtered.map(row => {
                const canEdit   = canEditRecord(row);
                const isSaving  = savingRowId === row.empId;
                const showTimes = ['Present', 'Late'].includes(row.status);

                return (
                  <div key={row.empId} className={`border rounded-xl p-3 transition-colors ${
                    row.__dirty   ? 'border-amber-300 bg-amber-50'  :
                    row.__saved   ? 'border-green-300 bg-green-50'  :
                    row.__isVirtual ? 'border-gray-200 bg-gray-50'  : 'border-gray-200 bg-white'
                  }`}>
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-semibold text-gray-900 text-sm">{row.empName}</p>
                        <p className="text-xs text-gray-500">#{row.empNumber} · {row.department}</p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {isSaving   ? <Loader2 size={14} className="text-blue-500 animate-spin" /> :
                         row.__saved ? <CheckCircle2 size={14} className="text-green-500" /> :
                         row.__dirty ? <Circle size={14} className="text-amber-400 fill-amber-400" /> : null}
                      </div>
                    </div>

                    {canEdit ? (
                      <div className="space-y-2">
                        <select value={row.status}
                          onChange={e => {
                            const val = e.target.value;
                            handleRowChange(row.empId, {
                              status: val,
                              ...(!['Present', 'Late'].includes(val) ? { inTime: '', outTime: '', outNextDay: false } : {}),
                            });
                          }}
                          disabled={isSaving}
                          className={`w-full text-sm font-semibold rounded-lg border px-2 py-1.5 cursor-pointer ${STATUS_COLORS[row.status] || STATUS_COLORS['']}`}>
                          <option value="Absent">Absent</option>
                          <option value="Present">Present</option>
                          <option value="Late">Late</option>
                          <option value="Leave">Leave</option>
                        </select>

                        {showTimes && (
                          <div className="flex gap-2 items-center">
                            <input type="text" value={row.inTime || ''} placeholder="In 09:00"
                              onChange={e => handleRowChange(row.empId, { inTime: e.target.value })}
                              disabled={isSaving}
                              className="flex-1 border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-blue-400" />
                            <input type="text" value={row.outTime || ''} placeholder="Out 17:00"
                              onChange={e => handleRowChange(row.empId, { outTime: e.target.value })}
                              disabled={isSaving}
                              className="flex-1 border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-blue-400" />
                            <label className="flex items-center gap-1 text-xs text-gray-500 cursor-pointer select-none">
                              <input type="checkbox" checked={row.outNextDay || false}
                                onChange={e => handleRowChange(row.empId, { outNextDay: e.target.checked })}
                                disabled={isSaving} className="w-3.5 h-3.5" />
                              +1
                            </label>
                          </div>
                        )}

                        {isAdmin && (
                          <button onClick={() => handleSaveRow(row.empId)}
                            disabled={isSaving || !row.__dirty}
                            className={`w-full flex items-center justify-center gap-2 py-1.5 rounded-lg text-xs font-medium transition ${
                              row.__dirty
                                ? 'bg-blue-600 text-white hover:bg-blue-700'
                                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            } disabled:opacity-50`}>
                            {isSaving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                            Save
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="mt-1">
                        <span className={`inline-block px-2 py-0.5 rounded-full font-semibold border text-xs ${STATUS_COLORS[row.status] || STATUS_COLORS['']}`}>
                          {row.status || '—'}
                        </span>
                        {row.inTime && <p className="text-xs text-gray-500 mt-1">In: {row.inTime} · Out: {displayTime(row.outTime)}</p>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Advanced edit modal for OT / deductions */}
      {editModal && (
        <AttendanceFormModal mode="edit" record={editModal} currentUserRole={userRole}
          onClose={() => setEditModal(null)} onSuccess={() => loadWorksheet(markDate)} />
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// ─── VIEW TAB ─────────────────────────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════

function ViewTab({ userRole, isSuperAdmin, isAdmin, isHybrid }) {
  const [attendance,      setAttendance]      = useState([]);
  const [loading,         setLoading]         = useState(false);
  const [fromDate,        setFromDate]        = useState(getDateMinusDays(30));
  const [toDate,          setToDate]          = useState(getTodayDate());
  const [showImportModal, setShowImportModal] = useState(false);
  const [refreshing,      setRefreshing]      = useState(false);
  const [showAddModal,    setShowAddModal]    = useState(false);
  const [editRecord,      setEditRecord]      = useState(null);
  const [detailsModal,    setDetailsModal]    = useState(null);
  const [deleteRecord,    setDeleteRecord]    = useState(null);
  const [deleting,        setDeleting]        = useState(false);
  const [searchQuery,     setSearchQuery]     = useState('');

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
      if (userRole === 'admin') records = records.filter(r => !PRIVILEGED_ROLES.includes(r.empRole));
      setAttendance(records);
    } catch (error) {
      if      (error.response?.status === 401) toast.error('Unauthorized. Please login again.');
      else if (error.response?.status === 403) toast.error('You do not have permission.');
      else                                     toast.error('Failed to load attendance data');
      setAttendance([]);
    } finally { setLoading(false); }
  }, [fromDate, toDate, userRole]);

  useEffect(() => { fetchAttendance(); }, [fetchAttendance]);

  const handleDateRangeChange = () => {
    const from = parseDate(fromDate);
    const to   = parseDate(toDate);
    if (!from || !to) { toast.error('Invalid date format. Use dd/mm/yyyy'); return; }
    if (from > to)    { toast.error('From date cannot be after to date'); return; }
    fetchAttendance();
  };

  const canEditRecord = (record) => {
    if (isSuperAdmin) return true;
    if (userRole === 'admin') return !PRIVILEGED_ROLES.includes(record.empRole);
    return false;
  };

  const handleDeleteConfirm = async () => {
    if (!deleteRecord?._id) return;
    setDeleting(true);
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`/api/attendance/${deleteRecord._id}`, { headers: { Authorization: `Bearer ${token}` } });
      toast.success('Record deleted successfully');
      setDeleteRecord(null);
      fetchAttendance();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete record');
    } finally { setDeleting(false); }
  };

  const handleExport = () => {
    if (!attendance.length) { toast.error('No attendance data to export'); return; }
    const csv = [['Date','Employee ID','Name','Department','Status','In Time','Out Time','Hours Worked','OT Amount','Total Deduction','Daily Earning','Last Modified'].join(',')];
    attendance.forEach(record => {
      csv.push([
        `"${record.dateFormatted||'--'}"`,`"${record.empNumber||'--'}"`,
        `"${(record.empName||'--').replace(/"/g,'""')}"`,`"${record.department||'--'}"`,
        `"${record.status||'--'}"`,`"${record.inTime??'--'}"`,`"${record.outTime??'--'}"`,
        `"${(record.financials?.hoursWorked?.toFixed(2))||'0.00'}"`,
        `"${(record.financials?.otAmount?.toFixed(2))||'0.00'}"`,
        `"${(record.financials?.deduction?.toFixed(2))||'0.00'}"`,
        `"${(record.financials?.finalDayEarning?.toFixed(2))||'0.00'}"`,
        `"${record.lastModified||'--'}"`,
      ].join(','));
    });
    const blob = new Blob([csv.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url  = window.URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `attendance-${fromDate}-to-${toDate}.csv`; a.click();
    window.URL.revokeObjectURL(url);
    toast.success('Attendance exported');
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

  const filtered = filterRecords(attendance, searchQuery);

  return (
    <div>
      <div className="flex gap-2 flex-wrap mb-6">
        {isAdmin && (
          <>
            <button onClick={() => setShowAddModal(true)} disabled={loading}
              className="flex items-center gap-2 px-3 md:px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:opacity-50 text-sm">
              <Plus size={18} /><span className="hidden sm:inline">Add Record</span>
            </button>
            <button onClick={() => setShowImportModal(true)} disabled={loading || refreshing}
              className="flex items-center gap-2 px-3 md:px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50 text-sm">
              <Download size={18} /><span className="hidden sm:inline">Import CSV</span>
            </button>
          </>
        )}
        <button onClick={handleExport} disabled={loading || !attendance.length}
          className="flex items-center gap-2 px-3 md:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 text-sm">
          <Upload size={18} /><span className="hidden sm:inline">Export</span>
        </button>
        <button onClick={() => { setRefreshing(true); fetchAttendance().finally(() => setRefreshing(false)); }}
          disabled={loading || refreshing}
          className="flex items-center gap-2 px-3 md:px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition disabled:opacity-50 text-sm">
          <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="bg-white rounded-lg shadow p-4 md:p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 md:gap-4">
          <div><DateNavigator value={fromDate} onChange={setFromDate} label="From Date (dd/mm/yyyy)" /></div>
          <div><DateNavigator value={toDate}   onChange={setToDate}   label="To Date (dd/mm/yyyy)" /></div>
          <div className="flex items-end">
            <button onClick={handleDateRangeChange} disabled={loading}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 text-sm font-medium">
              {loading ? 'Loading...' : 'Apply'}
            </button>
          </div>
          <div className="flex items-end md:col-span-2">
            <div className="w-full text-xs text-gray-600 p-2 bg-gray-50 rounded">
              Total: {attendance.length}{searchQuery && ` · Showing: ${filtered.length}`}
            </div>
          </div>
        </div>
      </div>

      <div className="mb-4">
        <SearchBar value={searchQuery} onChange={setSearchQuery}
          placeholder="Search by name, employee ID, department, status, or date..." />
      </div>

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
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Date</th>
                    <th className="px-4 py-3 text-left font-semibold">Emp #</th>
                    <th className="px-4 py-3 text-left font-semibold">Name</th>
                    <th className="px-4 py-3 text-left font-semibold">Department</th>
                    <th className="px-4 py-3 text-left font-semibold">Status</th>
                    <th className="px-4 py-3 text-center font-semibold">In</th>
                    <th className="px-4 py-3 text-center font-semibold">Out</th>
                    {!isHybrid && <th className="px-4 py-3 text-right font-semibold">Hours</th>}
                    {!isHybrid && <th className="px-4 py-3 text-right font-semibold">OT</th>}
                    {!isHybrid && <th className="px-4 py-3 text-right font-semibold">Deduction</th>}
                    {!isHybrid && <th className="px-4 py-3 text-right font-semibold">Earning</th>}
                    <th className="px-4 py-3 text-left font-semibold">Modified</th>
                    {isAdmin && <th className="px-4 py-3 text-center font-semibold">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.length === 0 ? (
                    <tr><td colSpan={13} className="px-4 py-8 text-center text-gray-500 text-sm">No records match your search</td></tr>
                  ) : filtered.map((record, idx) => {
                    const editable = canEditRecord(record);
                    return (
                      <tr key={record._id || idx} className="hover:bg-gray-50">
                        <td className="px-4 py-3">{record.dateFormatted}</td>
                        <td className="px-4 py-3 font-mono text-xs">{record.empNumber}</td>
                        <td className="px-4 py-3">{record.empName}</td>
                        <td className="px-4 py-3">{record.department}</td>
                        <td className="px-4 py-3">
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(record.status)}`}>{record.status}</span>
                        </td>
                        <td className="px-4 py-3 text-center">{displayTime(record.inTime)}</td>
                        <td className="px-4 py-3 text-center">
                          {displayTime(record.outTime)}
                          {record.outNextDay && record.outTime && <span className="ml-1 text-xs text-orange-500 font-medium">(+1)</span>}
                        </td>
                        {!isHybrid && <td className="px-4 py-3 text-right">{(record.financials?.hoursWorked || 0).toFixed(2)}</td>}
                        {!isHybrid && (
                          <td className="px-4 py-3 text-right">
                            <button onClick={() => setDetailsModal({ type: 'ot', record })}
                              className="inline-flex items-center gap-1 text-blue-700 hover:text-blue-900">
                              PKR {(record.financials?.otAmount || 0).toFixed(2)} <Eye size={12} />
                            </button>
                          </td>
                        )}
                        {!isHybrid && (
                          <td className="px-4 py-3 text-right">
                            <button onClick={() => setDetailsModal({ type: 'deduction', record })}
                              className="inline-flex items-center gap-1 text-red-700 hover:text-red-900">
                              PKR {(record.financials?.deduction || 0).toFixed(2)} <Eye size={12} />
                            </button>
                          </td>
                        )}
                        {!isHybrid && <td className="px-4 py-3 text-right font-semibold">PKR {(record.financials?.finalDayEarning || 0).toFixed(2)}</td>}
                        <td className="px-4 py-3 text-xs text-gray-600">{record.lastModified || '--'}</td>
                        {isAdmin && (
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button onClick={() => editable && setEditRecord(record)} disabled={!editable}
                                className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg transition ${editable ? 'text-indigo-700 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100' : 'text-gray-400 bg-gray-50 border border-gray-200 opacity-50 cursor-not-allowed'}`}>
                                <Pencil size={13} /> Edit
                              </button>
                              <button onClick={() => editable && setDeleteRecord(record)} disabled={!editable}
                                className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg transition ${editable ? 'text-red-700 bg-red-50 border border-red-200 hover:bg-red-100' : 'text-gray-400 bg-gray-50 border border-gray-200 opacity-50 cursor-not-allowed'}`}>
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="md:hidden space-y-3 p-4">
              {filtered.length === 0 ? (
                <p className="text-center text-sm text-gray-500 py-6">No records match your search</p>
              ) : filtered.map((record, idx) => {
                const editable = canEditRecord(record);
                return (
                  <div key={record._id || idx} className="border rounded-lg p-4 bg-gray-50">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-semibold text-gray-900">{record.empName}</p>
                        <p className="text-xs text-gray-600">#{record.empNumber}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${getStatusColor(record.status)}`}>{record.status}</span>
                        {isAdmin && (
                          <>
                            <button onClick={() => editable && setEditRecord(record)} disabled={!editable}
                              className={`p-1.5 rounded-lg border ${editable ? 'text-indigo-600 bg-indigo-50 border-indigo-200' : 'text-gray-300 bg-gray-50 border-gray-200 opacity-50 cursor-not-allowed'}`}>
                              <Pencil size={13} />
                            </button>
                            <button onClick={() => editable && setDeleteRecord(record)} disabled={!editable}
                              className={`p-1.5 rounded-lg border ${editable ? 'text-red-600 bg-red-50 border-red-200' : 'text-gray-300 bg-gray-50 border-gray-200 opacity-50 cursor-not-allowed'}`}>
                              <Trash2 size={13} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="space-y-1 text-sm">
                      <p><span className="font-medium">Date:</span> {record.dateFormatted}</p>
                      <p><span className="font-medium">Dept:</span> {record.department}</p>
                      <p>
                        <span className="font-medium">In/Out:</span> {displayTime(record.inTime)} — {displayTime(record.outTime)}
                        {record.outNextDay && record.outTime && <span className="ml-1 text-xs text-orange-500">(+1 day)</span>}
                      </p>
                      {!isHybrid && <p><span className="font-medium">Earning:</span> PKR {(record.financials?.finalDayEarning || 0).toFixed(2)}</p>}
                      <p className="text-xs text-gray-500"><span className="font-medium">Modified:</span> {record.lastModified || '--'}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {showImportModal && (
        <CSVImportModal onClose={() => setShowImportModal(false)}
          onSuccess={() => { setRefreshing(true); setTimeout(() => { fetchAttendance(); setRefreshing(false); }, 1500); }} />
      )}
      {showAddModal  && <AttendanceFormModal mode="add"  currentUserRole={userRole} onClose={() => setShowAddModal(false)}  onSuccess={fetchAttendance} />}
      {editRecord    && <AttendanceFormModal mode="edit" record={editRecord} currentUserRole={userRole} onClose={() => setEditRecord(null)} onSuccess={fetchAttendance} />}
      {deleteRecord  && <DeleteConfirmModal  record={deleteRecord} onClose={() => setDeleteRecord(null)} onConfirm={handleDeleteConfirm} deleting={deleting} />}

      {detailsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-3 border-b">
              <h3 className="font-semibold text-gray-800">
                {detailsModal.type === 'ot' ? 'OT Details' : 'Deduction Details'} — {detailsModal.record.empName}
              </h3>
              <button onClick={() => setDetailsModal(null)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <div className="p-4 space-y-2 max-h-80 overflow-auto">
              {(() => {
                const entries = detailsModal.type === 'ot'
                  ? detailsModal.record.financials?.otDetails
                  : detailsModal.record.financials?.deductionDetails;
                if (!entries?.length) return <p className="text-sm text-gray-500">No detail entries found.</p>;
                return entries.map((entry, i) => (
                  <div key={i} className="border rounded-lg p-2 text-sm bg-gray-50">
                    {detailsModal.type === 'ot'
                      ? <p>{entry.type === 'manual' ? `Amount: PKR ${entry.amount}` : `Hours: ${entry.hours} × ${entry.rate}x`} · {entry.reason}</p>
                      : <p>Amount: PKR {entry.amount} · {entry.reason}</p>
                    }
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

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function ManualAttendance() {
  const [activeTab, setActiveTab] = useState('manage');
  const userRole     = getCurrentUserRole();
  const isSuperAdmin = userRole === 'superadmin';
  const isAdmin      = userRole === 'admin' || isSuperAdmin;
  const isHybrid     = userRole === 'hybrid';
  const tabProps     = { userRole, isSuperAdmin, isAdmin, isHybrid };

  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Manual Attendance</h1>
      </div>
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-lg w-fit">
        <button onClick={() => setActiveTab('manage')}
          className={`px-5 py-2 rounded-md text-sm font-medium transition ${activeTab === 'manage' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}>
          Manage
        </button>
        <button onClick={() => setActiveTab('mark')}
          className={`px-5 py-2 rounded-md text-sm font-medium transition ${activeTab === 'mark' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}>
          Mark
        </button>
      </div>
      {activeTab === 'manage' ? <ViewTab {...tabProps} /> : <MarkTab {...tabProps} />}
    </div>
  );
}