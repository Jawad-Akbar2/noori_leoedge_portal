import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
  X, Save, AlertCircle, Shield, Camera, Upload,
  Trash2, FileText, Phone, Home, User, Check, Briefcase,
  Calendar, Clock, DollarSign, Building2, CreditCard, MapPin,
  UserCircle, Mail, Hash, TrendingUp,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { formatToDDMMYYYY } from '../../utils/dateFormatter';
import { useEscape } from "../../context/EscapeStack";

// ─── reusable field primitives ────────────────────────────────────────────────

const Label = ({ children, required }) => (
  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
    {children}{required && <span className="text-red-500 ml-0.5">*</span>}
  </label>
);

const Field = ({ label, required, error, children }) => (
  <div>
    {label && <Label required={required}>{label}</Label>}
    {children}
    {error && <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
      <AlertCircle size={10} /> {error}
    </p>}
  </div>
);

const Input = ({ error, className = '', ...props }) => (
  <input
    className={`w-full px-3.5 py-2.5 bg-gray-50/50 border rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm disabled:bg-gray-100 disabled:text-gray-500 ${error ? 'border-red-400' : 'border-gray-200'} ${className}`}
    {...props}
  />
);

const Select = ({ error, className = '', children, ...props }) => (
  <select
    className={`w-full px-3.5 py-2.5 bg-gray-50/50 border rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm disabled:bg-gray-100 ${error ? 'border-red-400' : 'border-gray-200'} ${className}`}
    {...props}
  >
    {children}
  </select>
);

const Textarea = ({ error, className = '', ...props }) => (
  <textarea
    className={`w-full px-3.5 py-2.5 bg-gray-50/50 border rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm disabled:bg-gray-100 resize-y ${error ? 'border-red-400' : 'border-gray-200'} ${className}`}
    {...props}
  />
);

