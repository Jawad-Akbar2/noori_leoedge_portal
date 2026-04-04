import React, { useState, useRef } from "react";
import axios from "axios";
import {
  X,
  Save,
  AlertCircle,
  Calendar,
  Shield,
  Upload,
  Trash2,
  Camera,
  FileText,
  User,
  Briefcase,
  Clock,
  DollarSign,
  Building2,
  CreditCard,
  Image,
  CreditCardIcon,
  ChevronRight,
  CheckCircle2,
} from "lucide-react";
import toast from "react-hot-toast";
import EmployeeLinkDialog from "./EmployeeLinkDialog";
import { formatToDDMMYYYY } from "../../utils/dateFormatter";
import { useEscape } from "../../context/EscapeStack";


// ─── ID card side uploader ────────────────────────────────────────────────────
const IdCardSide = ({ label, side, currentFile, onUpload, onDelete, isLoading }) => {
  const ref = useRef(null);

  const handleSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const valid = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"];

    if (!valid.includes(file.type)) {
      toast.error("Only image formats allowed: JPEG, PNG, GIF, or WebP");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("File must be under 5 MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => onUpload(side, { url: ev.target.result, fileName: file.name });
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          {label}
        </p>
        {currentFile?.url && (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full">
            <CheckCircle2 size={10} /> Uploaded
          </span>
        )}
      </div>
      <div
        onClick={() => !isLoading && ref.current?.click()}
        className={`relative cursor-pointer rounded-xl border-2 transition-all duration-200 group
          ${
            currentFile?.url
              ? "border-green-300 bg-green-50/30 hover:border-green-400"
              : "border-dashed border-gray-300 bg-gray-50/50 hover:bg-gray-100/60 hover:border-gray-400"
          } ${isLoading ? "opacity-50 cursor-not-allowed" : ""}`}
        style={{ minHeight: 130 }}
      >
        {currentFile?.url ? (
          <>
            <img
              src={currentFile.url}
              alt={label}
              className="w-full h-32 object-cover rounded-[10px]"
              onError={(e) => {
                e.target.onerror = null;
                e.target.src =
                  'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="%23999" stroke-width="1.5"%3E%3Crect x="2" y="2" width="20" height="20" rx="2"/%3E%3Cpath d="M8 2v20M16 2v20M2 8h20M2 16h20"/%3E%3C/svg%3E';
                toast.error(`Failed to load ${label} image`);
              }}
            />
            <div className="absolute inset-0 rounded-[10px] bg-black/0 group-hover:bg-black/20 transition flex items-center justify-center">
              <div className="opacity-0 group-hover:opacity-100 transition flex items-center gap-1.5 bg-white/90 px-3 py-1.5 rounded-full shadow text-xs font-medium text-gray-700">
                <Camera size={12} /> Change
              </div>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(side);
              }}
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
    className={`flex items-center gap-2 px-5 py-3 font-medium text-sm transition-all duration-200 border-b-2 ${
      active
        ? "border-blue-500 text-blue-600 bg-blue-50/30"
        : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
    }`}
  >
    <Icon size={16} />
    {label}
  </button>
);

// ─── Form section component ───────────────────────────────────────────────────
const FormSection = ({ title, icon: Icon, children }) => (
  <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
    <div className="px-5 py-3 bg-gradient-to-r from-gray-50 to-white border-b border-gray-100">
      <div className="flex items-center gap-2">
        <div className="p-1 rounded-lg bg-blue-50">
          <Icon size={14} className="text-blue-600" />
        </div>
        <h3 className="font-semibold text-gray-800 text-sm">{title}</h3>
      </div>
    </div>
    <div className="p-5 space-y-4">{children}</div>
  </div>
);

export default function AddEmployeeModal({ onClose, onSave, currentUserRole }) {
    useEscape(onClose);
  const isSuperAdmin = currentUserRole === "superadmin" || currentUserRole === "owner";

  const [activeTab, setActiveTab] = useState("basic");
  const [profilePicture, setProfilePicture] = useState(null);
  const [idCard, setIdCard] = useState({ front: null, back: null });
  const [loading, setLoading] = useState(false);
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [generatedLink, setGeneratedLink] = useState(null);
  const [newEmployee, setNewEmployee] = useState(null);
  const dateInputRef = useRef(null);

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    employeeNumber: "",
    department: "IT",
    role: "employee",
    joiningDate: new Date().toISOString().split("T")[0],
    shift: { start: "09:00", end: "18:00" },
    salaryType: "hourly",
    hourlyRate: 0,
    monthlySalary: "",
    bank: { bankName: "", accountName: "", accountNumber: "" },
  });

  const [errors, setErrors] = useState({});

  const handleProfileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 500 * 1024) {
      toast.error("Profile picture should be under 500KB");
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => setProfilePicture(ev.target.result);
    reader.readAsDataURL(file);
  };

  const handleIdUpload = (side, fileData) => {
    setIdCard((prev) => ({ ...prev, [side]: fileData }));
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setErrors((prev) => ({ ...prev, [name]: "" }));

    if (name.includes(".")) {
      const [parent, child] = name.split(".");
      setFormData((prev) => ({
        ...prev,
        [parent]: { ...prev[parent], [child]: value },
      }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const calculateMonthlySalary = () => {
    if (!formData.hourlyRate || !formData.shift.start || !formData.shift.end) return 0;
    const [startH, startM] = formData.shift.start.split(":").map(Number);
    const [endH, endM] = formData.shift.end.split(":").map(Number);
    let startMin = startH * 60 + startM;
    let endMin = endH * 60 + endM;
    if (endMin <= startMin) endMin += 24 * 60;
    return ((endMin - startMin) / 60) * 22 * parseFloat(formData.hourlyRate);
  };

  const isValidTime = (time) => /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(time);

  const validateForm = () => {
    const newErrors = {};

    if (!formData.firstName.trim()) newErrors.firstName = "First name is required";
    if (!formData.lastName.trim()) newErrors.lastName = "Last name is required";
    if (!formData.email.trim()) newErrors.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email))
      newErrors.email = "Invalid email format";
    if (!formData.employeeNumber.trim()) newErrors.employeeNumber = "Employee number is required";
    if (!formData.joiningDate) newErrors.joiningDate = "Joining date is required";

    if (!isValidTime(formData.shift.start)) newErrors.shiftStart = "Invalid shift start (HH:mm)";
    if (!isValidTime(formData.shift.end)) newErrors.shiftEnd = "Invalid shift end (HH:mm)";

    if (formData.salaryType === "hourly") {
      if (!formData.hourlyRate || parseFloat(formData.hourlyRate) <= 0)
        newErrors.hourlyRate = "Hourly rate must be greater than 0";
    }
    if (formData.salaryType === "monthly") {
      if (!formData.monthlySalary || parseFloat(formData.monthlySalary) <= 0)
        newErrors.monthlySalary = "Monthly salary must be greater than 0";
    }

    if (Object.keys(newErrors).length > 0) {
      if (newErrors.firstName || newErrors.lastName || newErrors.email || newErrors.employeeNumber || newErrors.joiningDate) {
        setActiveTab("basic");
      } else if (newErrors.shiftStart || newErrors.shiftEnd || newErrors.hourlyRate || newErrors.monthlySalary) {
        setActiveTab("shift");
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleGenerateLink = async (e) => {
    e.preventDefault();
    if (!validateForm()) {
      toast.error("Please correct the errors below");
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem("token");

      const payload = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        employeeNumber: formData.employeeNumber,
        department: formData.department,
        role: isSuperAdmin ? formData.role : "employee",
        joiningDate: formatToDDMMYYYY(formData.joiningDate),
        shift: formData.shift,
        salaryType: formData.salaryType,
        hourlyRate: parseFloat(formData.hourlyRate) || 0,
        monthlySalary: formData.salaryType === "monthly" ? parseFloat(formData.monthlySalary) : null,
        bank: formData.bank,
        profilePicture,
        idCard,
      };

      const response = await axios.post("/api/employees", payload, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const { employee, inviteLink } = response.data;
      setNewEmployee(employee);
      setGeneratedLink(inviteLink);
      setShowLinkDialog(true);

      if (onSave) onSave();
      toast.success("Employee created successfully");
    } catch (error) {
      const errorMsg = error.response?.data?.message || "Failed to create employee";
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

  const handleShare = async () => {
    if (!generatedLink) return;
    const shareData = {
      title: `Employee Invite – ${newEmployee?.firstName} ${newEmployee?.lastName}`,
      text: `You've been invited to join as an employee. Click the link to complete your registration.`,
      url: generatedLink,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(generatedLink);
        toast.success("Link copied to clipboard!");
      }
    } catch (err) {
      if (err.name !== "AbortError") toast.error("Could not share link");
    }
  };

  const selectedRoleIsPrivileged = isSuperAdmin && ["admin", "superadmin", "owner"].includes(formData.role);

  const tabs = [
    { key: "basic", label: "Basic Info", icon: User },
    { key: "shift", label: "Shift & Salary", icon: Clock },
    { key: "bank", label: "Bank Details", icon: Building2 },
    { key: "other", label: "Documents", icon: FileText },
  ];

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
        <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
          {/* Header */}
          <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b border-gray-100 px-6 py-5 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                Add New Employee
              </h2>
              {isSuperAdmin && (
                <div className="flex items-center gap-1.5 mt-1">
                  <div className="px-2 py-0.5 rounded-full bg-gradient-to-r from-purple-100 to-purple-200 text-purple-800 text-[10px] font-semibold flex items-center gap-1">
                    <Shield size={10} /> Superadmin
                  </div>
                  <span className="text-[10px] text-gray-400">Can create admin accounts</span>
                </div>
              )}
            </div>
            <button
              onClick={onClose}
              disabled={loading}
              className="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all disabled:opacity-50"
            >
              <X size={20} />
            </button>
          </div>

          {/* Submit Error */}
          {errors.submit && (
            <div className="mx-6 mt-6 bg-gradient-to-r from-red-50 to-red-100/50 border border-red-200 p-4 rounded-xl flex gap-3">
              <AlertCircle className="text-red-600 flex-shrink-0" size={18} />
              <p className="text-red-800 text-sm">{errors.submit}</p>
            </div>
          )}

          {/* Tabs */}
          <div className="border-b border-gray-100 px-6">
            <div className="flex gap-1">
              {tabs.map((tab) => (
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

          <form onSubmit={handleGenerateLink} className="p-6 overflow-y-auto" style={{ maxHeight: "calc(90vh - 180px)" }}>
            {/* Basic Info Tab */}
            {activeTab === "basic" && (
              <div className="space-y-5">
                <FormSection title="Personal Information" icon={User}>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        First Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="firstName"
                        value={formData.firstName}
                        onChange={handleInputChange}
                        disabled={loading}
                        placeholder="John"
                        className={`w-full px-4 py-2.5 bg-gray-50/50 border rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all disabled:bg-gray-100 ${
                          errors.firstName ? "border-red-500" : "border-gray-200"
                        }`}
                      />
                      {errors.firstName && <p className="text-xs text-red-600 mt-1">{errors.firstName}</p>}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        Last Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="lastName"
                        value={formData.lastName}
                        onChange={handleInputChange}
                        disabled={loading}
                        placeholder="Doe"
                        className={`w-full px-4 py-2.5 bg-gray-50/50 border rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all disabled:bg-gray-100 ${
                          errors.lastName ? "border-red-500" : "border-gray-200"
                        }`}
                      />
                      {errors.lastName && <p className="text-xs text-red-600 mt-1">{errors.lastName}</p>}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Email Address <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      disabled={loading}
                      placeholder="john@example.com"
                      className={`w-full px-4 py-2.5 bg-gray-50/50 border rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all disabled:bg-gray-100 ${
                        errors.email ? "border-red-500" : "border-gray-200"
                      }`}
                    />
                    {errors.email && <p className="text-xs text-red-600 mt-1">{errors.email}</p>}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        Employee Number <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="employeeNumber"
                        value={formData.employeeNumber}
                        onChange={handleInputChange}
                        disabled={loading}
                        placeholder="EMP001"
                        className={`w-full px-4 py-2.5 bg-gray-50/50 border rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all disabled:bg-gray-100 ${
                          errors.employeeNumber ? "border-red-500" : "border-gray-200"
                        }`}
                      />
                      {errors.employeeNumber && <p className="text-xs text-red-600 mt-1">{errors.employeeNumber}</p>}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        Department <span className="text-red-500">*</span>
                      </label>
                      <select
                        name="department"
                        value={formData.department}
                        onChange={handleInputChange}
                        disabled={loading}
                        className="w-full px-4 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all disabled:bg-gray-100"
                      >
                        <option value="IT">IT</option>
                        <option value="Customer Support">Customer Support</option>
                        <option value="Manager">Manager</option>
                        <option value="Marketing">Marketing</option>
                        <option value="HR">HR</option>
                        <option value="Finance">Finance</option>
                      </select>
                    </div>
                  </div>

                  {isSuperAdmin && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        Account Role <span className="text-red-500">*</span>
                      </label>
                      <select
                        name="role"
                        value={formData.role}
                        onChange={handleInputChange}
                        disabled={loading}
                        className={`w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-blue-500/20 transition-all disabled:bg-gray-100 ${
                          selectedRoleIsPrivileged
                            ? "border-purple-300 bg-purple-50/50 text-purple-900 font-medium"
                            : "border-gray-200 bg-gray-50/50"
                        }`}
                      >
                        <option value="employee">Employee</option>
                        <option value="admin">Admin</option>
                        <option value="superadmin">Superadmin</option>
                        <option value="hybrid">Hybrid</option>
                      </select>
                      {selectedRoleIsPrivileged && (
                        <p className="text-xs text-purple-700 mt-1.5 flex items-center gap-1">
                          <Shield size={11} />
                          This account will have {formData.role} privileges — full system access.
                        </p>
                      )}
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
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
                      <div
                        className={`flex items-center gap-3 px-4 py-2.5 border rounded-xl bg-gray-50/50 group-hover:border-blue-400 transition-all ${
                          errors.joiningDate ? "border-red-500" : "border-gray-200"
                        } ${loading ? "bg-gray-100" : ""}`}
                      >
                        <Calendar size={18} className="text-gray-400" />
                        <span className="text-gray-700">
                          {formData.joiningDate ? formatToDDMMYYYY(formData.joiningDate) : "Select Date"}
                        </span>
                      </div>
                    </div>
                    {errors.joiningDate && <p className="text-xs text-red-600 mt-1">{errors.joiningDate}</p>}
                  </div>
                </FormSection>
              </div>
            )}

            {/* Shift & Salary Tab */}
            {activeTab === "shift" && (
              <div className="space-y-5">
                <FormSection title="Work Schedule" icon={Clock}>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        Shift Start <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="shift.start"
                        value={formData.shift.start}
                        onChange={handleInputChange}
                        disabled={loading}
                        placeholder="09:00"
                        className={`w-full px-4 py-2.5 bg-gray-50/50 border rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all disabled:bg-gray-100 ${
                          errors.shiftStart ? "border-red-500" : "border-gray-200"
                        }`}
                      />
                      {errors.shiftStart && <p className="text-xs text-red-600 mt-1">{errors.shiftStart}</p>}
                      <p className="text-[10px] text-gray-400 mt-1">24-hour format (HH:mm)</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        Shift End <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="shift.end"
                        value={formData.shift.end}
                        onChange={handleInputChange}
                        disabled={loading}
                        placeholder="18:00"
                        className={`w-full px-4 py-2.5 bg-gray-50/50 border rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all disabled:bg-gray-100 ${
                          errors.shiftEnd ? "border-red-500" : "border-gray-200"
                        }`}
                      />
                      {errors.shiftEnd && <p className="text-xs text-red-600 mt-1">{errors.shiftEnd}</p>}
                      <p className="text-[10px] text-gray-400 mt-1">24-hour format (HH:mm)</p>
                    </div>
                  </div>
                </FormSection>

                <FormSection title="Compensation" icon={DollarSign}>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Salary Type <span className="text-red-500">*</span>
                    </label>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setFormData((prev) => ({ ...prev, salaryType: "hourly", monthlySalary: "" }));
                          setErrors((prev) => ({ ...prev, monthlySalary: "" }));
                        }}
                        className={`flex-1 px-4 py-2.5 rounded-xl border-2 transition-all font-medium text-sm ${
                          formData.salaryType === "hourly"
                            ? "border-blue-500 bg-blue-50 text-blue-700"
                            : "border-gray-200 bg-gray-50/50 text-gray-600 hover:border-gray-300"
                        }`}
                      >
                        Hourly
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setFormData((prev) => ({ ...prev, salaryType: "monthly", hourlyRate: 0 }));
                          setErrors((prev) => ({ ...prev, hourlyRate: "" }));
                        }}
                        className={`flex-1 px-4 py-2.5 rounded-xl border-2 transition-all font-medium text-sm ${
                          formData.salaryType === "monthly"
                            ? "border-blue-500 bg-blue-50 text-blue-700"
                            : "border-gray-200 bg-gray-50/50 text-gray-600 hover:border-gray-300"
                        }`}
                      >
                        Monthly
                      </button>
                    </div>
                  </div>

                  {formData.salaryType === "hourly" && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        Hourly Rate (PKR) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        name="hourlyRate"
                        value={formData.hourlyRate}
                        onChange={handleInputChange}
                        disabled={loading}
                        step="1"
                        min="0"
                        className={`w-full px-4 py-2.5 bg-gray-50/50 border rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all disabled:bg-gray-100 ${
                          errors.hourlyRate ? "border-red-500" : "border-gray-200"
                        }`}
                      />
                      {errors.hourlyRate && <p className="text-xs text-red-600 mt-1">{errors.hourlyRate}</p>}
                    </div>
                  )}

                  {formData.salaryType === "monthly" && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        Monthly Salary (PKR) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        name="monthlySalary"
                        value={formData.monthlySalary}
                        onChange={handleInputChange}
                        disabled={loading}
                        step="1"
                        min="0"
                        placeholder="e.g., 50000"
                        className={`w-full px-4 py-2.5 bg-gray-50/50 border rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all disabled:bg-gray-100 ${
                          errors.monthlySalary ? "border-red-500" : "border-gray-200"
                        }`}
                      />
                      {errors.monthlySalary && <p className="text-xs text-red-600 mt-1">{errors.monthlySalary}</p>}
                    </div>
                  )}

                  {/* Salary Preview Card */}
                  <div className="mt-4 bg-gradient-to-r from-blue-50 to-indigo-50/50 rounded-xl p-4 border border-blue-100">
                    {formData.salaryType === "hourly" ? (
                      <>
                        <p className="text-xs font-medium text-blue-700 uppercase tracking-wider mb-1">
                          Estimated Monthly
                        </p>
                        <p className="text-2xl font-bold text-blue-700">
                          PKR {calculateMonthlySalary().toLocaleString()}
                        </p>
                        <p className="text-[10px] text-gray-500 mt-1.5">
                          Based on {formData.shift.start}–{formData.shift.end} × PKR {formData.hourlyRate}/hr × 22 days
                        </p>
                        <p className="text-[10px] text-amber-600 mt-1">
                          ⚠️ Estimate only — actual pay depends on working days
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-xs font-medium text-blue-700 uppercase tracking-wider mb-1">
                          Fixed Monthly Salary
                        </p>
                        <p className="text-2xl font-bold text-blue-700">
                          PKR {(formData.monthlySalary || 0).toLocaleString()}
                        </p>
                        <p className="text-[10px] text-gray-500 mt-1.5">
                          Pro-rated by actual working days attended each pay period
                        </p>
                      </>
                    )}
                  </div>
                </FormSection>
              </div>
            )}

            {/* Bank Details Tab */}
            {activeTab === "bank" && (
              <div className="space-y-5">
                <FormSection title="Bank Information" icon={Building2}>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Bank Name</label>
                    <input
                      type="text"
                      name="bank.bankName"
                      value={formData.bank.bankName}
                      onChange={handleInputChange}
                      disabled={loading}
                      placeholder="e.g., HBL, UBL, Standard Chartered"
                      className="w-full px-4 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all disabled:bg-gray-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Account Title</label>
                    <input
                      type="text"
                      name="bank.accountName"
                      value={formData.bank.accountName}
                      onChange={handleInputChange}
                      disabled={loading}
                      placeholder="Full name as per bank account"
                      className="w-full px-4 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all disabled:bg-gray-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">IBAN / Account Number</label>
                    <input
                      type="text"
                      name="bank.accountNumber"
                      value={formData.bank.accountNumber}
                      onChange={handleInputChange}
                      disabled={loading}
                      placeholder="e.g., PK36 HBL 0112 3456 7890 1234"
                      className="w-full px-4 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all disabled:bg-gray-100"
                    />
                  </div>
                  <p className="text-xs text-gray-400 flex items-center gap-1.5 mt-2">
                    <CreditCard size={12} /> Bank details are optional and can be added later
                  </p>
                </FormSection>
              </div>
            )}

            {/* Documents Tab */}
            {activeTab === "other" && (
              <div className="space-y-5">
                <FormSection title="Profile Picture" icon={Image}>
                  <div>
                    <div className="flex items-center gap-4 flex-wrap">
                      <div className="relative">
                        {profilePicture ? (
                          <div className="relative inline-block">
                            <img
                              src={profilePicture}
                              className="w-20 h-20 rounded-xl object-cover border-2 border-gray-200 shadow-sm"
                              alt="Profile preview"
                            />
                            <button
                              type="button"
                              onClick={() => setProfilePicture(null)}
                              className="absolute -top-2 -right-2 p-1.5 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-full hover:from-red-600 hover:to-red-700 transition-all shadow-md"
                            >
                              <Trash2 size={10} />
                            </button>
                          </div>
                        ) : (
                          <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center border-2 border-dashed border-gray-300">
                            <User size={24} className="text-gray-400" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1">
                        <label className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-xl text-sm font-medium text-gray-700 cursor-pointer hover:bg-gray-200 transition-all">
                          <Camera size={14} />
                          Upload Photo
                          <input
                            type="file"
                            accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                            onChange={handleProfileUpload}
                            className="hidden"
                          />
                        </label>
                        <p className="text-[10px] text-gray-400 mt-2">
                          JPEG, PNG, GIF, WebP · max 500KB
                        </p>
                      </div>
                    </div>
                  </div>
                </FormSection>

                <FormSection title="CNIC / ID Card" icon={CreditCardIcon}>
                  <div className="flex flex-col sm:flex-row gap-4">
                    <IdCardSide
                      label="Front Side"
                      side="front"
                      currentFile={idCard.front}
                      onUpload={handleIdUpload}
                      onDelete={(side) => setIdCard((prev) => ({ ...prev, [side]: null }))}
                      isLoading={loading}
                    />
                    <IdCardSide
                      label="Back Side"
                      side="back"
                      currentFile={idCard.back}
                      onUpload={handleIdUpload}
                      onDelete={(side) => setIdCard((prev) => ({ ...prev, [side]: null }))}
                      isLoading={loading}
                    />
                  </div>
                  <p className="text-xs text-gray-400 flex items-center gap-1.5 mt-2">
                    <Shield size={12} /> ID images are stored securely and only accessible by HR/Admin
                  </p>
                </FormSection>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 mt-8 pt-5 border-t border-gray-100">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-all font-medium text-sm disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl transition-all font-semibold text-sm shadow-md disabled:opacity-50 text-white ${
                  selectedRoleIsPrivileged
                    ? "bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800"
                    : "bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
                }`}
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    Generate Invite Link
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
          onShare={handleShare}
        />
      )}
    </>
  );
}