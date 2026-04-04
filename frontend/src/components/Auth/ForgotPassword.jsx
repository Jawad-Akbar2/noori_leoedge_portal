/**
 * components/Auth/ForgotPassword.jsx - Modernized with consistent design
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, Send, KeyRound, Shield, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import apiClient from '../../services/api.js';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [focusedField, setFocusedField] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error('Please enter your email address');
      return;
    }

    setLoading(true);
    try {
      await apiClient.post('/auth/forgot-password', { email: email.trim() });
      setSubmitted(true);
      toast.success('Reset link sent successfully!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Success state ─────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 flex items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-white/10 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-white/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
        </div>

        <div className="relative bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl max-w-md w-full overflow-hidden transform transition-all duration-500">
          <div className="h-1 bg-gradient-to-r from-green-500 via-emerald-500 to-teal-500"></div>
          
          <div className="p-8 md:p-10 text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl shadow-lg mb-6 transform transition-transform hover:scale-105">
              <Mail className="text-white" size={36} />
            </div>
            
            <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent mb-3">
              Check Your Email
            </h1>
            
            <p className="text-gray-600 mb-4 leading-relaxed">
              We've sent a password reset link to
            </p>
            <p className="font-semibold text-gray-800 bg-blue-50 inline-block px-4 py-2 rounded-lg mb-4">
              {email}
            </p>
            <p className="text-sm text-gray-500 mb-6">
              The link expires in 15 minutes. Check your spam folder if you don't see it.
            </p>
            
            <div className="flex items-center justify-center gap-3">
              <Link
                to="/login"
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all font-medium"
              >
                <ArrowLeft size={16} />
                Back to Login
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Form state ────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-white/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-white/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>

      <div className="relative w-full max-w-md">
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl overflow-hidden transform transition-all duration-500 hover:shadow-3xl">
          <div className="h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-indigo-500"></div>
          
          <div className="p-8 md:p-10">
            {/* Header */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl shadow-lg mb-5 transform transition-transform hover:scale-105">
                <KeyRound className="text-white" size={36} />
              </div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent mb-2">
                Forgot Password?
              </h1>
              <p className="text-gray-500 text-sm">
                Don't worry, happens to the best of us.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Email Field */}
              <div className="group">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Email Address
                </label>
                <div className={`relative transition-all duration-200 ${
                  focusedField === 'email' ? 'transform scale-[1.02]' : ''
                }`}>
                  <Mail className={`absolute left-3 top-3.5 transition-colors duration-200 ${
                    focusedField === 'email' ? 'text-blue-500' : 'text-gray-400'
                  }`} size={18} />
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    onFocus={() => setFocusedField('email')}
                    onBlur={() => setFocusedField(null)}
                    required
                    disabled={loading}
                    autoFocus
                    className="w-full pl-10 pr-4 py-3 border-2 rounded-xl focus:outline-none transition-all duration-200 bg-gray-50/50"
                    style={{
                      borderColor: focusedField === 'email' ? '#3B82F6' : '#E5E7EB',
                      boxShadow: focusedField === 'email' ? '0 0 0 3px rgba(59, 130, 246, 0.1)' : 'none'
                    }}
                    placeholder="you@company.com"
                    autoComplete="email"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1.5">
                  We'll send a reset link to this email
                </p>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="relative w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-3 rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all duration-200 font-semibold disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden group"
              >
                <span className="relative z-10 flex items-center justify-center gap-2">
                  {loading ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      Send Reset Link
                      <Send size={18} className="group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </span>
              </button>
            </form>

            {/* Footer Links */}
            <div className="mt-6 text-center space-y-2">
              <Link
                to="/login"
                className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-blue-600 transition-colors group"
              >
                <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
                Back to Login
              </Link>
            </div>

            {/* Security note */}
            <div className="mt-6 pt-4 border-t border-gray-100">
              <div className="flex items-center justify-center gap-2 text-xs text-gray-400">
                <Shield size={12} />
                <span>Secure password reset process</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}