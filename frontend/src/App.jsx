import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { isAuthenticated, getRole } from './services/auth';

// Auth Pages
import Login from './components/Auth/Login';
import EmployeeOnboarding from './components/Auth/EmployeeOnboarding';
import ProtectedRoute from './components/Auth/ProtectedRoute';

// Layouts (ALREADY EXIST, just use them differently)
import AdminDashboard from './components/Admin/AdminDashboard';
import AdminSidebar from './components/Admin/Sidebar';
import Header from './components/Common/Header';

import EmployeeDashboard from './components/Employee/EmployeeDashboard';
import EmployeeSidebar from './components/Employee/EmployeeSidebar';

// Admin Pages
import ManageEmployees from './components/Admin/ManageEmployees';
import ManualAttendance from './components/Admin/ManualAttendance';
import PayrollReports from './components/Admin/PayrollReports';
import NotificationCenter from './components/Admin/NotificationCenter';

// Employee Pages
import AttendanceHistory from './components/Employee/AttendanceHistory';
import MySalary from './components/Employee/MySalary';
import MyRequests from './components/Employee/MyRequests';
import Profile from './components/Employee/Profile';

// NEW: Admin Layout Wrapper (inline, reuses existing components)
function AdminLayoutWrapper() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  React.useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleMenuClick = () => {
    setSidebarOpen(!sidebarOpen);
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {/* PERSISTENT SIDEBAR */}
      <AdminSidebar isOpen={sidebarOpen} isMobile={isMobile} />

      {/* Overlay for mobile */}
      {isMobile && sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-20"
          onClick={() => setSidebarOpen(false)}
        ></div>
      )}

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header onMenuClick={handleMenuClick} />
        <div className="flex-1 overflow-auto">
          <Routes>
            <Route path="/dashboard" element={<AdminDashboard />} />
            <Route path="/employees" element={<ManageEmployees />} />
            <Route path="/attendance" element={<ManualAttendance />} />
            <Route path="/payroll" element={<PayrollReports />} />
            <Route path="/notifications" element={<NotificationCenter />} />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}

// NEW: Employee Layout Wrapper (inline, reuses existing components)
function EmployeeLayoutWrapper() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  React.useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleMenuClick = () => {
    setSidebarOpen(!sidebarOpen);
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {/* PERSISTENT SIDEBAR */}
      <EmployeeSidebar isOpen={sidebarOpen} isMobile={isMobile} />

      {/* Overlay for mobile */}
      {isMobile && sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-20"
          onClick={() => setSidebarOpen(false)}
        ></div>
      )}

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header onMenuClick={handleMenuClick} />
        <div className="flex-1 overflow-auto">
          <Routes>
            <Route path="/dashboard" element={<EmployeeDashboard />} />
            <Route path="/attendance" element={<AttendanceHistory />} />
            <Route path="/salary" element={<MySalary />} />
            <Route path="/requests" element={<MyRequests />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(false);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600 font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/join/:token" element={<EmployeeOnboarding />} />

        {/* Admin Routes - Nested with persistent layout */}
        <Route
          path="/admin/*"
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminLayoutWrapper />
            </ProtectedRoute>
          }
        />

        {/* Employee Routes - Nested with persistent layout */}
        <Route
          path="/employee/*"
          element={
            <ProtectedRoute requiredRole="employee">
              <EmployeeLayoutWrapper />
            </ProtectedRoute>
          }
        />

        {/* Default redirect */}
        <Route
          path="/"
          element={
            isAuthenticated() ? (
              <Navigate to={getRole() === 'admin' ? '/admin/dashboard' : '/employee/dashboard'} replace />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        {/* Catch all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}