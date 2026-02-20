import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Menu, X, Save, Upload, Check, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ManualAttendance() {
  const [fromDate, setFromDate] = useState(new Date().toISOString().split('T')[0]);
  const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);
  const [worksheet, setWorksheet] = useState([]);
  const [filteredWorksheet, setFilteredWorksheet] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showDrawer, setShowDrawer] = useState(false);
  const [selectedRow, setSelectedRow] = useState(null);
  const [editingRow, setEditingRow] = useState(null);

  useEffect(() => {
    fetchWorksheet();
  }, []);

  useEffect(() => {
    filterWorksheet();
  }, [worksheet, searchTerm]);

  const fetchWorksheet = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        '/api/attendance/worksheet',
        { fromDate, toDate },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setWorksheet(response.data.worksheet);
      setLoading(false);
    } catch (error) {
      toast.error('Failed to load worksheet');
      setLoading(false);
    }
  };

  const filterWorksheet = () => {
    let filtered = worksheet;

    if (searchTerm) {
      filtered = filtered.filter(row =>
        row.empName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        row.empNumber.includes(searchTerm)
      );
    }

    filtered.sort((a, b) => {
      const dateCompare = new Date(a.date) - new Date(b.date);
      if (dateCompare !== 0) return dateCompare;
      return a.empNumber.localeCompare(b.empNumber);
    });

    setFilteredWorksheet(filtered);
  };

  const calculateEarning = (row) => {
    const { status, inOut, financials, shift, hourlyRate } = row;

    if (status === 'Absent' || (!inOut?.in && !inOut?.out)) {
      return 0;
    }

    if (status === 'Leave') {
      const [shiftH, shiftM] = shift.start.split(':').map(Number);
      const [endH, endM] = shift.end.split(':').map(Number);
      const hoursPerDay = ((endH * 60 + endM) - (shiftH * 60 + shiftM)) / 60;
      return hoursPerDay * hourlyRate;
    }

    if (inOut?.in && inOut?.out) {
      const [inH, inM] = inOut.in.split(':').map(Number);
      const [outH, outM] = inOut.out.split(':').map(Number);
      let inMinutes = inH * 60 + inM;
      let outMinutes = outH * 60 + outM;

      if (outMinutes < inMinutes) {
        outMinutes += 24 * 60;
      }

      const hoursPerDay = (outMinutes - inMinutes) / 60;
      const basePay = hoursPerDay * hourlyRate;
      const otAmount = (financials?.otHours || 0) * hourlyRate * (financials?.otMultiplier || 1);
      const deduction = financials?.deduction || 0;

      return Math.max(0, basePay + otAmount - deduction);
    } else if (inOut?.in || inOut?.out) {
      const [shiftH, shiftM] = shift.start.split(':').map(Number);
      const [endH, endM] = shift.end.split(':').map(Number);
      const hoursPerDay = ((endH * 60 + endM) - (shiftH * 60 + shiftM)) / 60;
      const basePay = hoursPerDay * hourlyRate;
      const otAmount = (financials?.otHours || 0) * hourlyRate * (financials?.otMultiplier || 1);
      const deduction = financials?.deduction || 0;

      return Math.max(0, (basePay * 0.5) + otAmount - deduction);
    }

    return 0;
  };

  const handleSaveRow = async (row) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        '/api/attendance/save-row',
        {
          empId: row.empId,
          date: row.date,
          status: row.status,
          inTime: row.inOut?.in,
          outTime: row.inOut?.out,
          otHours: row.financials?.otHours || 0,
          otMultiplier: row.financials?.otMultiplier || 1,
          deduction: row.financials?.deduction || 0
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success('Row saved successfully');
      fetchWorksheet();
      setShowDrawer(false);
      setSelectedRow(null);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save row');
    }
  };

  const handleSaveAll = async () => {
    if (worksheet.length === 0) {
      toast.error('No data to save');
      return;
    }

    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const dataToSave = worksheet.map(row => ({
        empId: row.empId,
        date: row.date,
        status: row.status,
        inOut: row.inOut,
        financials: row.financials
      }));

      await axios.post(
        '/api/attendance/save-batch',
        { attendanceData: dataToSave },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success('All records saved successfully');
      fetchWorksheet();
    } catch (error) {
      toast.error('Failed to save attendance');
    } finally {
      setSaving(false);
    }
  };

  const handleCSVImport = async (file) => {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const csvContent = e.target.result;
        const token = localStorage.getItem('token');

        await axios.post(
          '/api/attendance/csv-import',
          { csvContent },
          { headers: { Authorization: `Bearer ${token}` } }
        );

        toast.success('CSV imported and processed successfully');
        fetchWorksheet();
      } catch (error) {
        toast.error('Failed to import CSV: ' + error.response?.data?.message);
      }
    };
    reader.readAsText(file);
  };

  const handleMarkAllPresent = () => {
    const updated = worksheet.map(row => ({
      ...row,
      status: 'Present',
      inOut: { in: row.shift.start, out: row.shift.end },
      financials: {
        ...row.financials,
        otHours: 0,
        deduction: 0
      },
      isModified: true
    }));
    setWorksheet(updated);
    toast.success('All employees marked as present');
  };

  const openDrawer = (row) => {
    setEditingRow(JSON.parse(JSON.stringify(row)));
    setSelectedRow(row);
    setShowDrawer(true);
  };

  const closeDrawer = () => {
    setShowDrawer(false);
    setSelectedRow(null);
    setEditingRow(null);
  };

  const updateEditingRow = (field, value) => {
    if (!editingRow) return;

    const updated = { ...editingRow };

    if (field === 'status') {
      updated.status = value;
    } else if (field.startsWith('inOut.')) {
      const timeField = field.split('.')[1];
      updated.inOut = { ...updated.inOut, [timeField]: value };
    } else if (field.startsWith('financials.')) {
      const finField = field.split('.')[1];
      updated.financials = { ...updated.financials, [finField]: value };
    }

    const earning = calculateEarning(updated);
    updated.financials.finalDayEarning = earning;

    setEditingRow(updated);
  };

  const isValidTime = (time) => {
    const regex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
    return regex.test(time);
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white shadow sticky top-0 z-30">
          <div className="flex items-center justify-between p-4 md:p-6">
            <h1 className="text-2xl font-bold text-gray-800">Manual Attendance</h1>
            <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold">
              A
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          {/* Controls Section */}
          <div className="m-4 md:m-6 bg-white rounded-lg shadow p-4 md:p-6">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">From Date</label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => {
                    setFromDate(e.target.value);
                    setToDate(e.target.value);
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">To Date</label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  min={fromDate}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
                <input
                  type="text"
                  placeholder="Name or ID"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="flex flex-col justify-end">
                <label htmlFor="csv-upload" className="block text-sm font-medium text-gray-700 mb-2">
                  Import CSV
                </label>
                <input
                  id="csv-upload"
                  type="file"
                  accept=".csv"
                  onChange={(e) => e.target.files && handleCSVImport(e.target.files[0])}
                  className="hidden"
                />
                <button
                  onClick={() => document.getElementById('csv-upload').click()}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition text-sm"
                >
                  <Upload size={18} />
                  <span className="hidden md:inline">CSV</span>
                </button>
              </div>
              <div className="flex flex-col justify-end">
                <label className="block text-sm font-medium text-gray-700 mb-2">Refresh</label>
                <button
                  onClick={fetchWorksheet}
                  disabled={loading}
                  className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition text-sm disabled:opacity-50"
                >
                  {loading ? 'Loading...' : 'Refresh'}
                </button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleMarkAllPresent}
                disabled={loading}
                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition text-sm disabled:opacity-50"
              >
                Mark All Present
              </button>
              <button
                onClick={handleSaveAll}
                disabled={saving || worksheet.length === 0 || loading}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm disabled:opacity-50"
              >
                <Save size={18} />
                {saving ? 'Saving...' : 'Save All'}
              </button>
            </div>

            {/* Stats */}
            <div className="mt-4 pt-4 border-t">
              <p className="text-sm text-gray-600">
                Showing <span className="font-semibold">{filteredWorksheet.length}</span> of{' '}
                <span className="font-semibold">{worksheet.length}</span> records
              </p>
            </div>
          </div>

          {/* Worksheet Table */}
          <div className="m-4 md:m-6 bg-white rounded-lg shadow overflow-hidden">
            {loading ? (
              <div className="p-12 text-center">
                <p className="text-gray-600">Loading worksheet...</p>
              </div>
            ) : filteredWorksheet.length === 0 ? (
              <div className="p-12 text-center">
                <AlertCircle className="mx-auto mb-4 text-gray-400" size={48} />
                <p className="text-gray-600">No records found</p>
              </div>
            ) : (
              <>
                {/* Desktop View */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100 border-b sticky top-0">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700">Date</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700">Employee</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700">ID</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700">Status</th>
                        <th className="px-4 py-3 text-center font-semibold text-gray-700">In Time</th>
                        <th className="px-4 py-3 text-center font-semibold text-gray-700">Out Time</th>
                        <th className="px-4 py-3 text-center font-semibold text-gray-700">OT Hrs</th>
                        <th className="px-4 py-3 text-center font-semibold text-gray-700">OT Rate</th>
                        <th className="px-4 py-3 text-right font-semibold text-gray-700">Deduction</th>
                        <th className="px-4 py-3 text-right font-semibold text-gray-700">Day Earning</th>
                        <th className="px-4 py-3 text-center font-semibold text-gray-700">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {filteredWorksheet.map((row) => (
                        <tr
                          key={`${row.empId}-${row.date}`}
                          className={`hover:bg-gray-50 transition ${
                            row.isVirtual ? 'bg-yellow-50' : ''
                          }`}
                        >
                          <td className="px-4 py-3">
                            <span className="text-gray-900 font-medium">
                              {new Date(row.date).toLocaleDateString()}
                            </span>
                          </td>
                          <td className="px-4 py-3">{row.empName}</td>
                          <td className="px-4 py-3 text-gray-600">{row.empNumber}</td>
                          <td className="px-4 py-3">
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-semibold ${
                                row.status === 'Present'
                                  ? 'bg-green-100 text-green-800'
                                  : row.status === 'Late'
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : row.status === 'Leave'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-gray-100 text-gray-800'
                              }`}
                            >
                              {row.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center text-gray-600">
                            {row.inOut?.in ? (
                              <span className="font-medium">{row.inOut.in}</span>
                            ) : (
                              <span className="text-red-500 font-semibold">MISSED</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center text-gray-600">
                            {row.inOut?.out ? (
                              <span className="font-medium">{row.inOut.out}</span>
                            ) : (
                              <span className="text-red-500 font-semibold">MISSED</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {row.financials?.otHours || 0}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {row.financials?.otMultiplier || 1}x
                          </td>
                          <td className="px-4 py-3 text-right">
                            {row.financials?.deduction || 0}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-blue-600">
                            PKR {(row.financials?.finalDayEarning || 0).toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => openDrawer(row)}
                              className="text-blue-600 hover:text-blue-800 font-medium text-sm hover:underline"
                            >
                              Edit
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Card View */}
                <div className="md:hidden space-y-4 p-4">
                  {filteredWorksheet.map((row) => (
                    <div
                      key={`${row.empId}-${row.date}`}
                      className={`rounded-lg p-4 border ${
                        row.isVirtual ? 'bg-yellow-50 border-yellow-300' : 'bg-white border-gray-300'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <p className="font-semibold text-gray-900">{row.empName}</p>
                          <p className="text-xs text-gray-600 mt-1">
                            {new Date(row.date).toLocaleDateString()}
                          </p>
                        </div>
                        <span
                          className={`px-2 py-1 rounded text-xs font-semibold ${
                            row.status === 'Present'
                              ? 'bg-green-100 text-green-800'
                              : row.status === 'Late'
                              ? 'bg-yellow-100 text-yellow-800'
                              : row.status === 'Leave'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {row.status}
                        </span>
                      </div>

                      <div className="space-y-2 text-sm mb-4">
                        <div className="flex justify-between">
                          <span className="text-gray-600">ID:</span>
                          <span className="font-medium">{row.empNumber}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">In/Out:</span>
                          <span className="font-medium">
                            {row.inOut?.in || 'MISSED'} / {row.inOut?.out || 'MISSED'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">OT:</span>
                          <span className="font-medium">
                            {row.financials?.otHours || 0}h @ {row.financials?.otMultiplier || 1}x
                          </span>
                        </div>
                        <div className="flex justify-between border-t pt-2">
                          <span className="text-gray-600 font-semibold">Earning:</span>
                          <span className="font-bold text-blue-600">
                            PKR {(row.financials?.finalDayEarning || 0).toFixed(2)}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => openDrawer(row)}
                        className="w-full px-3 py-2 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 transition font-medium"
                      >
                        Edit
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Edit Drawer */}
      {showDrawer && editingRow && (
        <div className="fixed inset-0 z-50">
          {/* Overlay */}
          <div className="fixed inset-0 bg-black bg-opacity-50" onClick={closeDrawer}></div>

          {/* Drawer */}
          <div className="fixed right-0 top-0 bottom-0 w-full sm:w-96 bg-white shadow-2xl overflow-y-auto z-50 flex flex-col">
            {/* Header */}
            <div className="sticky top-0 bg-white border-b p-6 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-800">Edit Attendance</h2>
              <button onClick={closeDrawer} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Employee Info */}
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <p className="text-sm text-gray-600">
                  <span className="font-semibold text-gray-900">{editingRow.empName}</span>
                </p>
                <p className="text-sm text-gray-600 mt-1">ID: {editingRow.empNumber}</p>
                <p className="text-sm text-gray-600 mt-1">
                  Date: {new Date(editingRow.date).toLocaleDateString()}
                </p>
              </div>

              {/* Status Selection */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-3">Status</label>
                <div className="grid grid-cols-2 gap-2">
                  {['Absent', 'Present', 'Late', 'Leave'].map((status) => (
                    <button
                      key={status}
                      onClick={() => updateEditingRow('status', status)}
                      className={`px-4 py-3 rounded-lg font-medium transition text-sm ${
                        editingRow.status === status
                          ? 'bg-blue-600 text-white ring-2 ring-blue-700'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>

              {/* In Time */}
              {editingRow.status !== 'Leave' && (
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">In Time (HH:mm)</label>
                  <input
                    type="text"
                    placeholder="09:00"
                    value={editingRow.inOut?.in || ''}
                    onChange={(e) => updateEditingRow('inOut.in', e.target.value)}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      editingRow.inOut?.in && !isValidTime(editingRow.inOut.in)
                        ? 'border-red-500'
                        : 'border-gray-300'
                    }`}
                  />
                  <p className="text-xs text-gray-500 mt-1">Format: HH:mm (24-hour)</p>
                </div>
              )}

              {/* Out Time */}
              {editingRow.status !== 'Leave' && (
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Out Time (HH:mm)</label>
                  <input
                    type="text"
                    placeholder="18:00"
                    value={editingRow.inOut?.out || ''}
                    onChange={(e) => updateEditingRow('inOut.out', e.target.value)}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      editingRow.inOut?.out && !isValidTime(editingRow.inOut.out)
                        ? 'border-red-500'
                        : 'border-gray-300'
                    }`}
                  />
                  <p className="text-xs text-gray-500 mt-1">Format: HH:mm (24-hour)</p>
                </div>
              )}

              {/* OT Hours */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">OT Hours</label>
                <input
                  type="number"
                  value={editingRow.financials?.otHours || 0}
                  onChange={(e) => updateEditingRow('financials.otHours', parseFloat(e.target.value) || 0)}
                  step="0.5"
                  min="0"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* OT Rate */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-3">OT Multiplier</label>
                <div className="grid grid-cols-3 gap-2">
                  {[1, 1.5, 2].map((rate) => (
                    <button
                      key={rate}
                      onClick={() => updateEditingRow('financials.otMultiplier', rate)}
                      className={`px-4 py-3 rounded-lg font-medium transition text-sm ${
                        editingRow.financials?.otMultiplier === rate
                          ? 'bg-green-600 text-white ring-2 ring-green-700'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {rate}x
                    </button>
                  ))}
                </div>
              </div>

              {/* Deduction */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Deduction (PKR)</label>
                <input
                  type="number"
                  value={editingRow.financials?.deduction || 0}
                  onChange={(e) => updateEditingRow('financials.deduction', parseFloat(e.target.value) || 0)}
                  step="10"
                  min="0"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Display Calculated Earning */}
              <div className="bg-green-50 p-4 rounded-lg border border-green-300">
                <p className="text-sm text-gray-600 mb-1">Calculated Day Earning:</p>
                <p className="text-3xl font-bold text-green-600">
                  PKR {(editingRow.financials?.finalDayEarning || 0).toFixed(2)}
                </p>
              </div>

              {/* Info Alert */}
              {editingRow.isVirtual && (
                <div className="bg-yellow-50 border border-yellow-300 p-4 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    <span className="font-semibold">Note:</span> This is a virtual row. It will be saved as a new record.
                  </p>
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="sticky bottom-0 bg-white border-t p-6 space-y-3">
              <button
                onClick={() => handleSaveRow(editingRow)}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold"
              >
                <Check size={20} />
                Save This Row
              </button>
              <button
                onClick={closeDrawer}
                className="w-full px-4 py-3 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400 transition font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}