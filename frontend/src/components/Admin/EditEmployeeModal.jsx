import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
  X, Save, AlertCircleIcon, Shield, Camera, Upload,
  Trash2, FileText, Phone, Home, User, Check,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { formatToDDMMYYYY } from '../../utils/dateFormatter';

// ─── tiny helpers ─────────────────────────────────────────────────────────────

const isValidTime = (t) => /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(t);

const processBase64Image = (base64String) => {
  if (!base64String) return null;
  // ✅ Only allow images, reject PDFs
  const base64Regex = /^data:image\/(jpeg|jpg|png|gif|webp);base64,/;
  if (!base64Regex.test(base64String)) throw new Error('Only image formats allowed (JPEG, PNG, GIF, WebP)');
  const mimeType  = base64String.match(/^data:([^;]+);/)[1];
  const extension = mimeType.split('/')[1];
  return { data: base64String, fileName: `profile_${Date.now()}.${extension}`, mimeType, uploadedAt: new Date() };
};

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
    {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
  </div>
);

const inp = (extra = '') =>
  `w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm transition disabled:bg-gray-50 disabled:text-gray-500 ${extra}`;

// ─── ID card side uploader ────────────────────────────────────────────────────
const IdCardSide = ({ label, side, currentFile, onUpload, onDelete, isLoading }) => {
  const ref = useRef(null);

  const handleSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // ✅ IMAGES ONLY - Remove PDF support
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

  // ✅ Check if it's a valid image (not PDF)
  const isValidImage = currentFile?.url && !currentFile.url.startsWith('data:application/pdf');

  return (
    <div className="flex-1 min-w-0">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
        {label}
        <span className="ml-1.5 normal-case font-normal text-gray-400">
          {currentFile?.url ? '✓ uploaded' : 'required'}
        </span>
      </p>
      <div
        onClick={() => !isLoading && ref.current?.click()}
        className={`relative cursor-pointer rounded-xl border-2 border-dashed transition group
          ${currentFile?.url
            ? 'border-green-300 bg-green-50/30 hover:border-green-400'
            : 'border-gray-300 bg-gray-50/50 hover:bg-gray-100/60'
          } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
        style={{ minHeight: 130 }}
      >
        {currentFile?.url ? (
          <>
            {/* ✅ Only images - show error if PDF somehow got through */}
            {!isValidImage ? (
              <div className="flex flex-col items-center justify-center h-32 gap-2 bg-red-50 rounded-[10px]">
                <AlertCircleIcon size={28} className="text-red-400" />
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
              className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 shadow disabled:opacity-50 z-10 transition"
            >
              <Trash2 size={11} />
            </button>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-32 gap-2 text-gray-400">
            <Upload size={20} />
            <span className="text-xs">Click to upload image</span>
            <span className="text-[10px]">JPEG, PNG, GIF, WebP · max 5 MB</span>
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

// ═════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═════════════════════════════════════════════════════════════════════════════

export default function EditEmployeeModal({ employee, onClose, onSave, currentUserRole }) {
  const isSuperAdmin = currentUserRole === 'superadmin' || currentUserRole === 'owner';
  const targetRole   = employee?.role || 'employee';

  const [activeTab,    setActiveTab]    = useState('basic');
  const [loading,      setLoading]      = useState(false);
  const [dataLoading,  setDataLoading]  = useState(true);
  const [error,        setError]        = useState(null);
  const [errors,       setErrors]       = useState({});
  const dateInputRef = useRef(null);
  const picInputRef  = useRef(null);

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

  // ── "Other info" upload state (managed separately, saved immediately) ────────
  const [profilePicture,    setProfilePicture]    = useState(null); // base64 string
  const [uploadingPic,      setUploadingPic]      = useState(false);
  const [idCard,            setIdCard]            = useState({ front: null, back: null });
  const [uploadingId,       setUploadingId]       = useState(false);

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
          firstName:      emp.firstName      || '',
          lastName:       emp.lastName       || '',
          email:          emp.email          || '',
          employeeNumber: emp.employeeNumber || '',
          department:     emp.department     || 'IT',
          role:           emp.role           || 'employee',
          joiningDate:    emp.joiningDate ? new Date(emp.joiningDate).toISOString().split('T')[0] : '',
          shift:          emp.shift          || { start: '09:00', end: '18:00' },
          salaryType:     emp.salaryType     || 'hourly',
          hourlyRate:     emp.hourlyRate     || 0,
          monthlySalary:  emp.monthlySalary  || '',
          bank:           emp.bank           || { bankName: '', accountName: '', accountNumber: '' },
          emergencyContact: emp.emergencyContact || { name: '', relationship: '', phone: '' },
          address:          emp.address          || { street: '', city: '', state: '', zip: '', country: '' },
        });
        if (emp.profilePicture?.data) setProfilePicture(emp.profilePicture.data);
        setIdCard({
          front: emp.idCard?.front?.url ? emp.idCard.front : null,
          back:  emp.idCard?.back?.url  ? emp.idCard.back  : null,
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

  // ── Profile picture (saved immediately to /api/employees/:id/profile-picture) ─
  const handlePicSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const valid = ['image/jpeg','image/jpg','image/png','image/gif','image/webp'];
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

  // ── ID card (saved immediately to /api/employees/:id) ────────────────────────
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
    } catch (err) {
      toast.error(err.response?.data?.message || 'Remove failed');
    } finally {
      setUploadingId(false);
    }
  };

  // ── Salary estimate ──────────────────────────────────────────────────────────
  const calcMonthly = () => {
    if (!formData.hourlyRate || !formData.shift.start || !formData.shift.end) return 0;
    const [sh, sm] = formData.shift.start.split(':').map(Number);
    const [eh, em] = formData.shift.end.split(':').map(Number);
    let start = sh * 60 + sm, end = eh * 60 + em;
    if (end <= start) end += 24 * 60;
    return ((end - start) / 60 * 22 * parseFloat(formData.hourlyRate)).toFixed(2);
  };

  // ── Validation ───────────────────────────────────────────────────────────────
  const validateForm = () => {
    const e = {};
    if (!formData.firstName.trim())      e.firstName      = 'First name is required';
    if (!formData.lastName.trim())       e.lastName       = 'Last name is required';
    if (!formData.employeeNumber.trim()) e.employeeNumber = 'Employee number is required';
    if (!formData.email.trim())          e.email          = 'Email is required';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) e.email = 'Enter a valid email';
    if (!isValidTime(formData.shift.start)) e.shiftStart = 'Invalid (HH:mm)';
    if (!isValidTime(formData.shift.end))   e.shiftEnd   = 'Invalid (HH:mm)';
    if (formData.salaryType === 'hourly'  && (!formData.hourlyRate   || parseFloat(formData.hourlyRate)   <= 0)) e.hourlyRate   = 'Must be > 0';
    if (formData.salaryType === 'monthly' && (!formData.monthlySalary || parseFloat(formData.monthlySalary) <= 0)) e.monthlySalary = 'Must be > 0';

    if (Object.keys(e).length) {
      if (e.firstName || e.lastName || e.email || e.employeeNumber) setActiveTab('basic');
      else if (e.shiftStart || e.shiftEnd || e.hourlyRate || e.monthlySalary) setActiveTab('shift');
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
        firstName:      formData.firstName,
        lastName:       formData.lastName,
        email:          formData.email,
        employeeNumber: formData.employeeNumber,
        department:     formData.department,
        joiningDate:    formData.joiningDate ? formatToDDMMYYYY(formData.joiningDate) : null,
        shift:          formData.shift,
        salaryType:     formData.salaryType,
        hourlyRate:     parseFloat(formData.hourlyRate) || 0,
        monthlySalary:  formData.salaryType === 'monthly' ? parseFloat(formData.monthlySalary) : null,
        bank:           formData.bank,
        emergencyContact: formData.emergencyContact,
        address:          formData.address,
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl w-full max-w-md p-6">
        <div className="flex items-center gap-3 mb-4 text-red-600"><AlertCircleIcon size={24} /><h2 className="text-lg font-bold">Error Loading Employee</h2></div>
        <p className="text-gray-600 mb-6">{error}</p>
        <button onClick={onClose} className="w-full px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition">Close</button>
      </div>
    </div>
  );

  if (dataLoading) return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl w-full max-w-md p-6 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4" />
        <p className="text-gray-600">Loading employee information…</p>
      </div>
    </div>
  );

  const editingPrivileged = ['admin','superadmin', 'owner'].includes(targetRole);

  const TABS = [
    { key: 'basic', label: 'Basic Info' },
    { key: 'shift', label: 'Shift & Salary' },
    { key: 'bank',  label: 'Bank Details' },
    { key: 'other', label: 'Other Info' },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl">

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div className={`shrink-0 rounded-t-2xl border-b px-6 py-4 flex items-center justify-between ${editingPrivileged ? 'bg-purple-50' : 'bg-white'}`}>
          <div className="flex items-center gap-3">
            {/* Mini avatar */}
            <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-100 shrink-0 ring-2 ring-offset-1 ring-gray-200">
              {profilePicture
                ? <img src={profilePicture} alt="" className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center"><User size={18} className="text-gray-400" /></div>
              }
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-800 leading-tight">
                {formData.firstName} {formData.lastName}
                {editingPrivileged && (
                  <span className="ml-2 inline-flex items-center gap-1 text-xs text-purple-700 font-semibold">
                    <Shield size={11} /> {targetRole}
                  </span>
                )}
              </h2>
              <p className="text-xs text-gray-500">{formData.email}</p>
            </div>
          </div>
          <button onClick={onClose} disabled={loading} className="text-gray-400 hover:text-gray-600 disabled:opacity-40 p-1 rounded-lg hover:bg-gray-100 transition">
            <X size={22} />
          </button>
        </div>

        {/* Privileged notice */}
        {editingPrivileged && (
          <div className="shrink-0 mx-6 mt-3 bg-purple-50 border border-purple-200 rounded-lg p-3 flex items-start gap-2">
            <Shield size={15} className="text-purple-600 mt-0.5 shrink-0" />
            <p className="text-xs text-purple-800">
              Editing a <strong>{targetRole}</strong> account. Role changes take effect immediately.
            </p>
          </div>
        )}

        {/* ── Tabs ───────────────────────────────────────────────────────────── */}
        <div className="shrink-0 border-b px-6">
          <div className="flex gap-0 -mb-px">
            {TABS.map(tab => (
              <button key={tab.key} type="button" onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition whitespace-nowrap
                  ${activeTab === tab.key
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}>
                {tab.label}
                {tab.key === 'other' && (
                  <span className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-blue-400 align-middle" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* ── Scrollable body ─────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">
          <form onSubmit={handleSubmit} id="edit-form">
            <div className="p-6 space-y-4">

              {/* ══ BASIC INFO ══════════════════════════════════════════════════ */}
              {activeTab === 'basic' && (<>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="First Name" required error={errors.firstName}>
                    <input name="firstName" value={formData.firstName} onChange={handleInputChange} disabled={loading}
                      className={inp(errors.firstName ? 'border-red-400' : 'border-gray-300')} />
                  </Field>
                  <Field label="Last Name" required error={errors.lastName}>
                    <input name="lastName" value={formData.lastName} onChange={handleInputChange} disabled={loading}
                      className={inp(errors.lastName ? 'border-red-400' : 'border-gray-300')} />
                  </Field>
                </div>

                <Field label="Email" required error={errors.email}>
                  <input type="email" name="email" value={formData.email} onChange={handleInputChange} disabled={loading}
                    className={inp(errors.email ? 'border-red-400' : 'border-gray-300')} />
                </Field>

                <Field label="Employee Number" required error={errors.employeeNumber}>
                  <input name="employeeNumber" value={formData.employeeNumber} onChange={handleInputChange} disabled={loading}
                    className={inp(errors.employeeNumber ? 'border-red-400' : 'border-gray-300')} />
                </Field>

                <Field label="Department">
                  <select name="department" value={formData.department} onChange={handleInputChange} disabled={loading} className={inp('border-gray-300')}>
                    {['IT','Customer Support','Manager','Marketing','HR','Finance'].map(d => <option key={d}>{d}</option>)}
                  </select>
                </Field>

                {isSuperAdmin ? (
                  <Field label="Role" required>
                    <select name="role" value={formData.role} onChange={handleInputChange} disabled={loading}
                      className={inp(`border-gray-300 ${['admin','superadmin', 'owner'].includes(formData.role) ? 'border-purple-400 bg-purple-50 font-medium text-purple-900' : ''}`)}>
                      <option value="employee">Employee</option>
                      <option value="admin">Admin</option>
                      <option value="superadmin">Superadmin</option>
                      <option value="hybrid">Hybrid</option>
                    </select>
                    {['admin','superadmin', 'owner'].includes(formData.role) && (
                      <p className="text-xs text-purple-700 mt-1 flex items-center gap-1"><Shield size={10} /> {formData.role}-level system access</p>
                    )}
                  </Field>
                ) : (
                  <Field label="Role (Read-only)">
                    <input value={formData.role || 'employee'} readOnly className={inp('border-gray-200 bg-gray-50 text-gray-500 cursor-not-allowed capitalize')} />
                  </Field>
                )}

                <Field label="Joining Date" error={errors.joiningDate}>
                  <input ref={dateInputRef} type="date" name="joiningDate" value={formData.joiningDate}
                    onChange={handleInputChange} disabled={loading} className={inp(errors.joiningDate ? 'border-red-400' : 'border-gray-300')} />
                  {formData.joiningDate && <p className="text-xs text-gray-400 mt-1">Displays as: {formatToDDMMYYYY(formData.joiningDate)}</p>}
                </Field>
              </>)}

              {/* ══ SHIFT & SALARY ══════════════════════════════════════════════ */}
              {activeTab === 'shift' && (<>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Shift Start" required error={errors.shiftStart}>
                    <input name="shift.start" value={formData.shift.start} onChange={handleInputChange} disabled={loading} placeholder="09:00"
                      className={inp(errors.shiftStart ? 'border-red-400' : 'border-gray-300')} />
                    <p className="text-xs text-gray-400 mt-1">24-hour HH:mm</p>
                  </Field>
                  <Field label="Shift End" required error={errors.shiftEnd}>
                    <input name="shift.end" value={formData.shift.end} onChange={handleInputChange} disabled={loading} placeholder="18:00"
                      className={inp(errors.shiftEnd ? 'border-red-400' : 'border-gray-300')} />
                    <p className="text-xs text-gray-400 mt-1">24-hour HH:mm</p>
                  </Field>
                </div>

                <Field label="Salary Type" required>
                  <select name="salaryType" value={formData.salaryType} onChange={handleInputChange} disabled={loading} className={inp('border-gray-300')}>
                    <option value="hourly">Hourly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </Field>

                {formData.salaryType === 'hourly' && (
                  <Field label="Hourly Rate (PKR)" required error={errors.hourlyRate}>
                    <input type="number" name="hourlyRate" value={formData.hourlyRate} onChange={handleInputChange} disabled={loading} step="1" min="0"
                      className={inp(errors.hourlyRate ? 'border-red-400' : 'border-gray-300')} />
                  </Field>
                )}
                {formData.salaryType === 'monthly' && (
                  <Field label="Monthly Salary (PKR)" required error={errors.monthlySalary}>
                    <input type="number" name="monthlySalary" value={formData.monthlySalary} onChange={handleInputChange} disabled={loading} step="1" min="0" placeholder="e.g. 50000"
                      className={inp(errors.monthlySalary ? 'border-red-400' : 'border-gray-300')} />
                    <p className="text-xs text-gray-400 mt-1">Effective hourly rate is derived automatically for payroll.</p>
                  </Field>
                )}

                <div className="bg-blue-50 p-4 rounded-xl border border-blue-200">
                  {formData.salaryType === 'hourly' ? (
                    <>
                      <p className="text-xs text-gray-500 mb-1">Estimated Monthly Salary</p>
                      <p className="text-2xl font-bold text-blue-600">PKR {calcMonthly()}</p>
                      <p className="text-xs text-gray-400 mt-1">{formData.shift.start}–{formData.shift.end} × PKR {formData.hourlyRate}/hr × 22 days</p>
                      <p className="text-xs text-amber-600 mt-1">⚠️ Estimate only — actual pay depends on working days.</p>
                    </>
                  ) : (
                    <>
                      <p className="text-xs text-gray-500 mb-1">Fixed Monthly Salary</p>
                      <p className="text-2xl font-bold text-blue-600">PKR {formData.monthlySalary ? parseFloat(formData.monthlySalary).toFixed(2) : '0.00'}</p>
                      <p className="text-xs text-gray-400 mt-1">Pro-rated by actual working days attended.</p>
                    </>
                  )}
                </div>

                <div className="bg-amber-50 p-3 rounded-xl border border-amber-200 text-xs text-amber-800">
                  <span className="font-semibold">⚠️ Note:</span> Shift and salary changes apply to future records only. Historical records retain their original values.
                </div>
              </>)}

              {/* ══ BANK DETAILS ════════════════════════════════════════════════ */}
              {activeTab === 'bank' && (<>
                <Field label="Bank Name">
                  <input name="bank.bankName" value={formData.bank.bankName} onChange={handleInputChange} disabled={loading} placeholder="HBL, UBL, Meezan…" className={inp('border-gray-300')} />
                </Field>
                <Field label="Account Name">
                  <input name="bank.accountName" value={formData.bank.accountName} onChange={handleInputChange} disabled={loading} className={inp('border-gray-300')} />
                </Field>
                <Field label="IBAN / Account Number">
                  <input name="bank.accountNumber" value={formData.bank.accountNumber} onChange={handleInputChange} disabled={loading} className={inp('border-gray-300')} />
                </Field>
                <p className="text-xs text-gray-400">Bank details are optional and can be updated at any time.</p>
              </>)}

              {/* ══ OTHER INFO ══════════════════════════════════════════════════ */}
              {activeTab === 'other' && (<>

                {/* ── Profile picture ──────────────────────────────────────── */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Camera size={13} className="text-pink-500" /> Profile Picture
                  </p>
                  <div className="flex items-center gap-5">
                    {/* Avatar preview */}
                    <div
                      onClick={() => !uploadingPic && picInputRef.current?.click()}
                      className={`relative group w-24 h-24 rounded-2xl overflow-hidden bg-gray-100 shrink-0 ring-2 ring-offset-2 ring-gray-200 cursor-pointer transition
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
                            <User size={32} className="text-gray-300" />
                          </div>
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition flex items-center justify-center">
                            <Camera size={18} className="text-gray-600 opacity-0 group-hover:opacity-100 transition" />
                          </div>
                        </>
                      )}
                    </div>
                    <div>
                      <button type="button" onClick={() => picInputRef.current?.click()} disabled={uploadingPic}
                        className="flex items-center gap-2 px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition text-sm text-gray-600 disabled:opacity-50 mb-2">
                        <Upload size={14} /> {profilePicture ? 'Change Picture' : 'Upload Picture'}
                      </button>
                      {profilePicture && (
                        <button type="button" onClick={deletePic} disabled={uploadingPic}
                          className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition text-sm disabled:opacity-50">
                          <Trash2 size={14} /> Remove
                        </button>
                      )}
                      <p className="text-xs text-gray-400 mt-1">JPEG, PNG, GIF, WebP · max 2 MB</p>
                    </div>
                    <input ref={picInputRef} type="file" accept="image/jpeg,image/jpg,image/png,image/gif,image/webp" onChange={handlePicSelect} className="hidden" />
                  </div>
                </div>

                <div className="border-t border-gray-100 my-1" />

                {/* ── Emergency Contact ─────────────────────────────────────── */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Phone size={13} className="text-red-500" /> Emergency Contact
                    <span className="normal-case font-normal text-gray-400">(optional)</span>
                  </p>
                  <div className="space-y-3">
                    <Field label="Contact Name">
                      <input name="emergencyContact.name" value={formData.emergencyContact.name} onChange={handleInputChange} disabled={loading}
                        placeholder="Full name" className={inp('border-gray-300')} />
                    </Field>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Relationship">
                        <input name="emergencyContact.relationship" value={formData.emergencyContact.relationship} onChange={handleInputChange} disabled={loading}
                          placeholder="Spouse, Parent…" className={inp('border-gray-300')} />
                      </Field>
                      <Field label="Phone">
                        <input name="emergencyContact.phone" value={formData.emergencyContact.phone} onChange={handleInputChange} disabled={loading}
                          placeholder="+92 XXX XXXXXXX" className={inp('border-gray-300')} />
                      </Field>
                    </div>
                  </div>
                </div>

                <div className="border-t border-gray-100 my-1" />

                {/* ── Residential Address ───────────────────────────────────── */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Home size={13} className="text-yellow-600" /> Residential Address
                    <span className="normal-case font-normal text-gray-400">(optional)</span>
                  </p>
                  <div className="space-y-3">
                    <Field label="Street Address">
                      <textarea name="address.street" value={formData.address.street} onChange={handleInputChange} disabled={loading}
                        rows={2} placeholder="House/Flat No., Street, Area"
                        className={`${inp('border-gray-300')} resize-y`} />
                    </Field>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="City">
                        <input name="address.city" value={formData.address.city} onChange={handleInputChange} disabled={loading} placeholder="City" className={inp('border-gray-300')} />
                      </Field>
                      <Field label="State / Province">
                        <input name="address.state" value={formData.address.state} onChange={handleInputChange} disabled={loading} placeholder="State" className={inp('border-gray-300')} />
                      </Field>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="ZIP / Postal Code">
                        <input name="address.zip" value={formData.address.zip} onChange={handleInputChange} disabled={loading} placeholder="ZIP" className={inp('border-gray-300')} />
                      </Field>
                      <Field label="Country">
                        <input name="address.country" value={formData.address.country} onChange={handleInputChange} disabled={loading} placeholder="Country" className={inp('border-gray-300')} />
                      </Field>
                    </div>
                  </div>
                </div>

                <div className="border-t border-gray-100 my-1" />

                {/* ── ID Card ───────────────────────────────────────────────── */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-2">
                    <FileText size={13} className="text-purple-500" /> ID Card
                  </p>
                  <p className="text-xs text-gray-400 mb-3">Upload front and back of the government-issued ID. Changes are saved immediately.</p>
                  <div className="flex flex-col sm:flex-row gap-4">
                    <IdCardSide label="Front Side" side="front" currentFile={idCard.front} onUpload={handleIdUpload} onDelete={handleIdDelete} isLoading={uploadingId} />
                    <IdCardSide label="Back Side"  side="back"  currentFile={idCard.back}  onUpload={handleIdUpload} onDelete={handleIdDelete} isLoading={uploadingId} />
                  </div>
                  {/* Status pill */}
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

                <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-700">
                  💡 Profile picture and ID card changes are saved <strong>immediately</strong> — no need to click Save Changes.
                  Emergency contact and address are saved when you click Save Changes below.
                </div>

              </>)}

            </div>
          </form>
        </div>

        {/* ── Footer ──────────────────────────────────────────────────────────── */}
        <div className="shrink-0 border-t px-6 py-4 flex gap-3 bg-gray-50 rounded-b-2xl">
          <button type="button" onClick={onClose} disabled={loading}
            className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-100 transition font-medium text-sm disabled:opacity-50">
            Cancel
          </button>
          <button type="submit" form="edit-form" disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition font-semibold text-sm disabled:opacity-50">
            {loading
              ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Saving…</>
              : <><Save size={16} /> Save Changes</>
            }
          </button>
        </div>

      </div>
    </div>
  );
}