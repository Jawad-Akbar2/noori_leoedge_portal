// Employee/AttendanceHistory.jsx

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { MoreVertical, Calendar, Eye, X } from 'lucide-react';
import toast from 'react-hot-toast';

// ── date helpers ──────────────────────────────────────────────────────────────

/** JS Date → "dd/mm/yyyy"  (what /api/payroll/my/summary expects) */
const toApiDate = (isoStr) => {
  if (!isoStr) return '';
  const [y, m, d] = isoStr.split('-');
  return `${d}/${m}/${y}`;
};

/** "YYYY-MM-DD" → "dd/mm/yyyy"  (display only) */
const isoToDisplay = (isoStr) => {
  if (!isoStr) return '';
  const [y, m, d] = isoStr.split('-');
  return `${d}/${m}/${y}`;
};

/** Default pay-period start: 18th of current (or previous) month */
const defaultFromDate = () => {
  const now   = new Date();
  const day   = now.getDate();
  const year  = now.getFullYear();
  const month = now.getMonth();
  const start = day >= 18
    ? new Date(year, month,     18)
    : new Date(year, month - 1, 18);
  return start.toISOString().split('T')[0];
};

// ─────────────────────────────────────────────────────────────────────────────

const STATUS_FILTERS = [
  { key: 'Present', label: 'Present', on: 'bg-green-100 text-green-700',  off: 'bg-gray-100 text-gray-500' },
  { key: 'Late',    label: 'Late',    on: 'bg-yellow-100 text-yellow-700', off: 'bg-gray-100 text-gray-500' },
  { key: 'Leave',   label: 'Leave',   on: 'bg-blue-100 text-blue-700',     off: 'bg-gray-100 text-gray-500' },
  { key: 'Absent',  label: 'Absent',  on: 'bg-red-100 text-red-700',       off: 'bg-gray-100 text-gray-500' },
  { key: 'OT',      label: 'Has OT',  on: 'bg-purple-100 text-purple-700', off: 'bg-gray-100 text-gray-500' },
];

const statusBadge = (status) => {
  const map = {
    Present: 'bg-green-100 text-green-800',
    Late:    'bg-yellow-100 text-yellow-800',
    Leave:   'bg-blue-100 text-blue-800',
    Absent:  'bg-gray-100 text-gray-700',
  };
  return map[status] ?? 'bg-gray-100 text-gray-700';
};

// ─────────────────────────────────────────────────────────────────────────────

