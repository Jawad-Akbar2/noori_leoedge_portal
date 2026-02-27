import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { X, Save, AlertCircle, Calendar } from 'lucide-react';
import toast from 'react-hot-toast';

export default function EditEmployeeModal({ employee, onClose }) {
  const [activeTab, setActiveTab] = useState('basic');
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState(null);
  const dateInputRef = useRef(null);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    employeeNumber: '',
    department: 'IT',
    joiningDate: '',
    shift: { start: '09:00', end: '18:00' },
    hourlyRate: 0,
    bank: { bankName: '', accountName: '', accountNumber: '' }
  });

  const formatDateToDisplay = (dateStr) => {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  };

  useEffect(() => {
    // CRITICAL: Load latest employee data from backend
    const loadEmployeeData = async () => {
      setDataLoading(true);
      setError(null);
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get(
          `/api/employees/${employee._id}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        // Populate form with fresh backend data (not stale frontend state)
        setFormData({
          firstName: response.data.firstName || '',
          lastName: response.data.lastName || '',
          email: response.data.email || '',
          employeeNumber: response.data.employeeNumber || '',
          department: response.data.department || 'IT',
          joiningDate: response.data.joiningDate
            ? new Date(response.data.joiningDate).toISOString().split('T')[0]
            : '',
          shift: response.data.shift || { start: '09:00', end: '18:00' },
          hourlyRate: response.data.hourlyRate || 0,
          bank: response.data.bank || { bankName: '', accountName: '', accountNumber: '' }
        });
        
        setDataLoading(false);
      } catch (err) {
        setError('Failed to load employee data. Employee may no longer exist.');
        setDataLoading(false);
      }
    };

    loadEmployeeData();
  }, [employee._id]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      setFormData({
        ...formData,
        [parent]: { ...formData[parent], [child]: value }
      });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const calculateMonthlySalary = () => {
    if (!formData.hourlyRate || !formData.shift.start || !formData.shift.end) {
      return 0;
    }

    const [startH, startM] = formData.shift.start.split(':').map(Number);
    const [endH, endM] = formData.shift.end.split(':').map(Number);
    
    let startMin = startH * 60 + startM;
    let endMin = endH * 60 + endM;

    if (endMin < startMin) {
      endMin += 24 * 60;
    }

    const hoursPerDay = (endMin - startMin) / 60;
    const monthlySalary = hoursPerDay * 22 * parseFloat(formData.hourlyRate);
    
    return monthlySalary.toFixed(2);
  };

  const isValidTime = (time) => {
    const regex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
    return regex.test(time);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation
    if (!formData.firstName.trim()) {
      toast.error('First name is required');
      return;
    }
    if (!formData.lastName.trim()) {
      toast.error('Last name is required');
      return;
    }
    if (!isValidTime(formData.shift.start)) {
      toast.error('Invalid shift start time (HH:mm format)');
      return;
    }
    if (!isValidTime(formData.shift.end)) {
      toast.error('Invalid shift end time (HH:mm format)');
      return;
    }
    if (formData.hourlyRate <= 0) {
      toast.error('Hourly rate must be greater than 0');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `/api/employees/${employee._id}`,
        {
          firstName: formData.firstName,
          lastName: formData.lastName,
          department: formData.department,
          shift: formData.shift,
          hourlyRate: parseFloat(formData.hourlyRate),
          bank: formData.bank
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success('Employee updated successfully');
      onClose();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update employee');
    } finally {
      setLoading(false);
    }
  };

  // ERROR STATE: Cannot render if data failed to load
  if (error) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg w-full max-w-md p-6">
          <div className="flex items-center gap-3 mb-4 text-red-600">
            <AlertCircle size={24} />
            <h2 className="text-lg font-bold">Error Loading Employee</h2>
          </div>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400 transition"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  // LOADING STATE
  if (dataLoading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg w-full max-w-md p-6 text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">Loading employee information...</p>
        </div>
      </div>
    );
  }

  if (!employee) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b p-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Edit Employee</h2>
            <p className="text-sm text-gray-600 mt-1">
              {formData.firstName} {formData.lastName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X size={24} />
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b">
          <div className="flex">
            <button
              onClick={() => setActiveTab('basic')}
              className={`flex-1 px-4 py-3 font-medium border-b-2 transition ${
                activeTab === 'basic'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-800'
              }`}
            >
              Basic Info
            </button>
            <button
              onClick={() => setActiveTab('shift')}
              className={`flex-1 px-4 py-3 font-medium border-b-2 transition ${
                activeTab === 'shift'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-800'
              }`}
            >
              Shift & Salary
            </button>
            <button
              onClick={() => setActiveTab('bank')}
              className={`flex-1 px-4 py-3 font-medium border-b-2 transition ${
                activeTab === 'bank'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-800'
              }`}
            >
              Bank Details
            </button>
          </div>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6">
          {/* Basic Info Tab */}
          {activeTab === 'basic' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    First Name
                  </label>
                  <input
                    type="text"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Last Name
                  </label>
                  <input
                    type="text"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email (Read-only)
                </label>
                <input
                  type="email"
                  value={formData.email}
                  readOnly
                  className="w-full px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg text-gray-600"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Employee Number (Read-only)
                </label>
                <input
                  type="text"
                  value={formData.employeeNumber}
                  readOnly
                  className="w-full px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg text-gray-600"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Department
                </label>
                <select
                  name="department"
                  value={formData.department}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="IT">IT</option>
                  <option value="Customer Support">Customer Support</option>
                  <option value="Manager">Manager</option>
                  <option value="Marketing">Marketing</option>
                  <option value="HR">HR</option>
                  <option value="Finance">Finance</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Joining Date (Read-only)
                </label>
                <div className="relative">
                  <input
                    type="date"
                    ref={dateInputRef}
                    value={formData.joiningDate}
                    readOnly
                    className="absolute opacity-0 pointer-events-none"
                  />
                  <div 
                    onClick={() => dateInputRef.current?.showPicker()}
                    className="w-full px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg text-gray-600 flex items-center justify-between cursor-not-allowed"
                  >
                    <span>{formatDateToDisplay(formData.joiningDate) || 'Select Date'}</span>
                    <Calendar size={18} className="text-gray-400" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Shift & Salary Tab */}
          {activeTab === 'shift' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Shift Start Time (HH:mm, 24-hour)
                  </label>
                  <input
                    type="text"
                    name="shift.start"
                    value={formData.shift.start}
                    onChange={handleInputChange}
                    placeholder="09:00"
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                      !isValidTime(formData.shift.start) && formData.shift.start
                        ? 'border-red-500'
                        : 'border-gray-300'
                    }`}
                  />
                  <p className="text-xs text-gray-500 mt-1">Use HH:mm format (e.g., 09:00)</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Shift End Time (HH:mm, 24-hour)
                  </label>
                  <input
                    type="text"
                    name="shift.end"
                    value={formData.shift.end}
                    onChange={handleInputChange}
                    placeholder="18:00"
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                      !isValidTime(formData.shift.end) && formData.shift.end
                        ? 'border-red-500'
                        : 'border-gray-300'
                    }`}
                  />
                  <p className="text-xs text-gray-500 mt-1">Use HH:mm format (e.g., 18:00)</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Hourly Rate (PKR)
                </label>
                <input
                  type="number"
                  name="hourlyRate"
                  value={formData.hourlyRate}
                  onChange={handleInputChange}
                  step="10"
                  min="0"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Monthly Salary Display */}
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <p className="text-sm text-gray-600 mb-1">Estimated Monthly Salary:</p>
                <p className="text-3xl font-bold text-blue-600">
                  PKR {calculateMonthlySalary()}
                </p>
                <p className="text-xs text-gray-600 mt-2">
                  Based on {formData.shift.start} - {formData.shift.end} shift and PKR {formData.hourlyRate}/hour for 22 working days
                </p>
              </div>

              {/* Snapshot Notice */}
              <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                <p className="text-sm text-yellow-800">
                  <span className="font-semibold">⚠️ Note:</span> Changes to shift times and hourly rate apply to future attendance records only. Historical records retain their original snapshot values.
                </p>
              </div>
            </div>
          )}

          {/* Bank Details Tab */}
          {activeTab === 'bank' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Bank Name
                </label>
                <input
                  type="text"
                  name="bank.bankName"
                  value={formData.bank.bankName}
                  onChange={handleInputChange}
                  placeholder="HBL, UBL, etc."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Account Name
                </label>
                <input
                  type="text"
                  name="bank.accountName"
                  value={formData.bank.accountName}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Account Number
                </label>
                <input
                  type="text"
                  name="bank.accountNumber"
                  value={formData.bank.accountNumber}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-4 mt-8 pt-6 border-t">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium disabled:opacity-50"
            >
              <Save size={18} />
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}