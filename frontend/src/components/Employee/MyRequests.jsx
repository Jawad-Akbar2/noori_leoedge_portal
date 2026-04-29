import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { AlertCircle, Calendar, ClipboardList, FileEdit } from 'lucide-react';
import LeaveRequestModal from './LeaveRequestModal';
import CorrectionRequestModal from './CorrectionRequestModal';
import toast from 'react-hot-toast';
import { useLocation } from 'react-router-dom';

// ── date helpers ──────────────────────────────────────────────────────────────

/** "YYYY-MM-DD" → "dd/mm/yyyy" for the date picker display label */
const isoToDisplay = (isoStr) => {
  if (!isoStr) return '';
  const [y, m, d] = isoStr.split('-');
  return `${d}/${m}/${y}`;
};

/**
 * Format any date value → "dd/mm/yyyy" for table cells.
 * Accepts ISO strings, Date objects, or already-formatted strings.
 * The API returns pre-formatted fields (fromDateFormatted, toDateFormatted,
 * dateFormatted) — prefer those; this is a safe fallback for raw dates.
 */
const fmt = (val) => {
  if (!val) return '—';
  // Already "dd/mm/yyyy"
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(String(val))) return val;
  const d = new Date(val);
  if (isNaN(d)) return String(val);
  return [
    String(d.getDate()).padStart(2, '0'),
    String(d.getMonth() + 1).padStart(2, '0'),
    d.getFullYear(),
  ].join('/');
};

// ── leave eligibility (computed client-side from stored user) ─────────────────
// FIX 1 & 5: removed the /api/employees/:id call (adminAuth → 403).
// The backend already enforces the 90-day rule on submit (routes/requests.js).
// We compute it locally from joiningDate stored in the JWT payload / localStorage.
// validate-token is called once on app load and stores the user object.
const computeEligibility = (user) => {
  if (!user?.joiningDate) return { eligible: true, daysLeft: 0 }; // can't determine → allow UI, backend will gate
  const days = Math.floor((Date.now() - new Date(user.joiningDate)) / 86_400_000);
  return { eligible: days >= 90, daysLeft: Math.max(0, 90 - days) };
};

// ─────────────────────────────────────────────────────────────────────────────

const STATUS_OPTIONS = ['All', 'Pending', 'Approved', 'Rejected'];
const TYPE_OPTIONS   = ['All', 'Leave', 'Correction'];

const statusBadge = (s) =>
  s === 'Pending'  ? 'bg-yellow-100 text-yellow-800' :
  s === 'Approved' ? 'bg-green-100 text-green-800'   :
                     'bg-red-100 text-red-800';

const typeBadge = (t) =>
  t === 'Leave' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800';

// ─────────────────────────────────────────────────────────────────────────────

