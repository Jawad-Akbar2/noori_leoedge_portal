import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Eye, EyeOff, Save, Calendar, User, Lock, CreditCard,
  Shield, ShieldCheck, UserCircle, Pencil, X, Check,
} from 'lucide-react';
import toast from 'react-hot-toast';

// ═════════════════════════════════════════════════════════════════════════════
// ─── ROLE DETECTION ──────────────────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════

function getCurrentUserRole() {
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return user.role || localStorage.getItem('role') || 'employee';
  } catch {
    return localStorage.getItem('role') || 'employee';
  }
}

// Role config — drives UI decisions in one place
const ROLE_CONFIG = {
  superadmin: {
    label:     'Super Administrator',
    Icon:      Shield,
    iconBg:    'bg-indigo-600',
    accentRing: 'focus:ring-indigo-500',
    accentBorder: 'border-indigo-300',
    accentBg:  'bg-indigo-50/40',
    btnBg:     'bg-indigo-600 hover:bg-indigo-700',
    pwBtnBg:   'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100',
    // superadmin can edit email + bank (backend limit); name fields shown editable too
    // but saving only sends email+bank to /me
    canEditPersonal: true,   // shows name/dept as editable inputs
    canEditEmail:    true,
    canEditBank:     true,
  canEditShift:      true,
  canEditSalary:     true,
  canEditStatus:     true,
  canEditJoining:    true,
  canEditDepartment: true,
  },
  admin: {
    label:     'Administrator',
    Icon:      ShieldCheck,
    iconBg:    'bg-blue-600',
    accentRing: 'focus:ring-blue-500',
    accentBorder: 'border-blue-300',
    accentBg:  'bg-blue-50/30',
    btnBg:     'bg-blue-600 hover:bg-blue-700',
    pwBtnBg:   'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100',
    canEditEmail:    true,
    canEditBank:     true,
  },
  employee: {
    label:     'Employee',
    Icon:      UserCircle,
    iconBg:    'bg-green-600',
    accentRing: 'focus:ring-green-500',
    accentBorder: 'border-green-300',
    accentBg:  'bg-green-50/30',
    btnBg:     'bg-green-600 hover:bg-green-700',
    pwBtnBg:   'bg-green-50 text-green-700 border-green-200 hover:bg-green-100',
    canEditEmail:    true,
    canEditBank:     true,
  },
  hybrid: {
    label:     'Hybrid Employee',
    Icon:      UserCircle,
    iconBg:    'bg-purple-600',
    accentRing: 'focus:ring-purple-500',
    accentBorder: 'border-purple-300',
    accentBg:  'bg-purple-50/30',
    btnBg:     'bg-purple-600 hover:bg-purple-700',
    pwBtnBg:   'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100',
    canEditEmail:    true,
    canEditBank:     true,
  },
};

// ═════════════════════════════════════════════════════════════════════════════
// ─── SMALL RE-USABLE PRIMITIVES ───────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════

const formatDateToDisplay = (dateStr) => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return [
    String(d.getDate()).padStart(2, '0'),
    String(d.getMonth() + 1).padStart(2, '0'),
    d.getFullYear(),
  ].join('/');
};

/** Read-only display box */
const InfoBox = ({ label, value }) => (
  <div>
    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">{label}</p>
    <div className="px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 min-h-[42px] flex items-center">
      {value || <span className="text-gray-400">—</span>}
    </div>
  </div>
);

/** Editable text input */
const EditBox = ({ label, name, value, onChange, type = 'text', placeholder = '', accentRing, accentBorder, accentBg, badge }) => (
  <div>
    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1.5">
      {label}
      {badge && <span className="normal-case font-normal text-xs text-blue-500">{badge}</span>}
    </p>
    <input
      type={type}
      name={name}
      value={value || ''}
      onChange={onChange}
      placeholder={placeholder}
      className={`w-full px-4 py-2.5 border ${accentBorder} ${accentBg} rounded-lg focus:outline-none ${accentRing} focus:ring-2 focus:border-transparent text-sm transition`}
    />
  </div>
);

