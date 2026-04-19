import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import {
  Eye,
  EyeOff,
  Save,
  Calendar,
  User,
  Lock,
  CreditCard,
  Shield,
  ShieldCheck,
  UserCircle,
  Pencil,
  X,
  Check,
  Home,
  Phone,
  FileText,
  Upload,
  Trash2,
  Camera,
  BadgeCheck,
} from "lucide-react";
import toast from "react-hot-toast";
import ProfileHeader from "../Common/ProfileHeader";

// ═══════════════════════════════════════════════════════════════
// ROLE DETECTION
// ═══════════════════════════════════════════════════════════════

function getCurrentUserRole() {
  try {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    return user.role || localStorage.getItem("role") || "employee";
  } catch {
    return localStorage.getItem("role") || "employee";
  }
}

const ROLE_CONFIG = {
  owner: {
    label: "Owner",
    Icon: BadgeCheck,
    iconBg: "bg-yellow-600",
    accent: "yellow",
    btnBg: "bg-yellow-600 hover:bg-yellow-700",
    pwBtnBg:
      "bg-yellow-50 text-yellow-700 border-yellow-200 hover:bg-yellow-100",
    canEditPersonal: true,
    canEditEmail: true,
    canEditBank: true,
    canEditShift: true,
    canEditSalary: true,
    canEditStatus: true,
    canEditJoining: true,
    canEditDepartment: true,
  },

  superadmin: {
    label: "Super Administrator",
    Icon: Shield,
    iconBg: "bg-indigo-600",
    accent: "indigo",
    btnBg: "bg-indigo-600 hover:bg-indigo-700",
    pwBtnBg:
      "bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100",
    canEditPersonal: true,
    canEditEmail: true,
    canEditBank: true,
    canEditShift: true,
    canEditSalary: true,
    canEditStatus: true,
    canEditJoining: true,
    canEditDepartment: true,
  },
  admin: {
    label: "Administrator",
    Icon: ShieldCheck,
    iconBg: "bg-blue-600",
    accent: "blue",
    btnBg: "bg-blue-600 hover:bg-blue-700",
    pwBtnBg:
      "bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100",
    canEditEmail: true,
    canEditBank: true,
  },
  employee: {
    label: "Employee",
    Icon: UserCircle,
    iconBg: "bg-emerald-600",
    accent: "emerald",
    btnBg: "bg-emerald-600 hover:bg-emerald-700",
    pwBtnBg:
      "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100",
    canEditEmail: true,
    canEditBank: true,
  },
  hybrid: {
    label: "Hybrid Employee",
    Icon: UserCircle,
    iconBg: "bg-purple-600",
    accent: "purple",
    btnBg: "bg-purple-600 hover:bg-purple-700",
    pwBtnBg:
      "bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100",
    canEditEmail: true,
    canEditBank: true,
  },
};

const ACCENT_CLASSES = {
  indigo: {
    ring: "focus:ring-indigo-500",
    border: "border-indigo-300",
    bg: "bg-indigo-50/40",
    headerGrad: "from-indigo-700 to-indigo-500",
    avatarRing: "ring-indigo-400",
  },
  blue: {
    ring: "focus:ring-blue-500",
    border: "border-blue-300",
    bg: "bg-blue-50/30",
    headerGrad: "from-blue-700 to-blue-500",
    avatarRing: "ring-blue-400",
  },
  emerald: {
    ring: "focus:ring-emerald-500",
    border: "border-emerald-300",
    bg: "bg-emerald-50/30",
    headerGrad: "from-emerald-700 to-emerald-500",
    avatarRing: "ring-emerald-400",
  },
  purple: {
    ring: "focus:ring-purple-500",
    border: "border-purple-300",
    bg: "bg-purple-50/30",
    headerGrad: "from-purple-700 to-purple-500",
    avatarRing: "ring-purple-400",
  },
};

// ═══════════════════════════════════════════════════════════════
// UTILS
// ═══════════════════════════════════════════════════════════════

const formatDateToDisplay = (dateStr) => {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return [
    String(d.getDate()).padStart(2, "0"),
    String(d.getMonth() + 1).padStart(2, "0"),
    d.getFullYear(),
  ].join("/");
};

// ═══════════════════════════════════════════════════════════════
// PRIMITIVES
// ═══════════════════════════════════════════════════════════════

const InfoBox = ({ label, value }) => (
  <div>
    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
      {label}
    </p>
    <div className="px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 min-h-[42px] flex items-center">
      {value || <span className="text-gray-400">—</span>}
    </div>
  </div>
);

