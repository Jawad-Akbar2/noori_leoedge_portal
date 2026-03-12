/**
 * components/auth/ProtectedRoute.jsx
 *
 * Guards routes by role.
 * Reads from AuthContext (not raw localStorage) so it reacts to state changes.
 * Shows nothing while the token validation is still in progress on mount.
 */
import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.js";

/** Returns the correct home dashboard path for any role */
function homePath(role) {
  if (role === "admin" || role === "superadmin") return "/admin/dashboard";
  if (role === "hybrid")                         return "/hybrid/dashboard";
  return "/employee/dashboard";
}

export default function ProtectedRoute({ requiredRole, children }) {
  const { user, role, loading } = useAuth();

  // Wait for AuthContext to finish validating the stored token
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Not authenticated → login
  if (!user || !role) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole) {
    const allowedRoles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];

    if (!allowedRoles.includes(role)) {
      // Redirect to the user's own home instead of hardcoding /employee/dashboard
      return <Navigate to={homePath(role)} replace />;
    }
  }

  return children;
}