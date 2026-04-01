import React, { useState } from 'react';
import { Edit2, Lock, Eye, Trash2, Send, X } from 'lucide-react';
import EditEmployeeModal from './EditEmployeeModal';
import GhostModeView from './GhostModeView';

/**
 * EmployeeActionsMenu
 *
 * Visibility rules:
 *   superadmin → can act on everyone (superadmin, admin, employee)
 *   admin      → can only act on role: 'employee'
 *                (backend enforces this too, but we hide the buttons proactively)
 *
 * Props:
 *   employee        — the employee record this menu is for
 *   currentUserRole — role of the logged-in user ('superadmin' | 'admin')
 *   onFreeze        — callback
 *   onArchive       — callback
 *   onClose         — close this dropdown
 *   onResendInvite  — callback
 *   onRefresh       — refresh parent list after edit
 */
export default function EmployeeActionsMenu({
  employee,
  currentUserRole,
  onFreeze,
  onArchive,
  onClose,
  onResendInvite,
  onRefresh
}) {
  const [showEditModal, setShowEditModal] = useState(false);
  const [showGhostMode, setShowGhostMode] = useState(false);

  const isSuperAdmin  = currentUserRole === 'superadmin' || currentUserRole === 'owner';
  const targetIsAdmin = employee?.role === 'admin' || employee?.role === 'superadmin';

  // Admin cannot act on other admins or superadmins — all action buttons are hidden.
  // We still render the menu shell so the dropdown appears; it just shows a notice.
  const canAct = isSuperAdmin || !targetIsAdmin;

  const handleEdit = () => {
    setShowEditModal(true);
    onClose();
  };

  const handleGhostMode = () => {
    setShowGhostMode(true);
    onClose();
  };

  const handleFreeze = () => {
    onFreeze();
    onClose();
  };

  const handleArchive = () => {
    if (window.confirm('Are you sure you want to archive this employee?')) {
      onArchive();
      onClose();
    }
  };

  const handleResendInvite = () => {
    onResendInvite();
    onClose();
  };

  return (
    <>
      {/* Dropdown */}
      <div className="absolute right-0 mt-2 w-52 bg-white rounded-lg shadow-lg z-40 border border-gray-200 overflow-hidden">

        {canAct ? (
          <>
            {/* Edit */}
            <button onClick={handleEdit}
              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 border-b text-sm transition">
              <Edit2 size={16} className="text-blue-600" />
              <span className="text-gray-700 font-medium">Edit Information</span>
            </button>

            {/* Ghost Mode */}
            <button onClick={handleGhostMode}
              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 border-b text-sm transition">
              <Eye size={16} className="text-purple-600" />
              <span className="text-gray-700 font-medium">Ghost Mode</span>
            </button>

            {/* Freeze / Unfreeze — only for Active or Frozen accounts */}
            {employee.status !== 'Inactive' && (
              <button onClick={handleFreeze}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 border-b text-sm transition">
                <Lock size={16} className={employee.status === 'Frozen' ? 'text-green-600' : 'text-orange-600'} />
                <span className="text-gray-700 font-medium">
                  {employee.status === 'Frozen' ? 'Unfreeze Account' : 'Freeze Account'}
                </span>
              </button>
            )}

            {/* Archive */}
            <button onClick={handleArchive}
              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-red-50 border-b text-sm transition">
              <Trash2 size={16} className="text-red-600" />
              <span className="text-red-700 font-medium">Archive Employee</span>
            </button>

            {/* Resend Invite — only for Inactive */}
            {employee.status === 'Inactive' && (
              <button onClick={handleResendInvite}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 text-sm transition">
                <Send size={16} className="text-green-600" />
                <span className="text-gray-700 font-medium">Resend Invite</span>
              </button>
            )}
          </>
        ) : (
          /* Admin trying to act on an admin/superadmin account */
          <div className="px-4 py-4 text-center">
            <p className="text-xs text-gray-500">
              You don't have permission to manage this account.
            </p>
            <button onClick={onClose}
              className="mt-2 text-xs text-blue-600 hover:underline">
              Close
            </button>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {showEditModal && (
        <EditEmployeeModal
          employee={employee}
          currentUserRole={currentUserRole}
          onClose={() => {
            setShowEditModal(false);
            onRefresh?.();
          }}
          onSave={() => {
            onRefresh?.();
          }}
        />
      )}

      {/* Ghost Mode View */}
      {showGhostMode && (
        <GhostModeView
          employee={employee}
          onClose={() => setShowGhostMode(false)}
        />
      )}
    </>
  );
}