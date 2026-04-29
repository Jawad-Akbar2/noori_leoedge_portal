import React, { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";
import {
  Plus,
  MoreVertical,
  AlertCircle,
  Shield,
  Archive,
  LogOut,
  RotateCcw,
  Search,
  Filter,
  X,
  Check,
  UserPlus,
  Eye,
  Edit,
  Mail,
  UserX,
  RefreshCw,
  Calendar,
  MessageSquare,
} from "lucide-react";
import AddEmployeeModal from "./AddEmployeeModal";
import EditEmployeeModal from "./EditEmployeeModal";
import GhostModeView from "./GhostModeView";
import toast from "react-hot-toast";
import ReactDOM from "react-dom";

// ─── Role helpers ─────────────────────────────────────────────────────────────
const PRIVILEGED_ROLES = ["admin", "superadmin", "owner"];

function canManage(actorRole, targetRole) {
  if (actorRole === "superadmin" || actorRole === "owner") return true;
  if (actorRole === "admin") return !PRIVILEGED_ROLES.includes(targetRole);
  return false;
}

function readCurrentUser() {
  try {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    return {
      id: user._id || user.id || null,
      role: user.role || localStorage.getItem("role") || "",
    };
  } catch {
    return { id: null, role: localStorage.getItem("role") || "" };
  }
}

function getRoleBadge(role) {
  switch (role) {
    case "superadmin":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gradient-to-r from-purple-100 to-purple-200 text-purple-800 border border-purple-200/50 shadow-sm">
          <Shield size={10} /> Superadmin
        </span>
      );
    case "owner":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gradient-to-r from-purple-100 to-purple-200 text-purple-800 border border-purple-200/50 shadow-sm">
          <Shield size={10} /> Owner
        </span>
      );
    case "admin":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gradient-to-r from-blue-100 to-blue-200 text-blue-800 border border-blue-200/50 shadow-sm">
          <Shield size={10} /> Admin
        </span>
      );
    case "hybrid":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gradient-to-r from-indigo-100 to-indigo-200 text-indigo-800 border border-indigo-200/50 shadow-sm">
          Hybrid
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700 border border-gray-200/50 shadow-sm">
          Employee
        </span>
      );
  }
}

