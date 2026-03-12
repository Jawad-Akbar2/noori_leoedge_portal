import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

// ── Providers ──────────────────────────────────────────────────────────────
import { AuthProvider, useAuth }             from './context/AuthContext.js';
import { NotificationProvider }              from './context/NotificationContext.js';

// ── Auth ───────────────────────────────────────────────────────────────────
import Login               from './components/Auth/Login';
import EmployeeOnboarding  from './components/Auth/EmployeeOnboarding';
import ForgotPassword      from './components/Auth/ForgotPassword';
import ResetPassword       from './components/Auth/ResetPassword';
import ProtectedRoute      from './components/Auth/ProtectedRoute';

// ── Shared layout ──────────────────────────────────────────────────────────
import Header    from './components/Common/Header';
import MyProfile from './components/Common/MyProfile.jsx';

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

// ── Hybrid ─────────────────────────────────────────────────────────────────
// Only the sidebar is new — all page components are reused from admin/employee
import HybridSidebar       from './components/Common/HybridSidebar.jsx';

import { useWindowSize }   from './hooks/useWindowSize.js';

// ─── Shared layout wrapper ────────────────────────────────────────────────────

function AppLayout({ Sidebar, children }) {
  const { isMobile } = useWindowSize();
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile);

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar isOpen={sidebarOpen} isMobile={isMobile} />

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
        <Route path="profile"       element={<MyProfile />} />
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
        <Route path="profile"    element={<MyProfile />} />
        <Route path="/"          element={<Navigate to="dashboard" replace />} />
        <Route path="*"          element={<Navigate to="dashboard" replace />} />
      </Routes>
    </AppLayout>
  );
}

// ─── Hybrid layout ────────────────────────────────────────────────────────────
// Same employee experience + Manage Attendance + Notifications from admin.
// Zero new page components — everything is reused.

function HybridLayoutWrapper() {
  return (
    <AppLayout Sidebar={HybridSidebar}>
      <Routes>
        {/* Employee modules */}
        <Route path="dashboard"         element={<EmployeeDashboard />} />
        <Route path="attendance"        element={<AttendanceHistory />} />
        <Route path="salary"            element={<MySalary />} />
        <Route path="requests"          element={<MyRequests />} />
        <Route path="profile"           element={<MyProfile />} />

        {/* Extra admin modules */}
        <Route path="manage-attendance" element={<ManualAttendance />} />
        <Route path="notifications"     element={<NotificationCenter />} />

        <Route path="/"                 element={<Navigate to="dashboard" replace />} />
        <Route path="*"                 element={<Navigate to="dashboard" replace />} />
      </Routes>
    </AppLayout>
  );
}

// ─── Root redirect ────────────────────────────────────────────────────────────

function RootRedirect() {
  const { user, role, loading } = useAuth();
  if (loading) return null;
  if (user && role) {
    if (role === 'admin' || role === 'superadmin') return <Navigate to="/admin/dashboard"    replace />;
    if (role === 'hybrid')                         return <Navigate to="/hybrid/dashboard"   replace />;
    return                                                <Navigate to="/employee/dashboard" replace />;
  }
  return <Navigate to="/login" replace />;
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <Router>

          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: { borderRadius: '8px', fontSize: '14px' },
              success: { iconTheme: { primary: '#2563eb', secondary: '#fff' } },
              error:   { iconTheme: { primary: '#dc2626', secondary: '#fff' } },
            }}
          />

          <Routes>
            {/* Public */}
            <Route path="/login"           element={<Login />} />
            <Route path="/join/:token"     element={<EmployeeOnboarding />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password"  element={<ResetPassword />} />

            {/* Admin — superadmin + admin */}
            <Route
              path="/admin/*"
              element={
                <ProtectedRoute requiredRole={['admin', 'superadmin']}>
                  <AdminLayoutWrapper />
                </ProtectedRoute>
              }
            />

            {/* Employee */}
            <Route
              path="/employee/*"
              element={
                <ProtectedRoute requiredRole="employee">
                  <EmployeeLayoutWrapper />
                </ProtectedRoute>
              }
            />

            {/* Hybrid */}
            <Route
              path="/hybrid/*"
              element={
                <ProtectedRoute requiredRole="hybrid">
                  <HybridLayoutWrapper />
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