const EditBox = ({
  label,
  name,
  value,
  onChange,
  type = "text",
  placeholder = "",
  accentRing,
  accentBorder,
  accentBg,
  badge,
  disabled,
}) => (
  <div>
    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1.5">
      {label}
      {badge && (
        <span className="normal-case font-normal text-xs text-blue-500">
          {badge}
        </span>
      )}
    </p>
    <input
      type={type}
      name={name}
      value={value || ""}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      className={`w-full px-4 py-2.5 border ${accentBorder} ${accentBg} rounded-lg focus:outline-none ${accentRing} focus:ring-2 focus:border-transparent text-sm transition
        ${disabled ? "opacity-50 cursor-not-allowed bg-gray-100" : ""}`}
    />
  </div>
);

const TextareaBox = ({
  label,
  name,
  value,
  onChange,
  rows = 3,
  placeholder = "",
  accentRing,
  accentBorder,
  accentBg,
  disabled,
}) => (
  <div>
    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
      {label}
    </p>
    <textarea
      name={name}
      value={value || ""}
      onChange={onChange}
      rows={rows}
      placeholder={placeholder}
      disabled={disabled}
      className={`w-full px-4 py-2.5 border ${accentBorder} ${accentBg} rounded-lg focus:outline-none ${accentRing} focus:ring-2 focus:border-transparent text-sm transition resize-y
        ${disabled ? "opacity-50 cursor-not-allowed bg-gray-100" : ""}`}
    />
  </div>
);

