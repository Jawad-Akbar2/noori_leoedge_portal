import React, { useState, useRef } from 'react';
import axios from 'axios';
import { X, Save, AlertCircle, Calendar } from 'lucide-react';
import toast from 'react-hot-toast';
import EmployeeLinkDialog from './EmployeeLinkDialog';
import { formatToDDMMYYYY } from '../../utils/dateFormatter';

export default function AddEmployeeModal({ onClose, onSave }) {
  const [activeTab, setActiveTab] = useState('basic');
  const [loading, setLoading] = useState(false);
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [generatedLink, setGeneratedLink] = useState(null);
  const [newEmployee, setNewEmployee] = useState(null);
  const dateInputRef = useRef(null);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    employeeNumber: '',
    department: 'IT',
    joiningDate: new Date().toISOString().split('T')[0],
    shift: { start: '09:00', end: '18:00' },
    hourlyRate: 0,
    bank: { bankName: '', accountName: '', accountNumber: '' }
  });
  const [errors, setErrors] = useState({});

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setErrors(prev => ({ ...prev, [name]: '' }));
    
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

  const validateForm = () => {
    const newErrors = {};

    if (!formData.firstName.trim()) {
      newErrors.firstName = 'First name is required';
    }
    if (!formData.lastName.trim()) {
      newErrors.lastName = 'Last name is required';
    }
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }
    if (!formData.employeeNumber.trim()) {
      newErrors.employeeNumber = 'Employee number is required';
    }
    if (!formData.joiningDate) {
      newErrors.joiningDate = 'Joining date is required';
    }
    if (!isValidTime(formData.shift.start)) {
      newErrors.shiftStart = 'Invalid shift start time (HH:mm format)';
    }
    if (!isValidTime(formData.shift.end)) {
      newErrors.shiftEnd = 'Invalid shift end time (HH:mm format)';
    }
    if (formData.hourlyRate <= 0) {
      newErrors.hourlyRate = 'Hourly rate must be greater than 0';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleGenerateLink = async (e) => {
    e.preventDefault();

    // Validate form first
    if (!validateForm()) {
      toast.error('Please correct the errors below');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      
      // Create employee in database
      const response = await axios.post(
        '/api/employees',
        {
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          employeeNumber: formData.employeeNumber,
          department: formData.department,
          joiningDate: formatToDDMMYYYY(formData.joiningDate), // Convert to dd/mm/yyyy for backend
          shift: formData.shift,
          hourlyRate: parseFloat(formData.hourlyRate),
          bank: formData.bank
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Backend returns employee with inviteLink
      const { employee, inviteLink } = response.data;

      // Store for reference
      setNewEmployee(employee);
      setGeneratedLink(inviteLink);

      // Close create dialog
      onClose();

      // Open link dialog
      setShowLinkDialog(true);

      // Notify parent
      if (onSave) {
        onSave();
      }

      toast.success('Employee created successfully');
    } catch (error) {
      const errorMsg = error.response?.data?.message || 'Failed to create employee';
      setErrors({ submit: errorMsg });
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleCloseLinkDialog = () => {
    setShowLinkDialog(false);
    setGeneratedLink(null);
    setNewEmployee(null);
  };

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="sticky top-0 bg-white border-b p-6 flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-800">Add New Employee</h2>
            <button
              onClick={onClose}
              disabled={loading}
              className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
            >
              <X size={24} />
            </button>
          </div>

          {/* Submit Error Alert */}
          {errors.submit && (
            <div className="mx-6 mt-6 bg-red-50 border border-red-200 p-4 rounded-lg flex gap-3">
              <AlertCircle className="text-red-600 flex-shrink-0" size={20} />
              <p className="text-red-800 text-sm">{errors.submit}</p>
            </div>
          )}

          {/* Tabs */}
          <div className="border-b">
            <div className="flex">
              <button
                type="button"
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
                type="button"
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
                type="button"
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
          <form onSubmit={handleGenerateLink} className="p-6">
            {/* Basic Info Tab */}
            {activeTab === 'basic' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      First Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleInputChange}
                      disabled={loading}
                      className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 ${
                        errors.firstName ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="John"
                    />
                    {errors.firstName && (
                      <p className="text-xs text-red-600 mt-1">{errors.firstName}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Last Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleInputChange}
                      disabled={loading}
                      className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 ${
                        errors.lastName ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="Doe"
                    />
                    {errors.lastName && (
                      <p className="text-xs text-red-600 mt-1">{errors.lastName}</p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    disabled={loading}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 ${
                      errors.email ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="john@example.com"
                  />
                  {errors.email && (
                    <p className="text-xs text-red-600 mt-1">{errors.email}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Employee Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="employeeNumber"
                      value={formData.employeeNumber}
                      onChange={handleInputChange}
                      disabled={loading}
                      className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 ${
                        errors.employeeNumber ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="EMP002"
                    />
                    {errors.employeeNumber && (
                      <p className="text-xs text-red-600 mt-1">{errors.employeeNumber}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Department <span className="text-red-500">*</span>
                    </label>
                    <select
                      name="department"
                      value={formData.department}
                      onChange={handleInputChange}
                      disabled={loading}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                    >
                      <option value="IT">IT</option>
                      <option value="Customer Support">Customer Support</option>
                      <option value="Marketing">Marketing</option>
                      <option value="HR">HR</option>
                      <option value="Finance">Finance</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Joining Date <span className="text-red-500">*</span>
                  </label>
                  <div 
                    className="relative group cursor-pointer"
                    onClick={() => !loading && dateInputRef.current?.showPicker()}
                  >
                    <input
                      type="date"
                      ref={dateInputRef}
                      name="joiningDate"
                      value={formData.joiningDate}
                      onChange={handleInputChange}
                      disabled={loading}
                      className="opacity-0 absolute inset-0 w-full h-full cursor-pointer z-10 disabled:cursor-not-allowed"
                    />
                    <div className={`flex items-center gap-2 px-4 py-2 border rounded-lg bg-white group-hover:border-blue-400 transition-colors ${
                        errors.joiningDate ? 'border-red-500' : 'border-gray-300'
                      } ${loading ? 'bg-gray-100' : ''}`}>
                      <Calendar size={18} className="text-gray-400" />
                      <span className="text-gray-700">
                        {formData.joiningDate ? formatToDDMMYYYY(formData.joiningDate) : 'Select Date'}
                      </span>
                    </div>
                  </div>
                  {errors.joiningDate && (
                    <p className="text-xs text-red-600 mt-1">{errors.joiningDate}</p>
                  )}
                </div>
              </div>
            )}

            {/* Shift & Salary Tab */}
            {activeTab === 'shift' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Shift Start Time (HH:mm) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="shift.start"
                      value={formData.shift.start}
                      onChange={handleInputChange}
                      disabled={loading}
                      placeholder="09:00"
                      className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 ${
                        errors.shiftStart ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                    {errors.shiftStart && (
                      <p className="text-xs text-red-600 mt-1">{errors.shiftStart}</p>
                    )}
                    <p className="text-xs text-gray-500 mt-1">24-hour format</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Shift End Time (HH:mm) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="shift.end"
                      value={formData.shift.end}
                      onChange={handleInputChange}
                      disabled={loading}
                      placeholder="18:00"
                      className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 ${
                        errors.shiftEnd ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                    {errors.shiftEnd && (
                      <p className="text-xs text-red-600 mt-1">{errors.shiftEnd}</p>
                    )}
                    <p className="text-xs text-gray-500 mt-1">24-hour format</p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Hourly Rate (PKR) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    name="hourlyRate"
                    value={formData.hourlyRate}
                    onChange={handleInputChange}
                    disabled={loading}
                    step="10"
                    min="0"
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 ${
                      errors.hourlyRate ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {errors.hourlyRate && (
                    <p className="text-xs text-red-600 mt-1">{errors.hourlyRate}</p>
                  )}
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
                    disabled={loading}
                    placeholder="HBL, UBL, etc."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
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
                    disabled={loading}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
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
                    disabled={loading}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                  />
                </div>

                <p className="text-xs text-gray-500">Bank details are optional</p>
              </div>
            )}

            {/* Buttons */}
            <div className="flex gap-4 mt-8 pt-6 border-t">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Creating...
                  </>
                ) : (
                  <>
                    <Save size={18} />
                    Generate Link
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Link Dialog */}
      {showLinkDialog && generatedLink && newEmployee && (
        <EmployeeLinkDialog
          employee={newEmployee}
          inviteLink={generatedLink}
          onClose={handleCloseLinkDialog}
        />
      )}
    </>
  );
}