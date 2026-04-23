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
} from "lucide-react";
import toast from "react-hot-toast";
import EmployeeLinkDialog from "./EmployeeLinkDialog";
import { formatToDDMMYYYY } from "../../utils/dateFormatter";

// ─── ID card side uploader ────────────────────────────────────────────────────

const IdCardSide = ({
  label,
  side,
  currentFile,
  onUpload,
  onDelete,
  isLoading,
}) => {
  const ref = useRef(null);

  const handleSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const valid = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/gif",
      "image/webp",
      "application/pdf",
    ];
    if (!valid.includes(file.type)) {
      toast.error("JPEG, PNG, GIF, WebP or PDF only");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File must be under 5 MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) =>
      onUpload(side, {
        url: ev.target.result,
        fileName: file.name,
        mimeType: file.type,
      });
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const isImage =
    currentFile?.url && !currentFile.url.startsWith("data:application/pdf");
  const isPDF = currentFile?.url?.startsWith("data:application/pdf");

  return (
    <div className="flex-1 min-w-0">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
        {label}
        <span className="ml-1.5 normal-case font-normal text-gray-400">
          {currentFile?.url ? "✓ uploaded" : "required"}
        </span>
      </p>
      <div
        onClick={() => !isLoading && ref.current?.click()}
        className={`relative cursor-pointer rounded-xl border-2 border-dashed transition group
          ${
            currentFile?.url
              ? "border-green-300 bg-green-50/30 hover:border-green-400"
              : "border-gray-300 bg-gray-50/50 hover:bg-gray-100/60"
          } ${isLoading ? "opacity-50 cursor-not-allowed" : ""}`}
        style={{ minHeight: 130 }}
      >
        {currentFile?.url ? (
          <>
            {isPDF ? (
              <div className="flex flex-col items-center justify-center h-32 gap-2">
                <FileText size={28} className="text-red-400" />
                <span className="text-xs text-gray-500 text-center px-2 break-all">
                  {currentFile.fileName || "document.pdf"}
                </span>
              </div>
            ) : (
              <img
                src={currentFile.url}
                alt={label}
                className="w-full h-32 object-cover rounded-[10px]"
              />
            )}
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
              className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 shadow disabled:opacity-50 z-10 transition"
            >
              <Trash2 size={11} />
            </button>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-32 gap-2 text-gray-400">
            <Upload size={20} />
            <span className="text-xs">Click to upload</span>
            <span className="text-[10px]">JPEG, PNG, PDF · max 5 MB</span>
          </div>
        )}
      </div>
      <input
        ref={ref}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/gif,image/webp,application/pdf"
        onChange={handleSelect}
        className="hidden"
      />
    </div>
  );
};

