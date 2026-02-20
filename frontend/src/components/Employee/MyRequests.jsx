import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, AlertCircle } from 'lucide-react';
import LeaveRequestModal from './LeaveRequestModal';
import CorrectionRequestModal from './CorrectionRequestModal';
import toast from 'react-hot-toast';

export default function MyRequests() {
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  const [fromDate, setFromDate] = useState(new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);
  const [statusFilter, setStatusFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [leaveEligible, setLeaveEligible] = useState(false);
  const [daysUntilEligible, setDaysUntilEligible] = useState(0);

  useEffect(() => {
    checkLeaveEligibility();
    fetchRequests();
  }, [fromDate, toDate, statusFilter, typeFilter]);

  // CRITICAL: Check 3-month eligibility from database joining date
  const checkLeaveEligibility = async () => {
    try {
      const user = JSON.parse(localStorage.getItem('user'));
      const token = localStorage.getItem('token');

      // Get fresh employee data from backend
      const response = await axios.get(
        `/api/employees/${user.id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const joiningDate = new Date(response.data.joiningDate);
      const now = new Date();
      const daysElapsed = Math.floor((now - joiningDate) / (1000 * 60 * 60 * 24));
      const canApply = daysElapsed >= 90;
      const daysUntil = Math.max(0, 90 - daysElapsed);

      setLeaveEligible(canApply);
      setDaysUntilEligible(daysUntil);
    } catch (error) {
      console.error('Error checking leave eligibility:', error);
    }
  };

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/requests/my-requests', {
        params: {
          fromDate,
          toDate,
          status: statusFilter !== 'All' ? statusFilter : undefined,
          type: typeFilter !== 'All' ? typeFilter.toLowerCase() : undefined
        },
        headers: { Authorization: `Bearer ${token}` }
      });

      const combined = [
        ...response.data.leaveRequests.map(r => ({ ...r, type: 'Leave' })),
        ...response.data.correctionRequests.map(r => ({ ...r, type: 'Correction' }))
      ];

      combined.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setRequests(combined);
      setLoading(false);
    } catch (error) {
      toast.error('Failed to fetch requests');
      setLoading(false);
    }
  };

  const handleRequestSubmitted = () => {
    fetchRequests();
    checkLeaveEligibility();
  };

  const filteredRequests = requests.filter(req =>
    req.reason?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    req.empName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-4 md:p-6">
      <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-6">My Requests</h1>

      {/* Action Blocks */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Leave Request Block - DISABLED if not eligible */}
        <div
          onClick={() => {
            if (!leaveEligible) {
              toast.error(`You can apply for leave after ${daysUntilEligible} days of service`);
              return;
            }
            setShowLeaveModal(true);
          }}
          className={`rounded-lg shadow p-6 border-2 border-transparent transition ${
            leaveEligible
              ? 'bg-white hover:shadow-lg hover:border-blue-500 cursor-pointer'
              : 'bg-gray-50 opacity-60 cursor-not-allowed'
          }`}
        >
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Apply for Leave</h3>
          <p className="text-gray-600 text-sm">Submit a leave request</p>

          {/* Eligibility Warning */}
          {!leaveEligible && (
            <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded">
              <p className="text-xs text-yellow-800 font-semibold">
                ⚠️ Not Eligible Yet
              </p>
              <p className="text-xs text-yellow-700 mt-1">
                Available after {daysUntilEligible} more days of service
              </p>
            </div>
          )}
        </div>

        {/* Correction Request Block - Always enabled */}
        <button
          onClick={() => setShowCorrectionModal(true)}
          className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition border-2 border-transparent hover:border-blue-500 text-left cursor-pointer"
        >
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Request Correction</h3>
          <p className="text-gray-600 text-sm">Correct your attendance times</p>
        </button>
      </div>

      {/* Filter Section */}
      <div className="bg-white rounded-lg shadow p-4 md:p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">From Date</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">To Date</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
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
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="All">All</option>
              <option value="Leave">Leave</option>
              <option value="Correction">Correction</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={fetchRequests}
              disabled={loading}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
            >
              {loading ? 'Loading...' : 'Refresh'}
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="mt-4">
          <input
            type="text"
            placeholder="Search requests..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Requests Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">Loading requests...</div>
        ) : filteredRequests.length === 0 ? (
          <div className="p-12 text-center text-gray-600">
            <AlertCircle className="mx-auto mb-4 text-gray-400" size={48} />
            <p>No requests found</p>
          </div>
        ) : (
          <>
            {/* Desktop View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100 border-b">
                  <tr>
                    <th className="px-4 py-2 text-left font-semibold">Date</th>
                    <th className="px-4 py-2 text-left font-semibold">Type</th>
                    <th className="px-4 py-2 text-left font-semibold">Period/Time</th>
                    <th className="px-4 py-2 text-left font-semibold">Reason</th>
                    <th className="px-4 py-2 text-left font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredRequests.map((request) => (
                    <tr key={request._id} className="hover:bg-gray-50">
                      <td className="px-4 py-2">
                        {new Date(request.fromDate || request.date).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-2 font-medium">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                          request.type === 'Leave'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-purple-100 text-purple-800'
                        }`}>
                          {request.type}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-gray-600">
                        {request.type === 'Leave'
                          ? `${new Date(request.fromDate).toLocaleDateString()} - ${new Date(request.toDate).toLocaleDateString()}`
                          : `${request.correctedInTime || '—'} to ${request.correctedOutTime || '—'}`
                        }
                      </td>
                      <td className="px-4 py-2 text-gray-600">{request.reason}</td>
                      <td className="px-4 py-2">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          request.status === 'Pending' ? 'bg-yellow-100 text-yellow-800' :
                          request.status === 'Approved' ? 'bg-green-100 text-green-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {request.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile View */}
            <div className="md:hidden space-y-4 p-4">
              {filteredRequests.map((request) => (
                <div key={request._id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${
                      request.type === 'Leave'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-purple-100 text-purple-800'
                    }`}>
                      {request.type}
                    </span>
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${
                      request.status === 'Pending' ? 'bg-yellow-100 text-yellow-800' :
                      request.status === 'Approved' ? 'bg-green-100 text-green-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {request.status}
                    </span>
                  </div>
                  <div className="space-y-1 text-sm">
                    <p><span className="font-medium">Date:</span> {new Date(request.fromDate || request.date).toLocaleDateString()}</p>
                    <p><span className="font-medium">Reason:</span> {request.reason}</p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Modals */}
      {showLeaveModal && (
        <LeaveRequestModal
          onClose={() => setShowLeaveModal(false)}
          onSubmit={handleRequestSubmitted}
        />
      )}

      {showCorrectionModal && (
        <CorrectionRequestModal
          onClose={() => setShowCorrectionModal(false)}
          onSubmit={handleRequestSubmitted}
        />
      )}
    </div>
  );
}