// ─── ID card side uploader ────────────────────────────────────────────────────
const IdCardSide = ({ label, side, currentFile, onUpload, onDelete, isLoading }) => {
  const ref = useRef(null);

  const handleSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const valid = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];

    if (!valid.includes(file.type)) {
      toast.error('Only image formats allowed: JPEG, PNG, GIF, or WebP');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('File must be under 5 MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => onUpload(side, { url: ev.target.result, fileName: file.name });
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const isValidImage = currentFile?.url && !currentFile.url.startsWith('data:application/pdf');

  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</p>
        {currentFile?.url && isValidImage && (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full">
            <Check size={10} /> Uploaded
          </span>
        )}
      </div>
      <div
        onClick={() => !isLoading && ref.current?.click()}
        className={`relative cursor-pointer rounded-xl border-2 transition-all duration-200 group
          ${currentFile?.url && isValidImage
            ? 'border-green-300 bg-green-50/30 hover:border-green-400'
            : 'border-dashed border-gray-300 bg-gray-50/50 hover:bg-gray-100/60 hover:border-gray-400'
          } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
        style={{ minHeight: 130 }}
      >
        {currentFile?.url ? (
          <>
            {!isValidImage ? (
              <div className="flex flex-col items-center justify-center h-32 gap-2 bg-red-50 rounded-[10px]">
                <AlertCircle size={28} className="text-red-400" />
                <span className="text-xs text-red-500 text-center px-2">Invalid format — only images allowed</span>
              </div>
            ) : (
              <img
                src={currentFile.url}
                alt={label}
                className="w-full h-32 object-cover rounded-[10px]"
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="%23999"%3E%3Crect x="2" y="2" width="20" height="20" rx="2"/%3E%3Cpath d="M8 2v20M16 2v20M2 8h20M2 16h20"/%3E%3C/svg%3E';
                }}
              />
            )}
            <div className="absolute inset-0 rounded-[10px] bg-black/0 group-hover:bg-black/20 transition flex items-center justify-center">
              <div className="opacity-0 group-hover:opacity-100 transition flex items-center gap-1.5 bg-white/90 px-3 py-1.5 rounded-full shadow text-xs font-medium text-gray-700">
                <Camera size={12} /> Change
              </div>
            </div>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onDelete(side); }}
              disabled={isLoading}
              className="absolute top-2 right-2 p-1.5 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-full hover:from-red-600 hover:to-red-700 shadow-md disabled:opacity-50 z-10 transition-all duration-200"
            >
              <Trash2 size={11} />
            </button>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-32 gap-2 text-gray-400">
            <div className="p-2 rounded-full bg-gray-100">
              <Upload size={18} />
            </div>
            <span className="text-xs font-medium">Click to upload</span>
            <span className="text-[10px] text-gray-400">JPEG, PNG, GIF, WebP · max 5 MB</span>
          </div>
        )}
      </div>
      <input
        ref={ref}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
        onChange={handleSelect}
        className="hidden"
      />
    </div>
  );
};

// ─── Tab button component ─────────────────────────────────────────────────────
const TabButton = ({ active, onClick, icon: Icon, label }) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex items-center gap-2 px-5 py-3 font-medium text-sm transition-all duration-200 border-b-2 whitespace-nowrap ${
      active
        ? 'border-blue-500 text-blue-600 bg-blue-50/30'
        : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
    }`}
  >
    <Icon size={16} />
    {label}
  </button>
);

// ─── Info card component ──────────────────────────────────────────────────────
const InfoCard = ({ icon: Icon, title, children, className = '' }) => (
  <div className={`bg-gradient-to-r from-blue-50 to-indigo-50/30 rounded-xl p-4 border border-blue-100 ${className}`}>
    <div className="flex items-center gap-2 mb-2">
      <Icon size={14} className="text-blue-600" />
      <span className="text-xs font-semibold text-blue-700 uppercase tracking-wider">{title}</span>
    </div>
    {children}
  </div>
);

// ═════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═════════════════════════════════════════════════════════════════════════════

export default function EditEmployeeModal({ employee, onClose, onSave, currentUserRole }) {
   useEscape(onClose);
  const isSuperAdmin = currentUserRole === 'superadmin' || currentUserRole === 'owner';
  const targetRole = employee?.role || 'employee';
  const isPrivileged = ['admin', 'superadmin', 'owner'].includes(targetRole);

  const [activeTab, setActiveTab] = useState('basic');
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState(null);
  const [errors, setErrors] = useState({});
  const dateInputRef = useRef(null);
  const picInputRef = useRef(null);

  // ── Form state ───────────────────────────────────────────────────────────────
  const [formData, setFormData] = useState({
    firstName: '', lastName: '', email: '', employeeNumber: '',
    department: 'IT', role: 'employee', joiningDate: '',
    shift: { start: '09:00', end: '18:00' },
    salaryType: 'hourly', hourlyRate: 0, monthlySalary: '',
    bank: { bankName: '', accountName: '', accountNumber: '' },
    emergencyContact: { name: '', relationship: '', phone: '' },
    address: { street: '', city: '', state: '', zip: '', country: '' },
  });

  // ── "Other info" upload state ────────────────────────────────────────────────
  const [profilePicture, setProfilePicture] = useState(null);
  const [uploadingPic, setUploadingPic] = useState(false);
  const [idCard, setIdCard] = useState({ front: null, back: null });
  const [uploadingId, setUploadingId] = useState(false);

  // ── Load employee ────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      setDataLoading(true);
      setError(null);
      try {
        const token = localStorage.getItem('token');
        const { data } = await axios.get(`/api/employees/${employee._id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const emp = data.employee;
        setFormData({
          firstName: emp.firstName || '',
          lastName: emp.lastName || '',
          email: emp.email || '',
          employeeNumber: emp.employeeNumber || '',
          department: emp.department || 'IT',
          role: emp.role || 'employee',
          joiningDate: emp.joiningDate ? new Date(emp.joiningDate).toISOString().split('T')[0] : '',
          shift: emp.shift || { start: '09:00', end: '18:00' },
          salaryType: emp.salaryType || 'hourly',
          hourlyRate: emp.hourlyRate || 0,
          monthlySalary: emp.monthlySalary || '',
          bank: emp.bank || { bankName: '', accountName: '', accountNumber: '' },
          emergencyContact: emp.emergencyContact || { name: '', relationship: '', phone: '' },
          address: emp.address || { street: '', city: '', state: '', zip: '', country: '' },
        });
        if (emp.profilePicture?.data) setProfilePicture(emp.profilePicture.data);
        setIdCard({
          front: emp.idCard?.front?.url ? emp.idCard.front : null,
          back: emp.idCard?.back?.url ? emp.idCard.back : null,
        });
      } catch {
        setError('Failed to load employee data. The employee may no longer exist.');
      } finally {
        setDataLoading(false);
      }
    })();
  }, [employee._id]);

  // ── Input handlers ───────────────────────────────────────────────────────────
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

  // ── Profile picture handlers ─────────────────────────────────────────────────
  const handlePicSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const valid = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!valid.includes(file.type)) { toast.error('Please select JPEG, PNG, GIF, or WebP'); return; }
    if (file.size > 2 * 1024 * 1024) { toast.error('Image must be under 2 MB'); return; }
    const reader = new FileReader();
    reader.onload = (ev) => uploadPic(ev.target.result);
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const uploadPic = async (base64) => {
    setUploadingPic(true);
    try {
      const token = localStorage.getItem('token');
      const { data } = await axios.put(
        `/api/employees/${employee._id}/profile-picture`,
        { profilePicture: base64 },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (data.success) { setProfilePicture(base64); toast.success('Profile picture updated'); }
      else toast.error(data.message || 'Upload failed');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Upload failed');
    } finally {
      setUploadingPic(false);
    }
  };

  const deletePic = async () => {
    setUploadingPic(true);
    try {
      const token = localStorage.getItem('token');
      const { data } = await axios.delete(
        `/api/employees/${employee._id}/profile-picture`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (data.success) { setProfilePicture(null); toast.success('Profile picture removed'); }
      else toast.error(data.message);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Remove failed');
    } finally {
      setUploadingPic(false);
    }
  };

  // ── ID card handlers ─────────────────────────────────────────────────────────
  const handleIdUpload = async (side, fileData) => {
    setUploadingId(true);
    try {
      const token = localStorage.getItem('token');
      const { data } = await axios.put(
        `/api/employees/${employee._id}`,
        { idCard: { [side]: { url: fileData.url, fileName: fileData.fileName } } },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (data.success) {
        setIdCard(prev => ({ ...prev, [side]: { url: fileData.url, fileName: fileData.fileName, uploadedAt: new Date() } }));
        toast.success(`ID card ${side} uploaded`);
      } else toast.error(data.message || 'Upload failed');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Upload failed');
    } finally {
      setUploadingId(false);
    }
  };

  const handleIdDelete = async (side) => {
    setUploadingId(true);
    try {
      const token = localStorage.getItem('token');
      const { data } = await axios.put(
        `/api/employees/${employee._id}`,
        { idCard: { [side]: null } },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (data.success) { setIdCard(prev => ({ ...prev, [side]: null })); toast.success(`ID card ${side} removed`); }
      else toast.error(data.message);
    } finally {
      setUploadingId(false);
    }
  };

  // ── Salary estimate ──────────────────────────────────────────────────────────
  const calculateMonthlyEstimate = () => {
    if (!formData.hourlyRate || !formData.shift.start || !formData.shift.end) return 0;
    const [sh, sm] = formData.shift.start.split(':').map(Number);
    const [eh, em] = formData.shift.end.split(':').map(Number);
    let start = sh * 60 + sm, end = eh * 60 + em;
    if (end <= start) end += 24 * 60;
    return ((end - start) / 60 * 22 * parseFloat(formData.hourlyRate)).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // ── Validation ───────────────────────────────────────────────────────────────
  const validateForm = () => {
    const e = {};
    if (!formData.firstName.trim()) e.firstName = 'First name is required';
    if (!formData.lastName.trim()) e.lastName = 'Last name is required';
    if (!formData.employeeNumber.trim()) e.employeeNumber = 'Employee number is required';
    if (!formData.email.trim()) e.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) e.email = 'Enter a valid email';
    if (formData.salaryType === 'hourly' && (!formData.hourlyRate || parseFloat(formData.hourlyRate) <= 0)) e.hourlyRate = 'Must be greater than 0';
    if (formData.salaryType === 'monthly' && (!formData.monthlySalary || parseFloat(formData.monthlySalary) <= 0)) e.monthlySalary = 'Must be greater than 0';

    if (Object.keys(e).length) {
      if (e.firstName || e.lastName || e.email || e.employeeNumber) setActiveTab('basic');
      else if (e.hourlyRate || e.monthlySalary) setActiveTab('shift');
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // ── Submit ───────────────────────────────────────────────────────────────────
  const handleSubmit = async (evt) => {
    evt.preventDefault();
    if (!validateForm()) { toast.error('Please fix the errors below'); return; }

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const payload = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        employeeNumber: formData.employeeNumber,
        department: formData.department,
        joiningDate: formData.joiningDate ? formatToDDMMYYYY(formData.joiningDate) : null,
        shift: formData.shift,
        salaryType: formData.salaryType,
        hourlyRate: parseFloat(formData.hourlyRate) || 0,
        monthlySalary: formData.salaryType === 'monthly' ? parseFloat(formData.monthlySalary) : null,
        bank: formData.bank,
        emergencyContact: formData.emergencyContact,
        address: formData.address,
        ...(isSuperAdmin && { role: formData.role }),
      };

      await axios.put(`/api/employees/${employee._id}`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success('Employee updated successfully');
      if (onSave) onSave();
      onClose();
    } catch (err) {
      const d = err.response?.data;
      if (d?.field) {
        setErrors(prev => ({ ...prev, [d.field]: d.message }));
        setActiveTab('basic');
        toast.error(d.message);
      } else {
        toast.error(d?.message || 'Failed to update employee');
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Loading / error screens ──────────────────────────────────────────────────
  if (error) return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="flex items-center gap-3 mb-4 text-red-600">
          <div className="p-2 rounded-full bg-red-100">
            <AlertCircle size={24} />
          </div>
          <h2 className="text-lg font-bold text-gray-800">Error Loading Employee</h2>
        </div>
        <p className="text-gray-600 mb-6">{error}</p>
        <button onClick={onClose} className="w-full px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition font-medium">Close</button>
      </div>
    </div>
  );

  if (dataLoading) return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl w-full max-w-md p-8 text-center shadow-2xl">
        <div className="inline-block animate-spin rounded-full h-10 w-10 border-3 border-blue-600 border-t-transparent mb-4" />
        <p className="text-gray-600 font-medium">Loading employee information...</p>
      </div>
    </div>
  );

  const tabs = [
    { key: 'basic', label: 'Basic Info', icon: UserCircle },
    { key: 'shift', label: 'Shift & Salary', icon: Clock },
    { key: 'bank', label: 'Bank Details', icon: Building2 },
    { key: 'other', label: 'Other Info', icon: FileText },
  ];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div className={`shrink-0 rounded-t-2xl border-b px-6 py-4 flex items-center justify-between ${isPrivileged ? 'bg-gradient-to-r from-purple-50/80 to-white' : 'bg-white'}`}>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200 shrink-0 ring-2 ring-offset-1 ring-gray-200 shadow-sm">
              {profilePicture
                ? <img src={profilePicture} alt="" className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center"><User size={20} className="text-gray-400" /></div>
              }
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-bold text-gray-800">
                  {formData.firstName} {formData.lastName}
                </h2>
                {isPrivileged && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gradient-to-r from-purple-100 to-purple-200 text-purple-800 border border-purple-200/50 shadow-sm">
                    <Shield size={10} /> {targetRole}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                <Mail size={10} /> {formData.email}
              </p>
            </div>
          </div>
          <button onClick={onClose} disabled={loading} className="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all disabled:opacity-40">
            <X size={20} />
          </button>
        </div>

        {/* Privileged notice */}
        {isPrivileged && (
          <div className="shrink-0 mx-6 mt-4 bg-gradient-to-r from-purple-50 to-purple-100/50 border border-purple-200 rounded-xl p-3 flex items-start gap-2.5">
            <div className="p-1 rounded-lg bg-purple-100">
              <Shield size={14} className="text-purple-600" />
            </div>
            <p className="text-xs text-purple-800">
              Editing a <strong className="font-semibold">{targetRole}</strong> account. Role changes take effect immediately.
            </p>
          </div>
        )}

        {/* ── Tabs ───────────────────────────────────────────────────────────── */}
        <div className="shrink-0 border-b border-gray-100 px-6">
          <div className="flex gap-1">
            {tabs.map(tab => (
              <TabButton
                key={tab.key}
                active={activeTab === tab.key}
                onClick={() => setActiveTab(tab.key)}
                icon={tab.icon}
                label={tab.label}
              />
            ))}
          </div>
        </div>

        {/* ── Scrollable body ─────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">
          <form onSubmit={handleSubmit} id="edit-form">
            <div className="p-6 space-y-5">

              {/* ══ BASIC INFO ══════════════════════════════════════════════════ */}
              {activeTab === 'basic' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="First Name" required error={errors.firstName}>
                      <Input name="firstName" value={formData.firstName} onChange={handleInputChange} disabled={loading} error={errors.firstName} />
                    </Field>
                    <Field label="Last Name" required error={errors.lastName}>
                      <Input name="lastName" value={formData.lastName} onChange={handleInputChange} disabled={loading} error={errors.lastName} />
                    </Field>
                  </div>

                  <Field label="Email Address" required error={errors.email}>
                    <Input type="email" name="email" value={formData.email} onChange={handleInputChange} disabled={loading} error={errors.email} />
                  </Field>

                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Employee Number" required error={errors.employeeNumber}>
                      <Input name="employeeNumber" value={formData.employeeNumber} onChange={handleInputChange} disabled={loading} error={errors.employeeNumber} />
                    </Field>
                    <Field label="Department">
                      <Select name="department" value={formData.department} onChange={handleInputChange} disabled={loading}>
                        {['IT', 'Customer Support', 'Manager', 'Marketing', 'HR', 'Finance'].map(d => <option key={d}>{d}</option>)}
                      </Select>
                    </Field>
                  </div>

                  {isSuperAdmin ? (
                    <Field label="Account Role" required>
                      <Select
                        name="role"
                        value={formData.role}
                        onChange={handleInputChange}
                        disabled={loading}
                        className={['admin', 'superadmin', 'owner'].includes(formData.role) ? 'border-purple-300 bg-purple-50/50 text-purple-900 font-medium' : ''}
                      >
                        <option value="employee">Employee</option>
                        <option value="admin">Admin</option>
                        <option value="superadmin">Superadmin</option>
                        <option value="hybrid">Hybrid</option>
                      </Select>
                      {['admin', 'superadmin', 'owner'].includes(formData.role) && (
                        <p className="text-xs text-purple-700 mt-1.5 flex items-center gap-1">
                          <Shield size={11} /> {formData.role}-level system access with full permissions
                        </p>
                      )}
                    </Field>
                  ) : (
                    <Field label="Account Role">
                      <Input value={formData.role || 'employee'} disabled className="capitalize bg-gray-100 text-gray-600" />
                    </Field>
                  )}

                  <Field label="Joining Date" error={errors.joiningDate}>
                    <div className="relative">
                      <Input
                        ref={dateInputRef}
                        type="date"
                        name="joiningDate"
                        value={formData.joiningDate}
                        onChange={handleInputChange}
                        disabled={loading}
                        error={errors.joiningDate}
                        className="pl-9"
                      />
                      <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    </div>
                    {formData.joiningDate && (
                      <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                        <Calendar size={10} /> Displays as: {formatToDDMMYYYY(formData.joiningDate)}
                      </p>
                    )}
                  </Field>
                </div>
              )}

              {/* ══ SHIFT & SALARY ══════════════════════════════════════════════ */}
              {activeTab === 'shift' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Shift Start" required>
                      <div className="relative">
                        <Input
                          name="shift.start"
                          value={formData.shift.start}
                          onChange={handleInputChange}
                          disabled={loading}
                          placeholder="09:00"
                          className="pl-9"
                        />
                        <Clock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                      </div>
                      <p className="text-[10px] text-gray-400 mt-1">24-hour format (HH:mm)</p>
                    </Field>
                    <Field label="Shift End" required>
                      <div className="relative">
                        <Input
                          name="shift.end"
                          value={formData.shift.end}
                          onChange={handleInputChange}
                          disabled={loading}
                          placeholder="18:00"
                          className="pl-9"
                        />
                        <Clock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                      </div>
                      <p className="text-[10px] text-gray-400 mt-1">24-hour format (HH:mm)</p>
                    </Field>
                  </div>

                  <Field label="Salary Type" required>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setFormData(prev => ({ ...prev, salaryType: 'hourly', monthlySalary: '' }));
                          setErrors(prev => ({ ...prev, monthlySalary: '' }));
                        }}
                        className={`flex-1 px-4 py-2.5 rounded-xl border-2 transition-all font-medium text-sm ${
                          formData.salaryType === 'hourly'
                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                            : 'border-gray-200 bg-gray-50/50 text-gray-600 hover:border-gray-300'
                        }`}
                      >
                        Hourly
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setFormData(prev => ({ ...prev, salaryType: 'monthly', hourlyRate: 0 }));
                          setErrors(prev => ({ ...prev, hourlyRate: '' }));
                        }}
                        className={`flex-1 px-4 py-2.5 rounded-xl border-2 transition-all font-medium text-sm ${
                          formData.salaryType === 'monthly'
                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                            : 'border-gray-200 bg-gray-50/50 text-gray-600 hover:border-gray-300'
                        }`}
                      >
                        Monthly
                      </button>
                    </div>
                  </Field>

                  {formData.salaryType === 'hourly' && (
                    <Field label="Hourly Rate (PKR)" required error={errors.hourlyRate}>
                      <div className="relative">
                        <Input
                          type="number"
                          name="hourlyRate"
                          value={formData.hourlyRate}
                          onChange={handleInputChange}
                          disabled={loading}
                          step="1"
                          min="0"
                          placeholder="e.g., 500"
                          error={errors.hourlyRate}
                          className="pl-9"
                        />
                        <DollarSign size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                      </div>
                    </Field>
                  )}

                  {formData.salaryType === 'monthly' && (
                    <Field label="Monthly Salary (PKR)" required error={errors.monthlySalary}>
                      <div className="relative">
                        <Input
                          type="number"
                          name="monthlySalary"
                          value={formData.monthlySalary}
                          onChange={handleInputChange}
                          disabled={loading}
                          step="1"
                          min="0"
                          placeholder="e.g., 50000"
                          error={errors.monthlySalary}
                          className="pl-9"
                        />
                        <DollarSign size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                      </div>
                    </Field>
                  )}

                  {/* Salary Preview Card */}
                  <InfoCard icon={TrendingUp} title="Salary Preview">
                    {formData.salaryType === 'hourly' ? (
                      <>
                        <p className="text-2xl font-bold text-blue-700">PKR {calculateMonthlyEstimate()}</p>
                        <p className="text-[10px] text-gray-500 mt-1">
                          {formData.shift.start}–{formData.shift.end} × PKR {formData.hourlyRate}/hr × 22 days
                        </p>
                        <p className="text-[10px] text-amber-600 mt-1.5 flex items-center gap-1">
                          <AlertCircle size={10} /> Estimate only — actual pay depends on working days
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-2xl font-bold text-blue-700">PKR {(formData.monthlySalary || 0).toLocaleString()}</p>
                        <p className="text-[10px] text-gray-500 mt-1">Fixed monthly salary, pro-rated by actual working days</p>
                      </>
                    )}
                  </InfoCard>

                  <div className="bg-gradient-to-r from-amber-50 to-amber-100/50 rounded-xl p-3 border border-amber-200">
                    <p className="text-xs text-amber-800 flex items-start gap-2">
                      <span className="font-semibold shrink-0">⚠️ Note:</span>
                      <span>Shift and salary changes apply to future records only. Historical records retain their original values.</span>
                    </p>
                  </div>
                </div>
              )}

              {/* ══ BANK DETAILS ════════════════════════════════════════════════ */}
              {activeTab === 'bank' && (
                <div className="space-y-4">
                  <InfoCard icon={Building2} title="Bank Information">
                    <div className="space-y-3">
                      <Field label="Bank Name">
                        <div className="relative">
                          <Input
                            name="bank.bankName"
                            value={formData.bank.bankName}
                            onChange={handleInputChange}
                            disabled={loading}
                            placeholder="e.g., HBL, UBL, Meezan Bank"
                            className="pl-9"
                          />
                          <Building2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                        </div>
                      </Field>
                      <Field label="Account Title">
                        <Input
                          name="bank.accountName"
                          value={formData.bank.accountName}
                          onChange={handleInputChange}
                          disabled={loading}
                          placeholder="Full name as per bank account"
                        />
                      </Field>
                      <Field label="IBAN / Account Number">
                        <div className="relative">
                          <Input
                            name="bank.accountNumber"
                            value={formData.bank.accountNumber}
                            onChange={handleInputChange}
                            disabled={loading}
                            placeholder="e.g., PK36 HBL 0112 3456 7890 1234"
                            className="pl-9"
                          />
                          <CreditCard size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                        </div>
                      </Field>
                    </div>
                  </InfoCard>
                  <p className="text-xs text-gray-400 flex items-center gap-1.5">
                    <CreditCard size={12} /> Bank details are optional and can be updated at any time
                  </p>
                </div>
              )}

              {/* ══ OTHER INFO ══════════════════════════════════════════════════ */}
              {activeTab === 'other' && (
                <div className="space-y-6">
                  {/* Profile Picture Section */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="p-1 rounded-lg bg-pink-100">
                        <Camera size={14} className="text-pink-600" />
                      </div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Profile Picture</p>
                    </div>
                    <div className="flex items-center gap-5 flex-wrap">
                      <div
                        onClick={() => !uploadingPic && picInputRef.current?.click()}
                        className={`relative group w-20 h-20 rounded-2xl overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200 shrink-0 ring-2 ring-offset-1 ring-gray-200 cursor-pointer transition-all duration-200
                          ${uploadingPic ? 'opacity-60 cursor-not-allowed' : 'hover:ring-blue-400'}`}
                      >
                        {uploadingPic ? (
                          <div className="w-full h-full flex items-center justify-center">
                            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                          </div>
                        ) : profilePicture ? (
                          <>
                            <img src={profilePicture} alt="" className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition flex items-center justify-center">
                              <Camera size={18} className="text-white opacity-0 group-hover:opacity-100 transition" />
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="w-full h-full flex items-center justify-center">
                              <User size={28} className="text-gray-400" />
                            </div>
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition flex items-center justify-center">
                              <Camera size={16} className="text-gray-500 opacity-0 group-hover:opacity-100 transition" />
                            </div>
                          </>
                        )}
                      </div>
                      <div>
                        <button
                          type="button"
                          onClick={() => picInputRef.current?.click()}
                          disabled={uploadingPic}
                          className="inline-flex items-center gap-2 px-4 py-2 border-2 border-dashed border-gray-300 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition-all text-sm text-gray-600 disabled:opacity-50"
                        >
                          <Upload size={14} /> {profilePicture ? 'Change Picture' : 'Upload Picture'}
                        </button>
                        {profilePicture && (
                          <button
                            type="button"
                            onClick={deletePic}
                            disabled={uploadingPic}
                            className="inline-flex items-center gap-2 px-4 py-2 ml-2 text-red-600 hover:bg-red-50 rounded-xl transition-all text-sm disabled:opacity-50"
                          >
                            <Trash2 size={14} /> Remove
                          </button>
                        )}
                        <p className="text-[10px] text-gray-400 mt-2">JPEG, PNG, GIF, WebP · max 2 MB</p>
                      </div>
                      <input ref={picInputRef} type="file" accept="image/jpeg,image/jpg,image/png,image/gif,image/webp" onChange={handlePicSelect} className="hidden" />
                    </div>
                  </div>

                  <div className="border-t border-gray-100" />

                  {/* Emergency Contact Section */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="p-1 rounded-lg bg-red-100">
                        <Phone size={14} className="text-red-600" />
                      </div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Emergency Contact</p>
                      <span className="text-[10px] text-gray-400 font-normal">(optional)</span>
                    </div>
                    <div className="space-y-3">
                      <Field label="Contact Name">
                        <Input
                          name="emergencyContact.name"
                          value={formData.emergencyContact.name}
                          onChange={handleInputChange}
                          disabled={loading}
                          placeholder="Full name"
                        />
                      </Field>
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Relationship">
                          <Input
                            name="emergencyContact.relationship"
                            value={formData.emergencyContact.relationship}
                            onChange={handleInputChange}
                            disabled={loading}
                            placeholder="Spouse, Parent, Sibling..."
                          />
                        </Field>
                        <Field label="Phone Number">
                          <Input
                            name="emergencyContact.phone"
                            value={formData.emergencyContact.phone}
                            onChange={handleInputChange}
                            disabled={loading}
                            placeholder="+92 XXX XXXXXXX"
                          />
                        </Field>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-gray-100" />

                  {/* Residential Address Section */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="p-1 rounded-lg bg-yellow-100">
                        <Home size={14} className="text-yellow-600" />
                      </div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Residential Address</p>
                      <span className="text-[10px] text-gray-400 font-normal">(optional)</span>
                    </div>
                    <div className="space-y-3">
                      <Field label="Street Address">
                        <Textarea
                          name="address.street"
                          value={formData.address.street}
                          onChange={handleInputChange}
                          disabled={loading}
                          rows={2}
                          placeholder="House/Flat No., Street, Area"
                        />
                      </Field>
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="City">
                          <Input name="address.city" value={formData.address.city} onChange={handleInputChange} disabled={loading} placeholder="City" />
                        </Field>
                        <Field label="State / Province">
                          <Input name="address.state" value={formData.address.state} onChange={handleInputChange} disabled={loading} placeholder="State" />
                        </Field>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="ZIP / Postal Code">
                          <Input name="address.zip" value={formData.address.zip} onChange={handleInputChange} disabled={loading} placeholder="ZIP Code" />
                        </Field>
                        <Field label="Country">
                          <div className="relative">
                            <Input name="address.country" value={formData.address.country} onChange={handleInputChange} disabled={loading} placeholder="Country" className="pl-9" />
                            <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                          </div>
                        </Field>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-gray-100" />

                  {/* ID Card Section */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="p-1 rounded-lg bg-purple-100">
                        <FileText size={14} className="text-purple-600" />
                      </div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">ID Card</p>
                    </div>
                    <p className="text-xs text-gray-400 mb-3">Upload front and back of the government-issued ID. Changes are saved immediately.</p>
                    <div className="flex flex-col sm:flex-row gap-4">
                      <IdCardSide label="Front Side" side="front" currentFile={idCard.front} onUpload={handleIdUpload} onDelete={handleIdDelete} isLoading={uploadingId} />
                      <IdCardSide label="Back Side" side="back" currentFile={idCard.back} onUpload={handleIdUpload} onDelete={handleIdDelete} isLoading={uploadingId} />
                    </div>
                    <div className="mt-3">
                      {idCard.front?.url && idCard.back?.url ? (
                        <span className="inline-flex items-center gap-1.5 text-xs text-green-700 bg-green-50 border border-green-200 px-3 py-1 rounded-full">
                          <Check size={11} /> Both sides uploaded
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full">
                          {!idCard.front?.url && !idCard.back?.url ? 'Neither side uploaded'
                            : !idCard.front?.url ? 'Front side missing'
                            : 'Back side missing'}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50/50 rounded-xl p-3 border border-blue-100">
                    <p className="text-xs text-blue-700 flex items-start gap-2">
                      <span className="shrink-0">💡</span>
                      <span>Profile picture and ID card changes are saved <strong>immediately</strong> — no need to click Save Changes. Emergency contact and address are saved when you click Save Changes below.</span>
                    </p>
                  </div>
                </div>
              )}
            </div>
          </form>
        </div>

        {/* ── Footer ──────────────────────────────────────────────────────────── */}
        <div className="shrink-0 border-t border-gray-100 px-6 py-4 flex gap-3 bg-gray-50/80 rounded-b-2xl">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-100 transition-all font-medium text-sm disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="edit-form"
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all shadow-md font-semibold text-sm disabled:opacity-50"
          >
            {loading
              ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Saving...</>
              : <><Save size={16} /> Save Changes</>
            }
          </button>
        </div>
      </div>
    </div>
  );
}