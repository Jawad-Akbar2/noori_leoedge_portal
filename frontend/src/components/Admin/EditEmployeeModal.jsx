import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { X, Save, AlertCircle, Calendar, Shield } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatToDDMMYYYY } from '../../utils/dateFormatter';

// currentUserRole passed from ManageEmployees
export default function EditEmployeeModal({ employee, onClose, onSave, currentUserRole }) {
  const isSuperAdmin = currentUserRole === 'superadmin';
  // The role of the employee being edited (not the logged-in user)
  const targetRole   = employee?.role || 'employee';

  const [activeTab, setActiveTab] = useState('basic');
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState(null);
  const dateInputRef = useRef(null);

  const [formData, setFormData] = useState({
    firstName:      '',
    lastName:       '',
    email:          '',
    employeeNumber: '',
    department:     'IT',
    role:           'employee',
    joiningDate:    '',
    shift:          { start: '09:00', end: '18:00' },
    salaryType:     'hourly',
    hourlyRate:     0,
    monthlySalary:  '',
    bank:           { bankName: '', accountName: '', accountNumber: '' }
  });

  const [errors, setErrors] = useState({});

  useEffect(() => {
    const loadEmployeeData = async () => {
      setDataLoading(true);
      setError(null);
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get(`/api/employees/${employee._id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        const emp = response.data.employee;

        setFormData({
          firstName:      emp.firstName      || '',
          lastName:       emp.lastName       || '',
          email:          emp.email          || '',
          employeeNumber: emp.employeeNumber || '',
          department:     emp.department     || 'IT',
          role:           emp.role           || 'employee',
          joiningDate:    emp.joiningDate
            ? new Date(emp.joiningDate).toISOString().split('T')[0]
            : '',
          shift:          emp.shift          || { start: '09:00', end: '18:00' },
          salaryType:     emp.salaryType     || 'hourly',
          hourlyRate:     emp.hourlyRate     || 0,
          monthlySalary:  emp.monthlySalary  || '',
          bank:           emp.bank           || { bankName: '', accountName: '', accountNumber: '' }
        });
      } catch {
        setError('Failed to load employee data. Employee may no longer exist.');
      } finally {
        setDataLoading(false);
      }
    };

    loadEmployeeData();
  }, [employee._id]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setErrors(prev => ({ ...prev, [name]: '' }));

    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      setFormData(prev => ({ ...prev, [parent]: { ...prev[parent], [child]: value } }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const isValidTime = (time) => /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(time);

  const calculateMonthlySalary = () => {
    if (!formData.hourlyRate || !formData.shift.start || !formData.shift.end) return 0;
    const [startH, startM] = formData.shift.start.split(':').map(Number);
    const [endH, endM]     = formData.shift.end.split(':').map(Number);
    let startMin = startH * 60 + startM;
    let endMin   = endH * 60 + endM;
    if (endMin <= startMin) endMin += 24 * 60;
    return ((endMin - startMin) / 60 * 22 * parseFloat(formData.hourlyRate)).toFixed(2);
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.firstName.trim()) newErrors.firstName = 'First name is required';
    if (!formData.lastName.trim())  newErrors.lastName  = 'Last name is required';
    if (!isValidTime(formData.shift.start)) newErrors.shiftStart = 'Invalid shift start (HH:mm)';
    if (!isValidTime(formData.shift.end))   newErrors.shiftEnd   = 'Invalid shift end (HH:mm)';

    if (formData.salaryType === 'hourly') {
      if (!formData.hourlyRate || parseFloat(formData.hourlyRate) <= 0)
        newErrors.hourlyRate = 'Hourly rate must be greater than 0';
    }
    if (formData.salaryType === 'monthly') {
      if (!formData.monthlySalary || parseFloat(formData.monthlySalary) <= 0)
        newErrors.monthlySalary = 'Monthly salary is required and must be greater than 0';
    }

    if (Object.keys(newErrors).length > 0) {
      if (newErrors.firstName || newErrors.lastName) {
        setActiveTab('basic');
      } else if (newErrors.shiftStart || newErrors.shiftEnd ||
                 newErrors.hourlyRate || newErrors.monthlySalary) {
        setActiveTab('shift');
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) {
      toast.error('Please correct the errors below');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('token');

      const payload = {
        firstName:     formData.firstName,
        lastName:      formData.lastName,
        department:    formData.department,
        shift:         formData.shift,
        salaryType:    formData.salaryType,
        hourlyRate:    parseFloat(formData.hourlyRate) || 0,
        monthlySalary: formData.salaryType === 'monthly' ? parseFloat(formData.monthlySalary) : null,
        bank:          formData.bank,
        joiningDate:   formatToDDMMYYYY(formData.joiningDate),
        // Only superadmin can change the role field
        ...(isSuperAdmin && { role: formData.role })
      };

      await axios.put(`/api/employees/${employee._id}`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success('Employee updated successfully');
      if (onSave) onSave();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update employee');
    } finally {
      setLoading(false);
    }
  };

  // Whether this employee being edited is a privileged account
  const editingPrivilegedAccount = ['admin', 'superadmin'].includes(targetRole);

  if (error) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg w-full max-w-md p-6">
          <div className="flex items-center gap-3 mb-4 text-red-600">
            <AlertCircle size={24} />
            <h2 className="text-lg font-bold">Error Loading Employee</h2>
          </div>
          <p className="text-gray-600 mb-6">{error}</p>
          <button onClick={onClose}
            className="w-full px-4 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400 transition">
            Close
          </button>
        </div>
      </div>
    );
  }

  if (dataLoading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg w-full max-w-md p-6 text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4" />
          <p className="text-gray-600">Loading employee information...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className={`sticky top-0 border-b p-6 flex items-center justify-between ${editingPrivilegedAccount ? 'bg-purple-50' : 'bg-white'}`}>
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Edit Employee</h2>
            <p className="text-sm text-gray-600 mt-1">
              {formData.firstName} {formData.lastName}
              {editingPrivilegedAccount && (
                <span className="ml-2 inline-flex items-center gap-1 text-xs text-purple-700 font-semibold">
                  <Shield size={11} /> {targetRole}
                </span>
              )}
            </p>
          </div>
          <button onClick={onClose} disabled={loading}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-50">
            <X size={24} />
          </button>
        </div>

        {/* Privileged account notice */}
        {editingPrivilegedAccount && (
          <div className="mx-6 mt-4 bg-purple-50 border border-purple-200 rounded-lg p-3 flex items-start gap-2">
            <Shield size={16} className="text-purple-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-purple-800">
              You are editing a <strong>{targetRole}</strong> account. Role changes here take effect immediately and will change their system access level.
            </p>
          </div>
        )}

        {/* Tabs */}
        <div className="border-b">
          <div className="flex">
            {[
              { key: 'basic', label: 'Basic Info' },
              { key: 'shift', label: 'Shift & Salary' },
              { key: 'bank',  label: 'Bank Details' }
            ].map(tab => (
              <button key={tab.key} type="button" onClick={() => setActiveTab(tab.key)}
                className={`flex-1 px-4 py-3 font-medium border-b-2 transition ${
                  activeTab === tab.key
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-800'
                }`}>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6">

          {/* ── Basic Info Tab ───────────────────────────────────────────── */}
          {activeTab === 'basic' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">First Name *</label>
                  <input type="text" name="firstName" value={formData.firstName}
                    onChange={handleInputChange} disabled={loading}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 ${errors.firstName ? 'border-red-500' : 'border-gray-300'}`} />
                  {errors.firstName && <p className="text-xs text-red-600 mt-1">{errors.firstName}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Last Name *</label>
                  <input type="text" name="lastName" value={formData.lastName}
                    onChange={handleInputChange} disabled={loading}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 ${errors.lastName ? 'border-red-500' : 'border-gray-300'}`} />
                  {errors.lastName && <p className="text-xs text-red-600 mt-1">{errors.lastName}</p>}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email (Read-only)</label>
                <input type="email" value={formData.email} readOnly
                  className="w-full px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg text-gray-600 cursor-not-allowed" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Employee Number (Read-only)</label>
                <input type="text" value={formData.employeeNumber} readOnly
                  className="w-full px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg text-gray-600 cursor-not-allowed" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Department</label>
                <select name="department" value={formData.department}
                  onChange={handleInputChange} disabled={loading}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100">
                  <option value="IT">IT</option>
                  <option value="Customer Support">Customer Support</option>
                  <option value="Manager">Manager</option>
                  <option value="Marketing">Marketing</option>
                  <option value="HR">HR</option>
                  <option value="Finance">Finance</option>
                </select>
              </div>

              {/* ── Role field — superadmin only ───────────────────────── */}
              {isSuperAdmin ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Role <span className="text-red-500">*</span>
                  </label>
                  <select name="role" value={formData.role}
                    onChange={handleInputChange} disabled={loading}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 ${
                      ['admin','superadmin'].includes(formData.role)
                        ? 'border-purple-400 bg-purple-50 text-purple-900 font-medium'
                        : 'border-gray-300'
                    }`}>
                    <option value="employee">Employee</option>
                    <option value="admin">Admin</option>
                    <option value="superadmin">Superadmin</option>
                  </select>
                  {['admin','superadmin'].includes(formData.role) && (
                    <p className="text-xs text-purple-700 mt-1 flex items-center gap-1">
                      <Shield size={11} />
                      This account has {formData.role}-level system access.
                    </p>
                  )}
                </div>
              ) : (
                /* Admin sees role as read-only */
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Role (Read-only)</label>
                  <input type="text" value={formData.role || 'employee'} readOnly
                    className="w-full px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg text-gray-600 cursor-not-allowed capitalize" />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Joining Date (Read-only)</label>
                <div className="w-full px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg text-gray-600 flex items-center justify-between cursor-not-allowed">
                  <span>{formData.joiningDate ? formatToDDMMYYYY(formData.joiningDate) : '—'}</span>
                  <Calendar size={18} className="text-gray-400" />
                </div>
              </div>
            </div>
          )}

          {/* ── Shift & Salary Tab ───────────────────────────────────────── */}
          {activeTab === 'shift' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Shift Start (HH:mm) *</label>
                  <input type="text" name="shift.start" value={formData.shift.start}
                    onChange={handleInputChange} disabled={loading} placeholder="09:00"
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 ${errors.shiftStart ? 'border-red-500' : 'border-gray-300'}`} />
                  {errors.shiftStart && <p className="text-xs text-red-600 mt-1">{errors.shiftStart}</p>}
                  <p className="text-xs text-gray-500 mt-1">24-hour format</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Shift End (HH:mm) *</label>
                  <input type="text" name="shift.end" value={formData.shift.end}
                    onChange={handleInputChange} disabled={loading} placeholder="18:00"
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 ${errors.shiftEnd ? 'border-red-500' : 'border-gray-300'}`} />
                  {errors.shiftEnd && <p className="text-xs text-red-600 mt-1">{errors.shiftEnd}</p>}
                  <p className="text-xs text-gray-500 mt-1">24-hour format</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Salary Type *</label>
                <select name="salaryType" value={formData.salaryType}
                  onChange={handleInputChange} disabled={loading}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100">
                  <option value="hourly">Hourly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>

              {formData.salaryType === 'hourly' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Hourly Rate (PKR) *</label>
                  <input type="number" name="hourlyRate" value={formData.hourlyRate}
                    onChange={handleInputChange} disabled={loading} step="10" min="0"
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 ${errors.hourlyRate ? 'border-red-500' : 'border-gray-300'}`} />
                  {errors.hourlyRate && <p className="text-xs text-red-600 mt-1">{errors.hourlyRate}</p>}
                </div>
              )}

              {formData.salaryType === 'monthly' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Monthly Salary (PKR) *</label>
                  <input type="number" name="monthlySalary" value={formData.monthlySalary}
                    onChange={handleInputChange} disabled={loading} step="100" min="0" placeholder="e.g. 50000"
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 ${errors.monthlySalary ? 'border-red-500' : 'border-gray-300'}`} />
                  {errors.monthlySalary && <p className="text-xs text-red-600 mt-1">{errors.monthlySalary}</p>}
                  <p className="text-xs text-gray-500 mt-1">Effective hourly rate is derived automatically for payroll calculations.</p>
                </div>
              )}

              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                {formData.salaryType === 'hourly' ? (
                  <>
                    <p className="text-sm text-gray-600 mb-1">Estimated Monthly Salary:</p>
                    <p className="text-3xl font-bold text-blue-600">PKR {calculateMonthlySalary()}</p>
                    <p className="text-xs text-gray-500 mt-2">
                      {formData.shift.start}–{formData.shift.end} × PKR {formData.hourlyRate}/hr × 22 days
                    </p>
                    <p className="text-xs text-amber-600 mt-1">
                      ⚠️ Estimate only — actual pay depends on working days in the pay period.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-gray-600 mb-1">Fixed Monthly Salary:</p>
                    <p className="text-3xl font-bold text-blue-600">
                      PKR {formData.monthlySalary ? parseFloat(formData.monthlySalary).toFixed(2) : '0.00'}
                    </p>
                    <p className="text-xs text-gray-500 mt-2">Pro-rated by actual working days attended each pay period.</p>
                  </>
                )}
              </div>

              <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                <p className="text-sm text-yellow-800">
                  <span className="font-semibold">⚠️ Note:</span> Changes to shift times and salary apply to future attendance records only. Historical records retain their original snapshot values.
                </p>
              </div>
            </div>
          )}

          {/* ── Bank Details Tab ─────────────────────────────────────────── */}
          {activeTab === 'bank' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Bank Name</label>
                <input type="text" name="bank.bankName" value={formData.bank.bankName}
                  onChange={handleInputChange} disabled={loading} placeholder="HBL, UBL, etc."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Account Name</label>
                <input type="text" name="bank.accountName" value={formData.bank.accountName}
                  onChange={handleInputChange} disabled={loading}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Account Number</label>
                <input type="text" name="bank.accountNumber" value={formData.bank.accountNumber}
                  onChange={handleInputChange} disabled={loading}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100" />
              </div>
              <p className="text-xs text-gray-500">Bank details are optional and can be updated anytime.</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-4 mt-8 pt-6 border-t">
            <button type="button" onClick={onClose} disabled={loading}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed">
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save size={18} />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}