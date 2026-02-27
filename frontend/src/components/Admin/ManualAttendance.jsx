import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import {
  Plus, Download, Upload, AlertCircle, RefreshCw, X, Save, Pencil, Calendar, Eye
} from 'lucide-react';
import toast from 'react-hot-toast';
import CSVImportModal from './CSVImportModal.jsx';
import { getDateMinusDays, getTodayDate, parseDate } from '../../utils/dateFormatter.js';

// ─── Attendance Form Modal (Add & Edit) ──────────────────────────────────────
function AttendanceFormModal({ mode = 'add', record = null, onClose, onSuccess }) {
  const isEdit = mode === 'edit';
  const dateInputRef = useRef(null);
  const hiddenDateRef = useRef(null);

  const [form, setForm] = useState({
    empId:         isEdit ? record?.empId?._id || record?.empId || '' : '',
    date:          isEdit ? record?.dateFormatted || '' : getTodayDate(),
    status:        isEdit ? record?.status || 'Present' : 'Present',
    inTime:        isEdit ? record?.inTime !== '--' ? record?.inTime : '' : '',
    outTime:       isEdit ? record?.outTime !== '--' ? record?.outTime : '' : '',
    otHours:       isEdit ? record?.financials?.otHours || 0 : 0,
    otMultiplier:  isEdit ? record?.financials?.otMultiplier || 1 : 1,
    deduction:     isEdit ? record?.financials?.deduction || 0 : 0,
  });

  const [employees, setEmployees] = useState([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [saving, setSaving] = useState(false);

  // Fetch employees for the dropdown (only needed in Add mode)
  useEffect(() => {
    if (!isEdit) {
      setLoadingEmployees(true);
      const token = localStorage.getItem('token');
      axios.get('/api/employees?status=Active', {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(res => {
          const list = res.data?.employees || res.data || [];
          setEmployees(list);
        })
        .catch(() => toast.error('Failed to load employees'))
        .finally(() => setLoadingEmployees(false));
    }
  }, [isEdit]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleHiddenDateChange = (e) => {
    const val = e.target.value; // yyyy-mm-dd
    if (!val) return;
    const [y, m, d] = val.split('-');
    const formatted = `${d}/${m}/${y}`;
    setForm(prev => ({ ...prev, date: formatted }));
  };

  const handleCalendarClick = () => {
    if (hiddenDateRef.current) {
      try {
        hiddenDateRef.current.showPicker();
      } catch (err) {
        hiddenDateRef.current.focus();
      }
    }
  };

  const handleSubmit = async () => {
    // Basic validation
    if (!isEdit && !form.empId) {
      toast.error('Please select an employee');
      return;
    }
    if (!form.date) {
      toast.error('Please enter a date');
      return;
    }
    if (!form.status) {
      toast.error('Please select a status');
      return;
    }

    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const payload = {
        empId:         isEdit ? (record?.empId?._id || record?.empId) : form.empId,
        date:          form.date,
        status:        form.status,
        inTime:        form.inTime || null,
        outTime:       form.outTime || null,
        otHours:       parseFloat(form.otHours) || 0,
        otMultiplier:  parseFloat(form.otMultiplier) || 1,
        deduction:     parseFloat(form.deduction) || 0,
      };

      await axios.post('/api/attendance/save-row', payload, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      toast.success(isEdit ? 'Attendance updated successfully' : 'Attendance added successfully');
      onSuccess();
      onClose();
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to save attendance';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  // Determine which fields to show based on status
  const showTimes = ['Present', 'Late'].includes(form.status);
  const showOT    = showTimes;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-bold text-gray-800">
            {isEdit ? 'Edit Attendance Record' : 'Add Attendance Record'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">

          {/* Employee — only in Add mode */}
          {!isEdit && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Employee *</label>
              {loadingEmployees ? (
                <p className="text-sm text-gray-400">Loading employees...</p>
              ) : (
                <select
                  name="empId"
                  value={form.empId}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
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

          {/* Employee info display — Edit mode */}
          {isEdit && (
            <div className="bg-blue-50 rounded-lg px-4 py-3">
              <p className="text-sm font-semibold text-blue-800">{record?.empName}</p>
              <p className="text-xs text-blue-600">ID: {record?.empNumber} · {record?.department}</p>
            </div>
          )}

          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date * (dd/mm/yyyy)</label>
            <div className="relative">
              <input
                ref={dateInputRef}
                type="text"
                name="date"
                value={form.date}
                onChange={handleChange}
                placeholder="dd/mm/yyyy"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <input 
                type="date"
                ref={hiddenDateRef}
                className="absolute opacity-0 pointer-events-none"
                onChange={handleHiddenDateChange}
              />
              <button 
                type="button"
                onClick={handleCalendarClick}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-blue-500"
              >
                <Calendar size={16} />
              </button>
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status *</label>
            <select
              name="status"
              value={form.status}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="Present">Present</option>
              <option value="Late">Late</option>
              <option value="Absent">Absent</option>
              <option value="Leave">Leave</option>
            </select>
          </div>

          {/* In / Out Times */}
          {showTimes && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">In Time (HH:mm)</label>
                <input
                  type="text"
                  name="inTime"
                  value={form.inTime}
                  onChange={handleChange}
                  placeholder="09:00"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Out Time (HH:mm)</label>
                <input
                  type="text"
                  name="outTime"
                  value={form.outTime}
                  onChange={handleChange}
                  placeholder="17:00"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}

          {/* OT & Deduction */}
          {showOT && (
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">OT Hours</label>
                <input
                  type="number"
                  name="otHours"
                  value={form.otHours}
                  onChange={handleChange}
                  min="0"
                  step="0.5"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">OT Multiplier</label>
                <input
                  type="number"
                  name="otMultiplier"
                  value={form.otMultiplier}
                  onChange={handleChange}
                  min="1"
                  step="0.5"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Deduction (PKR)</label>
                <input
                  type="number"
                  name="deduction"
                  value={form.deduction}
                  onChange={handleChange}
                  min="0"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
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
  const [attendance, setAttendance]       = useState([]);
  const [loading, setLoading]             = useState(false);
  const [fromDate, setFromDate]           = useState(getDateMinusDays(30));
  const [toDate, setToDate]               = useState(getTodayDate());
  const [showImportModal, setShowImportModal] = useState(false);
  const [refreshing, setRefreshing]       = useState(false);
  const [isMobile, setIsMobile]           = useState(window.innerWidth < 768);

  const hiddenFromDateRef = useRef(null);
  const hiddenToDateRef = useRef(null);

  // Modal state
  const [showAddModal, setShowAddModal]   = useState(false);
  const [editRecord, setEditRecord]       = useState(null); // null = closed

  const userRole = localStorage.getItem('role');
  const isAdmin  = userRole === 'admin';

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const fetchAttendance = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) { toast.error('Authentication required'); return; }

      const response = await axios.get(
        `/api/attendance/range?fromDate=${fromDate}&toDate=${toDate}`,
        { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
      );

      setAttendance(response.data?.attendance || []);
    } catch (error) {
      if (error.response?.status === 401)      toast.error('Unauthorized. Please login again.');
      else if (error.response?.status === 403) toast.error('You do not have permission to access this page.');
      else                                     toast.error('Failed to load attendance data');
      setAttendance([]);
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate]);

  useEffect(() => { fetchAttendance(); }, [fetchAttendance]);

  const handleDateRangeChange = () => {
    const from = parseDate(fromDate);
    const to   = parseDate(toDate);

    if (!from || !to) {
      toast.error('Invalid date format. Use dd/mm/yyyy');
      return;
    }

    if (from > to) {
      toast.error('From date cannot be after to date');
      return;
    }

    fetchAttendance();
  };

  const handleImportSuccess = () => {
    setRefreshing(true);
    setTimeout(() => {
      fetchAttendance();
      setRefreshing(false);
      toast.success('Attendance list updated');
    }, 1500);
  };

  const handleFormSuccess = () => {
    fetchAttendance();
  };

  const handleShowPicker = (ref) => {
    if (ref.current) {
      try {
        ref.current.showPicker();
      } catch (err) {
        ref.current.focus();
      }
    }
  };

  const handleHiddenDateChange = (e, setter) => {
    const val = e.target.value;
    if (!val) return;
    const [y, m, d] = val.split('-');
    setter(`${d}/${m}/${y}`);
  };

  const handleExport = () => {
    if (attendance.length === 0) { toast.error('No attendance data to export'); return; }

    const csv = [
      ['Date','Employee ID','Name','Department','Status','In Time','Out Time','Hours Worked','Daily Earning','Last Modified'].join(',')
    ];
    attendance.forEach(record => {
      csv.push([
        record.dateFormatted || '--',
        record.empNumber     || '--',
        record.empName       || '--',
        record.department    || '--',
        record.status        || '--',
        record.inTime        || '--',
        record.outTime       || '--',
        (record.financials?.hoursPerDay?.toFixed(2))    || '0.00',
        (record.financials?.finalDayEarning?.toFixed(2)) || '0.00',
        record.lastModified  || '--'
      ].map(v => `"${v}"`).join(','));
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

      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Manual Attendance</h1>

        <div className="flex gap-2 w-full md:w-auto flex-wrap">
          {isAdmin && (
            <>
              {/* Add Record */}
              <button
                onClick={() => setShowAddModal(true)}
                disabled={loading}
                className="flex items-center gap-2 px-3 md:px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:opacity-50 text-sm md:text-base"
                title="Add attendance record manually"
              >
                <Plus size={18} />
                <span className="hidden sm:inline">Add Record</span>
              </button>

              {/* Import CSV */}
              <button
                onClick={() => setShowImportModal(true)}
                disabled={loading || refreshing}
                className="flex items-center gap-2 px-3 md:px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50 text-sm md:text-base"
                title="Import CSV file"
              >
                <Upload size={18} />
                <span className="hidden sm:inline">Import CSV</span>
              </button>
            </>
          )}

          {/* Export */}
          <button
            onClick={handleExport}
            disabled={loading || attendance.length === 0}
            className="flex items-center gap-2 px-3 md:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 text-sm md:text-base"
            title="Export attendance"
          >
            <Download size={18} />
            <span className="hidden sm:inline">Export</span>
          </button>

          {/* Refresh */}
          <button
            onClick={() => { setRefreshing(true); fetchAttendance().then(() => setRefreshing(false)); }}
            disabled={loading || refreshing}
            className="flex items-center gap-2 px-3 md:px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition disabled:opacity-50 text-sm md:text-base"
            title="Refresh data"
          >
            <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* ── Date Range Filter ── */}
      <div className="bg-white rounded-lg shadow p-4 md:p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 md:gap-4">
          <div>
            <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1 md:mb-2">
              From Date (dd/mm/yyyy)
            </label>
            <div className="relative">
              <input
                type="text"
                value={fromDate}
                onChange={e => setFromDate(e.target.value)}
                placeholder="dd/mm/yyyy"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
              />
              <input 
                type="date"
                ref={hiddenFromDateRef}
                className="absolute opacity-0 pointer-events-none"
                onChange={(e) => handleHiddenDateChange(e, setFromDate)}
              />
              <button 
                type="button"
                onClick={() => handleShowPicker(hiddenFromDateRef)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-blue-500"
              >
                <Calendar size={14} />
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1 md:mb-2">
              To Date (dd/mm/yyyy)
            </label>
            <div className="relative">
              <input
                type="text"
                value={toDate}
                onChange={e => setToDate(e.target.value)}
                placeholder="dd/mm/yyyy"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
              />
              <input 
                type="date"
                ref={hiddenToDateRef}
                className="absolute opacity-0 pointer-events-none"
                onChange={(e) => handleHiddenDateChange(e, setToDate)}
              />
              <button 
                type="button"
                onClick={() => handleShowPicker(hiddenToDateRef)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-blue-500"
              >
                <Calendar size={14} />
              </button>
            </div>
          </div>
          <div className="flex items-end">
            <button
              onClick={handleDateRangeChange}
              disabled={loading}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 text-sm font-medium"
            >
              {loading ? 'Loading...' : 'Apply'}
            </button>
          </div>
          <div className="flex items-end md:col-span-2">
            <div className="w-full text-xs text-gray-600 p-2 bg-gray-50 rounded">
              Total Records: {attendance.length}
            </div>
          </div>
        </div>
      </div>

      {/* ── Attendance Table ── */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading && !attendance.length ? (
          <div className="p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
            <p className="text-gray-600 font-medium">Loading attendance data...</p>
          </div>
        ) : attendance.length === 0 ? (
          <div className="p-12 text-center text-gray-600">
            <AlertCircle className="mx-auto mb-4 text-gray-400" size={48} />
            <p>No attendance records found for selected date range</p>
          </div>
        ) : (
          <>
            {/* Desktop View */}
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
                    <th className="px-4 py-3 text-right font-semibold">Earning</th>
                    <th className="px-4 py-3 text-left font-semibold">Last Modified</th>
                    {isAdmin && <th className="px-4 py-3 text-center font-semibold">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {attendance.map((record, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-4 py-3">{record.dateFormatted}</td>
                      <td className="px-4 py-3 font-medium">{record.empNumber}</td>
                      <td className="px-4 py-3">{record.empName}</td>
                      <td className="px-4 py-3">{record.department}</td>
                      <td className="px-4 py-3">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(record.status)}`}>
                          {record.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">{record.inTime}</td>
                      <td className="px-4 py-3 text-center">{record.outTime}</td>
                      <td className="px-4 py-3 text-right">{(record.financials?.hoursPerDay || 0).toFixed(2)}</td>
                      <td className="px-4 py-3 text-right font-semibold">
                        PKR {(record.financials?.finalDayEarning || 0).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600">{record.lastModified}</td>
                      {isAdmin && (
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => setEditRecord(record)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition"
                            title="Edit record"
                          >
                            <Pencil size={13} />
                            Edit
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile View */}
            <div className="md:hidden space-y-3 p-4">
              {attendance.map((record, idx) => (
                <div key={idx} className="border rounded-lg p-4 bg-gray-50">
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
                          onClick={() => setEditRecord(record)}
                          className="p-1.5 text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition"
                          title="Edit record"
                        >
                          <Pencil size={13} />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1 text-sm">
                    <p><span className="font-medium">Date:</span> {record.dateFormatted}</p>
                    <p><span className="font-medium">Dept:</span> {record.department}</p>
                    <p><span className="font-medium">In/Out:</span> {record.inTime} - {record.outTime}</p>
                    <p><span className="font-medium">Hours:</span> {(record.financials?.hoursPerDay || 0).toFixed(2)}</p>
                    <p><span className="font-medium">Earning:</span> PKR {(record.financials?.finalDayEarning || 0).toFixed(2)}</p>
                    <p className="text-xs text-gray-500">
                      <span className="font-medium">Modified:</span> {record.lastModified}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── Modals ── */}
      {showImportModal && (
        <CSVImportModal
          onClose={() => setShowImportModal(false)}
          onSuccess={handleImportSuccess}
        />
      )}

      {showAddModal && (
        <AttendanceFormModal
          mode="add"
          onClose={() => setShowAddModal(false)}
          onSuccess={handleFormSuccess}
        />
      )}

      {editRecord && (
        <AttendanceFormModal
          mode="edit"
          record={editRecord}
          onClose={() => setEditRecord(null)}
          onSuccess={handleFormSuccess}
        />
      )}
    </div>
  );
}