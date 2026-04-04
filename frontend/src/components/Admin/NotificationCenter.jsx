import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { Calendar, Check, X, Bell, Filter, RefreshCw, AlertCircle, UserCheck, CalendarDays, Clock, MessageSquare, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

const formatDateToDisplay = (dateStr) => {
  if (!dateStr) return '--';
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
};

export default function NotificationCenter() {
  const [activeBlock, setActiveBlock] = useState('leaves');
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [correctionRequests, setCorrectionRequests] = useState([]);
  const [fromDate, setFromDate] = useState(
    new Date(Date.now() - 45 * 86400000).toISOString().split('T')[0]
  );
  const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);
  const [statusFilter, setStatusFilter] = useState('Pending');
  const [loading, setLoading] = useState(true);
  const [rejectModal, setRejectModal] = useState({ open: false, type: null, id: null });
  const [rejectReason, setRejectReason] = useState('');

  const fromDateRef = useRef(null);
  const toDateRef = useRef(null);

  const getToken = () => localStorage.getItem('token');

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const token = getToken();
      const days = Math.ceil((new Date(toDate) - new Date(fromDate)) / 86400000) + 1;
      const response = await axios.get(`/api/requests/admin/pending?days=${Math.max(days, 1)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      let leaves = response.data.leaveRequests || [];
      let corrections = response.data.correctionRequests || [];

      const from = new Date(fromDate);
      const to = new Date(toDate);
      to.setHours(23, 59, 59, 999);

      leaves = leaves.filter(r => { const d = new Date(r.createdAt); return d >= from && d <= to; });
      corrections = corrections.filter(r => { const d = new Date(r.createdAt); return d >= from && d <= to; });

      setLeaveRequests(leaves);
      setCorrectionRequests(corrections);
    } catch {
      toast.error('Failed to fetch requests');
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate]);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  const handleApproveLeave = async (id) => {
    try {
      await axios.patch(`/api/requests/leave/${id}/approve`, {}, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      toast.success('Leave approved');
      fetchRequests();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to approve leave');
    }
  };

  const handleApproveCorrection = async (id) => {
    try {
      await axios.patch(`/api/requests/correction/${id}/approve`, {}, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      toast.success('Correction approved');
      fetchRequests();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to approve correction');
    }
  };

  const openRejectModal = (type, id) => {
    setRejectModal({ open: true, type, id });
    setRejectReason('');
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      toast.error('Please enter a rejection reason');
      return;
    }
    try {
      const endpoint = rejectModal.type === 'leave'
        ? `/api/requests/leave/${rejectModal.id}/reject`
        : `/api/requests/correction/${rejectModal.id}/reject`;

      await axios.patch(endpoint, { reason: rejectReason }, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      toast.success(`${rejectModal.type === 'leave' ? 'Leave' : 'Correction'} rejected`);
      setRejectModal({ open: false, type: null, id: null });
      fetchRequests();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reject');
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-[1600px] mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800 tracking-tight">
            Notification Center
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage and review employee requests
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => setActiveBlock('leaves')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                activeBlock === 'leaves'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              <CalendarDays size={16} />
              Leave Requests ({leaveRequests.length})
            </button>
            <button
              onClick={() => setActiveBlock('corrections')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                activeBlock === 'corrections'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              <Clock size={16} />
              Corrections ({correctionRequests.length})
            </button>
          </div>
        </div>
      </div>

      {/* Filters Card */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-6">
        <div className="flex flex-wrap items-end gap-4">
          {/* From Date */}
          <div className="flex-1 min-w-[160px]">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
              From Date
            </label>
            <div className="relative">
              <input
                type="date"
                ref={fromDateRef}
                value={fromDate}
                onChange={e => setFromDate(e.target.value)}
                className="absolute opacity-0 pointer-events-none"
              />
              <div
                onClick={() => fromDateRef.current?.showPicker()}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl flex items-center justify-between cursor-pointer bg-white shadow-sm hover:border-gray-300 transition"
              >
                <span className="text-sm text-gray-700">{formatDateToDisplay(fromDate)}</span>
                <Calendar size={16} className="text-gray-400" />
              </div>
            </div>
          </div>

          {/* To Date */}
          <div className="flex-1 min-w-[160px]">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
              To Date
            </label>
            <div className="relative">
              <input
                type="date"
                ref={toDateRef}
                value={toDate}
                onChange={e => setToDate(e.target.value)}
                className="absolute opacity-0 pointer-events-none"
              />
              <div
                onClick={() => toDateRef.current?.showPicker()}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl flex items-center justify-between cursor-pointer bg-white shadow-sm hover:border-gray-300 transition"
              >
                <span className="text-sm text-gray-700">{formatDateToDisplay(toDate)}</span>
                <Calendar size={16} className="text-gray-400" />
              </div>
            </div>
          </div>

          {/* Status Filter */}
          <div className="flex-1 min-w-[160px]">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-sm"
            >
              <option value="Pending">Pending</option>
            </select>
          </div>

          {/* Refresh Button */}
          <div>
            <button
              onClick={fetchRequests}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition shadow-sm text-sm font-medium disabled:opacity-50"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Content Card */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-16 text-center">
            <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-4" />
            <p className="text-gray-600 font-medium">Loading requests...</p>
          </div>
        ) : (
          <>
            {/* Leave Requests Table */}
            {activeBlock === 'leaves' && (
              <div className="overflow-x-auto">
                {leaveRequests.length === 0 ? (
                  <div className="p-16 text-center text-gray-500">
                    <Bell className="mx-auto mb-4 text-gray-300" size={48} />
                    <p>No pending leave requests</p>
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Employee</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Leave Type</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">From</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">To</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Reason</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Submitted</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {leaveRequests.map(r => (
                        <tr key={r._id} className="hover:bg-gray-50/50 transition">
                          <td className="px-4 py-3">
                            <p className="font-medium text-gray-900">{r.empName}</p>
                            <p className="text-xs text-gray-500 mt-0.5">#{r.empNumber}</p>
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                              {r.leaveType}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">{r.fromDateFormatted || formatDateToDisplay(r.fromDate)}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{r.toDateFormatted || formatDateToDisplay(r.toDate)}</td>
                          <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate">{r.reason}</td>
                          <td className="px-4 py-3 text-xs text-gray-400">{formatDateToDisplay(r.createdAt)}</td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => handleApproveLeave(r._id)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition"
                                title="Approve"
                              >
                                <Check size={12} /> Approve
                              </button>
                              <button
                                onClick={() => openRejectModal('leave', r._id)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition"
                                title="Reject"
                              >
                                <X size={12} /> Reject
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* Correction Requests Table */}
            {activeBlock === 'corrections' && (
              <div className="overflow-x-auto">
                {correctionRequests.length === 0 ? (
                  <div className="p-16 text-center text-gray-500">
                    <Bell className="mx-auto mb-4 text-gray-300" size={48} />
                    <p>No pending correction requests</p>
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Employee</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Original In</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Corrected In</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Original Out</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Corrected Out</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Reason</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {correctionRequests.map(r => (
                        <tr key={r._id} className="hover:bg-gray-50/50 transition">
                          <td className="px-4 py-3">
                            <p className="font-medium text-gray-900">{r.empName}</p>
                            <p className="text-xs text-gray-500 mt-0.5">#{r.empNumber}</p>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">{r.dateFormatted || formatDateToDisplay(r.date)}</td>
                          <td className="px-4 py-3">
                            <span className="inline-flex px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                              {r.correctionType}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-400">{r.originalInTime || '--'}</td>
                          <td className="px-4 py-3 text-sm font-medium text-green-600">{r.correctedInTime || '--'}</td>
                          <td className="px-4 py-3 text-sm text-gray-400">{r.originalOutTime || '--'}</td>
                          <td className="px-4 py-3 text-sm font-medium text-green-600">{r.correctedOutTime || '--'}</td>
                          <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate">{r.reason}</td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => handleApproveCorrection(r._id)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition"
                                title="Approve"
                              >
                                <Check size={12} /> Approve
                              </button>
                              <button
                                onClick={() => openRejectModal('correction', r._id)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition"
                                title="Reject"
                              >
                                <X size={12} /> Reject
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Reject Reason Modal */}
      {rejectModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-red-100">
                  <X size={16} className="text-red-600" />
                </div>
                <h2 className="text-lg font-bold text-gray-800">
                  Reject {rejectModal.type === 'leave' ? 'Leave' : 'Correction'} Request
                </h2>
              </div>
              <button
                onClick={() => setRejectModal({ open: false, type: null, id: null })}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
              >
                <X size={20} />
              </button>
            </div>
            <div className="px-6 py-5">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Reason for rejection <span className="text-red-500">*</span>
              </label>
              <textarea
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                rows={4}
                placeholder="Please provide a reason for rejecting this request..."
                className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500/20 focus:border-red-500 text-sm resize-none"
                autoFocus
              />
              <div className="mt-4 bg-red-50 rounded-xl p-3 border border-red-200">
                <p className="text-xs text-red-700 flex items-center gap-1.5">
                  <AlertCircle size={12} /> This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl">
              <button
                onClick={() => setRejectModal({ open: false, type: null, id: null })}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-gradient-to-r from-red-600 to-red-700 rounded-xl hover:from-red-700 hover:to-red-800 transition shadow-md"
              >
                <X size={15} /> Reject Request
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}