const Card = ({
  icon: Icon,
  iconBg = "bg-blue-50",
  iconColor = "text-blue-600",
  title,
  badge,
  children,
  optional,
}) => (
  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
    <div className="flex items-center justify-between mb-5 pb-4 border-b border-gray-100">
      <div className="flex items-center gap-2.5">
        <div className={`p-2 rounded-lg ${iconBg}`}>
          <Icon size={18} className={iconColor} />
        </div>
        <h2 className="text-base font-bold text-gray-800">{title}</h2>
        {optional && (
          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full ml-1">
            Optional
          </span>
        )}
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

// Reusable inline spinner
const Spinner = ({ size = 16, color = "border-white" }) => (
  <div
    className={`border-2 ${color} border-t-transparent rounded-full animate-spin shrink-0`}
    style={{ width: size, height: size }}
  />
);

// ─── Single ID card side uploader ─────────────────────────────────────────────
const IdCardSide = ({
  label,
  side,
  currentFile,
  onUpload,
  onDelete,
  accentBorder,
  accentRing,
  isLoading,
  globalBusy,
}) => {
  const fileInputRef = useRef(null);
  const isBusy = isLoading || globalBusy;

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // ✅ IMAGES ONLY - No PDFs
    const validTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/gif",
      "image/webp"
    ];
    
    if (!validTypes.includes(file.type)) {
      toast.error("Only image formats allowed: JPEG, PNG, GIF, or WebP");
      return;
    }
    
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File must be under 5MB");
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (ev) =>
      onUpload(side, { url: ev.target.result, fileName: file.name });
    reader.onerror = () => toast.error("Failed to read file");
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  return (
    <div className="flex-1 min-w-0">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
        {label}
        <span className="ml-1.5 normal-case font-normal text-gray-400">
          {currentFile?.url ? "✓ uploaded" : "required"}
        </span>
      </p>
      <div
        onClick={() => !isBusy && fileInputRef.current.click()}
        className={`relative cursor-pointer rounded-xl border-2 border-dashed transition group
          ${
            currentFile?.url
              ? "border-green-300 bg-green-50/30 hover:border-green-400"
              : `${accentBorder} bg-gray-50/50 hover:bg-gray-100/60`
          } ${isBusy ? "opacity-50 cursor-not-allowed" : ""}`}
        style={{ minHeight: 140 }}
      >
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70 rounded-[10px] z-20">
            <Spinner size={28} color="border-gray-400" />
          </div>
        )}

        {currentFile?.url ? (
          <>
            <img
              src={currentFile.url}
              alt={label}
              className="w-full h-36 object-cover rounded-[10px]"
            />
            {!isBusy && (
              <div className="absolute inset-0 rounded-[10px] bg-black/0 group-hover:bg-black/20 transition flex items-center justify-center">
                <div className="opacity-0 group-hover:opacity-100 transition flex items-center gap-1.5 bg-white/90 px-3 py-1.5 rounded-full shadow text-xs font-medium text-gray-700">
                  <Camera size={13} /> Change
                </div>
              </div>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(side);
              }}
              disabled={isBusy}
              className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 transition shadow disabled:opacity-50 disabled:cursor-not-allowed z-10"
            >
              <Trash2 size={11} />
            </button>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-36 gap-2 text-gray-400">
            <Upload size={22} />
            <span className="text-xs">Click to upload image</span>
            <span className="text-[10px] text-gray-400">
              JPEG, PNG, GIF, WebP · max 5MB
            </span>
          </div>
        )}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
        onChange={handleFileSelect}
        disabled={isBusy}
        className="hidden"
      />
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function MyProfile() {
  const role = getCurrentUserRole();
  const config = ROLE_CONFIG[role] ?? ROLE_CONFIG.employee;
  const ac = ACCENT_CLASSES[config.accent] ?? ACCENT_CLASSES.emerald;
  const { Icon, canEditPersonal, canEditEmail, canEditBank, btnBg, pwBtnBg } =
    config;

  // ── State ────────────────────────────────────────────────────────────────────
  const [employee, setEmployee] = useState(null);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    department: "",
    bankName: "",
    accountName: "",
    accountNumber: "",
    shiftStart: "",
    shiftEnd: "",
    salaryType: "hourly",
    hourlyRate: "",
    monthlySalary: "",
    status: "Active",
    joiningDate: "",
    employeeNumber: "",
    emergencyContact: { name: "", relationship: "", phone: "" },
    address: { street: "", city: "", state: "", zip: "", country: "" },
  });
  const [idCard, setIdCard] = useState({ front: null, back: null });
  const [profilePicture, setProfilePicture] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPic, setUploadingPic] = useState(false);
  // Granular ID upload state: null | 'front' | 'back' | 'delete-front' | 'delete-back'
  const [uploadingIdSide, setUploadingIdSide] = useState(null);

  // Password
  const [pwForm, setPwForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [showPw, setShowPw] = useState({
    current: false,
    new: false,
    confirm: false,
  });
  const [pwOpen, setPwOpen] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);

  const picInputRef = useRef(null);

  // ── Master "anything is in flight" guard ────────────────────────────────────
  // Used to disable all form inputs and the Save button whenever ANY async op runs.
  // ID card uploads are excluded from disabling the main Save button — they have
  // their own local overlay and don't touch form fields.
  const anyBusy =
    loading || saving || uploadingPic || !!uploadingIdSide || pwSaving;
  const formInputBusy = loading || saving || uploadingPic || pwSaving; // don't lock form for ID uploads

  // ── Fetch ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const token = localStorage.getItem("token");
      const { data } = await axios.get("/api/employees/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (data.success) {
        const emp = data.employee;
        setEmployee(emp);
        setForm({
          firstName: emp.firstName || "",
          lastName: emp.lastName || "",
          email: emp.email || "",
          department: emp.department || "",
          bankName: emp.bank?.bankName || "",
          accountName: emp.bank?.accountName || "",
          accountNumber: emp.bank?.accountNumber || "",
          shiftStart: emp.shift?.start || "",
          shiftEnd: emp.shift?.end || "",
          salaryType: emp.salaryType || "hourly",
          hourlyRate: emp.hourlyRate || "",
          monthlySalary: emp.monthlySalary || "",
          status: emp.status || "Active",
          employeeNumber: emp.employeeNumber || "",
          joiningDate: emp.joiningDate
            ? new Date(emp.joiningDate).toISOString().split("T")[0]
            : "",
          emergencyContact: emp.emergencyContact || {
            name: "",
            relationship: "",
            phone: "",
          },
          address: emp.address || {
            street: "",
            city: "",
            state: "",
            zip: "",
            country: "",
          },
        });
        if (emp.profilePicture?.data)
          setProfilePicture(emp.profilePicture.data);
        setIdCard({
          front: emp.idCard?.front?.url ? emp.idCard.front : null,
          back: emp.idCard?.back?.url ? emp.idCard.back : null,
        });
      } else {
        toast.error("Failed to load profile");
      }
    } catch {
      toast.error("Failed to load profile");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };
  const handleECChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      emergencyContact: { ...prev.emergencyContact, [name]: value },
    }));
  };
  const handleAddrChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      address: { ...prev.address, [name]: value },
    }));
  };

  // ── Profile picture ──────────────────────────────────────────────────────────
  const handlePicFileSelect = (e) => {
    if (anyBusy) return;
    const file = e.target.files[0];
    if (!file) return;
    const validTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/gif",
      "image/webp",
    ];
    if (!validTypes.includes(file.type)) {
      toast.error("Please select a valid image (JPEG, PNG, GIF, or WebP)");
      return;
    }
    if (file.size > 500 * 1024) {
      toast.error("Image must be under 500 KB — resize it first");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => uploadProfilePicture(ev.target.result);
    reader.onerror = () => toast.error("Failed to read image");
    reader.readAsDataURL(file);
    e.target.value = "";
  };