// currentUserRole is passed from ManageEmployees
export default function AddEmployeeModal({ onClose, onSave, currentUserRole }) {
  const isSuperAdmin =
    currentUserRole === "superadmin" || currentUserRole === "owner";

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
    // Superadmin can set role; admin always creates 'employee'
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

    const reader = new FileReader();
    reader.onload = (ev) =>
      setProfilePicture({
        data: ev.target.result,
        fileName: file.name,
        mimeType: file.type,
      });

    reader.readAsDataURL(file);
  };

  const handleIdUpload = (side, fileData) => {
    setIdCard((prev) => ({
      ...prev,
      [side]: fileData,
    }));
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
    if (!formData.hourlyRate || !formData.shift.start || !formData.shift.end)
      return 0;
    const [startH, startM] = formData.shift.start.split(":").map(Number);
    const [endH, endM] = formData.shift.end.split(":").map(Number);
    let startMin = startH * 60 + startM;
    let endMin = endH * 60 + endM;
    if (endMin <= startMin) endMin += 24 * 60;
    return (
      ((endMin - startMin) / 60) *
      22 *
      parseFloat(formData.hourlyRate)
    ).toLocaleString("en-PK", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  };

  const isValidTime = (time) => /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(time);

  const validateForm = () => {
    const newErrors = {};

    if (!formData.firstName.trim())
      newErrors.firstName = "First name is required";
    if (!formData.lastName.trim()) newErrors.lastName = "Last name is required";
    if (!formData.email.trim()) newErrors.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email))
      newErrors.email = "Invalid email format";
    if (!formData.employeeNumber.trim())
      newErrors.employeeNumber = "Employee number is required";
    if (!formData.joiningDate)
      newErrors.joiningDate = "Joining date is required";

    if (!isValidTime(formData.shift.start))
      newErrors.shiftStart = "Invalid shift start (HH:mm)";
    if (!isValidTime(formData.shift.end))
      newErrors.shiftEnd = "Invalid shift end (HH:mm)";

    if (formData.salaryType === "hourly") {
      if (!formData.hourlyRate || parseFloat(formData.hourlyRate) <= 0)
        newErrors.hourlyRate = "Hourly rate must be greater than 0";
    }
    if (formData.salaryType === "monthly") {
      if (!formData.monthlySalary || parseFloat(formData.monthlySalary) <= 0)
        newErrors.monthlySalary =
          "Monthly salary is required and must be greater than 0";
    }

    if (Object.keys(newErrors).length > 0) {
      if (
        newErrors.firstName ||
        newErrors.lastName ||
        newErrors.email ||
        newErrors.employeeNumber ||
        newErrors.joiningDate
      ) {
        setActiveTab("basic");
      } else if (
        newErrors.shiftStart ||
        newErrors.shiftEnd ||
        newErrors.hourlyRate ||
        newErrors.monthlySalary
      ) {
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
        monthlySalary:
          formData.salaryType === "monthly"
            ? parseFloat(formData.monthlySalary)
            : null,
        bank: formData.bank,
      };

      const response = await axios.post("/api/employees", payload, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const { employee, inviteLink } = response.data;

      const uploads = [];

      if (profilePicture) {
        uploads.push(
          axios.put(
            `/api/employees/${employee._id}/profile-picture`,
            {
              profilePicture,
            },
            { headers: { Authorization: `Bearer ${token}` } },
          ),
        );
      }

      if (idCard.front?.url) {
        uploads.push(
          axios.put(
            `/api/employees/${employee._id}/id-card/front`,
            {
              idCard: idCard.front,
            },
            { headers: { Authorization: `Bearer ${token}` } },
          ),
        );
      }

      if (idCard.back?.url) {
        uploads.push(
          axios.put(
            `/api/employees/${employee._id}/id-card/back`,
            {
              idCard: idCard.back,
            },
            { headers: { Authorization: `Bearer ${token}` } },
          ),
        );
      }

      await Promise.all(uploads);
      setNewEmployee(employee);
      setGeneratedLink(inviteLink);
      setShowLinkDialog(true);

      if (onSave) onSave();
      toast.success("Employee created successfully");
    } catch (error) {
      const errorMsg =
        error.response?.data?.message || "Failed to create employee";
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

  // Role badge preview shown when superadmin selects admin/superadmin role
  const selectedRoleIsPrivileged =
    isSuperAdmin && ["admin", "superadmin", "owner"].includes(formData.role);

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="sticky top-0 bg-white border-b p-6 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-800">
                Add New Employee
              </h2>
              {isSuperAdmin && (
                <p className="text-xs text-purple-600 mt-1 flex items-center gap-1">
                  <Shield size={11} /> Superadmin — can also create admin
                  accounts
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              disabled={loading}
              className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
            >
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
                { key: "basic", label: "Basic Info" },
                { key: "shift", label: "Shift & Salary" },
                { key: "bank", label: "Bank Details" },
                { key: "other", label: "Other Info" },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex-1 px-4 py-3 font-medium border-b-2 transition ${
                    activeTab === tab.key
                      ? "border-blue-500 text-blue-600"
                      : "border-transparent text-gray-600 hover:text-gray-800"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleGenerateLink} className="p-6">
            {/* ── Basic Info Tab ──────────────────────────────────────────── */}
            {activeTab === "basic" && (
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
                      placeholder="John"
                      className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 ${errors.firstName ? "border-red-500" : "border-gray-300"}`}
                    />
                    {errors.firstName && (
                      <p className="text-xs text-red-600 mt-1">
                        {errors.firstName}
                      </p>
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
                      placeholder="Doe"
                      className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 ${errors.lastName ? "border-red-500" : "border-gray-300"}`}
                    />
                    {errors.lastName && (
                      <p className="text-xs text-red-600 mt-1">
                        {errors.lastName}
                      </p>
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
                    placeholder="john@example.com"
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 ${errors.email ? "border-red-500" : "border-gray-300"}`}
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
                      placeholder="EMP002"
                      className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 ${errors.employeeNumber ? "border-red-500" : "border-gray-300"}`}
                    />
                    {errors.employeeNumber && (
                      <p className="text-xs text-red-600 mt-1">
                        {errors.employeeNumber}
                      </p>
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
                    <select
                      name="role"
                      value={formData.role}
                      onChange={handleInputChange}
                      disabled={loading}
                      className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 ${
                        selectedRoleIsPrivileged
                          ? "border-purple-400 bg-purple-50 text-purple-900 font-medium"
                          : "border-gray-300"
                      }`}
                    >
                      <option value="employee">Employee</option>
                      <option value="admin">Admin</option>
                      <option value="superadmin">Superadmin</option>
                      <option value="hybrid">Hybrid</option>
                    </select>
                    {selectedRoleIsPrivileged && (
                      <p className="text-xs text-purple-700 mt-1 flex items-center gap-1">
                        <Shield size={11} />
                        This account will have {formData.role} privileges — full
                        system access.
                      </p>
                    )}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Joining Date <span className="text-red-500">*</span>
                  </label>
                  <div
                    className="relative group cursor-pointer"
                    onClick={() =>
                      !loading && dateInputRef.current?.showPicker()
                    }
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
                      className={`flex items-center gap-2 px-4 py-2 border rounded-lg bg-white group-hover:border-blue-400 transition-colors ${errors.joiningDate ? "border-red-500" : "border-gray-300"} ${loading ? "bg-gray-100" : ""}`}
                    >
                      <Calendar size={18} className="text-gray-400" />
                      <span className="text-gray-700">
                        {formData.joiningDate
                          ? formatToDDMMYYYY(formData.joiningDate)
                          : "Select Date"}
                      </span>
                    </div>
                  </div>
                  {errors.joiningDate && (
                    <p className="text-xs text-red-600 mt-1">
                      {errors.joiningDate}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* ── Shift & Salary Tab ─────────────────────────────────────── */}
            {activeTab === "shift" && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Shift Start (HH:mm){" "}
                      <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="shift.start"
                      value={formData.shift.start}
                      onChange={handleInputChange}
                      disabled={loading}
                      placeholder="09:00"
                      className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 ${errors.shiftStart ? "border-red-500" : "border-gray-300"}`}
                    />
                    {errors.shiftStart && (
                      <p className="text-xs text-red-600 mt-1">
                        {errors.shiftStart}
                      </p>
                    )}
                    <p className="text-xs text-gray-500 mt-1">24-hour format</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Shift End (HH:mm) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="shift.end"
                      value={formData.shift.end}
                      onChange={handleInputChange}
                      disabled={loading}
                      placeholder="18:00"
                      className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 ${errors.shiftEnd ? "border-red-500" : "border-gray-300"}`}
                    />
                    {errors.shiftEnd && (
                      <p className="text-xs text-red-600 mt-1">
                        {errors.shiftEnd}
                      </p>
                    )}
                    <p className="text-xs text-gray-500 mt-1">24-hour format</p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Salary Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="salaryType"
                    value={formData.salaryType}
                    onChange={handleInputChange}
                    disabled={loading}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                  >
                    <option value="hourly">Hourly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>

                {formData.salaryType === "hourly" && (
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
                      step="1"
                      min="0"
                      className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 ${errors.hourlyRate ? "border-red-500" : "border-gray-300"}`}
                    />
                    {errors.hourlyRate && (
                      <p className="text-xs text-red-600 mt-1">
                        {errors.hourlyRate}
                      </p>
                    )}
                  </div>
                )}

                {formData.salaryType === "monthly" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Monthly Salary (PKR){" "}
                      <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      name="monthlySalary"
                      value={formData.monthlySalary}
                      onChange={handleInputChange}
                      disabled={loading}
                      step="1"
                      min="0"
                      placeholder="e.g. 50000"
                      className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 ${errors.monthlySalary ? "border-red-500" : "border-gray-300"}`}
                    />
                    {errors.monthlySalary && (
                      <p className="text-xs text-red-600 mt-1">
                        {errors.monthlySalary}
                      </p>
                    )}
                    <p className="text-xs text-gray-500 mt-1">
                      An effective hourly rate will be derived automatically.
                    </p>
                  </div>
                )}

                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  {formData.salaryType === "hourly" ? (
                    <>
                      <p className="text-sm text-gray-600 mb-1">
                        Estimated Monthly Salary:
                      </p>
                      <p className="text-3xl font-bold text-blue-600">
                        PKR {calculateMonthlySalary()}
                      </p>
                      <p className="text-xs text-gray-500 mt-2">
                        Based on {formData.shift.start}–{formData.shift.end} ×
                        PKR {formData.hourlyRate}/hr × 22 days
                      </p>
                      <p className="text-xs text-amber-600 mt-1">
                        ⚠️ Estimate only — actual pay depends on working days in
                        the pay period.
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm text-gray-600 mb-1">
                        Fixed Monthly Salary:
                      </p>
                      <p className="text-3xl font-bold text-blue-600">
                        PKR{" "}
                        {Number(formData.monthlySalary || 0).toLocaleString(
                          "en-PK",
                          {
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 0,
                          },
                        )}
                      </p>
                      <p className="text-xs text-gray-500 mt-2">
                        Pro-rated by actual working days attended each pay
                        period.
                      </p>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* ── Bank Details Tab ───────────────────────────────────────── */}
            {activeTab === "bank" && (
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
                    IBAN Number
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
                <p className="text-xs text-gray-500">
                  Bank details are optional and can be added later.
                </p>
              </div>
            )}

            {activeTab === "other" && (
              <div className="space-y-6">
                {/* Profile Picture */}
                <div>
                  <label className="text-sm font-medium">Profile Picture</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleProfileUpload}
                  />

                  {profilePicture && (
                    <img
                      src={profilePicture}
                      className="w-20 h-20 mt-2 rounded-lg object-cover"
                    />
                  )}
                </div>

                {/* ID Card */}
                <div>
                  <label className="text-sm font-medium">CNIC / ID Card</label>

                  <div className="flex gap-4 mt-2">
                    <IdCardSide
                      label="Front"
                      side="front"
                      currentFile={idCard.front}
                      onUpload={handleIdUpload}
                      onDelete={(side) =>
                        setIdCard((prev) => ({ ...prev, [side]: null }))
                      }
                    />

                    <IdCardSide
                      label="Back"
                      side="back"
                      currentFile={idCard.back}
                      onUpload={handleIdUpload}
                      onDelete={(side) =>
                        setIdCard((prev) => ({ ...prev, [side]: null }))
                      }
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
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
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition font-medium disabled:opacity-50 disabled:cursor-not-allowed text-white ${
                  selectedRoleIsPrivileged
                    ? "bg-purple-600 hover:bg-purple-700"
                    : "bg-blue-600 hover:bg-blue-700"
                }`}
              >
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
          onShare={handleShare}
        />
      )}
    </>
  );
}
