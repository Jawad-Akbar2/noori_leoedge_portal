import React, { useState, useRef } from 'react';
import axios from 'axios';
import { X, Save, AlertCircle, Calendar, Shield } from 'lucide-react';
import toast from 'react-hot-toast';
import EmployeeLinkDialog from './EmployeeLinkDialog';
import { formatToDDMMYYYY } from '../../utils/dateFormatter';

// currentUserRole is passed from ManageEmployees
export default function AddEmployeeModal({ onClose, onSave, currentUserRole }) {
  const isSuperAdmin = currentUserRole === 'superadmin';

  const [activeTab, setActiveTab] = useState('basic');
  const [loading, setLoading] = useState(false);
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [generatedLink, setGeneratedLink] = useState(null);
  const [newEmployee, setNewEmployee] = useState(null);
  const dateInputRef = useRef(null);

  const [formData, setFormData] = useState({
    firstName:      '',
    lastName:       '',
    email:          '',
    employeeNumber: '',
    department:     'IT',
    // Superadmin can set role; admin always creates 'employee'
    role:           'employee',
    joiningDate:    new Date().toISOString().split('T')[0],
    shift:          { start: '09:00', end: '18:00' },
    salaryType:     'hourly',
    hourlyRate:     0,
    monthlySalary:  '',
    bank:           { bankName: '', accountName: '', accountNumber: '' }
  });

  const [errors, setErrors] = useState({});

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

  const calculateMonthlySalary = () => {
    if (!formData.hourlyRate || !formData.shift.start || !formData.shift.end) return 0;
    const [startH, startM] = formData.shift.start.split(':').map(Number);
    const [endH, endM]     = formData.shift.end.split(':').map(Number);
    let startMin = startH * 60 + startM;
    let endMin   = endH * 60 + endM;
    if (endMin <= startMin) endMin += 24 * 60;
    return ((endMin - startMin) / 60 * 22 * parseFloat(formData.hourlyRate)).toFixed(2);
  };

  const isValidTime = (time) => /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(time);

  const validateForm = () => {
    const newErrors = {};

    if (!formData.firstName.trim())      newErrors.firstName      = 'First name is required';
    if (!formData.lastName.trim())       newErrors.lastName       = 'Last name is required';
    if (!formData.email.trim())          newErrors.email          = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email))
                                         newErrors.email          = 'Invalid email format';
    if (!formData.employeeNumber.trim()) newErrors.employeeNumber = 'Employee number is required';
    if (!formData.joiningDate)           newErrors.joiningDate    = 'Joining date is required';

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
      if (newErrors.firstName || newErrors.lastName || newErrors.email ||
          newErrors.employeeNumber || newErrors.joiningDate) {
        setActiveTab('basic');
      } else if (newErrors.shiftStart || newErrors.shiftEnd ||
                 newErrors.hourlyRate || newErrors.monthlySalary) {
        setActiveTab('shift');
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleGenerateLink = async (e) => {
    e.preventDefault();
    if (!validateForm()) {
      toast.error('Please correct the errors below');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('token');

      const payload = {
        firstName:      formData.firstName,
        lastName:       formData.lastName,
        email:          formData.email,
        employeeNumber: formData.employeeNumber,
        department:     formData.department,
        // Only send role if superadmin; otherwise always 'employee'
        role:           isSuperAdmin ? formData.role : 'employee',
        joiningDate:    formatToDDMMYYYY(formData.joiningDate),
        shift:          formData.shift,
        salaryType:     formData.salaryType,
        hourlyRate:     parseFloat(formData.hourlyRate) || 0,
        monthlySalary:  formData.salaryType === 'monthly' ? parseFloat(formData.monthlySalary) : null,
        bank:           formData.bank
      };

      const response = await axios.post('/api/employees', payload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const { employee, inviteLink } = response.data;
      setNewEmployee(employee);
      setGeneratedLink(inviteLink);
      setShowLinkDialog(true);

      if (onSave) onSave();
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
    onClose();
  };

  // Role badge preview shown when superadmin selects admin/superadmin role
  const selectedRoleIsPrivileged = isSuperAdmin && ['admin', 'superadmin'].includes(formData.role);

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">

          {/* Header */}
          <div className="sticky top-0 bg-white border-b p-6 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-800">Add New Employee</h2>
              {isSuperAdmin && (
                <p className="text-xs text-purple-600 mt-1 flex items-center gap-1">
                  <Shield size={11} /> Superadmin — can also create admin accounts
                </p>
              )}
            </div>
            <button onClick={onClose} disabled={loading}
              className="text-gray-400 hover:text-gray-600 disabled:opacity-50">
              <X size={24} />
            </button>
          </div>

          {/* Submit Error */}
          {errors.submit && (
            <div className="mx-6 mt-6 bg-red-50 border border-red-200 p-4 rounded-lg flex gap-3">
              <AlertCircle className="text-red-600 flex-shrink-0" size={20} />
              <p className="text-red-800 text-sm">{errors.submit}</p>
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

          <form onSubmit={handleGenerateLink} className="p-6">

            {/* ── Basic Info Tab ──────────────────────────────────────────── */}
            {activeTab === 'basic' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      First Name <span className="text-red-500">*</span>
                    </label>
                    <input type="text" name="firstName" value={formData.firstName}
                      onChange={handleInputChange} disabled={loading} placeholder="John"
                      className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 ${errors.firstName ? 'border-red-500' : 'border-gray-300'}`} />
                    {errors.firstName && <p className="text-xs text-red-600 mt-1">{errors.firstName}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Last Name <span className="text-red-500">*</span>
                    </label>
                    <input type="text" name="lastName" value={formData.lastName}
                      onChange={handleInputChange} disabled={loading} placeholder="Doe"
                      className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 ${errors.lastName ? 'border-red-500' : 'border-gray-300'}`} />
                    {errors.lastName && <p className="text-xs text-red-600 mt-1">{errors.lastName}</p>}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input type="email" name="email" value={formData.email}
                    onChange={handleInputChange} disabled={loading} placeholder="john@example.com"
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 ${errors.email ? 'border-red-500' : 'border-gray-300'}`} />
                  {errors.email && <p className="text-xs text-red-600 mt-1">{errors.email}</p>}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Employee Number <span className="text-red-500">*</span>
                    </label>
                    <input type="text" name="employeeNumber" value={formData.employeeNumber}
                      onChange={handleInputChange} disabled={loading} placeholder="EMP002"
                      className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 ${errors.employeeNumber ? 'border-red-500' : 'border-gray-300'}`} />
                    {errors.employeeNumber && <p className="text-xs text-red-600 mt-1">{errors.employeeNumber}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Department <span className="text-red-500">*</span>
                    </label>
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
                </div>

                {/* ── Role selector — superadmin only ───────────────────── */}
                {isSuperAdmin && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Role <span className="text-red-500">*</span>
                    </label>
                    <select name="role" value={formData.role}
                      onChange={handleInputChange} disabled={loading}
                      className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 ${
                        selectedRoleIsPrivileged
                          ? 'border-purple-400 bg-purple-50 text-purple-900 font-medium'
                          : 'border-gray-300'
                      }`}>
                      <option value="employee">Employee</option>
                      <option value="admin">Admin</option>
                      <option value="superadmin">Superadmin</option>
                    </select>
                    {selectedRoleIsPrivileged && (
                      <p className="text-xs text-purple-700 mt-1 flex items-center gap-1">
                        <Shield size={11} />
                        This account will have {formData.role} privileges — full system access.
                      </p>
                    )}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Joining Date <span className="text-red-500">*</span>
                  </label>
                  <div className="relative group cursor-pointer"
                    onClick={() => !loading && dateInputRef.current?.showPicker()}>
                    <input type="date" ref={dateInputRef} name="joiningDate"
                      value={formData.joiningDate} onChange={handleInputChange} disabled={loading}
                      className="opacity-0 absolute inset-0 w-full h-full cursor-pointer z-10 disabled:cursor-not-allowed" />
                    <div className={`flex items-center gap-2 px-4 py-2 border rounded-lg bg-white group-hover:border-blue-400 transition-colors ${errors.joiningDate ? 'border-red-500' : 'border-gray-300'} ${loading ? 'bg-gray-100' : ''}`}>
                      <Calendar size={18} className="text-gray-400" />
                      <span className="text-gray-700">
                        {formData.joiningDate ? formatToDDMMYYYY(formData.joiningDate) : 'Select Date'}
                      </span>
                    </div>
                  </div>
                  {errors.joiningDate && <p className="text-xs text-red-600 mt-1">{errors.joiningDate}</p>}
                </div>
              </div>
            )}

            {/* ── Shift & Salary Tab ─────────────────────────────────────── */}
            {activeTab === 'shift' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Shift Start (HH:mm) <span className="text-red-500">*</span>
                    </label>
                    <input type="text" name="shift.start" value={formData.shift.start}
                      onChange={handleInputChange} disabled={loading} placeholder="09:00"
                      className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 ${errors.shiftStart ? 'border-red-500' : 'border-gray-300'}`} />
                    {errors.shiftStart && <p className="text-xs text-red-600 mt-1">{errors.shiftStart}</p>}
                    <p className="text-xs text-gray-500 mt-1">24-hour format</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Shift End (HH:mm) <span className="text-red-500">*</span>
                    </label>
                    <input type="text" name="shift.end" value={formData.shift.end}
                      onChange={handleInputChange} disabled={loading} placeholder="18:00"
                      className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 ${errors.shiftEnd ? 'border-red-500' : 'border-gray-300'}`} />
                    {errors.shiftEnd && <p className="text-xs text-red-600 mt-1">{errors.shiftEnd}</p>}
                    <p className="text-xs text-gray-500 mt-1">24-hour format</p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Salary Type <span className="text-red-500">*</span>
                  </label>
                  <select name="salaryType" value={formData.salaryType}
                    onChange={handleInputChange} disabled={loading}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100">
                    <option value="hourly">Hourly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>

                {formData.salaryType === 'hourly' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Hourly Rate (PKR) <span className="text-red-500">*</span>
                    </label>
                    <input type="number" name="hourlyRate" value={formData.hourlyRate}
                      onChange={handleInputChange} disabled={loading} step="10" min="0"
                      className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 ${errors.hourlyRate ? 'border-red-500' : 'border-gray-300'}`} />
                    {errors.hourlyRate && <p className="text-xs text-red-600 mt-1">{errors.hourlyRate}</p>}
                  </div>
                )}

                {formData.salaryType === 'monthly' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Monthly Salary (PKR) <span className="text-red-500">*</span>
                    </label>
                    <input type="number" name="monthlySalary" value={formData.monthlySalary}
                      onChange={handleInputChange} disabled={loading} step="100" min="0" placeholder="e.g. 50000"
                      className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 ${errors.monthlySalary ? 'border-red-500' : 'border-gray-300'}`} />
                    {errors.monthlySalary && <p className="text-xs text-red-600 mt-1">{errors.monthlySalary}</p>}
                    <p className="text-xs text-gray-500 mt-1">An effective hourly rate will be derived automatically.</p>
                  </div>
                )}

                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  {formData.salaryType === 'hourly' ? (
                    <>
                      <p className="text-sm text-gray-600 mb-1">Estimated Monthly Salary:</p>
                      <p className="text-3xl font-bold text-blue-600">PKR {calculateMonthlySalary()}</p>
                      <p className="text-xs text-gray-500 mt-2">
                        Based on {formData.shift.start}–{formData.shift.end} × PKR {formData.hourlyRate}/hr × 22 days
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
              </div>
            )}

            {/* ── Bank Details Tab ───────────────────────────────────────── */}
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
                <p className="text-xs text-gray-500">Bank details are optional and can be added later.</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-4 mt-8 pt-6 border-t">
              <button type="button" onClick={onClose} disabled={loading}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed">
                Cancel
              </button>
              <button type="submit" disabled={loading}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition font-medium disabled:opacity-50 disabled:cursor-not-allowed text-white ${
                  selectedRoleIsPrivileged ? 'bg-purple-600 hover:bg-purple-700' : 'bg-blue-600 hover:bg-blue-700'
                }`}>
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
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