// ─── Days remaining pill ──────────────────────────────────────────────────────
function DaysRemainingPill({ scheduledDeletion }) {
  if (!scheduledDeletion) return null;
  const ms = new Date(scheduledDeletion) - Date.now();
  const days = Math.max(0, Math.ceil(ms / 86_400_000));
  const urgent = days <= 7;
  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold shadow-sm ${
        urgent
          ? "bg-gradient-to-r from-red-100 to-red-200 text-red-700 border border-red-200/50"
          : "bg-gradient-to-r from-amber-100 to-amber-200 text-amber-700 border border-amber-200/50"
      }`}
    >
      {days}d left
    </span>
  );
}

export default function ManageEmployees() {
  const { id: initId, role: initRole } = readCurrentUser();

  const [employees, setEmployees] = useState([]);
  const [filteredEmployees, setFilteredEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showGhostMode, setShowGhostMode] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [departmentFilter, setDepartmentFilter] = useState("All");
  const [roleFilter, setRoleFilter] = useState("All");
  const [includeArchived, setIncludeArchived] = useState(false);
  const [includeLeft, setIncludeLeft] = useState(false);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(initId);
  const [currentUserRole, setCurrentUserRole] = useState(initRole);
  const [leftDate, setLeftDate] = useState(() => {
    const today = new Date();
    return today.toISOString().slice(0, 10);
  });
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const [showFilters, setShowFilters] = useState(false);

  // ── Reason modal state ────────────────────────────────────────────────────
  const [showReasonModal, setShowReasonModal] = useState(false);
  const [reasonTarget, setReasonTarget] = useState(null);
  const [reasonText, setReasonText] = useState("");

  const isSuperAdmin = currentUserRole === "superadmin" || currentUserRole === "owner";
  const isAdmin = currentUserRole === "admin" || isSuperAdmin;

  const filterEmployees = useCallback(
    (data) => {
      let filtered = data;

      if (currentUserRole === "admin") {
        filtered = filtered.filter(
          (emp) => !PRIVILEGED_ROLES.includes(emp.role)
        );
      }

      if (!includeLeft) {
        filtered = filtered.filter((emp) => !emp.leftBusiness?.isLeft);
      }

      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        filtered = filtered.filter(
          (emp) =>
            emp.firstName.toLowerCase().includes(term) ||
            emp.lastName.toLowerCase().includes(term) ||
            emp.email.toLowerCase().includes(term) ||
            emp.employeeNumber.toLowerCase().includes(term)
        );
      }
      if (statusFilter !== "All")
        filtered = filtered.filter((emp) => emp.status === statusFilter);
      if (departmentFilter !== "All")
        filtered = filtered.filter((emp) => emp.department === departmentFilter);
      if (roleFilter !== "All")
        filtered = filtered.filter((emp) => (emp.role || "employee") === roleFilter);

      setFilteredEmployees(filtered);
    },
    [searchTerm, statusFilter, departmentFilter, roleFilter, currentUserRole, includeLeft]
  );

  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get("/api/employees?images=true", {
        params: {
          includeArchived: includeArchived ? "true" : "false",
          includeLeft: "true",
        },
        headers: { Authorization: `Bearer ${token}` },
      });
      const list = response.data.employees || [];
      setEmployees(list);
      filterEmployees(list);
    } catch {
      toast.error("Failed to load employees");
    } finally {
      setLoading(false);
    }
  }, [filterEmployees, includeArchived]);

  useEffect(() => {
    const { id, role } = readCurrentUser();
    setCurrentUserId(id);
    setCurrentUserRole(role);
    fetchEmployees();
  }, [fetchEmployees]);

  useEffect(() => {
    filterEmployees(employees);
  }, [
    searchTerm,
    statusFilter,
    departmentFilter,
    roleFilter,
    employees,
    filterEmployees,
    includeLeft,
  ]);


useEffect(() => {
  const handleMouseDown = (e) => {
    // Ignore clicks on the trigger button or the menu itself
    if (
      e.target.closest("[data-kebab-btn]") ||
      e.target.closest("[data-kebab-menu]")
    ) {
      return;
    }
    setOpenMenuId(null);
  };
  document.addEventListener("mousedown", handleMouseDown);
  return () => document.removeEventListener("mousedown", handleMouseDown);
}, []);

  // ─── Guards ──────────────────────────────────────────────────────────────────
  const guardAction = (employee, action) => {
    if (employee._id === currentUserId) {
      toast.error(`You cannot ${action} your own account`);
      setOpenMenuId(null);
      return false;
    }
    if (!canManage(currentUserRole, employee.role)) {
      toast.error("You do not have permission to manage admin or superadmin accounts");
      setOpenMenuId(null);
      return false;
    }
    return true;
  };

  const handleEdit = (employee) => {
    if (!guardAction(employee, "edit")) return;
    setSelectedEmployee(employee);
    setShowEditModal(true);
    setOpenMenuId(null);
  };

  const handleGhostMode = (employee) => {
    if (employee._id === currentUserId) {
      toast.error("You cannot ghost your own account");
      setOpenMenuId(null);
      return;
    }
    if (!canManage(currentUserRole, employee.role)) {
      toast.error("You do not have permission to ghost admin or superadmin accounts");
      setOpenMenuId(null);
      return;
    }
    setSelectedEmployee(employee);
    setShowGhostMode(true);
    setOpenMenuId(null);
  };

  const handleArchive = async (employee) => {
    if (!guardAction(employee, "archive")) return;
    const action = employee.isArchived ? "unarchive" : "archive";
    if (
      !window.confirm(
        `${action.charAt(0).toUpperCase() + action.slice(1)} ${employee.firstName} ${employee.lastName}?`
      )
    ) {
      setOpenMenuId(null);
      return;
    }
    try {
      const token = localStorage.getItem("token");
      await axios.patch(
        `/api/employees/${employee._id}/archive`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(`Employee ${action}d`);
      fetchEmployees();
    } catch (err) {
      toast.error(err.response?.data?.message || `Failed to ${action} employee`);
    } finally {
      setOpenMenuId(null);
    }
  };

  const handleResendInvite = async (employee) => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.post(
        `/api/employees/${employee._id}/resend-invite`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (response.data.inviteLink) {
        await navigator.clipboard.writeText(response.data.inviteLink).catch(() => {});
        toast.success("Invite link copied to clipboard");
      } else {
        toast.success("Invite resent successfully");
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to resend invite");
    } finally {
      setOpenMenuId(null);
    }
  };

  // ─── Left-business actions ────────────────────────────────────────────────
  const openMarkLeftModal = (employee) => {
    if (!guardAction(employee, "mark as left")) return;
    setReasonTarget(employee);
    setReasonText("");
    setLeftDate(new Date().toISOString().slice(0, 10));
    setShowReasonModal(true);
    setOpenMenuId(null);
  };

  const confirmMarkLeft = async () => {
    if (!reasonTarget) return;
    try {
      const token = localStorage.getItem("token");
      await axios.patch(
        `/api/employees/${reasonTarget._id}/left-business`,
        { reason: reasonText, leftDate },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(
        `${reasonTarget.firstName} ${reasonTarget.lastName} marked as left. Data kept for 30 days.`
      );
      setShowReasonModal(false);
      setReasonTarget(null);
      fetchEmployees();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to mark employee as left");
    }
  };

  const handleReinstate = async (employee) => {
    if (!guardAction(employee, "reinstate")) return;
    if (
      !window.confirm(
        `Reinstate ${employee.firstName} ${employee.lastName} and restore their account access?`
      )
    ) {
      setOpenMenuId(null);
      return;
    }
    try {
      const token = localStorage.getItem("token");
      await axios.patch(
        `/api/employees/${employee._id}/reinstate`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(`${employee.firstName} ${employee.lastName} reinstated successfully.`);
      fetchEmployees();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to reinstate employee");
    } finally {
      setOpenMenuId(null);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "Active":
        return "bg-gradient-to-r from-green-100 to-green-200 text-green-800 border-green-200/50";
      case "Inactive":
        return "bg-gradient-to-r from-gray-100 to-gray-200 text-gray-600 border-gray-200/50";
      case "Frozen":
        return "bg-gradient-to-r from-amber-100 to-amber-200 text-amber-800 border-amber-200/50";
      default:
        return "bg-gradient-to-r from-gray-100 to-gray-200 text-gray-600 border-gray-200/50";
    }
  };

  const rowIsManageable = (employee) =>
    employee._id !== currentUserId && canManage(currentUserRole, employee.role);

  // ─── Count helpers ────────────────────────────────────────────────────────
  const archivedCount = employees.filter((e) => e.isArchived && !e.leftBusiness?.isLeft).length;
  const leftCount = employees.filter((e) => e.leftBusiness?.isLeft).length;

  // ─── Kebab menu ───────────────────────────────────────────────────────────
  const KebabMenu = ({ employee }) => {
  const manageable = rowIsManageable(employee);
  const hasLeft = employee.leftBusiness?.isLeft;
 
  const menu = (
    <div
      data-kebab-menu
      className="fixed w-64 bg-white rounded-2xl shadow-2xl z-[9999] border border-gray-100 overflow-hidden"
      style={{
        top: menuPosition.showAbove ? "auto" : menuPosition.top,
        bottom: menuPosition.showAbove
          ? window.innerHeight - (menuPosition.top - window.scrollY)
          : "auto",
        left: menuPosition.left,
      }}
    >
      <div className="py-1.5">
        {!hasLeft && (
          <>
            <button
              onClick={() => handleEdit(employee)}
              disabled={!manageable}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                manageable
                  ? "text-gray-700 hover:bg-gray-50"
                  : "opacity-40 cursor-not-allowed text-gray-400"
              }`}
            >
              <Edit size={16} className="text-gray-400" />
              Edit Information
            </button>
            <button
              onClick={() => handleGhostMode(employee)}
              disabled={!manageable}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                manageable
                  ? "text-gray-700 hover:bg-gray-50"
                  : "opacity-40 cursor-not-allowed text-gray-400"
              }`}
            >
              <Eye size={16} className="text-gray-400" />
              Ghost Mode
            </button>
            <button
              onClick={() => handleArchive(employee)}
              disabled={!manageable}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                manageable
                  ? employee.isArchived
                    ? "text-blue-600 hover:bg-blue-50"
                    : "text-amber-600 hover:bg-amber-50"
                  : "opacity-40 cursor-not-allowed text-gray-400"
              }`}
            >
              <Archive size={16} />
              {employee.isArchived ? "Unarchive" : "Archive"}
            </button>
            {employee.status === "Inactive" && manageable && (
              <button
                onClick={() => handleResendInvite(employee)}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <Mail size={16} className="text-gray-400" />
                Resend Invite
              </button>
            )}
            <button
              onClick={() => openMarkLeftModal(employee)}
              disabled={!manageable}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                manageable
                  ? "text-red-600 hover:bg-red-50"
                  : "opacity-40 cursor-not-allowed text-gray-400"
              }`}
            >
              <UserX size={16} />
              Mark as Left Business
            </button>
          </>
        )}
 
        {hasLeft && manageable && (
          <>
            <button
              onClick={() => handleReinstate(employee)}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-green-600 hover:bg-green-50 transition-colors"
            >
              <RefreshCw size={16} />
              Reinstate Employee
            </button>
            <button
              onClick={() => handleArchive(employee)}
              disabled={!manageable}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                manageable
                  ? employee.isArchived
                    ? "text-blue-600 hover:bg-blue-50"
                    : "text-amber-600 hover:bg-amber-50"
                  : "opacity-40 cursor-not-allowed text-gray-400"
              }`}
            >
              <Archive size={16} />
              {employee.isArchived ? "Unarchive" : "Archive"}
            </button>
          </>
        )}
 
        {hasLeft && !manageable && (
          <div className="px-4 py-3 text-xs text-gray-400 text-center">
            No actions available
          </div>
        )}
      </div>
    </div>
  );
 
  // Render into document.body so fixed positioning is never clipped by
  // overflow:hidden on table cells or card wrappers
  return ReactDOM.createPortal(menu, document.body);
};
 


  const handleMenuOpen = (e, employeeId) => {
  e.stopPropagation();
 
  const rect = e.currentTarget.getBoundingClientRect();
  const menuWidth = 256;
  const spaceBelow = window.innerHeight - rect.bottom;
  const showAbove = spaceBelow < 260; // flip upward if near bottom of viewport
 
  let left = rect.right - menuWidth;
  if (left < 10) left = 10;
 
  setMenuPosition({
    // if near bottom, anchor to top of button (menu grows upward)
    top: showAbove
      ? rect.top + window.scrollY - 8  // will use `bottom` trick below
      : rect.bottom + window.scrollY + 6,
    left,
    showAbove,
  });
 
  setOpenMenuId((prev) => (prev === employeeId ? null : employeeId));
};

  return (
    

        <div className="p-4 md:p-6 max-w-[1600px] mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800 tracking-tight">
            Manage Employees
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Full control including admin accounts
          </p>
        </div>
      {isAdmin && (
            <button
              onClick={() => setShowAddModal(true)}
              className="group relative inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
            >
              <UserPlus size={18} className="group-hover:scale-105 transition-transform" />
              <span className="font-semibold">
                {isSuperAdmin ? "Add Employee / Admin" : "Add Employee"}
              </span>
            </button>
          )}
      </div>

        {/* Search and Filters Bar */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-white/50 mb-6 p-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="flex-1 relative">
              <Search
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                placeholder="Search by name, email, or ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all duration-200 ${
                  showFilters
                    ? "bg-blue-50 text-blue-700 border border-blue-200"
                    : "bg-gray-50/50 text-gray-600 border border-gray-200 hover:bg-gray-100"
                }`}
              >
                <Filter size={16} />
                <span className="text-sm font-medium">Filters</span>
              </button>
              {(statusFilter !== "All" ||
                departmentFilter !== "All" ||
                roleFilter !== "All" ||
                includeArchived ||
                includeLeft) && (
                <button
                  onClick={() => {
                    setStatusFilter("All");
                    setDepartmentFilter("All");
                    setRoleFilter("All");
                    setIncludeArchived(false);
                    setIncludeLeft(false);
                  }}
                  className="inline-flex items-center gap-1 px-3 py-2.5 rounded-xl text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-all"
                >
                  <X size={14} />
                  <span className="text-xs">Reset</span>
                </button>
              )}
            </div>
          </div>

          {/* Expandable Filters */}
          {showFilters && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4 pt-4 border-t border-gray-100 animate-in slide-in-from-top-2 duration-200">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm"
              >
                <option value="All">All Status</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
                <option value="Frozen">Frozen</option>
              </select>
              <select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                className="px-4 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm"
              >
                <option value="All">All Departments</option>
                {["IT", "Customer Support", "Manager", "Marketing", "HR", "Finance"].map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
              {isSuperAdmin && (
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="px-4 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm"
                >
                  <option value="All">All Roles</option>
                  <option value="employee">Employee</option>
                  <option value="admin">Admin</option>
                  <option value="superadmin">Superadmin</option>
                  <option value="hybrid">Hybrid</option>
                </select>
              )}
              <div className="flex gap-4 items-center">
                <label className="flex items-center gap-2 cursor-pointer group">
                  <div
                    onClick={() => setIncludeArchived((v) => !v)}
                    className={`relative w-10 h-5 rounded-full transition-colors duration-200 ${
                      includeArchived ? "bg-blue-500" : "bg-gray-300"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${
                        includeArchived ? "translate-x-5" : ""
                      }`}
                    />
                  </div>
                  <span className="text-sm text-gray-600 flex items-center gap-1.5">
                    <Archive size={14} />
                    Archived
                    {archivedCount > 0 && (
                      <span className="px-1.5 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-600">
                        {archivedCount}
                      </span>
                    )}
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer group">
                  <div
                    onClick={() => setIncludeLeft((v) => !v)}
                    className={`relative w-10 h-5 rounded-full transition-colors duration-200 ${
                      includeLeft ? "bg-red-400" : "bg-gray-300"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${
                        includeLeft ? "translate-x-5" : ""
                      }`}
                    />
                  </div>
                  <span className="text-sm text-gray-600 flex items-center gap-1.5">
                    <LogOut size={14} />
                    Left
                    {leftCount > 0 && (
                      <span className="px-1.5 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-600">
                        {leftCount}
                      </span>
                    )}
                  </span>
                </label>
              </div>
            </div>
          )}

          {/* Context Hints */}
          {(includeLeft || includeArchived) && (
            <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-gray-100">
              {includeLeft && (
                <span className="inline-flex items-center gap-1.5 text-xs text-red-600 bg-red-50 px-2.5 py-1 rounded-full">
                  <LogOut size={12} />
                  Left employees shown — data auto-deletes after 30 days
                </span>
              )}
              {includeArchived && !includeLeft && (
                <span className="inline-flex items-center gap-1.5 text-xs text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full">
                  <Archive size={12} />
                  Archived employees shown — use ⋮ menu to unarchive
                </span>
              )}
            </div>
          )}
        </div>

        {/* Employees Table/Cards */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-white/50 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center">
              <div className="inline-block animate-spin rounded-full h-10 w-10 border-3 border-blue-600 border-t-transparent mb-4" />
              <p className="text-gray-500 text-sm font-medium">Loading employees...</p>
            </div>
          ) : filteredEmployees.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                <AlertCircle className="text-gray-400" size={32} />
              </div>
              <p className="text-gray-600 font-medium">No employees found</p>
              {!includeArchived && archivedCount > 0 && (
                <p className="text-sm text-gray-400 mt-1">
                  {archivedCount} archived employee{archivedCount !== 1 ? "s" : ""} hidden —{" "}
                  <button
                    onClick={() => setIncludeArchived(true)}
                    className="text-blue-500 hover:underline font-medium"
                  >
                    show them
                  </button>
                </p>
              )}
              {!includeLeft && leftCount > 0 && (
                <p className="text-sm text-gray-400 mt-1">
                  {leftCount} employee{leftCount !== 1 ? "s" : ""} marked as left —{" "}
                  <button
                    onClick={() => setIncludeLeft(true)}
                    className="text-red-500 hover:underline font-medium"
                  >
                    show them
                  </button>
                </p>
              )}
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden lg:block overflow-x-auto overflow-y-visible">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gradient-to-r from-gray-50 to-gray-100/50 border-b border-gray-200">
                      {["Employee", "ID", "Email", "Department", "Role", "Status", "Compensation", ""].map(
                        (h, idx) => (
                          <th
                            key={h}
                            className={`px-5 py-4 text-left font-semibold text-gray-600 text-xs uppercase tracking-wider ${
                              idx === 7 ? "text-center w-16" : ""
                            }`}
                          >
                            {h}
                          </th>
                        )
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredEmployees.map((employee) => {
                      const isSelf = employee._id === currentUserId;
                      const hasLeft = employee.leftBusiness?.isLeft;
                      return (
                        <tr
                          key={employee._id}
                          className={`group transition-all duration-150 hover:bg-gray-50/80 ${
                            PRIVILEGED_ROLES.includes(employee.role)
                              ? "bg-gradient-to-r from-purple-50/30 to-transparent"
                              : ""
                          } ${employee.isArchived ? "opacity-60" : ""} ${
                            hasLeft ? "bg-gradient-to-r from-red-50/20 to-transparent opacity-80" : ""
                          }`}
                        >
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-2.5 flex-wrap">
                              <div>
                                <p className="font-semibold text-gray-900">
                                  {employee.firstName} {employee.lastName}
                                </p>
                                <div className="flex flex-wrap gap-1.5 mt-1">
                                  {isSelf && (
                                    <span className="text-[10px] font-medium text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">
                                      You
                                    </span>
                                  )}
                                  {employee.isArchived && !hasLeft && (
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700">
                                      <Archive size={9} /> Archived
                                    </span>
                                  )}
                                  {hasLeft && (
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-700">
                                      <LogOut size={9} /> Left
                                    </span>
                                  )}
                                  {hasLeft && (
                                    <DaysRemainingPill
                                      scheduledDeletion={employee.leftBusiness?.scheduledDeletion}
                                    />
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-3.5 text-gray-500 font-mono text-xs">
                            {employee.employeeNumber}
                          </td>
                          <td className="px-5 py-3.5 text-gray-600 text-sm">
                            {employee.email}
                          </td>
                          <td className="px-5 py-3.5 text-gray-600 text-sm">
                            {employee.department}
                          </td>
                          <td className="px-5 py-3.5">{getRoleBadge(employee.role)}</td>
                          <td className="px-5 py-3.5">
                            <span
                              className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold shadow-sm border ${getStatusColor(
                                employee.status
                              )}`}
                            >
                              {employee.status}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-gray-500 text-xs font-medium">
                            {employee.salaryType === "monthly"
                              ? `PKR ${employee.monthlySalary?.toLocaleString()}/mo`
                              : `PKR ${employee.hourlyRate}/hr`}
                          </td>
                          <td className="px-5 py-3.5 text-center relative">
                            <button
                              onClick={(e) => handleMenuOpen(e, employee._id)}
                              className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition-all"
                            >
                              <MoreVertical size={16} />
                            </button>
                            {openMenuId === employee._id && <KebabMenu employee={employee} />}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile/Tablet Card View */}
              <div className="lg:hidden p-4 space-y-4">
                {filteredEmployees.map((employee) => {
                  const isSelf = employee._id === currentUserId;
                  const hasLeft = employee.leftBusiness?.isLeft;
                  return (
                    <div
                      key={employee._id}
                      className={`bg-white rounded-xl border p-4 transition-all duration-200 ${
                        PRIVILEGED_ROLES.includes(employee.role)
                          ? "border-purple-200 shadow-sm"
                          : "border-gray-100"
                      } ${employee.isArchived ? "opacity-70" : ""} ${
                        hasLeft ? "border-red-200 bg-red-50/10" : ""
                      }`}
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-gray-900">
                              {employee.firstName} {employee.lastName}
                            </p>
                            {isSelf && (
                              <span className="text-[10px] font-medium text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">
                                You
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 font-mono mt-0.5">
                            {employee.employeeNumber}
                          </p>
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {getRoleBadge(employee.role)}
                            {employee.isArchived && !hasLeft && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700">
                                <Archive size={9} /> Archived
                              </span>
                            )}
                            {hasLeft && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-700">
                                <LogOut size={9} /> Left business
                              </span>
                            )}
                            {hasLeft && (
                              <DaysRemainingPill
                                scheduledDeletion={employee.leftBusiness?.scheduledDeletion}
                              />
                            )}
                          </div>
                        </div>
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold shadow-sm border ${getStatusColor(
                            employee.status
                          )}`}
                        >
                          {employee.status}
                        </span>
                      </div>
                      <div className="space-y-1.5 text-sm text-gray-600 mb-4">
                        <p className="flex items-center gap-2">
                          <span className="text-gray-400 text-xs">Email:</span>
                          {employee.email}
                        </p>
                        <p className="flex items-center gap-2">
                          <span className="text-gray-400 text-xs">Dept:</span>
                          {employee.department}
                        </p>
                        <p className="flex items-center gap-2">
                          <span className="text-gray-400 text-xs">Comp:</span>
                          {employee.salaryType === "monthly"
                            ? `PKR ${employee.monthlySalary?.toLocaleString()}/mo`
                            : `PKR ${employee.hourlyRate}/hr`}
                        </p>
                      </div>
                      <div className="relative">
                        <button
                          onClick={(e) => handleMenuOpen(e, employee._id)}
                          className="w-full py-2.5 bg-gray-50 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100 transition-all"
                        >
                          ⋮ Actions
                        </button>
                        {openMenuId === employee._id && (
                          <div className="absolute top-full left-0 right-0 z-50 mt-2">
                            <KebabMenu employee={employee} />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Modals */}
        {showAddModal && (
          <AddEmployeeModal
            currentUserRole={currentUserRole}
            onClose={() => {
              setShowAddModal(false);
              fetchEmployees();
            }}
            onSave={() => fetchEmployees()}
          />
        )}
        {showEditModal && selectedEmployee && (
          <EditEmployeeModal
            employee={selectedEmployee}
            currentUserRole={currentUserRole}
            onClose={() => {
              setShowEditModal(false);
              setSelectedEmployee(null);
            }}
            onSave={() => fetchEmployees()}
          />
        )}
        {showGhostMode && selectedEmployee && (
          <GhostModeView
            employee={selectedEmployee}
            onClose={() => {
              setShowGhostMode(false);
              setSelectedEmployee(null);
            }}
          />
        )}

        {/* Mark as Left Modal */}
        {showReasonModal && reasonTarget && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="p-6 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-r from-red-100 to-red-200 flex items-center justify-center shrink-0">
                    <LogOut size={18} className="text-red-600" />
                  </div>
                  <div>
                    <h2 className="font-bold text-gray-800 text-lg">Mark as Left Business</h2>
                    <p className="text-sm text-gray-500">
                      {reasonTarget.firstName} {reasonTarget.lastName}
                    </p>
                  </div>
                </div>
              </div>
              <div className="p-6 space-y-5">
                <div className="bg-gradient-to-r from-amber-50 to-amber-100/50 border border-amber-200 rounded-xl p-3.5 text-sm text-amber-800">
                  <p className="font-semibold flex items-center gap-2 mb-1">
                    <AlertCircle size={14} /> Important
                  </p>
                  <p className="text-xs">
                    This will freeze the employee's account immediately. All data is kept for{" "}
                    <strong>30 days</strong> and then permanently deleted. You can reinstate them
                    within that window.
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                    <MessageSquare size={12} /> Reason for leaving{" "}
                    <span className="normal-case font-normal text-gray-400">(optional)</span>
                  </label>
                  <textarea
                    value={reasonText}
                    onChange={(e) => setReasonText(e.target.value)}
                    rows={3}
                    maxLength={500}
                    placeholder="e.g. Resigned, End of contract, Redundancy..."
                    className="w-full px-3.5 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500/20 focus:border-red-400 focus:outline-none text-sm resize-none transition-all"
                  />
                  <p className="text-xs text-gray-400 text-right mt-1">{reasonText.length}/500</p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                    <Calendar size={12} /> Last Working Date
                  </label>
                  <input
                    type="date"
                    value={leftDate}
                    max={new Date().toISOString().slice(0, 10)}
                    onChange={(e) => setLeftDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500/20 focus:border-red-400 focus:outline-none text-sm transition-all"
                  />
                </div>
              </div>
              <div className="p-6 pt-0 flex gap-3">
                <button
                  onClick={() => {
                    setShowReasonModal(false);
                    setReasonTarget(null);
                  }}
                  className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-all font-medium text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmMarkLeft}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl hover:from-red-700 hover:to-red-800 transition-all shadow-md font-semibold text-sm"
                >
                  <LogOut size={15} /> Confirm — Mark as Left
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    // </div>
  );
}