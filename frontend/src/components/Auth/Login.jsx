/**
 * components/auth/Login.jsx
 *
 * Calls the auth service (which uses apiClient) and stores credentials
 * via AuthContext.login() — single source of truth for auth state.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { login as authLogin } from '../../services/auth.js';
import { useAuth } from '../../context/AuthContext.js';

export default function Login() {
  const [email,        setEmail]        = useState('');
  const [password,     setPassword]     = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading,      setLoading]      = useState(false);
  const [rememberMe,   setRememberMe]   = useState(false);

  const navigate = useNavigate();
  const { login: ctxLogin, user, role } = useAuth();

  // Already logged in → redirect immediately
  useEffect(() => {
    if (user && role) {
      navigate(role === 'admin' || role === 'superadmin' ? '/admin/dashboard' : '/employee/dashboard', { replace: true });
    }
  }, [user, role, navigate]);

  // Restore saved email on mount
  useEffect(() => {
    const saved = localStorage.getItem('savedEmail');
    if (saved) {
      setEmail(saved);
      setRememberMe(true);
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!email.trim() || !password) {
      toast.error('Email and password are required');
      return;
    }

    setLoading(true);
    try {
      // authLogin calls POST /api/auth/login via apiClient
      const { token, user: userData } = await authLogin(email.trim(), password);

      // Sync AuthContext state (single source of truth)
      ctxLogin(userData, token);

      // Handle remember me
      if (rememberMe) {
        localStorage.setItem('savedEmail', email.trim());
      } else {
        localStorage.removeItem('savedEmail');
      }

      toast.success(`Welcome, ${userData.firstName}!`);

      navigate(
        userData.role === 'admin' || userData.role === 'superadmin' ? '/admin/dashboard' : '/employee/dashboard',
        { replace: true }
      );
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-md p-8 md:p-12">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
            <LogIn className="text-blue-600" size={32} />
          </div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">HR Portal</h1>
          <p className="text-gray-600">Employee Management System</p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Email */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              disabled={loading}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-colors"
              placeholder="your@email.com"
              autoComplete="email"
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                disabled={loading}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-colors pr-12"
                placeholder="••••••••"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-4 top-3.5 text-gray-400 hover:text-gray-600"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          {/* Remember me */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="rememberMe"
              checked={rememberMe}
              onChange={e => setRememberMe(e.target.checked)}
              disabled={loading}
              className="w-4 h-4 rounded border-gray-300 accent-blue-600"
            />
            <label htmlFor="rememberMe" className="text-sm text-gray-600 select-none cursor-pointer">
              Remember email
            </label>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Logging in…
              </span>
            ) : 'Login'}
          </button>
        </form>

      </div>
    </div>
  );
}