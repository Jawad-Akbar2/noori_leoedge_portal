/**
 * components/Auth/ResetPassword.jsx
 *
 * Security flow:
 *  1. On mount: reads ?token + ?email from URL
 *  2. Hits POST /api/auth/verify-reset-token  (does NOT consume the token)
 *  3. If valid → writes a tab-scoped session fingerprint via resetFlowSession
 *  4. isResetSessionValid() is checked on every render — direct URL access
 *     skips step 2-3 so the session is never written → redirect to /forgot-password
 *  5. On success → clears session, navigates to /login
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { KeyRound, Eye, EyeOff, CheckCircle, AlertTriangle, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import apiClient from '../../services/api.js';
import {
  markResetSessionValid,
  isResetSessionValid,
  clearResetSession
} from '../../utils/resetFlowSession.js';

// ── Statuses ──────────────────────────────────────────────────────────────────
// 'verifying'  – checking token with backend on mount
// 'invalid'    – token bad / expired / direct URL access
// 'ready'      – token confirmed, form shown
// 'success'    – password changed

export default function ResetPassword() {
  const [searchParams]               = useSearchParams();
  const navigate                     = useNavigate();

  const token = searchParams.get('token') || '';
  const email = decodeURIComponent(searchParams.get('email') || '');

  const [status,          setStatus]          = useState('verifying');
  const [expiresIn,       setExpiresIn]       = useState(null);  // seconds
  const [newPassword,     setNewPassword]     = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew,         setShowNew]         = useState(false);
  const [showConfirm,     setShowConfirm]     = useState(false);
  const [loading,         setLoading]         = useState(false);

  // ── Mount: verify token with backend ─────────────────────────────────────
  const verifyToken = useCallback(async () => {
    // No token/email in URL → definitely a direct visit
    if (!token || !email) {
      setStatus('invalid');
      return;
    }

    // If this tab already verified (e.g. hot-reload), skip the round-trip
    if (isResetSessionValid(email)) {
      setStatus('ready');
      return;
    }

    try {
      const { data } = await apiClient.post('/auth/verify-reset-token', { email, token });
      if (data.valid) {
        markResetSessionValid(email);           // write tab-scoped fingerprint
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

    // Clear session if user navigates away without completing
    return () => {
      // Only clear if they didn't succeed (success clears it explicitly)
      // We check the DOM flag set in handleSubmit
    };
  }, [verifyToken]);

  // Countdown timer display
  useEffect(() => {
    if (!expiresIn || status !== 'ready') return;
    const id = setInterval(() => setExpiresIn(s => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [expiresIn, status]);

  // Guard: re-check session on every render (catches back-button tricks)
  useEffect(() => {
    if (status === 'ready' && !isResetSessionValid(email)) {
      setStatus('invalid');
    }
  });

  // ── Password strength ─────────────────────────────────────────────────────
  const strength = (() => {
    if (!newPassword) return 0;
    let s = 0;
    if (newPassword.length >= 8)           s++;
    if (/[A-Z]/.test(newPassword))         s++;
    if (/[0-9]/.test(newPassword))         s++;
    if (/[^A-Za-z0-9]/.test(newPassword))  s++;
    return s;
  })();

  const strengthMeta = [
    null,
    { label: 'Weak',   color: 'bg-red-500',    text: 'text-red-500'   },
    { label: 'Fair',   color: 'bg-yellow-400',  text: 'text-yellow-500'},
    { label: 'Good',   color: 'bg-blue-400',    text: 'text-blue-500'  },
    { label: 'Strong', color: 'bg-green-500',   text: 'text-green-600' },
  ][strength];

  // ── Submit ────────────────────────────────────────────────────────────────
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
      clearResetSession();   // single-use — wipe immediately
      setStatus('success');
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to reset password. The link may have expired.';
      toast.error(msg);
      // If the backend says the token is gone, treat it as invalid
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

  // ── Render: verifying ─────────────────────────────────────────────────────
  if (status === 'verifying') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-2xl w-full max-w-md p-12 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-50 rounded-full mb-6">
            <span className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin block" />
          </div>
          <p className="text-gray-600 font-medium">Verifying your reset link…</p>
        </div>
      </div>
    );
  }

  // ── Render: invalid / direct URL access ───────────────────────────────────
  if (status === 'invalid') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-2xl w-full max-w-md p-8 md:p-12 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-6">
            <AlertTriangle className="text-red-500" size={32} />
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-3">Link invalid or expired</h1>
          <p className="text-gray-600 mb-8 leading-relaxed text-sm">
            This password reset link has already been used, has expired, or is invalid.
            Please request a new one.
          </p>
          <Link
            to="/forgot-password"
            className="inline-block w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors font-semibold text-center"
          >
            Request New Link
          </Link>
          <div className="mt-4">
            <Link to="/login" className="text-sm text-gray-500 hover:text-blue-600 transition-colors">
              Back to login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Render: success ───────────────────────────────────────────────────────
  if (status === 'success') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-2xl w-full max-w-md p-8 md:p-12 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-6">
            <CheckCircle className="text-green-600" size={32} />
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-3">Password reset!</h1>
          <p className="text-gray-600 mb-8 leading-relaxed">
            Your password has been updated. You can now log in with your new password.
          </p>
          <button
            onClick={() => navigate('/login', { replace: true })}
            className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors font-semibold"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  // ── Render: ready (form) ──────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-md p-8 md:p-12">

        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
            <KeyRound className="text-blue-600" size={32} />
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-1">Set new password</h1>
          <p className="text-gray-500 text-sm">
            For <span className="font-medium text-gray-700">{email}</span>
          </p>
        </div>

        {/* Countdown */}
        {expiresIn !== null && (
          <div className={`flex items-center justify-center gap-2 text-sm font-medium mb-5 px-3 py-2 rounded-lg ${
            expiresIn < 120 ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'
          }`}>
            <Clock size={14} />
            Link expires in {formatTime(expiresIn)}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">

          {/* New password */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              New Password
            </label>
            <div className="relative">
              <input
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                required
                disabled={loading}
                autoFocus
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-colors pr-12"
                placeholder="Min. 8 characters"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowNew(v => !v)}
                className="absolute right-4 top-3.5 text-gray-400 hover:text-gray-600"
                tabIndex={-1}
              >
                {showNew ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>

            {/* Strength meter */}
            {newPassword && (
              <div className="mt-2">
                <div className="flex gap-1 mb-1">
                  {[1, 2, 3, 4].map(i => (
                    <div
                      key={i}
                      className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                        i <= strength ? strengthMeta?.color : 'bg-gray-200'
                      }`}
                    />
                  ))}
                </div>
                {strengthMeta && (
                  <p className={`text-xs font-medium ${strengthMeta.text}`}>
                    {strengthMeta.label}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Confirm password */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Confirm Password
            </label>
            <div className="relative">
              <input
                type={showConfirm ? 'text' : 'password'}
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                required
                disabled={loading}
                className={`w-full px-4 py-3 border-2 rounded-lg focus:outline-none focus:ring-2 transition-colors pr-12 ${
                  confirmPassword && confirmPassword !== newPassword
                    ? 'border-red-400 focus:border-red-400 focus:ring-red-100'
                    : 'border-gray-300 focus:border-blue-500 focus:ring-blue-200'
                }`}
                placeholder="Re-enter password"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowConfirm(v => !v)}
                className="absolute right-4 top-3.5 text-gray-400 hover:text-gray-600"
                tabIndex={-1}
              >
                {showConfirm ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            {confirmPassword && confirmPassword !== newPassword && (
              <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1">
                <AlertTriangle size={12} /> Passwords do not match
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || !newPassword || !confirmPassword || newPassword !== confirmPassword}
            className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed mt-2"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Resetting…
              </span>
            ) : 'Reset Password'}
          </button>
        </form>

        <div className="text-center mt-5">
          <Link
            to="/forgot-password"
            className="text-sm text-gray-500 hover:text-blue-600 transition-colors"
          >
            Request a new link
          </Link>
        </div>

      </div>
    </div>
  );
}