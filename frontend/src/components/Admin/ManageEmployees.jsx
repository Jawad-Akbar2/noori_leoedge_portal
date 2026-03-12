import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { Plus, MoreVertical, AlertCircle, Shield } from 'lucide-react';
import AddEmployeeModal  from './AddEmployeeModal';
import EditEmployeeModal from './EditEmployeeModal';
import GhostModeView     from './GhostModeView';
import toast from 'react-hot-toast';

// ─── Role helpers ─────────────────────────────────────────────────────────────
const PRIVILEGED_ROLES = ['admin', 'superadmin'];

function canManage(actorRole, targetRole) {
  if (actorRole === 'superadmin') return true;
  if (actorRole === 'admin') return !PRIVILEGED_ROLES.includes(targetRole);
  return false;
}

// Read role synchronously from localStorage so it's available on first render
function readCurrentUser() {
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return {
      id:   user._id || user.id || null,
      role: user.role || localStorage.getItem('role') || ''
    };
  } catch {
    return { id: null, role: localStorage.getItem('role') || '' };
  }
}

function getRoleBadge(role) {
  switch (role) {
    case 'superadmin':
      return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-purple-100 text-purple-800"><Shield size={10} /> Superadmin</span>;
    case 'admin':
      return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-800"><Shield size={10} /> Admin</span>;
    default:
      return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-600">Employee</span>;
  }
}