const uploadProfilePicture = async (base64Image) => {
  setUploadingPic(true);
  try {
    const token = localStorage.getItem("token");

    const { data } = await axios.put(
      "/api/employees/me/profile-picture",
      { profilePicture: base64Image },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (data.success) {
      setProfilePicture(base64Image);   // ✅ update parent state

      setEmployee(prev => ({
        ...prev,
        profilePicture: { data: base64Image }
      }));

      toast.success("Profile picture updated");
    }
  } catch (err) {
    toast.error("Failed to update");
  } finally {
    setUploadingPic(false);
  }
};

const deleteProfilePicture = async () => {
  if (anyBusy) return;

  setUploadingPic(true);
  try {
    const token = localStorage.getItem("token");

    const { data } = await axios.delete(
      "/api/employees/me/profile-picture",
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (data.success) {
      setProfilePicture(null);

      // ✅ IMPORTANT: update employee state
      setEmployee(prev => ({
        ...prev,
        profilePicture: null
      }));

      toast.success("Profile picture removed");
    } else {
      toast.error(data.message);
    }
  } catch (err) {
    toast.error("Failed to remove profile picture");
  } finally {
    setUploadingPic(false);
  }
};

  // ── ID card ──────────────────────────────────────────────────────────────────
  const handleIdCardUpload = async (side, fileData) => {
    if (anyBusy) return;
    setUploadingIdSide(side);
    try {
      const token = localStorage.getItem("token");
      const { data } = await axios.put(
        "/api/employees/me",
        {
          idCard: {
            [side]: { url: fileData.url, fileName: fileData.fileName },
          },
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (data.success) {
        setIdCard((prev) => ({
          ...prev,
          [side]: {
            url: fileData.url,
            fileName: fileData.fileName,
            uploadedAt: new Date(),
          },
        }));
        toast.success(`ID card ${side} uploaded`);
      } else toast.error(data.message || "Upload failed");
    } catch (err) {
      toast.error(err.response?.data?.message || "Upload failed");
    } finally {
      setUploadingIdSide(null);
    }
  };

  const handleIdCardDelete = async (side) => {
    if (anyBusy) return;
    setUploadingIdSide(`delete-${side}`);
    try {
      const token = localStorage.getItem("token");
      const { data } = await axios.put(
        "/api/employees/me",
        { idCard: { [side]: null } },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (data.success) {
        setIdCard((prev) => ({ ...prev, [side]: null }));
        toast.success(`ID card ${side} removed`);
      } else toast.error(data.message);
    } catch (err) {
      toast.error(err.response?.data?.message || "Remove failed");
    } finally {
      setUploadingIdSide(null);
    }
  };

  // ── Save ─────────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (anyBusy) return;
    if (!form.email?.trim()) return toast.error("Email is required");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
      return toast.error("Please enter a valid email address");

    setSaving(true);
    try {
      const token = localStorage.getItem("token");
      const basePayload = {
        email: form.email.toLowerCase().trim(),
        bank: {
          bankName: form.bankName.trim(),
          accountName: form.accountName.trim(),
          accountNumber: form.accountNumber.trim(),
        },
        emergencyContact: form.emergencyContact,
        address: form.address,
      };

      let data;
      if (role === "superadmin" || role === "owner") {
        const res = await axios.put(
          `/api/employees/${employee._id}`,
          {
            ...basePayload,
            firstName: form.firstName.trim(),
            lastName: form.lastName.trim(),
            department: form.department,
            shift: { start: form.shiftStart, end: form.shiftEnd },
            salaryType: form.salaryType,
            employeeNumber: form.employeeNumber.trim(),
            hourlyRate: parseFloat(form.hourlyRate) || 0,
            monthlySalary:
              form.salaryType === "monthly"
                ? parseFloat(form.monthlySalary) || null
                : null,
            status: form.status,
            joiningDate: form.joiningDate,
          },
          { headers: { Authorization: `Bearer ${token}` } },
        );
        data = res.data;
      } else {
        const res = await axios.put("/api/employees/me", basePayload, {
          headers: { Authorization: `Bearer ${token}` },
        });
        data = res.data;
      }

      if (data.success) {
        setEmployee(data.employee);
        toast.success("Profile saved");
      } else toast.error(data.message || "Save failed");
    } catch (err) {
      toast.error(err.response?.data?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  // ── Change password ──────────────────────────────────────────────────────────
  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (anyBusy) return;
    if (!pwForm.currentPassword)
      return toast.error("Enter your current password");
    if (pwForm.newPassword !== pwForm.confirmPassword)
      return toast.error("Passwords do not match");
    if (pwForm.newPassword.length < 8)
      return toast.error("Password must be at least 8 characters");
    if (pwForm.currentPassword === pwForm.newPassword)
      return toast.error("New password must be different");

    setPwSaving(true);
    try {
      const token = localStorage.getItem("token");
      await axios.post(
        "/api/auth/change-password",
        {
          currentPassword: pwForm.currentPassword,
          newPassword: pwForm.newPassword,
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      toast.success("Password changed successfully");
      setPwForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setPwOpen(false);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to change password");
    } finally {
      setPwSaving(false);
    }
  };

  const calculateMonthlySalary = () => {
    if (!form.hourlyRate || !form.shiftStart || !form.shiftEnd) return null;
    const [sh, sm] = form.shiftStart.split(":").map(Number);
    const [eh, em] = form.shiftEnd.split(":").map(Number);
    let startMin = sh * 60 + sm;
    let endMin = eh * 60 + em;
    if (endMin <= startMin) endMin += 24 * 60;
    return (
      ((endMin - startMin) / 60) *
      22 *
      parseFloat(form.hourlyRate)
    ).toLocaleString("en-PK", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  };

  const SalaryRows = () => {
    if (!employee?.salaryType) return null;
    return employee.salaryType === "monthly" ? (
      <>
        <InfoBox label="Salary Type" value="Monthly" />
        <InfoBox
          label="Monthly Salary (PKR)"
          value={employee.monthlySalary?.toLocaleString("en-PK", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
        />
      </>
    ) : (
      <>
        <InfoBox label="Salary Type" value="Hourly" />
        <InfoBox
          label="Hourly Rate (PKR)"
          value={employee.hourlyRate?.toLocaleString("en-PK", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
        />
      </>
    );
  };

  // ── Loading screen ───────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div
            className={`w-8 h-8 border-2 border-t-transparent rounded-full animate-spin border-${config.accent}-500`}
          />
          <p className="text-sm text-gray-500">Loading profile…</p>
        </div>
      </div>
    );
  }

  const fullName = employee ? `${employee.firstName} ${employee.lastName}` : "";

  // Determine save button label based on what's busy
  const saveLabel = () => {
    if (saving)
      return (
        <>
          <Spinner size={16} /> Saving…
        </>
      );
    if (uploadingPic)
      return (
        <>
          <Spinner size={16} /> Uploading picture…
        </>
      );
    if (uploadingIdSide)
      return (
        <>
          <Spinner size={16} /> Uploading ID…
        </>
      );
    return (
      <>
        <Save size={16} /> Save Changes
      </>
    );
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="bg-gray-50 min-h-screen">
      {/* ── Global save overlay (soft dimming, doesn't block ID/pic uploads) ── */}
      {saving && (
        <div className="fixed inset-0 bg-black/10 backdrop-blur-[1px] z-50 flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-lg px-6 py-4 flex items-center gap-3 pointer-events-none">
            <Spinner size={20} color="border-gray-500" />
            <span className="text-sm font-medium text-gray-700">
              Saving profile…
            </span>
          </div>
        </div>
      )}

      <ProfileHeader
        employee={employee}
        mode="edit" // 👈 Edit mode
        onProfileUpdate={uploadProfilePicture}
         onProfileDelete={deleteProfilePicture}   // ✅ ADD THIS
      />

      {/* ════ CONTENT ════ */}
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 space-y-5">
        {/* ── Personal Information ── */}
        <Card
          icon={User}
          iconBg="bg-blue-50"
          iconColor="text-blue-600"
          title="Personal Information"
          badge={canEditPersonal ? null : "Read-only"}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {canEditPersonal ? (
                <>
                  <EditBox
                    label="First Name"
                    name="firstName"
                    value={form.firstName}
                    onChange={handleChange}
                    disabled={formInputBusy}
                    accentRing={ac.ring}
                    accentBorder={ac.border}
                    accentBg={ac.bg}
                  />
                  <EditBox
                    label="Last Name"
                    name="lastName"
                    value={form.lastName}
                    onChange={handleChange}
                    disabled={formInputBusy}
                    accentRing={ac.ring}
                    accentBorder={ac.border}
                    accentBg={ac.bg}
                  />
                </>
              ) : (
                <>
                  <InfoBox label="First Name" value={employee?.firstName} />
                  <InfoBox label="Last Name" value={employee?.lastName} />
                </>
              )}
            </div>

            <EditBox
              label="Email"
              name="email"
              value={form.email}
              onChange={handleChange}
              type="email"
              placeholder="your@email.com"
              badge="(editable)"
              disabled={formInputBusy}
              accentRing={ac.ring}
              accentBorder={ac.border}
              accentBg={ac.bg}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {config.canEditPersonal ? (
                <EditBox
                  label="Employee Number"
                  name="employeeNumber"
                  value={form.employeeNumber}
                  onChange={handleChange}
                  disabled={formInputBusy}
                  accentRing={ac.ring}
                  accentBorder={ac.border}
                  accentBg={ac.bg}
                />
              ) : (
                <InfoBox
                  label="Employee Number"
                  value={employee?.employeeNumber}
                />
              )}
              {config.canEditDepartment ? (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                    Department
                  </p>
                  <select
                    name="department"
                    value={form.department}
                    onChange={handleChange}
                    disabled={formInputBusy}
                    className={`w-full px-4 py-2.5 border ${ac.border} ${ac.bg} rounded-lg focus:outline-none ${ac.ring} focus:ring-2 text-sm transition
                      ${formInputBusy ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    {[
                      "IT",
                      "Customer Support",
                      "Manager",
                      "Marketing",
                      "HR",
                      "Finance",
                    ].map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <InfoBox label="Department" value={employee?.department} />
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {config.canEditJoining ? (
                <EditBox
                  label="Joining Date"
                  name="joiningDate"
                  value={form.joiningDate}
                  onChange={handleChange}
                  type="date"
                  disabled={formInputBusy}
                  accentRing={ac.ring}
                  accentBorder={ac.border}
                  accentBg={ac.bg}
                />
              ) : (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                    Joining Date
                  </p>
                  <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 min-h-[42px]">
                    <Calendar size={14} className="text-gray-400 shrink-0" />
                    <span>
                      {employee?.joiningDate ? (
                        formatDateToDisplay(employee.joiningDate)
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </span>
                  </div>
                </div>
              )}
              {config.canEditStatus ? (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                    Status
                  </p>
                  <select
                    name="status"
                    value={form.status}
                    onChange={handleChange}
                    disabled={formInputBusy}
                    className={`w-full px-4 py-2.5 border ${ac.border} ${ac.bg} rounded-lg focus:outline-none ${ac.ring} focus:ring-2 text-sm transition
                      ${formInputBusy ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    {["Active", "Inactive", "Frozen"].map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <InfoBox label="Status" value={employee?.status} />
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {config.canEditShift ? (
                <>
                  <EditBox
                    label="Shift Start"
                    name="shiftStart"
                    value={form.shiftStart}
                    onChange={handleChange}
                    placeholder="09:00"
                    disabled={formInputBusy}
                    accentRing={ac.ring}
                    accentBorder={ac.border}
                    accentBg={ac.bg}
                  />
                  <EditBox
                    label="Shift End"
                    name="shiftEnd"
                    value={form.shiftEnd}
                    onChange={handleChange}
                    placeholder="18:00"
                    disabled={formInputBusy}
                    accentRing={ac.ring}
                    accentBorder={ac.border}
                    accentBg={ac.bg}
                  />
                </>
              ) : (
                <>
                  <InfoBox label="Shift Start" value={employee?.shift?.start} />
                  <InfoBox label="Shift End" value={employee?.shift?.end} />
                </>
              )}
            </div>

            {employee?.salaryType &&
              (config.canEditSalary ? (
                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                      Salary Type
                    </p>
                    <select
                      name="salaryType"
                      value={form.salaryType}
                      onChange={handleChange}
                      disabled={formInputBusy}
                      className={`w-full px-4 py-2.5 border ${ac.border} ${ac.bg} rounded-lg focus:outline-none ${ac.ring} focus:ring-2 text-sm transition
                        ${formInputBusy ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                      <option value="hourly">Hourly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <EditBox
                        label="Hourly Rate (PKR)"
                        name="hourlyRate"
                        value={form.hourlyRate}
                        onChange={handleChange}
                        type="number"
                        placeholder="0"
                        disabled={formInputBusy}
                        accentRing={ac.ring}
                        accentBorder={ac.border}
                        accentBg={ac.bg}
                      />
                      {calculateMonthlySalary() && (
                        <p className="text-xs text-green-600 mt-1.5">
                          ≈ PKR {calculateMonthlySalary()} / month (
                          {form.shiftStart}–{form.shiftEnd} × PKR{" "}
                          {form.hourlyRate}/hr × 22 days)
                        </p>
                      )}
                    </div>
                    {form.salaryType === "monthly" && (
                      <EditBox
                        label="Monthly Salary (PKR)"
                        name="monthlySalary"
                        value={form.monthlySalary}
                        onChange={handleChange}
                        type="number"
                        placeholder="0"
                        disabled={formInputBusy}
                        accentRing={ac.ring}
                        accentBorder={ac.border}
                        accentBg={ac.bg}
                      />
                    )}
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <SalaryRows />
                </div>
              ))}
          </div>
        </Card>

        {/* ── Emergency Contact ── */}
        <Card
          icon={Phone}
          iconBg="bg-red-50"
          iconColor="text-red-600"
          title="Emergency Contact"
          optional
        >
          <div className="space-y-4">
            <EditBox
              label="Contact Name"
              name="name"
              value={form.emergencyContact.name}
              onChange={handleECChange}
              placeholder="Full name of emergency contact"
              disabled={formInputBusy}
              accentRing={ac.ring}
              accentBorder={ac.border}
              accentBg={ac.bg}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <EditBox
                label="Relationship"
                name="relationship"
                value={form.emergencyContact.relationship}
                onChange={handleECChange}
                placeholder="e.g. Spouse, Parent, Sibling"
                disabled={formInputBusy}
                accentRing={ac.ring}
                accentBorder={ac.border}
                accentBg={ac.bg}
              />
              <EditBox
                label="Phone Number"
                name="phone"
                value={form.emergencyContact.phone}
                onChange={handleECChange}
                placeholder="+92 XXX XXXXXXX"
                disabled={formInputBusy}
                accentRing={ac.ring}
                accentBorder={ac.border}
                accentBg={ac.bg}
              />
            </div>
          </div>
        </Card>

        {/* ── Residential Address ── */}
        <Card
          icon={Home}
          iconBg="bg-yellow-50"
          iconColor="text-yellow-600"
          title="Residential Address"
          optional
        >
          <div className="space-y-4">
            <TextareaBox
              label="Street Address"
              name="street"
              value={form.address.street}
              onChange={handleAddrChange}
              rows={2}
              placeholder="House/Flat No., Street, Area"
              disabled={formInputBusy}
              accentRing={ac.ring}
              accentBorder={ac.border}
              accentBg={ac.bg}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <EditBox
                label="City"
                name="city"
                value={form.address.city}
                onChange={handleAddrChange}
                placeholder="City"
                disabled={formInputBusy}
                accentRing={ac.ring}
                accentBorder={ac.border}
                accentBg={ac.bg}
              />
              <EditBox
                label="State / Province"
                name="state"
                value={form.address.state}
                onChange={handleAddrChange}
                placeholder="State/Province"
                disabled={formInputBusy}
                accentRing={ac.ring}
                accentBorder={ac.border}
                accentBg={ac.bg}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <EditBox
                label="ZIP / Postal Code"
                name="zip"
                value={form.address.zip}
                onChange={handleAddrChange}
                placeholder="ZIP/Postal Code"
                disabled={formInputBusy}
                accentRing={ac.ring}
                accentBorder={ac.border}
                accentBg={ac.bg}
              />
              <EditBox
                label="Country"
                name="country"
                value={form.address.country}
                onChange={handleAddrChange}
                placeholder="Country"
                disabled={formInputBusy}
                accentRing={ac.ring}
                accentBorder={ac.border}
                accentBg={ac.bg}
              />
            </div>
          </div>
        </Card>

        {/* ── ID Card ── */}
        <Card
          icon={FileText}
          iconBg="bg-purple-50"
          iconColor="text-purple-600"
          title="ID Card"
        >
          <p className="text-xs text-gray-500 mb-4">
            Upload both sides of your government-issued ID card. Both front and
            back are required.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <IdCardSide
              label="Front Side"
              side="front"
              currentFile={idCard.front}
              onUpload={handleIdCardUpload}
              onDelete={handleIdCardDelete}
              accentBorder={ac.border}
              accentRing={ac.ring}
              isLoading={
                uploadingIdSide === "front" ||
                uploadingIdSide === "delete-front"
              }
              globalBusy={saving || uploadingPic || pwSaving}
            />
            <IdCardSide
              label="Back Side"
              side="back"
              currentFile={idCard.back}
              onUpload={handleIdCardUpload}
              onDelete={handleIdCardDelete}
              accentBorder={ac.border}
              accentRing={ac.ring}
              isLoading={
                uploadingIdSide === "back" || uploadingIdSide === "delete-back"
              }
              globalBusy={saving || uploadingPic || pwSaving}
            />
          </div>
          {/* Status row */}
          <div className="mt-4 flex items-center gap-2 flex-wrap">
            {uploadingIdSide && (
              <span className="inline-flex items-center gap-1.5 text-xs text-blue-700 bg-blue-50 border border-blue-200 px-3 py-1 rounded-full">
                <Spinner size={10} color="border-blue-500" />
                {uploadingIdSide.startsWith("delete")
                  ? "Removing…"
                  : "Uploading…"}
              </span>
            )}
            {!uploadingIdSide &&
              (idCard.front?.url && idCard.back?.url ? (
                <span className="inline-flex items-center gap-1.5 text-xs text-green-700 bg-green-50 border border-green-200 px-3 py-1 rounded-full">
                  <Check size={12} /> Both sides uploaded
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full">
                  {!idCard.front?.url && !idCard.back?.url
                    ? "Neither side uploaded yet"
                    : !idCard.front?.url
                      ? "Front side missing"
                      : "Back side missing"}
                </span>
              ))}
          </div>
        </Card>

        {/* ── Bank Details ── */}
        <Card
          icon={CreditCard}
          iconBg="bg-green-50"
          iconColor="text-green-600"
          title="Bank Details"
          badge={canEditBank ? null : "Read-only"}
        >
          <div className="space-y-4">
            {canEditBank ? (
              <>
                <EditBox
                  label="Bank Name"
                  name="bankName"
                  value={form.bankName}
                  onChange={handleChange}
                  placeholder="e.g. HBL, Meezan Bank"
                  disabled={formInputBusy}
                  accentRing={ac.ring}
                  accentBorder={ac.border}
                  accentBg={ac.bg}
                />
                <EditBox
                  label="Account Name"
                  name="accountName"
                  value={form.accountName}
                  onChange={handleChange}
                  placeholder="Account holder name"
                  disabled={formInputBusy}
                  accentRing={ac.ring}
                  accentBorder={ac.border}
                  accentBg={ac.bg}
                />
                <EditBox
                  label="IBAN / Account Number"
                  name="accountNumber"
                  value={form.accountNumber}
                  onChange={handleChange}
                  placeholder="PK00XXXX0000000000000000"
                  disabled={formInputBusy}
                  accentRing={ac.ring}
                  accentBorder={ac.border}
                  accentBg={ac.bg}
                />
              </>
            ) : (
              <>
                <InfoBox label="Bank Name" value={employee?.bank?.bankName} />
                <InfoBox
                  label="Account Name"
                  value={employee?.bank?.accountName}
                />
                <InfoBox
                  label="IBAN / Account Number"
                  value={employee?.bank?.accountNumber}
                />
              </>
            )}
          </div>
        </Card>

        {/* ── Save button ── */}
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={anyBusy}
            className={`flex items-center gap-2 px-6 py-2.5 text-white rounded-lg transition font-semibold text-sm
              disabled:opacity-60 disabled:cursor-not-allowed shadow-sm ${btnBg}`}
          >
            {saveLabel()}
          </button>
        </div>

        {/* ── Change Password ── */}
        <Card
          icon={Lock}
          iconBg="bg-orange-50"
          iconColor="text-orange-600"
          title="Change Password"
        >
          {!pwOpen ? (
            <button
              onClick={() => !anyBusy && setPwOpen(true)}
              disabled={anyBusy}
              className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition text-sm font-medium
                disabled:opacity-50 disabled:cursor-not-allowed ${pwBtnBg}`}
            >
              <Pencil size={14} /> Change Password
            </button>
          ) : (
            <form onSubmit={handleChangePassword} className="space-y-4">
              {[
                {
                  label: "Current Password",
                  field: "current",
                  key: "currentPassword",
                  placeholder: "Enter current password",
                },
                {
                  label: "New Password",
                  field: "new",
                  key: "newPassword",
                  placeholder: "At least 8 characters",
                },
                {
                  label: "Confirm New Password",
                  field: "confirm",
                  key: "confirmPassword",
                  placeholder: "Repeat new password",
                },
              ].map(({ label, field, key, placeholder }) => (
                <div key={field}>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                    {label} <span className="text-red-500">*</span>
                  </p>
                  <div className="relative">
                    <input
                      type={showPw[field] ? "text" : "password"}
                      value={pwForm[key]}
                      onChange={(e) =>
                        setPwForm((prev) => ({
                          ...prev,
                          [key]: e.target.value,
                        }))
                      }
                      required
                      disabled={pwSaving}
                      placeholder={placeholder}
                      className={`w-full px-4 py-2.5 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm transition
                        ${pwSaving ? "opacity-50 cursor-not-allowed bg-gray-100" : ""}`}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setShowPw((p) => ({ ...p, [field]: !p[field] }))
                      }
                      disabled={pwSaving}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {showPw[field] ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {key === "newPassword" && (
                    <p className="text-xs text-gray-400 mt-1">
                      Must be at least 8 characters
                    </p>
                  )}
                </div>
              ))}
              <div className="flex gap-3 pt-1">
                <button
                  type="submit"
                  disabled={pwSaving}
                  className={`flex items-center gap-2 px-5 py-2 text-white rounded-lg transition font-semibold text-sm
                    disabled:opacity-60 disabled:cursor-not-allowed ${btnBg}`}
                >
                  {pwSaving ? (
                    <>
                      <Spinner size={14} /> Updating…
                    </>
                  ) : (
                    <>
                      <Check size={14} /> Update Password
                    </>
                  )}
                </button>
                <button
                  type="button"
                  disabled={pwSaving}
                  onClick={() => {
                    if (pwSaving) return;
                    setPwOpen(false);
                    setPwForm({
                      currentPassword: "",
                      newPassword: "",
                      confirmPassword: "",
                    });
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition text-sm disabled:opacity-50 disabled:cursor-not-allowed"
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
