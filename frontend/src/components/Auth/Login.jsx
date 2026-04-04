/**
 * components/auth/Login.jsx - Modernized with consistent design
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { LogIn, Eye, EyeOff, Mail, Lock, ArrowRight, Briefcase, Shield, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { login as authLogin } from '../../services/auth.js';
import { useAuth } from '../../context/AuthContext.js';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [focusedField, setFocusedField] = useState(null);

  const navigate = useNavigate();
  const { login: ctxLogin, user, role } = useAuth();

  useEffect(() => {
    if (user && role) {
      if (role === 'admin' || role === 'superadmin' || role === 'owner') {
        navigate('/admin/dashboard', { replace: true });
      } else if (role === 'hybrid') {
        navigate('/hybrid/dashboard', { replace: true });
      } else {
        navigate('/employee/dashboard', { replace: true });
      }
    }
  }, [user, role, navigate]);

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
      const { token, user: userData } = await authLogin(email.trim(), password);
      ctxLogin(userData, token);

      if (rememberMe) {
        localStorage.setItem('savedEmail', email.trim());
      } else {
        localStorage.removeItem('savedEmail');
      }

      toast.success(`Welcome back, ${userData.firstName}!`);
      
      // Redirect based on role
      if (userData.role === 'admin' || userData.role === 'superadmin' || userData.role === 'owner') {
        navigate('/admin/dashboard', { replace: true });
      } else if (userData.role === 'hybrid') {
        navigate('/hybrid/dashboard', { replace: true });
      } else {
        navigate('/employee/dashboard', { replace: true });
      }
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const getRoleIcon = () => {
    return (
      <div className="flex items-center justify-center gap-2 mt-4">
        <div className="flex items-center gap-1 px-2 py-1 bg-blue-50 rounded-full">
          <Briefcase size={12} className="text-blue-600" />
          <span className="text-xs text-blue-600">Employee</span>
        </div>
        <div className="flex items-center gap-1 px-2 py-1 bg-purple-50 rounded-full">
          <Shield size={12} className="text-purple-600" />
          <span className="text-xs text-purple-600">Admin</span>
        </div>
        <div className="flex items-center gap-1 px-2 py-1 bg-indigo-50 rounded-full">
          <Users size={12} className="text-indigo-600" />
          <span className="text-xs text-indigo-600">Hybrid</span>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-white/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-white/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>

      <div className="relative w-full max-w-md">
        {/* Main Card */}
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl overflow-hidden transform transition-all duration-500 hover:shadow-3xl">
          
          {/* Decorative top bar */}
          <div className="h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-indigo-500"></div>
          
          <div className="p-8 md:p-10">
            {/* Logo/Brand Section */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl shadow-lg mb-5 transform transition-transform hover:scale-105">
                <LogIn className="text-white" size={36} />
              </div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent mb-2">
                Welcome Back
              </h1>
              <p className="text-gray-500 text-sm">
                Sign in to your HR Portal account
              </p>
              {getRoleIcon()}
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
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
                    className="w-full pl-10 pr-4 py-3 border-2 rounded-xl focus:outline-none transition-all duration-200 bg-gray-50/50"
                    style={{
                      borderColor: focusedField === 'email' ? '#3B82F6' : '#E5E7EB',
                      boxShadow: focusedField === 'email' ? '0 0 0 3px rgba(59, 130, 246, 0.1)' : 'none'
                    }}
                    placeholder="you@company.com"
                    autoComplete="email"
                  />
                </div>
              </div>

              {/* Password Field */}
              <div className="group">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-semibold text-gray-700">
                    Password
                  </label>
                  <Link
                    to="/forgot-password"
                    className="text-xs text-blue-600 hover:text-blue-700 font-medium transition-colors hover:underline"
                  >
                    Forgot password?
                  </Link>
                </div>
                <div className={`relative transition-all duration-200 ${
                  focusedField === 'password' ? 'transform scale-[1.02]' : ''
                }`}>
                  <Lock className={`absolute left-3 top-3.5 transition-colors duration-200 ${
                    focusedField === 'password' ? 'text-blue-500' : 'text-gray-400'
                  }`} size={18} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    onFocus={() => setFocusedField('password')}
                    onBlur={() => setFocusedField(null)}
                    required
                    disabled={loading}
                    className="w-full pl-10 pr-12 py-3 border-2 rounded-xl focus:outline-none transition-all duration-200 bg-gray-50/50"
                    style={{
                      borderColor: focusedField === 'password' ? '#3B82F6' : '#E5E7EB',
                      boxShadow: focusedField === 'password' ? '0 0 0 3px rgba(59, 130, 246, 0.1)' : 'none'
                    }}
                    placeholder="••••••••"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 top-3.5 text-gray-400 hover:text-gray-600 transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* Remember me */}
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={e => setRememberMe(e.target.checked)}
                    disabled={loading}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 focus:ring-2 transition-all"
                  />
                  <span className="text-sm text-gray-600 group-hover:text-gray-800 transition-colors">
                    Remember me
                  </span>
                </label>
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
                      Logging in...
                    </>
                  ) : (
                    <>
                      Sign In
                      <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </span>
              </button>
            </form>

            {/* Footer */}
            <div className="mt-6 text-center">
              <p className="text-xs text-gray-400">
                © 2026 NOORI HR Portal. All rights reserved.
              </p>
            </div>
          </div>
        </div>

        {/* Decorative bottom element */}
        <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-32 h-1 bg-gradient-to-r from-transparent via-white/50 to-transparent rounded-full"></div>
      </div>
    </div>
  );
}