export default function ManageEmployees() {
  // Initialise synchronously so filterEmployees never runs with empty role
  const { id: initId, role: initRole } = readCurrentUser();

  const [employees,         setEmployees]         = useState([]);
  const [filteredEmployees, setFilteredEmployees] = useState([]);
  const [loading,           setLoading]           = useState(true);
  const [showAddModal,      setShowAddModal]      = useState(false);
  const [showEditModal,     setShowEditModal]     = useState(false);
  const [showGhostMode,     setShowGhostMode]     = useState(false);
  const [selectedEmployee,  setSelectedEmployee]  = useState(null);
  const [searchTerm,        setSearchTerm]        = useState('');
  const [statusFilter,      setStatusFilter]      = useState('All');
  const [departmentFilter,  setDepartmentFilter]  = useState('All');
  const [roleFilter,        setRoleFilter]        = useState('All');
  const [openMenuId,        setOpenMenuId]        = useState(null);
  const [currentUserId,     setCurrentUserId]     = useState(initId);
  const [currentUserRole,   setCurrentUserRole]   = useState(initRole);

  const isSuperAdmin = currentUserRole === 'superadmin';
  const isAdmin      = currentUserRole === 'admin' || isSuperAdmin;

  const filterEmployees = useCallback((data) => {
    let filtered = data;

    if (currentUserRole === 'admin') {
      filtered = filtered.filter(emp => !PRIVILEGED_ROLES.includes(emp.role));
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(emp =>
        emp.firstName.toLowerCase().includes(term)      ||
        emp.lastName.toLowerCase().includes(term)       ||
        emp.email.toLowerCase().includes(term)          ||
        emp.employeeNumber.toLowerCase().includes(term)
      );
    }
    if (statusFilter !== 'All')     filtered = filtered.filter(emp => emp.status     === statusFilter);
    if (departmentFilter !== 'All') filtered = filtered.filter(emp => emp.department === departmentFilter);
    if (roleFilter !== 'All')       filtered = filtered.filter(emp => (emp.role || 'employee') === roleFilter);

    setFilteredEmployees(filtered);
  }, [searchTerm, statusFilter, departmentFilter, roleFilter, currentUserRole]);

  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/employees', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const list = response.data.employees || [];
      setEmployees(list);
      filterEmployees(list);
    } catch {
      toast.error('Failed to load employees');
    } finally {
      setLoading(false);
    }
  }, [filterEmployees]);

  useEffect(() => {
    // Re-read from storage in case it was updated after initial render
    const { id, role } = readCurrentUser();
    setCurrentUserId(id);
    setCurrentUserRole(role);
    fetchEmployees();
  }, [fetchEmployees]);

  useEffect(() => {
    filterEmployees(employees);
  }, [searchTerm, statusFilter, departmentFilter, roleFilter, employees, filterEmployees]);

  // Close kebab menu on outside click or scroll
  const menuRef = useRef(null);
  useEffect(() => {
    const close = () => setOpenMenuId(null);
    document.addEventListener('click',  close);
    document.addEventListener('scroll', close, true);
    return () => {
      document.removeEventListener('click',  close);
      document.removeEventListener('scroll', close, true);
    };
  }, []);

  // ─── Action guards ──────────────────────────────────────────────────────────
  const guardAction = (employee, action) => {
    if (employee._id === currentUserId) {
      toast.error(`You cannot ${action} your own account`);
      setOpenMenuId(null);
      return false;
    }
    if (!canManage(currentUserRole, employee.role)) {
      toast.error('You do not have permission to manage admin or superadmin accounts');
      setOpenMenuId(null);
      return false;
    }
    return true;
  };

  const handleEdit = (employee) => {
    if (!guardAction(employee, 'edit')) return;
    setSelectedEmployee(employee);
    setShowEditModal(true);
    setOpenMenuId(null);
  };

  const handleGhostMode = (employee) => {
    if (employee._id === currentUserId) {
      toast.error('You cannot ghost your own account');
      setOpenMenuId(null);
      return;
    }
    if (!canManage(currentUserRole, employee.role)) {
      toast.error('You do not have permission to ghost admin or superadmin accounts');
      setOpenMenuId(null);
      return;
    }
    setSelectedEmployee(employee);
    setShowGhostMode(true);
    setOpenMenuId(null);
  };

  const handleFreeze = async (employee) => {
    if (!guardAction(employee, 'freeze')) return;
    try {
      const token = localStorage.getItem('token');
      await axios.patch(`/api/employees/${employee._id}/freeze`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(`Employee ${employee.status === 'Frozen' ? 'unfrozen' : 'frozen'}`);
      fetchEmployees();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update employee status');
    } finally {
      setOpenMenuId(null);
    }
  };

  const handleArchive = async (employee) => {
    if (!guardAction(employee, 'archive')) return;
    if (!window.confirm(`Archive ${employee.firstName} ${employee.lastName}? They will be marked as archived.`)) {
      setOpenMenuId(null);
      return;
    }
    try {
      const token = localStorage.getItem('token');
      // ← fixed: was axios.put with { status: 'Inactive' } which hits the wrong endpoint
      await axios.patch(`/api/employees/${employee._id}/archive`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(`Employee ${employee.isArchived ? 'unarchived' : 'archived'}`);
      fetchEmployees();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to archive employee');
    } finally {
      setOpenMenuId(null);
    }
  };

  const handleResendInvite = async (employee) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `/api/employees/${employee._id}/resend-invite`, {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (response.data.inviteLink) {
        await navigator.clipboard.writeText(response.data.inviteLink).catch(() => {});
        toast.success('Invite link copied to clipboard');
      } else {
        toast.success('Invite resent successfully');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to resend invite');
    } finally {
      setOpenMenuId(null);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Active':   return 'bg-green-100 text-green-800';
      case 'Inactive': return 'bg-gray-100 text-gray-800';
      case 'Frozen':   return 'bg-yellow-100 text-yellow-800';
      default:         return 'bg-gray-100 text-gray-800';
    }
  };

  const rowIsManageable = (employee) =>
    employee._id !== currentUserId && canManage(currentUserRole, employee.role);

  const KebabMenu = ({ employee }) => {
    const manageable = rowIsManageable(employee);
    const isSelf     = employee._id === currentUserId;

    return (
      <div
        className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg z-40 border border-gray-200"
        onClick={e => e.stopPropagation()}
      >
        <button onClick={() => handleEdit(employee)} disabled={!manageable}
          className={`w-full flex items-center gap-2 px-4 py-3 text-left text-sm border-b transition ${
            !manageable ? 'opacity-40 cursor-not-allowed text-gray-400' : 'text-gray-700 hover:bg-gray-50'
          }`}>
          ✏️ Edit Information
        </button>

        <button onClick={() => handleGhostMode(employee)} disabled={!manageable}
          className={`w-full flex items-center gap-2 px-4 py-3 text-left text-sm border-b transition ${
            !manageable ? 'opacity-40 cursor-not-allowed text-gray-400' : 'text-gray-700 hover:bg-gray-50'
          }`}>
          👁️ Ghost Mode
        </button>

        <button onClick={() => handleFreeze(employee)} disabled={!manageable}
          className={`w-full flex items-center gap-2 px-4 py-3 text-left text-sm border-b transition ${
            !manageable ? 'opacity-40 cursor-not-allowed text-gray-400' : 'text-gray-700 hover:bg-gray-50'
          }`}>
          🔒 {employee.status === 'Frozen' ? 'Unfreeze' : 'Freeze'} Account
        </button>

        <button onClick={() => handleArchive(employee)} disabled={!manageable}
          className={`w-full flex items-center gap-2 px-4 py-3 text-left text-sm transition ${
            !manageable ? 'opacity-40 cursor-not-allowed text-gray-400' : 'text-red-700 hover:bg-red-50'
          }`}>
          🗑️ {employee.isArchived ? 'Unarchive' : 'Archive'}
        </button>

        {employee.status === 'Inactive' && manageable && (
          <button onClick={() => handleResendInvite(employee)}
            className="w-full flex items-center gap-2 px-4 py-3 text-left text-gray-700 hover:bg-gray-50 text-sm transition border-t">
            📧 Resend Invite
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Manage Employees</h1>
          {isSuperAdmin && (
            <p className="text-xs text-purple-600 mt-1 flex items-center gap-1">
              <Shield size={12} /> Superadmin — full access including admin accounts
            </p>
          )}
        </div>
        {isAdmin && (
          <button onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
            <Plus size={20} /> {isSuperAdmin ? 'Add Employee / Admin' : 'Add Employee'}
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="md:col-span-2">
            <input type="text" placeholder="Search by name, email, or ID..."
              value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
            <option value="All">All Status</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
            <option value="Frozen">Frozen</option>
          </select>
          <select value={departmentFilter} onChange={e => setDepartmentFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
            <option value="All">All Departments</option>
            <option value="IT">IT</option>
            <option value="Customer Support">Customer Support</option>
            <option value="Manager">Manager</option>
            <option value="Marketing">Marketing</option>
            <option value="HR">HR</option>
            <option value="Finance">Finance</option>
          </select>
          {isSuperAdmin && (
            <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
              <option value="All">All Roles</option>
              <option value="employee">Employee</option>
              <option value="admin">Admin</option>
              <option value="superadmin">Superadmin</option>
              <option value="hybrid">Hybrid</option>
            </select>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4" />
            <p className="text-gray-600">Loading employees...</p>
          </div>
        ) : filteredEmployees.length === 0 ? (
          <div className="p-12 text-center text-gray-600">
            <AlertCircle className="mx-auto mb-4 text-gray-400" size={48} />
            <p>No employees found</p>
          </div>
        ) : (
          <>
            {/* Desktop */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Name</th>
                    <th className="px-4 py-3 text-left font-semibold">ID</th>
                    <th className="px-4 py-3 text-left font-semibold">Email</th>
                    <th className="px-4 py-3 text-left font-semibold">Department</th>
                    <th className="px-4 py-3 text-left font-semibold">Role</th>
                    <th className="px-4 py-3 text-left font-semibold">Status</th>
                    <th className="px-4 py-3 text-left font-semibold">Salary</th>
                    <th className="px-4 py-3 text-center font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredEmployees.map(employee => {
                    const manageable = rowIsManageable(employee);
                    const isSelf     = employee._id === currentUserId;
                    return (
                      <tr key={employee._id}
                        className={`hover:bg-gray-50 ${PRIVILEGED_ROLES.includes(employee.role) ? 'bg-purple-50/30' : ''}`}>
                        <td className="px-4 py-3 font-medium">
                          {employee.firstName} {employee.lastName}
                          {isSelf && <span className="ml-2 text-xs text-gray-400">(you)</span>}
                        </td>
                        <td className="px-4 py-3 text-gray-600">{employee.employeeNumber}</td>
                        <td className="px-4 py-3 text-gray-600">{employee.email}</td>
                        <td className="px-4 py-3">{employee.department}</td>
                        <td className="px-4 py-3">{getRoleBadge(employee.role)}</td>
                        <td className="px-4 py-3">
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(employee.status)}`}>
                            {employee.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {employee.salaryType === 'monthly'
                            ? `PKR ${employee.monthlySalary?.toLocaleString()}/mo`
                            : `PKR ${employee.hourlyRate}/hr`}
                        </td>
                        <td className="px-4 py-3 relative text-center">
                          <button
                            onClick={e => { e.stopPropagation(); setOpenMenuId(openMenuId === employee._id ? null : employee._id); }}
                            className="text-gray-400 hover:text-gray-600 inline-block p-1">
                            <MoreVertical size={18} />
                          </button>
                          {openMenuId === employee._id && <KebabMenu employee={employee} />}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile */}
            <div className="md:hidden space-y-4 p-4">
              {filteredEmployees.map(employee => {
                const manageable = rowIsManageable(employee);
                const isSelf     = employee._id === currentUserId;
                return (
                  <div key={employee._id}
                    className={`border rounded-lg p-4 ${PRIVILEGED_ROLES.includes(employee.role) ? 'border-purple-200 bg-purple-50/30' : ''}`}>
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <p className="font-semibold text-gray-900">
                          {employee.firstName} {employee.lastName}
                          {isSelf && <span className="ml-1 text-xs text-gray-400">(you)</span>}
                        </p>
                        <p className="text-xs text-gray-600">{employee.employeeNumber}</p>
                        <div className="mt-1">{getRoleBadge(employee.role)}</div>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${getStatusColor(employee.status)}`}>
                        {employee.status}
                      </span>
                    </div>
                    <div className="space-y-1 text-sm mb-3">
                      <p className="text-gray-600">{employee.email}</p>
                      <p className="text-gray-600">{employee.department}</p>
                      <p className="text-gray-600">
                        {employee.salaryType === 'monthly'
                          ? `PKR ${employee.monthlySalary?.toLocaleString()}/mo`
                          : `PKR ${employee.hourlyRate}/hr`}
                      </p>
                    </div>
                    <div className="relative">
                      <button onClick={e => { e.stopPropagation(); setOpenMenuId(openMenuId === employee._id ? null : employee._id); }}
                        className="w-full text-center py-2 bg-gray-100 rounded text-sm hover:bg-gray-200 transition">
                        ⋮ More
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
          onClose={() => { setShowAddModal(false); fetchEmployees(); }}
          onSave={() => fetchEmployees()}
        />
      )}

      {showEditModal && selectedEmployee && (
        <EditEmployeeModal
          employee={selectedEmployee}
          currentUserRole={currentUserRole}
          onClose={() => { setShowEditModal(false); setSelectedEmployee(null); }}
          onSave={() => fetchEmployees()}
        />
      )}

      {showGhostMode && selectedEmployee && (
        <GhostModeView
          employee={selectedEmployee}
          onClose={() => { setShowGhostMode(false); setSelectedEmployee(null); }}
        />
      )}
    </div>
  );
}