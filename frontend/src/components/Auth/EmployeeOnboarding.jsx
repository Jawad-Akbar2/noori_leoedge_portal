/**
 * components/auth/EmployeeOnboarding.jsx - Modernized with consistent design
 */

import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CheckCircle, Eye, EyeOff, User, Lock, Building2, CreditCard, Banknote, ArrowRight, ArrowLeft, Shield, Briefcase } from 'lucide-react';
import toast from 'react-hot-toast';
import { employeeOnboard } from '../../services/auth.js';
import { useAuth } from '../../context/AuthContext.js';

const INITIAL_FORM = {
  firstName: '',
  lastName: '',
  password: '',
  confirmPassword: '',
  bankDetails: {
    bankName: '',
    accountName: '',
    accountNumber: ''
  }
};

export default function EmployeeOnboarding() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { login: ctxLogin } = useAuth();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [focusedField, setFocusedField] = useState(null);

  // Password strength calculator
  const getPasswordStrength = (password) => {
    if (!password) return 0;
    let strength = 0;
    if (password.length >= 8) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;
    return strength;
  };

  const passwordStrength = getPasswordStrength(formData.password);
  const strengthMeta = [
    null,
    { label: 'Weak', color: 'bg-red-500', text: 'text-red-500' },
    { label: 'Fair', color: 'bg-yellow-400', text: 'text-yellow-500' },
    { label: 'Good', color: 'bg-blue-400', text: 'text-blue-500' },
    { label: 'Strong', color: 'bg-green-500', text: 'text-green-600' },
  ][passwordStrength];

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name.startsWith('bank.')) {
      const key = name.slice(5);
      setFormData(prev => ({
        ...prev,
        bankDetails: { ...prev.bankDetails, [key]: value }
      }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const validateStep1 = () => {
    if (!formData.firstName.trim()) {
      toast.error('First name is required');
      return false;
    }
    if (!formData.lastName.trim()) {
      toast.error('Last name is required');
      return false;
    }
    if (formData.password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return false;
    }
    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match');
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    const { bankName, accountName, accountNumber } = formData.bankDetails;
    if (!bankName.trim()) {
      toast.error('Bank name is required');
      return false;
    }
    if (!accountName.trim()) {
      toast.error('Account name is required');
      return false;
    }
    if (!accountNumber.trim()) {
      toast.error('Account number is required');
      return false;
    }
    return true;
  };

  const goToStep2 = () => {
    if (validateStep1()) {
      setStep(2);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateStep2()) return;

    setLoading(true);
    try {
      const data = await employeeOnboard({
        token,
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        password: formData.password,
        bankDetails: formData.bankDetails
      });

      if (data.token && data.user) {
        ctxLogin(data.user, data.token);
        toast.success('Welcome aboard! Your account is ready.');
        if (data.user.role === 'admin' || data.user.role === 'superadmin' || data.user.role === 'owner') {
          navigate('/admin/dashboard', { replace: true });
        } else if (data.user.role === 'hybrid') {
          navigate('/hybrid/dashboard', { replace: true });
        } else {
          navigate('/employee/dashboard', { replace: true });
        }
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-white/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-white/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>

      <div className="relative w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl shadow-lg mb-5 transform transition-transform hover:scale-105">
            <Briefcase className="text-white" size={36} />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Complete Your Profile</h1>
          <p className="text-blue-100">Set up your account to get started with HR Portal</p>
        </div>

        {/* Step indicators */}
        <div className="mb-8 px-4">
          <div className="flex items-center justify-between max-w-md mx-auto">
            {[1, 2].map((s, i) => (
              <React.Fragment key={s}>
                <div className="flex flex-col items-center gap-2">
                  <div className={`
                    w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-lg
                    transition-all duration-300 transform
                    ${s < step 
                      ? 'bg-white text-blue-600 shadow-lg scale-105' 
                      : s === step 
                        ? 'bg-gradient-to-r from-blue-400 to-blue-500 text-white ring-4 ring-white/50 shadow-xl scale-110' 
                        : 'bg-blue-300/50 text-blue-700 backdrop-blur-sm'
                    }
                  `}>
                    {s < step ? <CheckCircle size={24} /> : s}
                  </div>
                  <span className={`text-xs font-medium ${s === step ? 'text-white' : 'text-blue-200'}`}>
                    {s === 1 ? 'Personal Info' : 'Bank Details'}
                  </span>
                </div>
                {i < 1 && (
                  <div className={`flex-1 h-1 rounded-full transition-all duration-500 ${
                    s < step ? 'bg-white' : 'bg-blue-300/50'
                  }`} />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Form card */}
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl overflow-hidden transform transition-all duration-500">
          <div className="h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-indigo-500"></div>
          
          <div className="p-8 md:p-10">
            <form onSubmit={handleSubmit}>
              {/* Step 1: Personal Info */}
              {step === 1 && (
                <div className="space-y-6">
                  <div className="text-center mb-2">
                    <h2 className="text-2xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
                      Personal Information
                    </h2>
                    <p className="text-gray-500 text-sm mt-1">Tell us about yourself</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        First Name *
                      </label>
                      <div className={`relative transition-all duration-200 ${
                        focusedField === 'firstName' ? 'transform scale-[1.02]' : ''
                      }`}>
                        <User className={`absolute left-3 top-3 transition-colors duration-200 ${
                          focusedField === 'firstName' ? 'text-blue-500' : 'text-gray-400'
                        }`} size={18} />
                        <input
                          type="text"
                          name="firstName"
                          value={formData.firstName}
                          onChange={handleChange}
                          onFocus={() => setFocusedField('firstName')}
                          onBlur={() => setFocusedField(null)}
                          required
                          className="w-full pl-10 pr-4 py-2.5 border-2 rounded-xl focus:outline-none transition-all duration-200 bg-gray-50/50"
                          style={{
                            borderColor: focusedField === 'firstName' ? '#3B82F6' : '#E5E7EB',
                            boxShadow: focusedField === 'firstName' ? '0 0 0 3px rgba(59, 130, 246, 0.1)' : 'none'
                          }}
                          placeholder="John"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Last Name *
                      </label>
                      <div className={`relative transition-all duration-200 ${
                        focusedField === 'lastName' ? 'transform scale-[1.02]' : ''
                      }`}>
                        <User className={`absolute left-3 top-3 transition-colors duration-200 ${
                          focusedField === 'lastName' ? 'text-blue-500' : 'text-gray-400'
                        }`} size={18} />
                        <input
                          type="text"
                          name="lastName"
                          value={formData.lastName}
                          onChange={handleChange}
                          onFocus={() => setFocusedField('lastName')}
                          onBlur={() => setFocusedField(null)}
                          required
                          className="w-full pl-10 pr-4 py-2.5 border-2 rounded-xl focus:outline-none transition-all duration-200 bg-gray-50/50"
                          style={{
                            borderColor: focusedField === 'lastName' ? '#3B82F6' : '#E5E7EB',
                            boxShadow: focusedField === 'lastName' ? '0 0 0 3px rgba(59, 130, 246, 0.1)' : 'none'
                          }}
                          placeholder="Doe"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Password *
                    </label>
                    <div className={`relative transition-all duration-200 ${
                      focusedField === 'password' ? 'transform scale-[1.02]' : ''
                    }`}>
                      <Lock className={`absolute left-3 top-3 transition-colors duration-200 ${
                        focusedField === 'password' ? 'text-blue-500' : 'text-gray-400'
                      }`} size={18} />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        name="password"
                        value={formData.password}
                        onChange={handleChange}
                        onFocus={() => setFocusedField('password')}
                        onBlur={() => setFocusedField(null)}
                        required
                        className="w-full pl-10 pr-12 py-2.5 border-2 rounded-xl focus:outline-none transition-all duration-200 bg-gray-50/50"
                        style={{
                          borderColor: focusedField === 'password' ? '#3B82F6' : '#E5E7EB',
                          boxShadow: focusedField === 'password' ? '0 0 0 3px rgba(59, 130, 246, 0.1)' : 'none'
                        }}
                        placeholder="Min. 8 characters"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(v => !v)}
                        className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 transition-colors"
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>

                    {/* Password strength meter */}
                    {formData.password && (
                      <div className="mt-3">
                        <div className="flex gap-1.5 mb-2">
                          {[1, 2, 3, 4].map(i => (
                            <div
                              key={i}
                              className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                                i <= passwordStrength ? strengthMeta?.color : 'bg-gray-200'
                              }`}
                            />
                          ))}
                        </div>
                        <p className={`text-xs font-medium ${strengthMeta?.text}`}>
                          {strengthMeta?.label} password
                        </p>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Confirm Password *
                    </label>
                    <div className={`relative transition-all duration-200 ${
                      focusedField === 'confirmPassword' ? 'transform scale-[1.02]' : ''
                    }`}>
                      <Lock className={`absolute left-3 top-3 transition-colors duration-200 ${
                        focusedField === 'confirmPassword' ? 'text-blue-500' : 'text-gray-400'
                      }`} size={18} />
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        name="confirmPassword"
                        value={formData.confirmPassword}
                        onChange={handleChange}
                        onFocus={() => setFocusedField('confirmPassword')}
                        onBlur={() => setFocusedField(null)}
                        required
                        className="w-full pl-10 pr-4 py-2.5 border-2 rounded-xl focus:outline-none transition-all duration-200 bg-gray-50/50"
                        style={{
                          borderColor: focusedField === 'confirmPassword' 
                            ? '#3B82F6' 
                            : (formData.confirmPassword && formData.confirmPassword !== formData.password ? '#EF4444' : '#E5E7EB'),
                          boxShadow: focusedField === 'confirmPassword' ? '0 0 0 3px rgba(59, 130, 246, 0.1)' : 'none'
                        }}
                        placeholder="Re-enter your password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(v => !v)}
                        className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 transition-colors"
                        tabIndex={-1}
                      >
                        {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                    {formData.confirmPassword && formData.confirmPassword !== formData.password && (
                      <p className="mt-2 text-xs text-red-500 flex items-center gap-1">
                        Passwords do not match
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={goToStep2}
                    className="relative w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-3 rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all duration-200 font-semibold group"
                  >
                    <span className="flex items-center justify-center gap-2">
                      Continue to Bank Details
                      <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                    </span>
                  </button>
                </div>
              )}

              {/* Step 2: Bank Details */}
              {step === 2 && (
                <div className="space-y-6">
                  <div className="text-center mb-2">
                    <h2 className="text-2xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
                      Bank Details
                    </h2>
                    <p className="text-gray-500 text-sm mt-1">Your salary will be transferred here</p>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Bank Name *
                    </label>
                    <div className={`relative transition-all duration-200 ${
                      focusedField === 'bankName' ? 'transform scale-[1.02]' : ''
                    }`}>
                      <Building2 className={`absolute left-3 top-3 transition-colors duration-200 ${
                        focusedField === 'bankName' ? 'text-blue-500' : 'text-gray-400'
                      }`} size={18} />
                      <input
                        type="text"
                        name="bank.bankName"
                        value={formData.bankDetails.bankName}
                        onChange={handleChange}
                        onFocus={() => setFocusedField('bankName')}
                        onBlur={() => setFocusedField(null)}
                        required
                        className="w-full pl-10 pr-4 py-2.5 border-2 rounded-xl focus:outline-none transition-all duration-200 bg-gray-50/50"
                        style={{
                          borderColor: focusedField === 'bankName' ? '#3B82F6' : '#E5E7EB',
                          boxShadow: focusedField === 'bankName' ? '0 0 0 3px rgba(59, 130, 246, 0.1)' : 'none'
                        }}
                        placeholder="HBL, UBL, Meezan Bank, etc."
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Account Name *
                    </label>
                    <div className={`relative transition-all duration-200 ${
                      focusedField === 'accountName' ? 'transform scale-[1.02]' : ''
                    }`}>
                      <CreditCard className={`absolute left-3 top-3 transition-colors duration-200 ${
                        focusedField === 'accountName' ? 'text-blue-500' : 'text-gray-400'
                      }`} size={18} />
                      <input
                        type="text"
                        name="bank.accountName"
                        value={formData.bankDetails.accountName}
                        onChange={handleChange}
                        onFocus={() => setFocusedField('accountName')}
                        onBlur={() => setFocusedField(null)}
                        required
                        className="w-full pl-10 pr-4 py-2.5 border-2 rounded-xl focus:outline-none transition-all duration-200 bg-gray-50/50"
                        style={{
                          borderColor: focusedField === 'accountName' ? '#3B82F6' : '#E5E7EB',
                          boxShadow: focusedField === 'accountName' ? '0 0 0 3px rgba(59, 130, 246, 0.1)' : 'none'
                        }}
                        placeholder="John Doe"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Account / IBAN Number *
                    </label>
                    <div className={`relative transition-all duration-200 ${
                      focusedField === 'accountNumber' ? 'transform scale-[1.02]' : ''
                    }`}>
                      <Banknote className={`absolute left-3 top-3 transition-colors duration-200 ${
                        focusedField === 'accountNumber' ? 'text-blue-500' : 'text-gray-400'
                      }`} size={18} />
                      <input
                        type="text"
                        name="bank.accountNumber"
                        value={formData.bankDetails.accountNumber}
                        onChange={handleChange}
                        onFocus={() => setFocusedField('accountNumber')}
                        onBlur={() => setFocusedField(null)}
                        required
                        className="w-full pl-10 pr-4 py-2.5 border-2 rounded-xl focus:outline-none transition-all duration-200 bg-gray-50/50"
                        style={{
                          borderColor: focusedField === 'accountNumber' ? '#3B82F6' : '#E5E7EB',
                          boxShadow: focusedField === 'accountNumber' ? '0 0 0 3px rgba(59, 130, 246, 0.1)' : 'none'
                        }}
                        placeholder="PK36 HBL 1234 5678 9012 3456"
                      />
                    </div>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl hover:bg-gray-200 transition-all duration-200 font-medium flex items-center justify-center gap-2 group"
                    >
                      <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 text-white py-3 rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all duration-200 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? (
                        <span className="flex items-center justify-center gap-2">
                          <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Setting up...
                        </span>
                      ) : (
                        'Complete Setup'
                      )}
                    </button>
                  </div>
                </div>
              )}
            </form>

            {/* Security note */}
            <div className="mt-6 pt-4 border-t border-gray-100">
              <div className="flex items-center justify-center gap-2 text-xs text-gray-400">
                <Shield size={12} />
                <span>Your information is securely encrypted</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}