export default function MyRequests() {
  const fromDateRef = useRef(null);
  const toDateRef   = useRef(null);
  const location = useLocation();

  // ── stored user (joiningDate lives here after validate-token on app load) ──
  const [user] = useState(() => {
    try { return JSON.parse(localStorage.getItem('user')) ?? {}; }
    catch { return {}; }
  });

  const { eligible: leaveEligible, daysLeft: daysUntilEligible } =
    computeEligibility(user);

  // ── filter state ──────────────────────────────────────────────────────────
  const [fromDate,     setFromDate]     = useState(
    () => new Date(Date.now() - 45 * 86_400_000).toISOString().split('T')[0]
  );
  const [toDate,       setToDate]       = useState(
    () => new Date().toISOString().split('T')[0]
  );
  const [statusFilter, setStatusFilter] = useState('All');
  const [typeFilter,   setTypeFilter]   = useState('All');
  const [searchTerm,   setSearchTerm]   = useState('');

  // ── data state ────────────────────────────────────────────────────────────
  const [requests, setRequests] = useState([]);
  const [loading,  setLoading]  = useState(false);

  // ── modal state ───────────────────────────────────────────────────────────
  const [showLeaveModal,      setShowLeaveModal]      = useState(false);
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  const [correctionInitialDate, setCorrectionInitialDate] = useState('');

  useEffect(() => {
  const params = new URLSearchParams(location.search);
  const type = params.get('type');
  const date = params.get('date'); // "dd/mm/yyyy"

  if (type === 'correction') {
    setCorrectionInitialDate(date || '');
    setShowCorrectionModal(true);
  } else if (type === 'leave') {
  if (!leaveEligible) {
    toast.error(`Leave available after ${daysUntilEligible} more day(s)`);
  } else {
    setCorrectionInitialDate(date || ''); // reuse same state OR create separate
    setShowLeaveModal(true);
  }
}
}, [location.search]); // only on query string change

  // ── fetch ─────────────────────────────────────────────────────────────────
  // FIX 4: single fetch function used by both the useEffect and the Refresh button.
  // useEffect only runs on filter changes; no duplicate call on mount.
  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');

      const response = await axios.get('/api/requests/my-requests', {
        params: {
          fromDate: fromDate,   // route accepts YYYY-MM-DD via new Date() fallback
          toDate:   toDate,
          status:   statusFilter !== 'All' ? statusFilter : undefined,
          type:     typeFilter   !== 'All' ? typeFilter.toLowerCase() : undefined,
        },
        headers: { Authorization: `Bearer ${token}` },
      });

      // FIX 3: use pre-formatted date fields returned by the API
      const leaves = (response.data.leaveRequests ?? []).map(r => ({
        ...r,
        type:          'Leave',
        displayDate:   r.fromDateFormatted ?? fmt(r.fromDate),   // "dd/mm/yyyy"
        displayPeriod: `${r.fromDateFormatted ?? fmt(r.fromDate)} → ${r.toDateFormatted ?? fmt(r.toDate)}`,
      }));

      const corrections = (response.data.correctionRequests ?? []).map(r => ({
        ...r,
        type:          'Correction',
        displayDate:   r.dateFormatted ?? fmt(r.date),
        displayPeriod: `${r.correctedInTime ?? '—'} → ${r.correctedOutTime ?? '—'}`,
      }));

      const combined = [...leaves, ...corrections].sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
      );

      setRequests(combined);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to fetch requests');
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, statusFilter, typeFilter]);

  // FIX 4: single effect, no manual call at mount that would double-fetch
  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  const handleRequestSubmitted = () => fetchRequests();

  // ── client-side search (reason or type) ──────────────────────────────────
  const filtered = requests.filter(r =>
    r.reason?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.type?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // ── leave button click ────────────────────────────────────────────────────
  const onLeaveClick = () => {
    if (!leaveEligible) {
      toast.error(`Leave available after ${daysUntilEligible} more day(s) of service`);
      return;
    }
    setShowLeaveModal(true);
  };

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 md:p-6 bg-gray-50 min-h-screen">
      <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-6">My Requests</h1>

      {/* ── Action cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">

        {/* Leave */}
        <div
          onClick={onLeaveClick}
          className={`bg-white rounded-xl shadow-sm border-2 p-6 transition ${
            leaveEligible
              ? 'border-transparent hover:border-blue-500 hover:shadow-md cursor-pointer'
              : 'border-transparent opacity-60 cursor-not-allowed'
          }`}
        >
          <div className="flex items-start gap-4">
            <div className="p-2.5 bg-blue-50 rounded-lg">
              <ClipboardList size={20} className="text-blue-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-800 mb-1">Apply for Leave</h3>
              <p className="text-sm text-gray-500">Submit a holiday, sick, or casual leave request</p>
              {!leaveEligible && (
                <div className="mt-3 p-2.5 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-xs text-yellow-800 font-semibold">⚠ Not eligible yet</p>
                  <p className="text-xs text-yellow-700 mt-0.5">
                    Available in {daysUntilEligible} more day(s)
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Correction */}
        <div
          onClick={() => setShowCorrectionModal(true)}
          className="bg-white rounded-xl shadow-sm border-2 border-transparent hover:border-purple-500 hover:shadow-md p-6 transition cursor-pointer"
        >
          <div className="flex items-start gap-4">
            <div className="p-2.5 bg-purple-50 rounded-lg">
              <FileEdit size={20} className="text-purple-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-800 mb-1">Request Correction</h3>
              <p className="text-sm text-gray-500">Correct your check-in or check-out times</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 md:p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">

          {/* From date */}
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
            <div
              onClick={() => fromDateRef.current?.showPicker()}
              className="flex items-center justify-between px-4 py-2 border border-gray-300 rounded-lg cursor-pointer hover:border-blue-400 transition bg-white"
            >
              <span className="text-gray-800 text-sm">{isoToDisplay(fromDate)}</span>
              <Calendar size={15} className="text-gray-400" />
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
              className="flex items-center justify-between px-4 py-2 border border-gray-300 rounded-lg cursor-pointer hover:border-blue-400 transition bg-white"
            >
              <span className="text-gray-800 text-sm">{isoToDisplay(toDate)}</span>
              <Calendar size={15} className="text-gray-400" />
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

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              {STATUS_OPTIONS.map(o => <option key={o}>{o}</option>)}
            </select>
          </div>

          {/* Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              {TYPE_OPTIONS.map(o => <option key={o}>{o}</option>)}
            </select>
          </div>

          {/* Refresh */}
          <div className="flex items-end">
            <button
              onClick={fetchRequests}
              disabled={loading}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium disabled:opacity-50"
            >
              {loading ? 'Loading…' : 'Refresh'}
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="mt-4">
          <input
            type="text"
            placeholder="Search by reason or type…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>
      </div>

      {/* ── Table ── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-gray-400">Loading requests…</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-gray-400">
            <AlertCircle size={40} className="mx-auto mb-3 opacity-40" />
            <p className="font-medium">No requests found</p>
            <p className="text-sm mt-1">Try adjusting the filters or date range</p>
          </div>
        ) : (
          <>
            {/* Desktop */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b text-gray-600">
                  <tr>
                    <th className="px-5 py-3 text-left font-semibold">Submitted</th>
                    <th className="px-5 py-3 text-left font-semibold">Type</th>
                    <th className="px-5 py-3 text-left font-semibold">Period / Time</th>
                    <th className="px-5 py-3 text-left font-semibold">Reason</th>
                    <th className="px-5 py-3 text-left font-semibold">Status</th>
                    <th className="px-5 py-3 text-left font-semibold">Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map((req) => (
                    <tr key={req._id} className="hover:bg-gray-50">
                      {/* FIX 3: use pre-formatted date fields from API */}
                      <td className="px-5 py-3 text-gray-700">{req.displayDate}</td>
                      <td className="px-5 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${typeBadge(req.type)}`}>
                          {req.type}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-gray-600">{req.displayPeriod}</td>
                      <td className="px-5 py-3 text-gray-600 max-w-xs truncate">{req.reason}</td>
                      <td className="px-5 py-3">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${statusBadge(req.status)}`}>
                          {req.status}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-gray-500 text-xs">
                        {req.status === 'Rejected' && req.rejectionReason
                          ? req.rejectionReason
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile */}
            <div className="md:hidden divide-y divide-gray-100">
              {filtered.map((req) => (
                <div key={req._id} className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${typeBadge(req.type)}`}>
                      {req.type}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusBadge(req.status)}`}>
                      {req.status}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-gray-800 mb-1">{req.displayPeriod}</p>
                  <p className="text-sm text-gray-500">{req.reason}</p>
                  {req.status === 'Rejected' && req.rejectionReason && (
                    <p className="text-xs text-red-500 mt-2">Reason: {req.rejectionReason}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-2">Submitted: {req.displayDate}</p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── Modals ── */}
      {showLeaveModal && (
        <LeaveRequestModal
  initialDate={correctionInitialDate}   // reuse or rename better
  onClose={() => {
    setShowLeaveModal(false);
    setCorrectionInitialDate('');
  }}
  onSubmit={() => {
    setShowLeaveModal(false);
    setCorrectionInitialDate('');
    handleRequestSubmitted();
  }}
/>
      )}
     {showCorrectionModal && (
  <CorrectionRequestModal
    initialDate={correctionInitialDate}   // ← new prop
    onClose={() => { setShowCorrectionModal(false); setCorrectionInitialDate(''); }}
    onSubmit={() => { setShowCorrectionModal(false); setCorrectionInitialDate(''); handleRequestSubmitted(); }}
  />
)}
    </div>
  );
}