/**
 * components/Auth/ResetPassword.jsx - Modernized with consistent design
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { KeyRound, Eye, EyeOff, CheckCircle, AlertTriangle, Clock, Shield, Lock, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import apiClient from '../../services/api.js';
import {
  markResetSessionValid,
  isResetSessionValid,
  clearResetSession
} from '../../utils/resetFlowSession.js';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const token = searchParams.get('token') || '';
  const email = decodeURIComponent(searchParams.get('email') || '');

  const [status, setStatus] = useState('verifying');
  const [expiresIn, setExpiresIn] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState(null);

  const verifyToken = useCallback(async () => {
    if (!token || !email) {
      setStatus('invalid');
      return;
    }

    if (isResetSessionValid(email)) {
      setStatus('ready');
      return;
    }

    try {
      const { data } = await apiClient.post('/auth/verify-reset-token', { email, token });
      if (data.valid) {
        markResetSessionValid(email);
        setExpiresIn(data.expiresInSeconds);
        setStatus('ready');
      } else {
        clearResetSession();
        setStatus('invalid');
      }
    } catch {
      clearResetSession();
      setStatus('invalid');
    }
  }, [token, email]);

  useEffect(() => {
    verifyToken();
  }, [verifyToken]);

  useEffect(() => {
    if (!expiresIn || status !== 'ready') return;
    const id = setInterval(() => setExpiresIn(s => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [expiresIn, status]);

  useEffect(() => {
    if (status === 'ready' && !isResetSessionValid(email)) {
      setStatus('invalid');
    }
  });

  const strength = (() => {
    if (!newPassword) return 0;
    let s = 0;
    if (newPassword.length >= 8) s++;
    if (/[A-Z]/.test(newPassword)) s++;
    if (/[0-9]/.test(newPassword)) s++;
    if (/[^A-Za-z0-9]/.test(newPassword)) s++;
    return s;
  })();

  const strengthMeta = [
    null,
    { label: 'Weak', color: 'bg-red-500', text: 'text-red-500', icon: '🔴' },
    { label: 'Fair', color: 'bg-yellow-400', text: 'text-yellow-500', icon: '🟡' },
    { label: 'Good', color: 'bg-blue-400', text: 'text-blue-500', icon: '🔵' },
    { label: 'Strong', color: 'bg-green-500', text: 'text-green-600', icon: '🟢' },
  ][strength];

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!isResetSessionValid(email)) {
      toast.error('Session expired. Please request a new reset link.');
      setStatus('invalid');
      return;
    }

    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      await apiClient.post('/auth/reset-password', { email, token, newPassword });
      clearResetSession();
      setStatus('success');
      toast.success('Password reset successfully!');
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to reset password. The link may have expired.';
      toast.error(msg);
      if (err.response?.status === 400) {
        clearResetSession();
        setStatus('invalid');
      }
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (s) => {
    if (!s || s <= 0) return '0:00';
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  // Loading state
  if (status === 'verifying') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 flex items-center justify-center p-4">
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl max-w-md w-full p-12 text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl shadow-lg mb-6">
            <span className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin block" />
          </div>
          <p className="text-gray-600 font-medium">Verifying your reset link...</p>
        </div>
      </div>
    );
  }

  // Invalid state
  if (status === 'invalid') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 flex items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-white/10 rounded-full blur-3xl animate-pulse"></div>
        </div>
        
        <div className="relative bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-red-500 via-orange-500 to-yellow-500"></div>
          
          <div className="p-8 md:p-10 text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-red-500 to-red-600 rounded-2xl shadow-lg mb-6">
              <AlertTriangle className="text-white" size={36} />
            </div>
            
            <h1 className="text-2xl font-bold text-gray-800 mb-3">Link Invalid or Expired</h1>
            <p className="text-gray-600 mb-6 leading-relaxed text-sm">
              This password reset link has already been used, has expired, or is invalid.
              Please request a new one.
            </p>
            
            <Link
              to="/forgot-password"
              className="inline-block w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-3 rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all font-semibold text-center"
            >
              Request New Link
            </Link>
            
            <div className="mt-4">
              <Link to="/login" className="text-sm text-gray-500 hover:text-blue-600 transition-colors inline-flex items-center gap-1">
                <ArrowLeft size={14} />
                Back to Login
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Success state
  if (status === 'success') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 flex items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-white/10 rounded-full blur-3xl animate-pulse"></div>
        </div>
        
        <div className="relative bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-green-500 via-emerald-500 to-teal-500"></div>
          
          <div className="p-8 md:p-10 text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl shadow-lg mb-6 transform transition-transform hover:scale-105">
              <CheckCircle className="text-white" size={36} />
            </div>
            
            <h1 className="text-2xl font-bold text-gray-800 mb-3">Password Reset!</h1>
            <p className="text-gray-600 mb-6 leading-relaxed">
              Your password has been successfully updated. You can now log in with your new password.
            </p>
            
            <button
              onClick={() => navigate('/login', { replace: true })}
              className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-3 rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all font-semibold"
            >
              Go to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Ready state - Form
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-white/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-white/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>

      <div className="relative w-full max-w-md">
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl overflow-hidden transform transition-all duration-500">
          <div className="h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-indigo-500"></div>
          
          <div className="p-8 md:p-10">
            {/* Header */}
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl shadow-lg mb-5 transform transition-transform hover:scale-105">
                <Lock className="text-white" size={36} />
              </div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent mb-2">
                Set New Password
              </h1>
              <p className="text-gray-500 text-sm">
                For <span className="font-medium text-gray-700">{email}</span>
              </p>
            </div>

            {/* Countdown Timer */}
            {expiresIn !== null && (
              <div className={`flex items-center justify-center gap-2 text-sm font-medium mb-6 px-3 py-2 rounded-xl ${
                expiresIn < 120 ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'
              }`}>
                <Clock size={14} />
                <span>Link expires in <strong>{formatTime(expiresIn)}</strong></span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* New Password */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  New Password
                </label>
                <div className={`relative transition-all duration-200 ${
                  focusedField === 'new' ? 'transform scale-[1.02]' : ''
                }`}>
                  <Lock className={`absolute left-3 top-3.5 transition-colors duration-200 ${
                    focusedField === 'new' ? 'text-blue-500' : 'text-gray-400'
                  }`} size={18} />
                  <input
                    type={showNew ? 'text' : 'password'}
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    onFocus={() => setFocusedField('new')}
                    onBlur={() => setFocusedField(null)}
                    required
                    disabled={loading}
                    autoFocus
                    className="w-full pl-10 pr-12 py-3 border-2 rounded-xl focus:outline-none transition-all duration-200 bg-gray-50/50"
                    style={{
                      borderColor: focusedField === 'new' ? '#3B82F6' : '#E5E7EB',
                      boxShadow: focusedField === 'new' ? '0 0 0 3px rgba(59, 130, 246, 0.1)' : 'none'
                    }}
                    placeholder="Min. 8 characters"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew(v => !v)}
                    className="absolute right-3 top-3.5 text-gray-400 hover:text-gray-600 transition-colors"
                    tabIndex={-1}
                  >
                    {showNew ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>

                {/* Strength Meter */}
                {newPassword && (
                  <div className="mt-3">
                    <div className="flex gap-1.5 mb-2">
                      {[1, 2, 3, 4].map(i => (
                        <div
                          key={i}
                          className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                            i <= strength ? strengthMeta?.color : 'bg-gray-200'
                          }`}
                        />
                      ))}
                    </div>
                    <div className="flex items-center justify-between">
                      <p className={`text-xs font-medium ${strengthMeta?.text}`}>
                        {strengthMeta?.label} Password
                      </p>
                      <p className="text-xs text-gray-400">
                        {newPassword.length}/8+ chars
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Confirm Password
                </label>
                <div className={`relative transition-all duration-200 ${
                  focusedField === 'confirm' ? 'transform scale-[1.02]' : ''
                }`}>
                  <Lock className={`absolute left-3 top-3.5 transition-colors duration-200 ${
                    focusedField === 'confirm' ? 'text-blue-500' : 'text-gray-400'
                  }`} size={18} />
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    onFocus={() => setFocusedField('confirm')}
                    onBlur={() => setFocusedField(null)}
                    required
                    disabled={loading}
                    className="w-full pl-10 pr-12 py-3 border-2 rounded-xl focus:outline-none transition-all duration-200 bg-gray-50/50"
                    style={{
                      borderColor: focusedField === 'confirm' 
                        ? '#3B82F6' 
                        : (confirmPassword && confirmPassword !== newPassword ? '#EF4444' : '#E5E7EB'),
                      boxShadow: focusedField === 'confirm' ? '0 0 0 3px rgba(59, 130, 246, 0.1)' : 'none'
                    }}
                    placeholder="Re-enter your password"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(v => !v)}
                    className="absolute right-3 top-3.5 text-gray-400 hover:text-gray-600 transition-colors"
                    tabIndex={-1}
                  >
                    {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {confirmPassword && confirmPassword !== newPassword && (
                  <p className="mt-2 text-xs text-red-500 flex items-center gap-1">
                    <AlertTriangle size={12} />
                    Passwords do not match
                  </p>
                )}
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading || !newPassword || !confirmPassword || newPassword !== confirmPassword}
                className="relative w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-3 rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all duration-200 font-semibold disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden mt-4"
              >
                <span className="relative z-10 flex items-center justify-center gap-2">
                  {loading ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Resetting...
                    </>
                  ) : (
                    <>
                      Reset Password
                      <KeyRound size={18} />
                    </>
                  )}
                </span>
              </button>
            </form>

            {/* Footer */}
            <div className="text-center mt-6">
              <Link
                to="/forgot-password"
                className="text-sm text-gray-500 hover:text-blue-600 transition-colors inline-flex items-center gap-1"
              >
                Request a new link
              </Link>
            </div>

            {/* Security Badge */}
            <div className="mt-6 pt-4 border-t border-gray-100">
              <div className="flex items-center justify-center gap-2 text-xs text-gray-400">
                <Shield size={12} />
                <span>256-bit encrypted connection</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}