/** Section card wrapper */
const Card = ({ icon: Icon, iconBg = 'bg-blue-50', iconColor = 'text-blue-600', title, badge, children }) => (
  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
    <div className="flex items-center justify-between mb-5 pb-4 border-b border-gray-100">
      <div className="flex items-center gap-2.5">
        <div className={`p-2 rounded-lg ${iconBg}`}>
          <Icon size={18} className={iconColor} />
        </div>
        <h2 className="text-base font-bold text-gray-800">{title}</h2>
      </div>
      {badge && (
        <span className="text-xs font-medium text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full">
          {badge}
        </span>
      )}
    </div>
    {children}
  </div>
);

// ═════════════════════════════════════════════════════════════════════════════
// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════

export default function MyProfile() {
  const role   = getCurrentUserRole();
  const config = ROLE_CONFIG[role] ?? ROLE_CONFIG.employee;
  const { Icon, canEditPersonal, canEditEmail, canEditBank,
          accentRing, accentBorder, accentBg, btnBg, pwBtnBg } = config;

  // ── State ───────────────────────────────────────────────────────────────────
  const [employee, setEmployee] = useState(null);
 const [form, setForm] = useState({
  firstName: '', lastName: '', email: '',
  department: '',
  bankName: '', accountName: '', accountNumber: '',
  shiftStart: '', shiftEnd: '',
  salaryType: 'hourly', hourlyRate: '', monthlySalary: '',
  status: 'Active',
  joiningDate: '',
  employeeNumber: '',

});
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);

  // Password sub-state
  const [pwForm,   setPwForm]   = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [showPw,   setShowPw]   = useState({ current: false, new: false, confirm: false });
  const [pwOpen,   setPwOpen]   = useState(false);
  const [pwSaving, setPwSaving] = useState(false);

  // ── Fetch profile ───────────────────────────────────────────────────────────
  useEffect(() => { fetchProfile(); }, []);

