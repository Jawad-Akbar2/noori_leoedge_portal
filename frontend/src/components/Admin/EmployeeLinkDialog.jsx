import React, { useState } from "react";
import { X, Copy, Check, Share2, Link2, Mail, MessageCircle, UserCheck, Building2, MailOpen, CalendarDays } from "lucide-react";
import { copyToClipboard } from "../../utils/clipboard";
import toast from "react-hot-toast";
import { useEscape } from "../../context/EscapeStack";

export default function EmployeeLinkDialog({ employee, inviteLink, onClose, onShare }) {
  const [copied, setCopied] = useState(false);
  const [copying, setCopying] = useState(false);
  useEscape(onClose);

  const handleCopyLink = async () => {
    setCopying(true);
    try {
      const result = await copyToClipboard(inviteLink);
      if (result.success) {
        setCopied(true);
        toast.success("Link copied to clipboard!");
        setTimeout(() => setCopied(false), 2000);
      } else {
        toast.error("Failed to copy link. Please try again.");
      }
    } catch (error) {
      console.error("Copy error:", error);
      toast.error("Failed to copy link");
    } finally {
      setCopying(false);
    }
  };

  const handleSelectAll = (e) => {
    e.target.select();
  };

  const handleShareViaEmail = () => {
    const subject = encodeURIComponent(`Onboarding Invitation: ${employee.firstName} ${employee.lastName}`);
    const body = encodeURIComponent(
      `Hello ${employee.firstName},\n\n` +
      `You have been added to the attendance system. Please use the link below to complete your profile setup:\n\n` +
      `${inviteLink}\n\n` +
      `Employee Number: ${employee.employeeNumber}\n` +
      `Department: ${employee.department}\n\n` +
      `Best regards,\nHR Team`
    );
    window.location.href = `mailto:${employee.email}?subject=${subject}&body=${body}`;
  };

  const handleShareViaWhatsApp = () => {
    const text = encodeURIComponent(
      `🎉 Welcome to the team ${employee.firstName}!\n\n` +
      `Please complete your onboarding using this link:\n${inviteLink}\n\n` +
      `Employee #: ${employee.employeeNumber}\n` +
      `Department: ${employee.department}`
    );
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-green-100">
              <UserCheck size={16} className="text-green-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-800">Employee Added Successfully</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {employee.firstName} {employee.lastName} · #{employee.employeeNumber}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Success Message */}
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-200 p-4">
            <div className="flex items-start gap-3">
              <div className="p-1 rounded-lg bg-green-100 flex-shrink-0">
                <Check size={14} className="text-green-600" />
              </div>
              <p className="text-sm text-green-800">
                Employee record has been created. Share the onboarding link below to activate their account.
              </p>
            </div>
          </div>

          {/* Link Section */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Onboarding Link
            </label>
            <p className="text-xs text-gray-500 mb-2">
              Share this link with {employee.firstName} to complete their profile setup
            </p>

            {/* Link Input Field */}
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <div className="absolute left-3 top-1/2 -translate-y-1/2">
                  <Link2 size={14} className="text-gray-400" />
                </div>
                <input
                  type="text"
                  value={inviteLink}
                  onClick={handleSelectAll}
                  readOnly
                  className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl bg-gray-50 font-mono text-xs text-gray-700 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 select-all"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleCopyLink}
                  disabled={copying}
                  className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all shadow-sm ${
                    copied
                      ? "bg-green-600 text-white hover:bg-green-700"
                      : "bg-blue-600 text-white hover:bg-blue-700"
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {copied ? (
                    <>
                      <Check size={14} />
                      <span className="hidden sm:inline text-sm">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy size={14} />
                      <span className="hidden sm:inline text-sm">Copy</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Quick Share Options */}
            <div className="mt-3">
              <p className="text-xs text-gray-500 mb-2">Quick share via:</p>
              <div className="flex gap-2">
                <button
                  onClick={handleShareViaEmail}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 border border-gray-200 rounded-lg hover:bg-gray-200 transition"
                >
                  <Mail size={12} />
                  Email
                </button>
                <button
                  onClick={handleShareViaWhatsApp}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition"
                >
                  <MessageCircle size={12} />
                  WhatsApp
                </button>
                <button
                  onClick={onShare}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-purple-700 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 transition"
                >
                  <Share2 size={12} />
                  More options
                </button>
              </div>
            </div>

            {copied && (
              <div className="mt-2 text-xs text-green-600 font-medium flex items-center gap-1">
                <Check size={12} /> Link copied to clipboard
              </div>
            )}
          </div>

          {/* Employee Details Card */}
          <div className="bg-gradient-to-r from-gray-50 to-gray-100/50 rounded-xl border border-gray-200 p-4">
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-3 flex items-center gap-2">
              <UserCheck size={12} /> Employee Details
            </p>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-gray-500">Full Name</p>
                <p className="text-sm font-medium text-gray-800">{employee.firstName} {employee.lastName}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Employee #</p>
                <p className="text-sm font-mono text-gray-700">{employee.employeeNumber}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Email</p>
                <p className="text-sm text-gray-700 truncate">{employee.email}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Department</p>
                <p className="text-sm text-gray-700">{employee.department}</p>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Account Status</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
                  <MailOpen size={10} />
                  Awaiting Activation
                </span>
              </div>
            </div>
          </div>

          {/* Instructions */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50/50 rounded-xl border border-blue-100 p-4">
            <p className="text-xs font-semibold text-blue-800 mb-2 flex items-center gap-2">
              <CalendarDays size={12} /> How to share
            </p>
            <ul className="text-xs text-blue-700 space-y-1.5 list-disc list-inside">
              <li>Copy the link above and send it to the employee</li>
              <li>Employee clicks the link to set their password</li>
              <li>They'll complete their profile and activate their account</li>
              <li>Once activated, they can access the system</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition"
          >
            Close
          </button>
          <button
            onClick={onShare}
            className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-gradient-to-r from-green-600 to-green-700 rounded-xl hover:from-green-700 hover:to-green-800 transition shadow-md"
          >
            <Share2 size={15} />
            Share Link
          </button>
        </div>
      </div>
    </div>
  );
}