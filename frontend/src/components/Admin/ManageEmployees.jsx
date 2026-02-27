import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Plus, Search, MoreVertical, AlertCircle } from 'lucide-react';
import AddEmployeeModal from './AddEmployeeModal';
import EditEmployeeModal from './EditEmployeeModal';
import GhostModeView from './GhostModeView';
import toast from 'react-hot-toast';

export default function ManageEmployees() {
  const [employees, setEmployees] = useState([]);
  const [filteredEmployees, setFilteredEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showGhostMode, setShowGhostMode] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [departmentFilter, setDepartmentFilter] = useState('All');
  const [openMenuId, setOpenMenuId] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);

  const filterEmployees = useCallback((data) => {
    let filtered = data;

    if (searchTerm) {
      filtered = filtered.filter(emp =>
        emp.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.employeeNumber.includes(searchTerm)
      );
    }

    if (statusFilter !== 'All') {
      filtered = filtered.filter(emp => emp.status === statusFilter);
    }

    if (departmentFilter !== 'All') {
      filtered = filtered.filter(emp => emp.department === departmentFilter);
    }

    setFilteredEmployees(filtered);
  }, [searchTerm, statusFilter, departmentFilter]);

  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/employees', {
        headers: { Authorization: `Bearer ${token}` }
      });

      setEmployees(response.data.employees);
      filterEmployees(response.data.employees);
    } catch (error) {
      toast.error('Failed to load employees');
    } finally {
      setLoading(false);
    }
  }, [filterEmployees]);

  useEffect(() => {
    // Get current user ID to prevent self-editing
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    setCurrentUserId(user.id);
    
    fetchEmployees();
  }, [fetchEmployees]);

  useEffect(() => {
    filterEmployees(employees);
  }, [searchTerm, statusFilter, departmentFilter, employees, filterEmployees]);

  const handleEdit = (employee) => {
    // PERMISSION CHECK: Cannot edit own info
    if (employee._id === currentUserId) {
      toast.error('You cannot edit your own employee information');
      setOpenMenuId(null);
      return;
    }

    setSelectedEmployee(employee);
    setShowEditModal(true);
    setOpenMenuId(null);
  };

  const handleGhostMode = (employee) => {
    setSelectedEmployee(employee);
    setShowGhostMode(true);
    setOpenMenuId(null);
  };

  const handleFreeze = async (employee) => {
    // PERMISSION CHECK: Cannot freeze own account
    if (employee._id === currentUserId) {
      toast.error('You cannot freeze your own account');
      setOpenMenuId(null);
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.patch(
        `/api/employees/${employee._id}/freeze`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success(`Employee ${employee.status === 'Frozen' ? 'unfrozen' : 'frozen'}`);
      fetchEmployees();
    } catch (error) {
      toast.error('Failed to update employee status');
    } finally {
      setOpenMenuId(null);
    }
  };

  const handleArchive = async (employee) => {
    // PERMISSION CHECK: Cannot archive own account
    if (employee._id === currentUserId) {
      toast.error('You cannot archive your own account');
      setOpenMenuId(null);
      return;
    }

    if (window.confirm('Are you sure you want to archive this employee?')) {
      try {
        const token = localStorage.getItem('token');
        await axios.patch(
          `/api/employees/${employee._id}/archive`,
          {},
          { headers: { Authorization: `Bearer ${token}` } }
        );

        toast.success('Employee archived');
        fetchEmployees();
      } catch (error) {
        toast.error('Failed to archive employee');
      } finally {
        setOpenMenuId(null);
      }
    }
  };

  const handleResendInvite = async (employee) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `/api/employees/${employee._id}/resend-invite`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Copy link to clipboard
      navigator.clipboard.writeText(response.data.inviteLink);
      toast.success('Invite link copied to clipboard');
    } catch (error) {
      toast.error('Failed to resend invite');
    } finally {
      setOpenMenuId(null);
    }
  };

  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Manage Employees</h1>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          <Plus size={20} />
          Add Employee
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <input
              type="text"
              placeholder="Search by name, email, or ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="All">All Status</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
            <option value="Frozen">Frozen</option>
          </select>
          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="All">All Departments</option>
            <option value="IT">IT</option>
            <option value="Customer Support">Customer Support</option>
            <option value="Marketing">Marketing</option>
            <option value="HR">HR</option>
            <option value="Finance">Finance</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">Loading employees...</div>
        ) : filteredEmployees.length === 0 ? (
          <div className="p-12 text-center text-gray-600">
            <AlertCircle className="mx-auto mb-4 text-gray-400" size={48} />
            <p>No employees found</p>
          </div>
        ) : (
          <>
            {/* Desktop View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Name</th>
                    <th className="px-4 py-3 text-left font-semibold">ID</th>
                    <th className="px-4 py-3 text-left font-semibold">Email</th>
                    <th className="px-4 py-3 text-left font-semibold">Department</th>
                    <th className="px-4 py-3 text-left font-semibold">Status</th>
                    <th className="px-4 py-3 text-left font-semibold">Rate</th>
                    <th className="px-4 py-3 text-center font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredEmployees.map((employee) => (
                    <tr key={employee._id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">
                        {employee.firstName} {employee.lastName}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{employee.employeeNumber}</td>
                      <td className="px-4 py-3 text-gray-600">{employee.email}</td>
                      <td className="px-4 py-3">{employee.department}</td>
                      <td className="px-4 py-3">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          employee.status === 'Active' ? 'bg-green-100 text-green-800' :
                          employee.status === 'Inactive' ? 'bg-gray-100 text-gray-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {employee.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">PKR {employee.hourlyRate}/hr</td>
                      <td className="px-4 py-3 relative text-center">
                        <button
                          onClick={() => setOpenMenuId(openMenuId === employee._id ? null : employee._id)}
                          className="text-gray-400 hover:text-gray-600 inline-block"
                        >
                          < MoreVertical size={18} />
                        </button>

                        {/* Kebab Menu */}
                        {openMenuId === employee._id && (
                          <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg z-40 border border-gray-200">
                            {/* Edit (Disabled for self) */}
                            <button
                              onClick={() => handleEdit(employee)}
                              disabled={employee._id === currentUserId}
                              className={`w-full flex items-center gap-2 px-4 py-3 text-left text-sm border-b transition ${
                                employee._id === currentUserId
                                  ? 'opacity-50 cursor-not-allowed text-gray-500'
                                  : 'text-gray-700 hover:bg-gray-50'
                              }`}
                            >
                              ✏️ Edit Information
                            </button>

                            {/* Ghost Mode */}
                            <button
                              onClick={() => handleGhostMode(employee)}
                              className="w-full flex items-center gap-2 px-4 py-3 text-left text-gray-700 hover:bg-gray-50 border-b text-sm transition"
                            >
                              👁️ Ghost Mode
                            </button>

                            {/* Freeze (Disabled for self) */}
                            <button
                              onClick={() => handleFreeze(employee)}
                              disabled={employee._id === currentUserId}
                              className={`w-full flex items-center gap-2 px-4 py-3 text-left text-sm border-b transition ${
                                employee._id === currentUserId
                                  ? 'opacity-50 cursor-not-allowed text-gray-500'
                                  : 'text-gray-700 hover:bg-gray-50'
                              }`}
                            >
                              🔒 {employee.status === 'Frozen' ? 'Unfreeze' : 'Freeze'} Account
                            </button>

                            {/* Archive (Disabled for self) */}
                            <button
                              onClick={() => handleArchive(employee)}
                              disabled={employee._id === currentUserId}
                              className={`w-full flex items-center gap-2 px-4 py-3 text-left text-sm transition ${
                                employee._id === currentUserId
                                  ? 'opacity-50 cursor-not-allowed text-gray-500'
                                  : 'text-red-700 hover:bg-red-50'
                              }`}
                            >
                              🗑️ Archive
                            </button>

                            {/* Resend Invite (Only for Inactive) */}
                            {employee.status === 'Inactive' && (
                              <button
                                onClick={() => handleResendInvite(employee)}
                                className="w-full flex items-center gap-2 px-4 py-3 text-left text-gray-700 hover:bg-gray-50 text-sm transition"
                              >
                                📧 Resend Invite
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile View */}
            <div className="md:hidden space-y-4 p-4">
              {filteredEmployees.map((employee) => (
                <div key={employee._id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="font-semibold text-gray-900">
                        {employee.firstName} {employee.lastName}
                      </p>
                      <p className="text-xs text-gray-600">{employee.employeeNumber}</p>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${
                      employee.status === 'Active' ? 'bg-green-100 text-green-800' :
                      employee.status === 'Inactive' ? 'bg-gray-100 text-gray-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {employee.status}
                    </span>
                  </div>

                  <div className="space-y-1 text-sm mb-3">
                    <p className="text-gray-600">{employee.email}</p>
                    <p className="text-gray-600">{employee.department}</p>
                    <p className="text-gray-600">PKR {employee.hourlyRate}/hr</p>
                  </div>

                  <div className="relative">
                    <button
                      onClick={() => setOpenMenuId(openMenuId === employee._id ? null : employee._id)}
                      className="w-full text-center py-2 bg-gray-100 rounded text-sm hover:bg-gray-200 transition"
                    >
                      ⋮ More
                    </button>

                    {openMenuId === employee._id && (
                      <div className="absolute top-full mt-2 w-full bg-white rounded-lg shadow-lg z-40 border border-gray-200">
                        <button
                          onClick={() => handleEdit(employee)}
                          disabled={employee._id === currentUserId}
                          className={`w-full px-4 py-3 text-left text-sm border-b ${
                            employee._id === currentUserId
                              ? 'opacity-50 cursor-not-allowed text-gray-500'
                              : 'hover:bg-gray-50'
                          }`}
                        >
                          ✏️ Edit
                        </button>
                        <button
                          onClick={() => handleGhostMode(employee)}
                          className="w-full px-4 py-3 text-left text-sm border-b hover:bg-gray-50"
                        >
                          👁️ Ghost Mode
                        </button>
                        <button
                          onClick={() => handleFreeze(employee)}
                          disabled={employee._id === currentUserId}
                          className={`w-full px-4 py-3 text-left text-sm border-b ${
                            employee._id === currentUserId
                              ? 'opacity-50 cursor-not-allowed text-gray-500'
                              : 'hover:bg-gray-50'
                          }`}
                        >
                          🔒 {employee.status === 'Frozen' ? 'Unfreeze' : 'Freeze'}
                        </button>
                        <button
                          onClick={() => handleArchive(employee)}
                          disabled={employee._id === currentUserId}
                          className={`w-full px-4 py-3 text-left text-sm ${
                            employee._id === currentUserId
                              ? 'opacity-50 cursor-not-allowed text-gray-500'
                              : 'hover:bg-red-50'
                          }`}
                        >
                          🗑️ Archive
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Modals */}
      {showAddModal && (
        <AddEmployeeModal
          onClose={() => {
            setShowAddModal(false);
            fetchEmployees();
          }}
        />
      )}

      {showEditModal && selectedEmployee && (
        <EditEmployeeModal
          employee={selectedEmployee}
          onClose={() => {
            setShowEditModal(false);
            setSelectedEmployee(null);
            fetchEmployees();
          }}
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
    </div>
  );
}