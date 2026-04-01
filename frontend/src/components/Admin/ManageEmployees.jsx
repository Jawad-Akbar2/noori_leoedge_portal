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
} from "lucide-react";
import AddEmployeeModal from "./AddEmployeeModal";
import EditEmployeeModal from "./EditEmployeeModal";
import GhostModeView from "./GhostModeView";
import toast from "react-hot-toast";

// ─── Role helpers ─────────────────────────────────────────────────────────────
const PRIVILEGED_ROLES = ["admin", "superadmin"];

function canManage(actorRole, targetRole) {
  if (actorRole === "superadmin") return true;
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
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-purple-100 text-purple-800">
          <Shield size={10} /> Superadmin
        </span>
      );
    case "admin":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-800">
          <Shield size={10} /> Admin
        </span>
      );
    case "hybrid":
      return (
        <span className="px-2 py-0.5 rounded text-xs font-semibold bg-indigo-100 text-indigo-700">
          Hybrid
        </span>
      );
    default:
      return (
        <span className="px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-600">
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
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold
      ${urgent ? "bg-red-100 text-red-700" : "bg-orange-100 text-orange-700"}`}
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
  // ── NEW: show employees who have left the business ────────────────────────
  const [includeLeft, setIncludeLeft] = useState(false);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(initId);
  const [currentUserRole, setCurrentUserRole] = useState(initRole);

  // ── Reason modal state ────────────────────────────────────────────────────
  const [showReasonModal, setShowReasonModal] = useState(false);
  const [reasonTarget, setReasonTarget] = useState(null); // employee
  const [reasonText, setReasonText] = useState("");

  const isSuperAdmin = currentUserRole === "superadmin";
  const isAdmin = currentUserRole === "admin" || isSuperAdmin;

  const filterEmployees = useCallback(
    (data) => {
      let filtered = data;

      if (currentUserRole === "admin") {
        filtered = filtered.filter(
          (emp) => !PRIVILEGED_ROLES.includes(emp.role),
        );
      }

      // By default hide employees who have left, unless the toggle is on
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
            emp.employeeNumber.toLowerCase().includes(term),
        );
      }
      if (statusFilter !== "All")
        filtered = filtered.filter((emp) => emp.status === statusFilter);
      if (departmentFilter !== "All")
        filtered = filtered.filter(
          (emp) => emp.department === departmentFilter,
        );
      if (roleFilter !== "All")
        filtered = filtered.filter(
          (emp) => (emp.role || "employee") === roleFilter,
        );

      setFilteredEmployees(filtered);
    },
    [
      searchTerm,
      statusFilter,
      departmentFilter,
      roleFilter,
      currentUserRole,
      includeLeft,
    ],
  );

  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      // Always fetch including left-business employees so counts are accurate.
      // Filtering is done client-side.
      const response = await axios.get("/api/employees", {
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

  // Close kebab menu on outside click / scroll
  useEffect(() => {
    const close = () => setOpenMenuId(null);
    document.addEventListener("click", close);
    document.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("click", close);
      document.removeEventListener("scroll", close, true);
    };
  }, []);

  // ─── Guards ──────────────────────────────────────────────────────────────────
  const guardAction = (employee, action) => {
    if (employee._id === currentUserId) {
      toast.error(`You cannot ${action} your own account`);
      setOpenMenuId(null);
      return false;
    }
    if (!canManage(currentUserRole, employee.role)) {
      toast.error(
        "You do not have permission to manage admin or superadmin accounts",
      );
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
      toast.error(
        "You do not have permission to ghost admin or superadmin accounts",
      );
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
        `${action.charAt(0).toUpperCase() + action.slice(1)} ${employee.firstName} ${employee.lastName}?`,
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
        { headers: { Authorization: `Bearer ${token}` } },
      );
      toast.success(`Employee ${action}d`);
      fetchEmployees();
    } catch (err) {
      toast.error(
        err.response?.data?.message || `Failed to ${action} employee`,
      );
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
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (response.data.inviteLink) {
        await navigator.clipboard
          .writeText(response.data.inviteLink)
          .catch(() => {});
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
    setShowReasonModal(true);
    setOpenMenuId(null);
  };

  const confirmMarkLeft = async () => {
    if (!reasonTarget) return;
    try {
      const token = localStorage.getItem("token");
      await axios.patch(
        `/api/employees/${reasonTarget._id}/left-business`,
        { reason: reasonText },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      toast.success(
        `${reasonTarget.firstName} ${reasonTarget.lastName} marked as left. Data kept for 30 days.`,
      );
      setShowReasonModal(false);
      setReasonTarget(null);
      fetchEmployees();
    } catch (err) {
      toast.error(
        err.response?.data?.message || "Failed to mark employee as left",
      );
    }
  };

  const handleReinstate = async (employee) => {
    if (!guardAction(employee, "reinstate")) return;
    if (
      !window.confirm(
        `Reinstate ${employee.firstName} ${employee.lastName} and restore their account access?`,
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
        { headers: { Authorization: `Bearer ${token}` } },
      );
      toast.success(
        `${employee.firstName} ${employee.lastName} reinstated successfully.`,
      );
      fetchEmployees();
    } catch (err) {
      toast.error(
        err.response?.data?.message || "Failed to reinstate employee",
      );
    } finally {
      setOpenMenuId(null);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "Active":
        return "bg-green-100 text-green-800";
      case "Inactive":
        return "bg-gray-100 text-gray-600";
      case "Frozen":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-gray-100 text-gray-600";
    }
  };

  const rowIsManageable = (employee) =>
    employee._id !== currentUserId && canManage(currentUserRole, employee.role);

  // ─── Count helpers ────────────────────────────────────────────────────────
  const archivedCount = employees.filter(
    (e) => e.isArchived && !e.leftBusiness?.isLeft,
  ).length;
  const leftCount = employees.filter((e) => e.leftBusiness?.isLeft).length;

  // ─── Kebab menu ───────────────────────────────────────────────────────────
  const KebabMenu = ({ employee }) => {
    const manageable = rowIsManageable(employee);
    const hasLeft = employee.leftBusiness?.isLeft;

    return (
      <div
        className="absolute right-0 mt-2 w-60 bg-white rounded-xl shadow-xl z-40 border border-gray-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Normal actions — hidden if employee has left */}
        {!hasLeft && (
          <>
            {[
              {
                label: "✏️ Edit Information",
                onClick: () => handleEdit(employee),
                disabled: !manageable,
              },
              {
                label: "👁️ Ghost Mode",
                onClick: () => handleGhostMode(employee),
                disabled: !manageable,
              },
            ].map(({ label, onClick, disabled }) => (
              <button
                key={label}
                onClick={onClick}
                disabled={disabled}
                className={`w-full flex items-center gap-2 px-4 py-3 text-left text-sm border-b border-gray-100 transition
                ${disabled ? "opacity-40 cursor-not-allowed text-gray-400" : "text-gray-700 hover:bg-gray-50"}`}
              >
                {label}
              </button>
            ))}

            {/* Archive / Unarchive */}

            <button
              onClick={() => handleArchive(employee)}
              disabled={!manageable}
              className={`w-full flex items-center gap-2 px-4 py-3 text-left text-sm transition border-b border-gray-100
              ${
                !manageable
                  ? "opacity-40 cursor-not-allowed text-gray-400"
                  : employee.isArchived
                    ? "text-blue-700 hover:bg-blue-50"
                    : "text-orange-700 hover:bg-orange-50"
              }`}
            >
              🗂️ {employee.isArchived ? "Unarchive" : "Archive"}
            </button>

            {/* Resend invite */}
            {employee.status === "Inactive" && manageable && (
              <button
                onClick={() => handleResendInvite(employee)}
                className="w-full flex items-center gap-2 px-4 py-3 text-left text-gray-700 hover:bg-gray-50 text-sm transition border-b border-gray-100"
              >
                📧 Resend Invite
              </button>
            )}

            {/* Mark as left */}
            <button
              onClick={() => openMarkLeftModal(employee)}
              disabled={!manageable}
              className={`w-full flex items-center gap-2 px-4 py-3 text-left text-sm transition
              ${!manageable ? "opacity-40 cursor-not-allowed text-gray-400" : "text-red-700 hover:bg-red-50"}`}
            >
              <LogOut size={14} /> Mark as Left Business
            </button>
          </>
        )}

        {/* Reinstate action — only s
        hown when employee has left */}
        {hasLeft && manageable && (
          <>
            <button
              onClick={() => handleReinstate(employee)}
              className="w-full flex items-center gap-2 px-4 py-3 text-left text-green-700 hover:bg-green-50 text-sm transition"
            >
              <RotateCcw size={14} /> Reinstate Employee
            </button>
            <button
              onClick={() => handleArchive(employee)}
              disabled={!manageable}
              className={`w-full flex items-center gap-2 px-4 py-3 text-left text-sm transition border-b border-gray-100
              ${
                !manageable
                  ? "opacity-40 cursor-not-allowed text-gray-400"
                  : employee.isArchived
                    ? "text-blue-700 hover:bg-blue-50"
                    : "text-orange-700 hover:bg-orange-50"
              }`}
            >
              🗂️ {employee.isArchived ? "Unarchive" : "Archive"}
            </button>
          </>
        )}

        {/* If left but not manageable */}
        {hasLeft && !manageable && (
          <div className="px-4 py-3 text-xs text-gray-400">
            No actions available
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800">
            Manage Employees
          </h1>
          {isSuperAdmin && (
            <p className="text-xs text-purple-600 mt-1 flex items-center gap-1">
              <Shield size={12} /> Superadmin — full access including admin
              accounts
            </p>
          )}
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            <Plus size={20} />{" "}
            {isSuperAdmin ? "Add Employee / Admin" : "Add Employee"}
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="md:col-span-2">
            <input
              type="text"
              placeholder="Search by name, email, or ID…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
          >
            <option value="All">All Status</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
            <option value="Frozen">Frozen</option>
          </select>
          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
          >
            <option value="All">All Departments</option>
            {[
              "IT",
              "Customer Support",
              "Manager",
              "Marketing",
              "HR",
              "Finance",
            ].map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
          {isSuperAdmin ? (
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="All">All Roles</option>
              <option value="employee">Employee</option>
              <option value="admin">Admin</option>
              <option value="superadmin">Superadmin</option>
              <option value="hybrid">Hybrid</option>
            </select>
          ) : (
            <div />
          )}
        </div>

        {/* Toggles row */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mt-4 pt-3 border-t border-gray-100">
          {/* Archived toggle */}
          <label className="flex items-center gap-2.5 cursor-pointer select-none group">
            <div
              onClick={() => setIncludeArchived((v) => !v)}
              className={`relative w-11 h-6 rounded-full transition-colors ${includeArchived ? "bg-blue-500" : "bg-gray-200"}`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${includeArchived ? "translate-x-5" : ""}`}
              />
            </div>
            <span className="text-sm text-gray-600 group-hover:text-gray-800 transition flex items-center gap-1.5">
              <Archive
                size={14}
                className={includeArchived ? "text-blue-500" : "text-gray-400"}
              />
              Show archived
              {archivedCount > 0 && (
                <span
                  className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${includeArchived ? "bg-blue-100 text-blue-700" : "bg-gray-200 text-gray-600"}`}
                >
                  {archivedCount}
                </span>
              )}
            </span>
          </label>

          {/* Left-business toggle */}
          <label className="flex items-center gap-2.5 cursor-pointer select-none group">
            <div
              onClick={() => setIncludeLeft((v) => !v)}
              className={`relative w-11 h-6 rounded-full transition-colors ${includeLeft ? "bg-red-400" : "bg-gray-200"}`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${includeLeft ? "translate-x-5" : ""}`}
              />
            </div>
            <span className="text-sm text-gray-600 group-hover:text-gray-800 transition flex items-center gap-1.5">
              <LogOut
                size={14}
                className={includeLeft ? "text-red-400" : "text-gray-400"}
              />
              Show left business
              {leftCount > 0 && (
                <span
                  className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${includeLeft ? "bg-red-100 text-red-700" : "bg-gray-200 text-gray-600"}`}
                >
                  {leftCount}
                </span>
              )}
            </span>
          </label>

          {/* Context hint */}
          {includeLeft && (
            <span className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded-full ml-auto">
              Left employees shown — data auto-deletes after 30 days
            </span>
          )}
          {includeArchived && !includeLeft && (
            <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-full ml-auto">
              Archived employees shown — use ⋮ menu to unarchive
            </span>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4" />
            <p className="text-gray-500 text-sm">Loading employees…</p>
          </div>
        ) : filteredEmployees.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <AlertCircle className="mx-auto mb-4 text-gray-300" size={48} />
            <p className="font-medium">No employees found</p>
            {!includeArchived && archivedCount > 0 && (
              <p className="text-sm text-gray-400 mt-1">
                {archivedCount} archived employee
                {archivedCount !== 1 ? "s" : ""} hidden —{" "}
                <button
                  onClick={() => setIncludeArchived(true)}
                  className="text-blue-500 hover:underline"
                >
                  show them
                </button>
              </p>
            )}
            {!includeLeft && leftCount > 0 && (
              <p className="text-sm text-gray-400 mt-1">
                {leftCount} employee{leftCount !== 1 ? "s" : ""} marked as left
                —{" "}
                <button
                  onClick={() => setIncludeLeft(true)}
                  className="text-red-500 hover:underline"
                >
                  show them
                </button>
              </p>
            )}
          </div>
        ) : (
          <>
            {/* Desktop */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    {[
                      "Name",
                      "ID",
                      "Email",
                      "Department",
                      "Role",
                      "Status",
                      "Salary",
                      "Actions",
                    ].map((h) => (
                      <th
                        key={h}
                        className={`px-4 py-3 text-left font-semibold text-gray-600 text-xs uppercase tracking-wider ${h === "Actions" ? "text-center" : ""}`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredEmployees.map((employee) => {
                    const isSelf = employee._id === currentUserId;
                    const hasLeft = employee.leftBusiness?.isLeft;
                    return (
                      <tr
                        key={employee._id}
                        className={`hover:bg-gray-50/80 transition
                          ${PRIVILEGED_ROLES.includes(employee.role) ? "bg-purple-50/20" : ""}
                          ${employee.isArchived ? "opacity-60" : ""}
                          ${hasLeft ? "bg-red-50/30 opacity-75" : ""}`}
                      >
                        <td className="px-4 py-3 font-medium text-gray-900">
                          <div className="flex items-center gap-2 flex-wrap">
                            {employee.firstName} {employee.lastName}
                            {isSelf && (
                              <span className="text-xs text-gray-400 font-normal">
                                (you)
                              </span>
                            )}
                            {employee.isArchived && !hasLeft && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-orange-100 text-orange-700">
                                <Archive size={9} /> Archived
                              </span>
                            )}
                            {hasLeft && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-red-100 text-red-700">
                                <LogOut size={9} /> Left
                              </span>
                            )}
                            {hasLeft && (
                              <DaysRemainingPill
                                scheduledDeletion={
                                  employee.leftBusiness?.scheduledDeletion
                                }
                              />
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-500 font-mono text-xs">
                          {employee.employeeNumber}
                        </td>
                        <td className="px-4 py-3 text-gray-500">
                          {employee.email}
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {employee.department}
                        </td>
                        <td className="px-4 py-3">
                          {getRoleBadge(employee.role)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2.5 py-1 rounded-full text-xs font-semibold ${getStatusColor(employee.status)}`}
                          >
                            {employee.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">
                          {employee.salaryType === "monthly"
                            ? `PKR ${employee.monthlySalary?.toLocaleString()}/mo`
                            : `PKR ${employee.hourlyRate}/hr`}
                        </td>
                        <td className="px-4 py-3 relative text-center">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenMenuId(
                                openMenuId === employee._id
                                  ? null
                                  : employee._id,
                              );
                            }}
                            className="text-gray-400 hover:text-gray-600 inline-block p-1.5 rounded-lg hover:bg-gray-100 transition"
                          >
                            <MoreVertical size={16} />
                          </button>
                          {openMenuId === employee._id && (
                            <KebabMenu employee={employee} />
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile */}
            <div className="md:hidden space-y-3 p-4">
              {filteredEmployees.map((employee) => {
                const isSelf = employee._id === currentUserId;
                const hasLeft = employee.leftBusiness?.isLeft;
                return (
                  <div
                    key={employee._id}
                    className={`border rounded-xl p-4 transition
                      ${PRIVILEGED_ROLES.includes(employee.role) ? "border-purple-200 bg-purple-50/20" : "border-gray-200"}
                      ${employee.isArchived ? "opacity-60" : ""}
                      ${hasLeft ? "border-red-200 bg-red-50/20 opacity-80" : ""}`}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <p className="font-semibold text-gray-900">
                          {employee.firstName} {employee.lastName}
                          {isSelf && (
                            <span className="ml-1 text-xs text-gray-400 font-normal">
                              (you)
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-gray-500 font-mono">
                          {employee.employeeNumber}
                        </p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {getRoleBadge(employee.role)}
                          {employee.isArchived && !hasLeft && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-orange-100 text-orange-700">
                              <Archive size={9} /> Archived
                            </span>
                          )}
                          {hasLeft && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-red-100 text-red-700">
                              <LogOut size={9} /> Left business
                            </span>
                          )}
                          {hasLeft && (
                            <DaysRemainingPill
                              scheduledDeletion={
                                employee.leftBusiness?.scheduledDeletion
                              }
                            />
                          )}
                        </div>
                      </div>
                      <span
                        className={`px-2 py-1 rounded text-xs font-semibold ${getStatusColor(employee.status)}`}
                      >
                        {employee.status}
                      </span>
                    </div>
                    <div className="space-y-0.5 text-sm text-gray-500 mb-3">
                      <p>{employee.email}</p>
                      <p>{employee.department}</p>
                      <p className="text-xs">
                        {employee.salaryType === "monthly"
                          ? `PKR ${employee.monthlySalary?.toLocaleString()}/mo`
                          : `PKR ${employee.hourlyRate}/hr`}
                      </p>
                    </div>
                    <div className="relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuId(
                            openMenuId === employee._id ? null : employee._id,
                          );
                        }}
                        className="w-full text-center py-2 bg-gray-100 rounded-lg text-sm hover:bg-gray-200 transition text-gray-600"
                      >
                        ⋮ Actions
                      </button>
                      {openMenuId === employee._id && (
                        <div className="absolute top-full mt-1 left-0 right-0 z-40">
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

      {/* ── Reason modal (mark as left) ────────────────────────────────────── */}
      {showReasonModal && reasonTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                  <LogOut size={18} className="text-red-600" />
                </div>
                <div>
                  <h2 className="font-bold text-gray-800">
                    Mark as Left Business
                  </h2>
                  <p className="text-sm text-gray-500">
                    {reasonTarget.firstName} {reasonTarget.lastName}
                  </p>
                </div>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
                <strong>⚠️ Important:</strong> This will freeze the employee's
                account immediately. All data is kept for{" "}
                <strong>30 days</strong> and then permanently deleted. You can
                reinstate them within that window.
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                  Reason for leaving{" "}
                  <span className="normal-case font-normal text-gray-400">
                    (optional)
                  </span>
                </label>
                <textarea
                  value={reasonText}
                  onChange={(e) => setReasonText(e.target.value)}
                  rows={3}
                  maxLength={500}
                  placeholder="e.g. Resigned, End of contract, Redundancy…"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-400 focus:outline-none text-sm resize-none"
                />
                <p className="text-xs text-gray-400 text-right mt-0.5">
                  {reasonText.length}/500
                </p>
              </div>
            </div>
            <div className="p-6 pt-0 flex gap-3">
              <button
                onClick={() => {
                  setShowReasonModal(false);
                  setReasonTarget(null);
                }}
                className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-100 transition font-medium text-sm"
              >
                Cancel
              </button>
              <button
                onClick={confirmMarkLeft}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 transition font-semibold text-sm"
              >
                <LogOut size={15} /> Confirm — Mark as Left
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
