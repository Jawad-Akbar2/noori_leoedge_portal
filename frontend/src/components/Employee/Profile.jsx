import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Eye, EyeOff, Save, Calendar, User, Lock, CreditCard } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Profile() {
  const [employee, setEmployee] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [showPassword, setShowPassword] = useState({
    current: false,
    new: false,
    confirm: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  const formatDateToDisplay = (dateStr) => {
    if (!dateStr) return '—';
    const date  = new Date(dateStr);
    const day   = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year  = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const payload = {
        email: employee.email || '',
        bank: {
          bankName: employee.bank?.bankName || '',
          accountName: employee.bank?.accountName || '',
          accountNumber: employee.bank?.accountNumber || '',
        },
      };
      const { data } = await axios.put('/api/employees/me', payload, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (data.success) {
        setEmployee(data.employee); // ← update state with returned employee
        toast.success('Profile updated successfully');
      } else {
        toast.error('Failed to update profile');
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const fetchProfile = async () => {
    try {
      const token = localStorage.getItem('token');
      const { data } = await axios.get('/api/employees/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (data.success) {
        setEmployee(data.employee);
      } else {
        toast.error('Failed to load profile');
      }
    } catch (error) {
      toast.error('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();

    if (!formData.currentPassword) {
      toast.error('Please enter your current password');
      return;
    }
    if (formData.newPassword !== formData.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (formData.newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    if (formData.currentPassword === formData.newPassword) {
      toast.error('New password must be different from current password');
      return;
    }

    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        '/api/auth/change-password',
        { currentPassword: formData.currentPassword, newPassword: formData.newPassword },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Password changed successfully');
      setFormData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setEditMode(false);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to change password');
    } finally {
      setSaving(false);
    }
  };

  const toggleShow = (field) =>
    setShowPassword((prev) => ({ ...prev, [field]: !prev[field] }));

  const cancelEdit = () => {
    setEditMode(false);
    setFormData({ currentPassword: '', newPassword: '', confirmPassword: '' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-gray-500">Loading profile…</div>
      </div>
    );
  }

  const InfoField = ({ label, value }) => (
    <div>
      <label className="block text-sm font-medium text-gray-600 mb-1">{label}</label>
      <div className="w-full px-4 py-2 bg-gray-100 border border-gray-200 rounded-lg text-gray-700 min-h-[40px]">
        {value || <span className="text-gray-400">—</span>}
      </div>
    </div>
  );

  const salaryDisplay = () => {
    if (!employee?.salaryType) return null;
    if (employee.salaryType === 'monthly') {
      return (
        <>
          <InfoField label="Salary Type" value="Monthly" />
          <InfoField label="Monthly Salary (PKR)" value={employee.monthlySalary?.toLocaleString('en-PK')} />
        </>
      );
    }
    return (
      <>
        <InfoField label="Salary Type" value="Hourly" />
        <InfoField label="Hourly Rate (PKR)" value={employee.hourlyRate?.toLocaleString('en-PK')} />
      </>
    );
  };

  return (
    <div className="p-4 md:p-6 bg-gray-50 min-h-screen">
      <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-6">My Profile</h1>

      <div className="max-w-3xl space-y-6">

        {/* Personal Information */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-2 mb-5">
            <User size={18} className="text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-800">Personal Information</h2>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InfoField label="First Name" value={employee?.firstName} />
              <InfoField label="Last Name"  value={employee?.lastName} />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Email</label>
              <input
                type="email"
                value={employee?.email || ""}
                onChange={(e) =>
                  setEmployee((prev) => ({ ...prev, email: e.target.value }))
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InfoField label="Employee ID" value={employee?.employeeNumber} />
              <InfoField label="Department"  value={employee?.department} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Joining Date</label>
                <div className="flex items-center gap-2 px-4 py-2 bg-gray-100 border border-gray-200 rounded-lg text-gray-700 min-h-[40px]">
                  <Calendar size={16} className="text-gray-400 shrink-0" />
                  <span>{employee?.joiningDate ? formatDateToDisplay(employee.joiningDate) : <span className="text-gray-400">—</span>}</span>
                </div>
              </div>
              <InfoField label="Status" value={employee?.status} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InfoField label="Shift Start" value={employee?.shift?.start} />
              <InfoField label="Shift End" value={employee?.shift?.end} />
            </div>

            {employee?.salaryType && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {salaryDisplay()}
              </div>
            )}
          </div>
        </div>

        {/* Bank Details */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-2 mb-5">
            <CreditCard size={18} className="text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-800">Bank Details</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Bank Name</label>
              <input
                type="text"
                value={employee?.bank?.bankName || ""}
                onChange={(e) =>
                  setEmployee((prev) => ({ ...prev, bank: { ...prev.bank, bankName: e.target.value } }))
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Account Name</label>
              <input
                type="text"
                value={employee?.bank?.accountName || ""}
                onChange={(e) =>
                  setEmployee((prev) => ({ ...prev, bank: { ...prev.bank, accountName: e.target.value } }))
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Iban Number</label>
              <input
                type="text"
                value={employee?.bank?.accountNumber || ""}
                onChange={(e) =>
                  setEmployee((prev) => ({ ...prev, bank: { ...prev.bank, accountNumber: e.target.value } }))
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* ── Save Profile Button ── */}
            <div className="flex justify-end mt-4">
              <button
                onClick={handleSaveProfile}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving…' : 'Save Profile'}
              </button>
            </div>
          </div>
        </div>

        {/* Change Password */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <Lock size={18} className="text-blue-600" />
              <h2 className="text-lg font-semibold text-gray-800">Change Password</h2>
            </div>
            {!editMode ? (
              <button
                onClick={() => setEditMode(true)}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition"
              >
                Change Password
              </button>
            ) : (
              <button
                onClick={cancelEdit}
                className="px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200 transition"
              >
                Cancel
              </button>
            )}
          </div>

          {editMode && (
            <form onSubmit={handleChangePassword} className="space-y-4">
              {[
                { label: 'Current Password', field: 'current', key: 'currentPassword', placeholder: 'Enter current password' },
                { label: 'New Password', field: 'new', key: 'newPassword', placeholder: 'At least 8 characters' },
                { label: 'Confirm New Password', field: 'confirm', key: 'confirmPassword', placeholder: 'Repeat new password' },
              ].map(({ label, field, key, placeholder }) => (
                <div key={field}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {label} <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword[field] ? 'text' : 'password'}
                      value={formData[key]}
                      onChange={(e) => setFormData((prev) => ({ ...prev, [key]: e.target.value }))}
                      required
                      className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      placeholder={placeholder}
                    />
                    <button
                      type="button"
                      onClick={() => toggleShow(field)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword[field] ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {key === 'newPassword' && (
                    <p className="text-xs text-gray-500 mt-1">Must be at least 8 characters</p>
                  )}
                </div>
              ))}

              <button
                type="submit"
                disabled={saving}
                className="flex items-center justify-center gap-2 w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <Save size={16} />
                {saving ? 'Saving…' : 'Update Password'}
              </button>
            </form>
          )}
        </div>

      </div>
    </div>
  );
}