const calculateMonthlySalary = () => {
  if (!form.hourlyRate || !form.shiftStart || !form.shiftEnd) return null;
  const [startH, startM] = form.shiftStart.split(':').map(Number);
  const [endH, endM]     = form.shiftEnd.split(':').map(Number);
    let startMin = startH * 60 + startM;
    let endMin   = endH * 60 + endM;
    if (endMin <= startMin) endMin += 24 * 60;
    return ((endMin - startMin) / 60 * 22 * parseFloat(form.hourlyRate)).toFixed(2);
  };

  const fetchProfile = async () => {
    try {
      const token = localStorage.getItem('token');
      const { data } = await axios.get('/api/employees/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (data.success) {
        const emp = data.employee;
        setEmployee(emp);
       setForm({
  firstName:     emp.firstName           || '',
  lastName:      emp.lastName            || '',
  email:         emp.email               || '',
  department:    emp.department          || '',
  bankName:      emp.bank?.bankName      || '',
  accountName:   emp.bank?.accountName   || '',
  accountNumber: emp.bank?.accountNumber || '',
  shiftStart:    emp.shift?.start        || '',
  shiftEnd:      emp.shift?.end          || '',
  salaryType:    emp.salaryType          || 'hourly',
  hourlyRate:    emp.hourlyRate          || '',
  monthlySalary: emp.monthlySalary       || '',
  status:        emp.status              || 'Active',
  employeeNumber: emp.employeeNumber || '',
  joiningDate:   emp.joiningDate
    ? new Date(emp.joiningDate).toISOString().split('T')[0]
    : '',
});

      } else {
        toast.error('Failed to load profile');
      }
    } catch {
      toast.error('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  // ── Save profile ────────────────────────────────────────────────────────────
// REPLACE the entire handleSave function
const handleSave = async () => {
  if (!form.email?.trim()) return toast.error('Email is required');
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim());
  if (!emailOk) return toast.error('Please enter a valid email address');

  setSaving(true);
  try {
    const token = localStorage.getItem('token');

    // Superadmin uses PUT /api/employees/:id (full edit),
    // everyone else uses PUT /api/employees/me (email + bank only)
    let data;
    if (role === 'superadmin') {
      const res = await axios.put(
        `/api/employees/${employee._id}`,
        {
          firstName:     form.firstName.trim(),
          lastName:      form.lastName.trim(),
          email:         form.email.toLowerCase().trim(),
          department:    form.department,
          shift:         { start: form.shiftStart, end: form.shiftEnd },
          salaryType:    form.salaryType,
          employeeNumber: form.employeeNumber.trim(),
          hourlyRate:    parseFloat(form.hourlyRate) || 0,
          monthlySalary: form.salaryType === 'monthly' ? parseFloat(form.monthlySalary) || null : null,
          status:        form.status,
          joiningDate:   form.joiningDate,
          bank: {
            bankName:      form.bankName.trim(),
            accountName:   form.accountName.trim(),
            accountNumber: form.accountNumber.trim(),
          },
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      data = res.data;
    } else {
      const res = await axios.put(
        '/api/employees/me',
        {
          email: form.email.toLowerCase().trim(),
          bank: {
            bankName:      form.bankName.trim(),
            accountName:   form.accountName.trim(),
            accountNumber: form.accountNumber.trim(),
          },
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      data = res.data;
    }

    if (data.success) {
      setEmployee(data.employee);
      toast.success('Profile updated successfully');
    } else {
      toast.error('Failed to update profile');
    }
  } catch (err) {
    toast.error(err.response?.data?.message || 'Failed to update profile');
  } finally {
    setSaving(false);
  }
};

  // ── Change password ─────────────────────────────────────────────────────────
  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!pwForm.currentPassword)                       return toast.error('Enter your current password');
    if (pwForm.newPassword !== pwForm.confirmPassword) return toast.error('Passwords do not match');
    if (pwForm.newPassword.length < 8)                 return toast.error('Password must be at least 8 characters');
    if (pwForm.currentPassword === pwForm.newPassword) return toast.error('New password must be different');

    setPwSaving(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post('/api/auth/change-password',
        { currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      toast.success('Password changed successfully');
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setPwOpen(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to change password');
    } finally {
      setPwSaving(false);
    }
  };

  const cancelPw = () => {
    setPwOpen(false);
    setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
  };

  // ── Salary display (read-only for all roles) ────────────────────────────────
  const SalaryRows = () => {
    if (!employee?.salaryType) return null;
    return employee.salaryType === 'monthly' ? (
      <>
        <InfoBox label="Salary Type"          value="Monthly" />
        <InfoBox label="Monthly Salary (PKR)" value={employee.monthlySalary?.toLocaleString('en-PK')} />
      </>
    ) : (
      <>
        <InfoBox label="Salary Type"       value="Hourly" />
        <InfoBox label="Hourly Rate (PKR)" value={employee.hourlyRate?.toLocaleString('en-PK')} />
      </>
    );
  };

  // ── Loading state ───────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className={`w-8 h-8 border-2 border-t-transparent rounded-full animate-spin ${config.accentBorder}`} />
          <p className="text-sm text-gray-500">Loading profile…</p>
        </div>
      </div>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 md:p-6 bg-gray-50 min-h-screen">

      {/* ── Page header ── */}
      <div className="flex items-center gap-3 mb-6">
        <div className={`p-2.5 ${config.iconBg} rounded-xl`}>
          <Icon size={22} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">My Profile</h1>
          <p className="text-sm text-gray-500">{config.label}</p>
        </div>
      </div>

      <div className="max-w-3xl space-y-5">

        {/* ── Personal Information ─────────────────────────────────────────── */}
        <Card
          icon={User}
          iconBg="bg-blue-50"
          iconColor="text-blue-600"
          title="Personal Information"
          badge={canEditPersonal ? null : 'Read-only'}
        >
          <div className="space-y-4">

  {/* Name */}
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    {canEditPersonal ? (
      <>
        <EditBox label="First Name" name="firstName" value={form.firstName}
          onChange={handleChange} accentRing={accentRing} accentBorder={accentBorder} accentBg={accentBg} />
        <EditBox label="Last Name"  name="lastName"  value={form.lastName}
          onChange={handleChange} accentRing={accentRing} accentBorder={accentBorder} accentBg={accentBg} />
      </>
    ) : (
      <>
        <InfoBox label="First Name" value={employee?.firstName} />
        <InfoBox label="Last Name"  value={employee?.lastName} />
      </>
    )}
  </div>

  {/* Email */}
  <EditBox
    label="Email" name="email" value={form.email}
    onChange={handleChange} type="email" placeholder="your@email.com"
    accentRing={accentRing} accentBorder={accentBorder} accentBg={accentBg}
    badge="(editable)"
  />

  {/* Employee Number + Department */}
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
{config.canEditPersonal ? (
  <EditBox label="Employee Number" name="employeeNumber" value={form.employeeNumber}
    onChange={handleChange}
    accentRing={accentRing} accentBorder={accentBorder} accentBg={accentBg} />
) : (
  <InfoBox label="Employee Number" value={employee?.employeeNumber} />
)}
    {config.canEditDepartment ? (
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Department</p>
        <select name="department" value={form.department} onChange={handleChange}
          className={`w-full px-4 py-2.5 border ${accentBorder} ${accentBg} rounded-lg focus:outline-none ${accentRing} focus:ring-2 text-sm transition`}>
          {['IT','Customer Support','Manager','Marketing','HR','Finance'].map(d => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
      </div>
    ) : (
      <InfoBox label="Department" value={employee?.department} />
    )}
  </div>

  {/* Joining Date + Status */}
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    {config.canEditJoining ? (
      <EditBox label="Joining Date" name="joiningDate" value={form.joiningDate}
        onChange={handleChange} type="date"
        accentRing={accentRing} accentBorder={accentBorder} accentBg={accentBg} />
    ) : (
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Joining Date</p>
        <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 min-h-[42px]">
          <Calendar size={14} className="text-gray-400 shrink-0" />
          <span>{employee?.joiningDate ? formatDateToDisplay(employee.joiningDate) : <span className="text-gray-400">—</span>}</span>
        </div>
      </div>
    )}
    {config.canEditStatus ? (
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Status</p>
        <select name="status" value={form.status} onChange={handleChange}
          className={`w-full px-4 py-2.5 border ${accentBorder} ${accentBg} rounded-lg focus:outline-none ${accentRing} focus:ring-2 text-sm transition`}>
          {['Active','Inactive','Frozen'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
    ) : (
      <InfoBox label="Status" value={employee?.status} />
    )}
  </div>

  {/* Shift */}
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    {config.canEditShift ? (
      <>
        <EditBox label="Shift Start" name="shiftStart" value={form.shiftStart}
          onChange={handleChange} placeholder="09:00"
          accentRing={accentRing} accentBorder={accentBorder} accentBg={accentBg} />
        <EditBox label="Shift End" name="shiftEnd" value={form.shiftEnd}
          onChange={handleChange} placeholder="18:00"
          accentRing={accentRing} accentBorder={accentBorder} accentBg={accentBg} />
      </>
    ) : (
      <>
        <InfoBox label="Shift Start" value={employee?.shift?.start} />
        <InfoBox label="Shift End"   value={employee?.shift?.end} />
      </>
    )}
  </div>

  {/* Salary */}
  {employee?.salaryType && (
    config.canEditSalary ? (
      <div className="space-y-4">
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Salary Type</p>
          <select name="salaryType" value={form.salaryType} onChange={handleChange}
            className={`w-full px-4 py-2.5 border ${accentBorder} ${accentBg} rounded-lg focus:outline-none ${accentRing} focus:ring-2 text-sm transition`}>
            <option value="hourly">Hourly</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
         <div>
  <EditBox label="Hourly Rate (PKR)" name="hourlyRate" value={form.hourlyRate}
    onChange={handleChange} type="number" placeholder="0"
    accentRing={accentRing} accentBorder={accentBorder} accentBg={accentBg} />
  {calculateMonthlySalary() && (
    <p className="text-xs text-red-500 mt-1.5">
      ≈ PKR {calculateMonthlySalary()} / month &nbsp;·&nbsp;
      ({form.shiftStart}–{form.shiftEnd} × PKR {form.hourlyRate}/hr × 22 days)
    </p>
  )}
</div>
          {form.salaryType === 'monthly' && (
            <EditBox label="Monthly Salary (PKR)" name="monthlySalary" value={form.monthlySalary}
              onChange={handleChange} type="number" placeholder="0"
              accentRing={accentRing} accentBorder={accentBorder} accentBg={accentBg} />
          )}
        </div>
      </div>
    ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SalaryRows />
      </div>
    )
  )}

</div>
        </Card>

        {/* ── Bank Details ─────────────────────────────────────────────────── */}
        <Card
          icon={CreditCard}
          iconBg="bg-green-50"
          iconColor="text-green-600"
          title="Bank Details"
          badge={canEditBank ? null : 'Read-only'}
        >
          <div className="space-y-4">
            {canEditBank ? (
              <>
                <EditBox label="Bank Name"    name="bankName"      value={form.bankName}
                  onChange={handleChange} placeholder="e.g. HBL, Meezan Bank"
                  accentRing={accentRing} accentBorder={accentBorder} accentBg={accentBg} />
                <EditBox label="Account Name" name="accountName"   value={form.accountName}
                  onChange={handleChange} placeholder="Account holder name"
                  accentRing={accentRing} accentBorder={accentBorder} accentBg={accentBg} />
                <EditBox label="IBAN / Account Number" name="accountNumber" value={form.accountNumber}
                  onChange={handleChange} placeholder="PK00XXXX0000000000000000"
                  accentRing={accentRing} accentBorder={accentBorder} accentBg={accentBg} />
              </>
            ) : (
              <>
                <InfoBox label="Bank Name"             value={employee?.bank?.bankName} />
                <InfoBox label="Account Name"          value={employee?.bank?.accountName} />
                <InfoBox label="IBAN / Account Number" value={employee?.bank?.accountNumber} />
              </>
            )}
          </div>
        </Card>

        {/* ── Save button ──────────────────────────────────────────────────── */}
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className={`flex items-center gap-2 px-6 py-2.5 text-white rounded-lg transition font-semibold text-sm disabled:opacity-60 disabled:cursor-not-allowed shadow-sm ${btnBg}`}
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Saving…
              </>
            ) : (
              <><Save size={16} /> Save Changes</>
            )}
          </button>
        </div>

        {/* ── Change Password ───────────────────────────────────────────────── */}
        <Card icon={Lock} iconBg="bg-orange-50" iconColor="text-orange-600" title="Change Password">
          {!pwOpen ? (
            <button
              onClick={() => setPwOpen(true)}
              className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition text-sm font-medium ${pwBtnBg}`}
            >
              <Pencil size={14} /> Change Password
            </button>
          ) : (
            <form onSubmit={handleChangePassword} className="space-y-4">
              {[
                { label: 'Current Password',    field: 'current', key: 'currentPassword', placeholder: 'Enter current password' },
                { label: 'New Password',         field: 'new',     key: 'newPassword',     placeholder: 'At least 8 characters'  },
                { label: 'Confirm New Password', field: 'confirm', key: 'confirmPassword', placeholder: 'Repeat new password'    },
              ].map(({ label, field, key, placeholder }) => (
                <div key={field}>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                    {label} <span className="text-red-500">*</span>
                  </p>
                  <div className="relative">
                    <input
                      type={showPw[field] ? 'text' : 'password'}
                      value={pwForm[key]}
                      onChange={e => setPwForm(prev => ({ ...prev, [key]: e.target.value }))}
                      required
                      placeholder={placeholder}
                      className="w-full px-4 py-2.5 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(p => ({ ...p, [field]: !p[field] }))}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPw[field] ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {key === 'newPassword' && (
                    <p className="text-xs text-gray-400 mt-1">Must be at least 8 characters</p>
                  )}
                </div>
              ))}

              <div className="flex gap-3 pt-1">
                <button
                  type="submit"
                  disabled={pwSaving}
                  className={`flex items-center gap-2 px-5 py-2 text-white rounded-lg transition font-semibold text-sm disabled:opacity-60 ${btnBg}`}
                >
                  {pwSaving ? 'Saving…' : <><Check size={14} /> Update Password</>}
                </button>
                <button
                  type="button"
                  onClick={cancelPw}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition text-sm"
                >
                  <X size={14} /> Cancel
                </button>
              </div>
            </form>
          )}
        </Card>

      </div>
    </div>
  );
}