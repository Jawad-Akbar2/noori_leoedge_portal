/**
 * App.jsx
 *
 * - Wraps the entire tree in <AuthProvider> + <NotificationProvider>
 *   so useAuth() / useNotification() work everywhere.
 * - Root "/" redirect reads from AuthContext (not raw localStorage).
 * - Layout wrappers use useWindowSize() hook instead of duplicating
 *   resize logic.
 */

import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// ── Providers ──────────────────────────────────────────────────────────────
import { AuthProvider, useAuth }             from './context/AuthContext.js';
import { NotificationProvider }              from './context/NotificationContext.js';

// ── Auth ───────────────────────────────────────────────────────────────────
import Login               from './components/Auth/Login';
import EmployeeOnboarding  from './components/Auth/EmployeeOnboarding';
import ProtectedRoute      from './components/Auth/ProtectedRoute';

// ── Shared layout ──────────────────────────────────────────────────────────
import Header from './components/Common/Header';

// ── Admin ──────────────────────────────────────────────────────────────────
import AdminSidebar        from './components/Admin/Sidebar';
import AdminDashboard      from './components/Admin/AdminDashboard';
import ManageEmployees     from './components/Admin/ManageEmployees';
import ManualAttendance    from './components/Admin/ManualAttendance';
import PayrollReports      from './components/Admin/PayrollReports';
import NotificationCenter  from './components/Admin/NotificationCenter';

// ── Employee ───────────────────────────────────────────────────────────────
import EmployeeSidebar     from './components/Employee/EmployeeSidebar';
import EmployeeDashboard   from './components/Employee/EmployeeDashboard';
import AttendanceHistory   from './components/Employee/AttendanceHistory';
import MySalary            from './components/Employee/MySalary';
import MyRequests          from './components/Employee/MyRequests';
import Profile             from './components/Employee/Profile';

import { useWindowSize }   from './hooks/useWindowSize.js';

// ─── Shared layout wrapper ────────────────────────────────────────────────────

function AppLayout({ Sidebar, children }) {
  const { isMobile } = useWindowSize();
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile);

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar isOpen={sidebarOpen} isMobile={isMobile} />

      {/* Mobile overlay */}
      {isMobile && sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-20"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header onMenuClick={() => setSidebarOpen(v => !v)} />
        <div className="flex-1 overflow-auto">
          {children}
        </div>
      </div>
    </div>
  );
}

// ─── Admin layout ─────────────────────────────────────────────────────────────

function AdminLayoutWrapper() {
  return (
    <AppLayout Sidebar={AdminSidebar}>
      <Routes>
        <Route path="dashboard"     element={<AdminDashboard />} />
        <Route path="employees"     element={<ManageEmployees />} />
        <Route path="attendance"    element={<ManualAttendance />} />
        <Route path="payroll"       element={<PayrollReports />} />
        <Route path="notifications" element={<NotificationCenter />} />
        <Route path="/"             element={<Navigate to="dashboard" replace />} />
        <Route path="*"             element={<Navigate to="dashboard" replace />} />
      </Routes>
    </AppLayout>
  );
}

// ─── Employee layout ──────────────────────────────────────────────────────────

function EmployeeLayoutWrapper() {
  return (
    <AppLayout Sidebar={EmployeeSidebar}>
      <Routes>
        <Route path="dashboard"  element={<EmployeeDashboard />} />
        <Route path="attendance" element={<AttendanceHistory />} />
        <Route path="salary"     element={<MySalary />} />
        <Route path="requests"   element={<MyRequests />} />
        <Route path="profile"    element={<Profile />} />
        <Route path="/"          element={<Navigate to="dashboard" replace />} />
        <Route path="*"          element={<Navigate to="dashboard" replace />} />
      </Routes>
    </AppLayout>
  );
}

// ─── Root redirect (reads from AuthContext, not raw localStorage) ─────────────

function RootRedirect() {
  const { user, role, loading } = useAuth();

  if (loading) return null;   // AuthProvider is still validating token

  if (user && role) {
    return <Navigate to={role === 'admin' || role === 'superadmin' ? '/admin/dashboard' : '/employee/dashboard'} replace />;
  }

  return <Navigate to="/login" replace />;
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <Router>
          <Routes>
            {/* Public */}
            <Route path="/login"        element={<Login />} />
            <Route path="/join/:token"  element={<EmployeeOnboarding />} />

            {/* Admin — protected */}
            <Route
              path="/admin/*"
              element={
                <ProtectedRoute requiredRole={["admin", "superadmin"]} >
                  <AdminLayoutWrapper />
                </ProtectedRoute>
              }
            />

            {/* Employee — protected */}
            <Route
              path="/employee/*"
              element={
                <ProtectedRoute requiredRole="employee">
                  <EmployeeLayoutWrapper />
                </ProtectedRoute>
              }
            />

            {/* Root + catch-all */}
            <Route path="/"  element={<RootRedirect />} />
            <Route path="*"  element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
      </NotificationProvider>
    </AuthProvider>
  );
}