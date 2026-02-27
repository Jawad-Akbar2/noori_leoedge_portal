import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { Calendar, Trash2, Check, X } from 'lucide-react';
import toast from 'react-hot-toast';

export default function NotificationCenter() {
  const [activeBlock, setActiveBlock] = useState('leaves');
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [correctionRequests, setCorrectionRequests] = useState([]);
  const [fromDate, setFromDate] = useState(new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);
  const [statusFilter, setStatusFilter] = useState('Pending');
  const [loading, setLoading] = useState(true);

  const fromDateRef = useRef(null);
  const toDateRef = useRef(null);

  const formatDateToDisplay = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  // ✅ Wrap fetchRequests in useCallback
  const fetchRequests = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/notifications/pending', {
        headers: { Authorization: `Bearer ${token}` }
      });

      let leaves = response.data.leaveRequests;
      let corrections = response.data.correctionRequests;

      // Filter by status if needed
      if (statusFilter !== 'All') {
        leaves = leaves.filter(r => r.status === statusFilter);
        corrections = corrections.filter(r => r.status === statusFilter);
      }

      // Filter by date range
      leaves = leaves.filter(r => {
        const reqDate = new Date(r.createdAt);
        return reqDate >= new Date(fromDate) && reqDate <= new Date(toDate);
      });

      corrections = corrections.filter(r => {
        const reqDate = new Date(r.createdAt);
        return reqDate >= new Date(fromDate) && reqDate <= new Date(toDate);
      });

      setLeaveRequests(leaves);
      setCorrectionRequests(corrections);
      setLoading(false);
    } catch (error) {
      toast.error('Failed to fetch requests');
      setLoading(false);
    }
  }, [fromDate, toDate, statusFilter]);

  // ✅ Add fetchRequests as dependency
  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handleApproveLeave = async (requestId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.patch(`/api/requests/leave/${requestId}/approve`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Leave request approved');
      fetchRequests();
    } catch (error) {
      toast.error('Failed to approve request');
    }
  };

  const handleApproveCorrection = async (requestId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.patch(`/api/requests/correction/${requestId}/approve`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Correction approved');
      fetchRequests();
    } catch (error) {
      toast.error('Failed to approve correction');
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm('Are you sure you want to delete all notifications?')) return;

    try {
      const token = localStorage.getItem('token');
      await axios.patch('/api/notifications/clear', {
        filters: {
          statuses: statusFilter === 'All' ? ['Pending', 'Approved', 'Rejected'] : [statusFilter]
        }
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Notifications cleared');
      fetchRequests();
    } catch (error) {
      toast.error('Failed to clear notifications');
    }
  };

  return (
    <div className="p-4 md:p-6 bg-gray-50 min-h-screen">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Notification Center</h1>
        <button
          onClick={handleClearAll}
          className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition"
        >
          <Trash2 size={18} />
          Clear All
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 md:p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">From Date</label>
            <div className="relative">
              <input
                type="date"
                ref={fromDateRef}
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="absolute opacity-0 pointer-events-none"
              />
              <div 
                onClick={() => fromDateRef.current?.showPicker()}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 flex items-center justify-between cursor-pointer bg-white"
              >
                <span>{formatDateToDisplay(fromDate)}</span>
                <Calendar size={18} className="text-gray-400" />
              </div>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">To Date</label>
            <div className="relative">
              <input
                type="date"
                ref={toDateRef}
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="absolute opacity-0 pointer-events-none"
              />
              <div 
                onClick={() => toDateRef.current?.showPicker()}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 flex items-center justify-between cursor-pointer bg-white"
              >
                <span>{formatDateToDisplay(toDate)}</span>
                <Calendar size={18} className="text-gray-400" />
              </div>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="All">All</option>
              <option value="Pending">Pending</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={fetchRequests}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              Show List
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="flex border-b">
          <button
            onClick={() => setActiveBlock('leaves')}
            className={`flex-1 px-4 py-3 font-medium border-b-2 transition ${
              activeBlock === 'leaves'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-600'
            }`}
          >
            Leave Requests ({leaveRequests.length})
          </button>
          <button
            onClick={() => setActiveBlock('corrections')}
            className={`flex-1 px-4 py-3 font-medium border-b-2 transition ${
              activeBlock === 'corrections'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-600'
            }`}
          >
            Correction Requests ({correctionRequests.length})
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">Loading...</div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {activeBlock === 'leaves' ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Date</th>
                    <th className="px-4 py-3 text-left font-semibold">Employee</th>
                    <th className="px-4 py-3 text-left font-semibold">Leave Type</th>
                    <th className="px-4 py-3 text-left font-semibold">Reason</th>
                    <th className="px-4 py-3 text-left font-semibold">Status</th>
                    <th className="px-4 py-3 text-left font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {leaveRequests.map((request) => (
                    <tr key={request._id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">{formatDateToDisplay(request.fromDate)}</td>
                      <td className="px-4 py-3">
                        <span className="font-medium">{request.empName}</span>
                        <br />
                        <span className="text-xs text-gray-600">{request.empNumber}</span>
                      </td>
                      <td className="px-4 py-3">{request.leaveType}</td>
                      <td className="px-4 py-3 text-gray-600">{request.reason}</td>
                      <td className="px-4 py-3">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          request.status === 'Pending' ? 'bg-yellow-100 text-yellow-800' :
                          request.status === 'Approved' ? 'bg-green-100 text-green-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {request.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {request.status === 'Pending' && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleApproveLeave(request._id)}
                              className="p-1 bg-green-100 text-green-600 rounded hover:bg-green-200"
                            >
                              <Check size={18} />
                            </button>
                            <button
                              onClick={() => {}}
                              className="p-1 bg-red-100 text-red-600 rounded hover:bg-red-200"
                            >
                              <X size={18} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Date</th>
                    <th className="px-4 py-3 text-left font-semibold">Employee</th>
                    <th className="px-4 py-3 text-left font-semibold">In Time</th>
                    <th className="px-4 py-3 text-left font-semibold">Out Time</th>
                    <th className="px-4 py-3 text-left font-semibold">Reason</th>
                    <th className="px-4 py-3 text-left font-semibold">Status</th>
                    <th className="px-4 py-3 text-left font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {correctionRequests.map((request) => (
                    <tr key={request._id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">{formatDateToDisplay(request.date)}</td>
                      <td className="px-4 py-3">
                        <span className="font-medium">{request.empName}</span>
                        <br />
                        <span className="text-xs text-gray-600">{request.empNumber}</span>
                      </td>
                      <td className="px-4 py-3">{request.correctedInTime}</td>
                      <td className="px-4 py-3">{request.correctedOutTime}</td>
                      <td className="px-4 py-3 text-gray-600">{request.reason}</td>
                      <td className="px-4 py-3">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          request.status === 'Pending' ? 'bg-yellow-100 text-yellow-800' :
                          request.status === 'Approved' ? 'bg-green-100 text-green-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {request.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {request.status === 'Pending' && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleApproveCorrection(request._id)}
                              className="p-1 bg-green-100 text-green-600 rounded hover:bg-green-200"
                            >
                              <Check size={18} />
                            </button>
                            <button
                              onClick={() => {}}
                              className="p-1 bg-red-100 text-red-600 rounded hover:bg-red-200"
                            >
                              <X size={18} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}