export default function AttendanceHistory() {
  const navigate     = useNavigate();
  const fromDateRef  = useRef(null);
  const toDateRef    = useRef(null);
  const menuRef      = useRef(null);

  const [fromDate, setFromDate] = useState(defaultFromDate);
  const [toDate,   setToDate]   = useState(() => new Date().toISOString().split('T')[0]);

  // Which status chips are active (all on by default)
  const [activeFilters, setActiveFilters] = useState(
    () => Object.fromEntries(STATUS_FILTERS.map(f => [f.key, true]))
  );

  const [allRecords,      setAllRecords]      = useState([]);
  const [filteredRecords, setFilteredRecords] = useState([]);
  const [loading,         setLoading]         = useState(false);
  const [openMenuId,      setOpenMenuId]      = useState(null);
  const [detailsModal,    setDetailsModal]    = useState(null);

  // ── close context menu on outside click ──────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── fetch ────────────────────────────────────────────────────────────────
  // FIX 1: use /api/payroll/my/summary (employeeAuth, auto-scoped to logged-in user)
  //         instead of /api/attendance/range (adminAuth)
  const fetchAttendance = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');

      const response = await axios.get('/api/payroll/my/summary', {
        params: {
          // FIX 2: correct param names for this route
          startDate: toApiDate(fromDate),
          endDate:   toApiDate(toDate),
        },
        headers: { Authorization: `Bearer ${token}` },
      });

      // dailyBreakdown already contains every day in the range (present + absent)
      // sorted ascending, with date already formatted as "dd/mm/yyyy" by the API
      const breakdown = response.data.dailyBreakdown ?? [];
      setAllRecords(breakdown);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to fetch attendance');
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate]);

  useEffect(() => { fetchAttendance(); }, [fetchAttendance]);

  // ── apply filters ─────────────────────────────────────────────────────────
  useEffect(() => {
    const filtered = allRecords.filter((r) => {
      const status = r.status;
      // OT filter: show/hide rows that have any OT hours
      if (!activeFilters.OT && (r.otHours ?? 0) > 0) return false;
      // Status filters
      if (status && !activeFilters[status] && status !== undefined) return false;
      return true;
    });
    setFilteredRecords(filtered);
  }, [allRecords, activeFilters]);

  const toggleFilter = (key) =>
    setActiveFilters((prev) => ({ ...prev, [key]: !prev[key] }));

  // FIX 5: use navigate instead of window.location.href
  const goToRequest = (type, date) => {
    localStorage.setItem('selectedDate', date);
    navigate(`/employee/requests?type=${type}`);
  };

  // ─────────────────────────────────────────────────────────────────────────

  const EmptyState = () => (
    <div className="py-16 text-center text-gray-400">
      <Calendar size={40} className="mx-auto mb-3 opacity-40" />
      <p className="font-medium">No records found</p>
      <p className="text-sm mt-1">Try adjusting the date range or filters</p>
    </div>
  );

  return (
    <div className="p-4 md:p-6 bg-gray-50 min-h-screen">
      <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-6">Attendance History</h1>

      {/* ── Filter panel ── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 md:p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">

          {/* From date */}
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
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

          {/* To date */}
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
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

          {/* Show list button */}
          <div className="flex items-end">
            <button
              onClick={fetchAttendance}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
            >
              Show List
            </button>
          </div>
        </div>

        {/* FIX 6: all filter chips now rendered (late + OT were invisible before) */}
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => toggleFilter(f.key)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition ${
                activeFilters[f.key] ? f.on : f.off
              }`}
            >
              {activeFilters[f.key] ? null : <span className="mr-1 opacity-60">✕</span>}
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Table ── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden" ref={menuRef}>
        {loading ? (
          <div className="py-16 text-center text-gray-400">Loading…</div>
        ) : filteredRecords.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            {/* Desktop */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b text-gray-600">
                  <tr>
                    <th className="px-5 py-3 text-left font-semibold">Date</th>
                    <th className="px-5 py-3 text-left font-semibold">In / Out</th>
                    <th className="px-5 py-3 text-left font-semibold">Status</th>
                    <th className="px-5 py-3 text-left font-semibold">OT</th>
<th className="px-5 py-3 text-left font-semibold">Deduction</th>
<th className="px-5 py-3 text-left font-semibold">Day Earning</th>
                    {/* FIX 3: finalDayEarning (not dailyEarning) */}
                    <th className="px-5 py-3 text-left font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredRecords.map((record, idx) => (
                    <tr key={record.dateRaw ?? idx} className="hover:bg-gray-50">
                      <td className="px-5 py-3 font-medium text-gray-800">
                        {/* date is already "dd/mm/yyyy" from the API */}
                        {record.date}
                      </td>
                      <td className="px-5 py-3 text-gray-600">
                        {record.inTime && record.outTime
                          ? `${record.inTime} / ${record.outTime}`
                          : <span className="text-gray-400">— / —</span>}
                      </td>
                      <td className="px-5 py-3">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${statusBadge(record.status)}`}>
                          {record.status}
                        </span>
                      </td>
                   <td className="px-5 py-3 text-green-600 font-medium">
  <button type="button" onClick={() => setDetailsModal({ type: 'ot', record })}
    className="inline-flex items-center gap-1 hover:text-green-800">
    PKR {(record.otAmount ?? 0).toLocaleString('en-PK', { minimumFractionDigits: 2 })} <Eye size={12} />
  </button>
