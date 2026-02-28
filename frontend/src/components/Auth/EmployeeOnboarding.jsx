/**
 * components/auth/EmployeeOnboarding.jsx
 *
 * Two-step onboarding form for new employees arriving via invite link.
 * Route: /join/:token
 *
 * Step 1 — personal info + password
 * Step 2 — bank details
 *
 * On success the backend returns a JWT → user is auto-logged-in.
 */

import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CheckCircle, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { employeeOnboard } from '../../services/auth.js';
import { useAuth } from '../../context/AuthContext.js';

const INITIAL_FORM = {
  firstName:    '',
  lastName:     '',
  password:     '',
  confirmPassword: '',
  bankDetails: {
    bankName:      '',
    accountName:   '',
    accountNumber: ''
  }
};

export default function EmployeeOnboarding() {
  const { token }    = useParams();
  const navigate     = useNavigate();
  const { login: ctxLogin } = useAuth();

  const [step,          setStep]          = useState(1);
  const [loading,       setLoading]       = useState(false);
  const [showPassword,  setShowPassword]  = useState(false);
  const [formData,      setFormData]      = useState(INITIAL_FORM);

  // ── input handler ────────────────────────────────────────────────────────
  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name.startsWith('bank.')) {
      const key = name.slice(5);   // strip "bank."
      setFormData(prev => ({
        ...prev,
        bankDetails: { ...prev.bankDetails, [key]: value }
      }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  // ── step 1 validation ────────────────────────────────────────────────────
  const validateStep1 = () => {
    if (!formData.firstName.trim()) { toast.error('First name is required');            return false; }
    if (!formData.lastName.trim())  { toast.error('Last name is required');             return false; }
    if (formData.password.length < 8) { toast.error('Password must be at least 8 characters'); return false; }
    if (formData.password !== formData.confirmPassword) { toast.error('Passwords do not match'); return false; }
    return true;
  };

  // ── step 2 validation ────────────────────────────────────────────────────
  const validateStep2 = () => {
    const { bankName, accountName, accountNumber } = formData.bankDetails;
    if (!bankName.trim() || !accountName.trim() || !accountNumber.trim()) {
      toast.error('All bank details are required');
      return false;
    }
    return true;
  };

  const goToStep2 = () => {
    if (validateStep1()) setStep(2);
  };

  // ── submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateStep2()) return;

    setLoading(true);
    try {
      const data = await employeeOnboard({
        token,
        firstName:   formData.firstName.trim(),
        lastName:    formData.lastName.trim(),
        password:    formData.password,
        bankDetails: formData.bankDetails
      });

      // Backend returns token + user → auto-login
      if (data.token && data.user) {
        ctxLogin(data.user, data.token);
        toast.success('Welcome! Your account is ready.');
        navigate(
          data.user.role === 'admin' || data.user.role === 'superadmin' ? '/admin/dashboard' : '/employee/dashboard',
          { replace: true }
        );
      } else {
        toast.success('Account setup complete! Please log in.');
        navigate('/login', { replace: true });
      }
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Onboarding failed');
    } finally {
      setLoading(false);
    }
  };

  // ── UI ────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 p-4">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Complete Your Profile</h1>
          <p className="text-blue-100">Set up your account to get started</p>
        </div>

        {/* Step indicators */}
        <div className="flex items-center gap-2 mb-8 px-4">
          {[1, 2].map((s, i) => (
            <React.Fragment key={s}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm
                ${s < step  ? 'bg-white text-blue-600' :
                  s === step ? 'bg-blue-400 text-white ring-2 ring-white' :
                               'bg-blue-300 text-blue-700'}`}
              >
                {s < step ? <CheckCircle size={18} /> : s}
              </div>
              {i < 1 && (
                <div className={`flex-1 h-1 rounded ${s < step ? 'bg-white' : 'bg-blue-300'}`} />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Form card */}
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-2xl p-8">

          {/* ── Step 1: Personal info ───────────────────────────────────── */}
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-2xl font-bold text-gray-800 mb-1">Personal Information</h2>
                <p className="text-gray-500 text-sm">Choose your name and set a secure password.</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
                  <input
                    type="text"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
                  <input
                    type="text"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    required
                    placeholder="At least 8 characters"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password *</label>
                <input
                  type="password"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <button
                type="button"
                onClick={goToStep2}
                className="w-full bg-blue-600 text-white py-2.5 rounded-lg hover:bg-blue-700 transition font-medium"
              >
                Next: Bank Details →
              </button>
            </div>
          )}

          {/* ── Step 2: Bank details ────────────────────────────────────── */}
          {step === 2 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-2xl font-bold text-gray-800 mb-1">Bank Details</h2>
                <p className="text-gray-500 text-sm">Your salary will be transferred to this account.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bank Name *</label>
                <input
                  type="text"
                  name="bank.bankName"
                  value={formData.bankDetails.bankName}
                  onChange={handleChange}
                  required
                  placeholder="HBL, UBL, Meezan, etc."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Account Name *</label>
                <input
                  type="text"
                  name="bank.accountName"
                  value={formData.bankDetails.accountName}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Account Number *</label>
                <input
                  type="text"
                  name="bank.accountNumber"
                  value={formData.bankDetails.accountNumber}
                  onChange={handleChange}
                  required
                  inputMode="numeric"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-lg hover:bg-gray-200 transition font-medium"
                >
                  ← Back
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg hover:bg-blue-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Setting up…
                    </span>
                  ) : 'Complete Setup'}
                </button>
              </div>
            </div>
          )}

        </form>
      </div>
    </div>
  );
}