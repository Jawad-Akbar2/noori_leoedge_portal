import React from 'react';
import { Navigate } from 'react-router-dom';
import { isAuthenticated, getRole } from '../../services/auth';

export default function ProtectedRoute({ requiredRole, children }) {
  // Check if user is authenticated
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }

  // Get role from localStorage (set during login)
  const userRole = getRole();

  // Validate role
  if (!userRole) {
    // No role found - authentication incomplete
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('role');
    return <Navigate to="/login" replace />;
  }

  // Check if user has required role
  if (requiredRole && userRole !== requiredRole) {
    // User trying to access wrong dashboard
    // Redirect to correct dashboard based on role
    return <Navigate to={userRole === 'admin' ? '/admin/dashboard' : '/employee/dashboard'} replace />;
  }

  // User is authenticated and has correct role
  return children;
}