</td>
<td className="px-5 py-3 text-red-500 font-medium">
  <button type="button" onClick={() => setDetailsModal({ type: 'deduction', record })}
    className="inline-flex items-center gap-1 hover:text-red-700">
    PKR {(record.deduction ?? 0).toLocaleString('en-PK', { minimumFractionDigits: 2 })} <Eye size={12} />
  </button>
</td>
                      <td className="px-5 py-3 font-semibold text-blue-600">
                        {/* FIX 3: finalDayEarning (not dailyEarning which doesn't exist) */}
                        PKR {(record.finalDayEarning ?? 0).toLocaleString('en-PK', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-5 py-3 relative">
                        <button
                          onClick={() =>
                            setOpenMenuId(openMenuId === idx ? null : idx)
                          }
                          className="p-1 text-gray-400 hover:text-gray-600 rounded"
                        >
                          <MoreVertical size={16} />
                        </button>
                        {openMenuId === idx && (
                          <div className="absolute right-4 top-10 w-44 bg-white rounded-lg shadow-lg z-40 border border-gray-200">
                            <button
                              onClick={() => { goToRequest('leave', record.date); setOpenMenuId(null); }}
                              className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50 border-b border-gray-100"
                            >
                              Request Leave
                            </button>
                            <button
                              onClick={() => { goToRequest('correction', record.date); setOpenMenuId(null); }}
                              className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50"
                            >
                              Request Correction
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile */}
            <div className="md:hidden divide-y divide-gray-100">
              {filteredRecords.map((record, idx) => (
                <div key={record.dateRaw ?? idx} className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-semibold text-gray-800">{record.date}</p>
                      <p className="text-sm text-gray-500 mt-0.5">
                        {record.inTime && record.outTime
                          ? `${record.inTime} → ${record.outTime}`
                          : 'No punch record'}
                      </p>
                    </div>
                    <button
                      onClick={() => setOpenMenuId(openMenuId === idx ? null : idx)}
                      className="p-1 text-gray-400"
                    >
                      <MoreVertical size={18} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${statusBadge(record.status)}`}>
                      {record.status}
                    </span>
                    <span className="font-semibold text-blue-600 text-sm">
                      PKR {(record.finalDayEarning ?? 0).toLocaleString('en-PK', { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                 <div className="flex gap-3 mt-1.5">
  {(record.otAmount ?? 0) > 0 && (
    <p className="text-xs text-green-600 font-medium">
      OT: PKR {record.otAmount.toLocaleString('en-PK', { minimumFractionDigits: 2 })}
    </p>
  )}
  {(record.deduction ?? 0) > 0 && (
    <p className="text-xs text-red-500 font-medium">
      Deduction: PKR {record.deduction.toLocaleString('en-PK', { minimumFractionDigits: 2 })}
    </p>
  )}
</div>

                  {openMenuId === idx && (
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button
                        onClick={() => { goToRequest('leave', record.date); setOpenMenuId(null); }}
                        className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm hover:bg-gray-50 text-center"
                      >
                        Request Leave
                      </button>
                      <button
                        onClick={() => { goToRequest('correction', record.date); setOpenMenuId(null); }}
                        className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm hover:bg-gray-50 text-center"
                      >
                        Correction
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
      {/* OT / Deduction detail popup */}
{detailsModal && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
      <div className="flex items-center justify-between px-5 py-3 border-b">
        <h3 className="font-semibold text-gray-800">
          {detailsModal.type === 'ot' ? 'OT Details' : 'Deduction Details'} — {detailsModal.record.date}
        </h3>
        <button onClick={() => setDetailsModal(null)} className="text-gray-400 hover:text-gray-600">
          <X size={18} />
        </button>
      </div>
      <div className="p-4 space-y-2 max-h-80 overflow-auto">
        {(() => {
          const entries = detailsModal.type === 'ot'
            ? detailsModal.record.otDetails
            : detailsModal.record.deductionDetails;
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