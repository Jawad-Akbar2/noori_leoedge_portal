import React, { useState } from 'react';
import { X, Copy, Check } from 'lucide-react';
import { copyToClipboard } from '../../utils/clipboard';
import toast from 'react-hot-toast';

export default function EmployeeLinkDialog({ employee, inviteLink, onClose }) {
  const [copied, setCopied] = useState(false);
  const [copying, setCopying] = useState(false);

  const handleCopyLink = async () => {
    setCopying(true);
    try {
      const result = await copyToClipboard(inviteLink);

      if (result.success) {
        setCopied(true);
        toast.success('Link copied to clipboard!');

        // Auto-dismiss success indicator after 2 seconds
        setTimeout(() => {
          setCopied(false);
        }, 2000);
      } else {
        toast.error('Failed to copy link. Please try again or copy manually.');
      }
    } catch (error) {
      console.error('Copy error:', error);
      toast.error('Failed to copy link');
    } finally {
      setCopying(false);
    }
  };

  const handleSelectAll = (e) => {
    e.target.select();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-lg w-full p-6 md:p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Employee Added Successfully</h2>
            <p className="text-sm text-gray-600 mt-1">
              {employee.firstName} {employee.lastName} ({employee.employeeNumber})
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-6">
          {/* Success Message */}
          <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
            <p className="text-sm text-green-800">
              ✓ Employee record has been created in the system. Share the onboarding link below with the new employee.
            </p>
          </div>

          {/* Link Section */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Onboarding Link
            </label>
            <p className="text-xs text-gray-600 mb-2">
              Copy this link and send it to {employee.firstName} to complete their profile setup.
            </p>

            {/* Link Text Field */}
            <div className="flex gap-2">
              <input
                type="text"
                value={inviteLink}
                onClick={handleSelectAll}
                readOnly
                className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-lg bg-gray-50 font-mono text-sm text-gray-800 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 select-all"
              />
              <button
                onClick={handleCopyLink}
                disabled={copying}
                className={`flex items-center gap-2 px-4 py-3 rounded-lg font-medium transition ${
                  copied
                    ? 'bg-green-600 text-white'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {copied ? (
                  <>
                    <Check size={18} />
                    <span className="hidden sm:inline">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy size={18} />
                    <span className="hidden sm:inline">Copy</span>
                  </>
                )}
              </button>
            </div>

            {/* Copy Feedback */}
            {copied && (
              <div className="mt-2 text-sm text-green-600 font-medium">
                ✓ Link copied to clipboard
              </div>
            )}
          </div>

          {/* Instructions */}
          <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
            <p className="text-sm font-semibold text-blue-900 mb-2">How to share:</p>
            <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
              <li>Copy the link above</li>
              <li>Send via email, WhatsApp, or any communication channel</li>
              <li>Employee clicks the link to activate their account</li>
              <li>They'll set their password and complete their profile</li>
            </ul>
          </div>

          {/* Link Details */}
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <p className="text-xs font-semibold text-gray-700 mb-2">Link Details:</p>
            <div className="space-y-1 text-xs text-gray-600">
              <p><span className="font-medium">Email:</span> {employee.email}</p>
              <p><span className="font-medium">Employee ID:</span> {employee.employeeNumber}</p>
              <p><span className="font-medium">Department:</span> {employee.department}</p>
              <p><span className="font-medium">Status:</span> Inactive (awaiting activation)</p>
            </div>
          </div>

          {/* Close Button */}
          <button
            onClick={onClose}
            className="w-full px-4 py-3 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}