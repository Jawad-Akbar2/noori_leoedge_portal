import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { MoreVertical, AlertCircle, Calendar } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatToDDMMYYYY, formatDate } from '../../utils/dateFormatter';

export default function AttendanceHistory() {
  const fromDateRef = useRef(null);
  const toDateRef = useRef(null);

  const formatDateToDisplay = (dateStr) => {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  };

  const [fromDate, setFromDate] = useState(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const day = now.getDate();
    let start = new Date(year, month, 18);
    if (day < 18) {
      start = new Date(year, month - 1, 18);
    }
    return start.toISOString().split('T')[0];
  });

  const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);
  const [filters, setFilters] = useState({
    absent: true,
    leave: true,
    ot: true,
    late: true
  });
  const [attendanceHistory, setAttendanceHistory] = useState([]);
  const [filteredHistory, setFilteredHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [openMenuId, setOpenMenuId] = useState(null);

  const fetchAttendance = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const user = JSON.parse(localStorage.getItem('user'));

      const response = await axios.get('/api/attendance/range', {
        params: {
          fromDate: formatToDDMMYYYY(fromDate),
          toDate: formatToDDMMYYYY(toDate)
        },
        headers: { Authorization: `Bearer ${token}` }
      });

      let data = response.data.attendance.filter(a => a.empId?._id === user.id || a.empId === user.id);
      
      // Generate missing records as Absent
      const start = new Date(fromDate);
      const end = new Date(toDate);
      const existingDates = new Set(data.map(a => new Date(a.date).toISOString().split('T')[0]));

      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        if (!existingDates.has(dateStr)) {
          data.push({
            _id: `missing-${dateStr}`,
            date: dateStr,
            status: 'Absent',
            inOut: { in: null, out: null },
            financials: { dailyEarning: 0 }
          });
        }
      }

      data.sort((a, b) => new Date(a.date) - new Date(b.date));
      setAttendanceHistory(data);
      setLoading(false);
    } catch (error) {
      toast.error('Failed to fetch attendance');
      setLoading(false);
    }
  }, [fromDate, toDate]);

  const applyFilters = useCallback(() => {
    let filtered = attendanceHistory.filter(record => {
      if (!filters.absent && record.status === 'Absent') return false;
      if (!filters.leave && record.status === 'Leave') return false;
      if (!filters.late && record.status === 'Late') return false;
      if (!filters.ot && record.financials?.otHours > 0) return false;
      return true;
    });
    setFilteredHistory(filtered);
  }, [attendanceHistory, filters]);

  useEffect(() => {
    fetchAttendance();
  }, [fetchAttendance]);

  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  const handleShowList = () => {
    fetchAttendance();
  };

  const handleToggleFilter = (filterKey) => {
    setFilters({
      ...filters,
      [filterKey]: !filters[filterKey]
    });
  };

  const handleLeaveRequest = (date) => {
    // Navigate to requests page with this date pre-selected
    localStorage.setItem('selectedDate', date);
    window.location.href = '/employee/requests?type=leave';
  };

  const handleCorrectionRequest = (date) => {
    localStorage.setItem('selectedDate', date);
    window.location.href = '/employee/requests?type=correction';
  };

  return (
    <div className="p-4 md:p-6 bg-gray-50 min-h-screen">
      <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-6">Attendance History</h1>

      {/* Filter Section */}
      <div className="bg-white rounded-lg shadow p-4 md:p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-2">From Date</label>
            <div 
              onClick={() => fromDateRef.current.showPicker()}
              className="flex items-center justify-between w-full px-4 py-2 border border-gray-300 rounded-lg focus-within:ring-2 focus-within:ring-blue-500 cursor-pointer bg-white"
            >
              <span className="text-gray-900">{formatDateToDisplay(fromDate)}</span>
              <Calendar size={18} className="text-gray-400" />
            </div>
            <input
              ref={fromDateRef}
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="absolute opacity-0 pointer-events-none"
            />
          </div>
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-2">To Date</label>
            <div 
              onClick={() => toDateRef.current.showPicker()}
              className="flex items-center justify-between w-full px-4 py-2 border border-gray-300 rounded-lg focus-within:ring-2 focus-within:ring-blue-500 cursor-pointer bg-white"
            >
              <span className="text-gray-900">{formatDateToDisplay(toDate)}</span>
              <Calendar size={18} className="text-gray-400" />
            </div>
            <input
              ref={toDateRef}
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              min={fromDate}
              className="absolute opacity-0 pointer-events-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Filter</label>
            <div className="flex gap-2">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.absent}
                  onChange={() => handleToggleFilter('absent')}
                  className="rounded"
                />
                Absent
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.leave}
                  onChange={() => handleToggleFilter('leave')}
                  className="rounded"
                />
                Leave
              </label>
            </div>
          </div>
          <div className="flex items-end">
            <button
              onClick={handleShowList}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              Show List
            </button>
          </div>
        </div>
      </div>

      {/* Attendance Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">Loading...</div>
        ) : (
          <>
            {/* Desktop View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Date</th>
                    <th className="px-4 py-3 text-left font-semibold">In / Out</th>
                    <th className="px-4 py-3 text-left font-semibold">Status</th>
                    <th className="px-4 py-3 text-left font-semibold">Day Earning</th>
                    <th className="px-4 py-3 text-left font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredHistory.map((record) => (
                    <tr key={record._id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">{formatDate(record.date)}</td>
                      <td className="px-4 py-3">
                        {record.inOut?.in && record.inOut?.out 
                          ? `${record.inOut.in} / ${record.inOut.out}`
                          : <span className="text-gray-400">-- / --</span>
                        }
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          record.status === 'Present' ? 'bg-green-100 text-green-800' :
                          record.status === 'Late' ? 'bg-yellow-100 text-yellow-800' :
                          record.status === 'Leave' ? 'bg-blue-100 text-blue-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {record.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-semibold text-blue-600">
                        PKR {(record.financials?.dailyEarning || 0).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 relative">
                        <button
                          onClick={() => setOpenMenuId(openMenuId === record._id ? null : record._id)}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          <MoreVertical size={18} />
                        </button>
                        {openMenuId === record._id && (
                          <div className="absolute right-0 mt-2 w-40 bg-white rounded-lg shadow-lg z-40 border border-gray-200">
                            <button
                              onClick={() => {
                                handleLeaveRequest(record.date);
                                setOpenMenuId(null);
                              }}
                              className="w-full px-4 py-2 text-left hover:bg-gray-50 text-sm border-b"
                            >
                              Leave Request
                            </button>
                            <button
                              onClick={() => {
                                handleCorrectionRequest(record.date);
                                setOpenMenuId(null);
                              }}
                              className="w-full px-4 py-2 text-left hover:bg-gray-50 text-sm"
                            >
                              Correction Request
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile View */}
            <div className="md:hidden space-y-4 p-4">
              {filteredHistory.map((record) => (
                <div key={record._id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="font-semibold text-gray-800">{formatDate(record.date)}</p>
                      <p className="text-sm text-gray-600">
                        {record.inOut?.in && record.inOut?.out 
                          ? `${record.inOut.in} - ${record.inOut.out}`
                          : 'No record'
                        }
                      </p>
                    </div>
                    <button
                      onClick={() => setOpenMenuId(openMenuId === record._id ? null : record._id)}
                    >
                      <MoreVertical size={18} className="text-gray-400" />
                    </button>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      record.status === 'Present' ? 'bg-green-100 text-green-800' :
                      record.status === 'Late' ? 'bg-yellow-100 text-yellow-800' :
                      record.status === 'Leave' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {record.status}
                    </span>
                    <span className="font-semibold text-blue-600">
                      PKR {(record.financials?.dailyEarning || 0).toFixed(2)}
                    </span>
                  </div>
                  {openMenuId === record._id && (
                    <div className="mt-3 space-y-2">
                      <button
                        onClick={() => {
                          handleLeaveRequest(record.date);
                          setOpenMenuId(null);
                        }}
                        className="w-full px-4 py-2 bg-white border border-gray-300 rounded text-sm hover:bg-gray-50"
                      >
                        Leave Request
                      </button>
                      <button
                        onClick={() => {
                          handleCorrectionRequest(record.date);
                          setOpenMenuId(null);
                        }}
                        className="w-full px-4 py-2 bg-white border border-gray-300 rounded text-sm hover:bg-gray-50"
                      >
                        Correction Request
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}