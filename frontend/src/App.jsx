import React, { useState } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { Toaster } from "react-hot-toast";

// ── Providers ──────────────────────────────────────────────────────────────
import { AuthProvider, useAuth } from "./context/AuthContext.js";
import { NotificationProvider } from "./context/NotificationContext.js";

// ── Auth ───────────────────────────────────────────────────────────────────
import Login from "./components/Auth/Login";
import EmployeeOnboarding from "./components/Auth/EmployeeOnboarding";
import ForgotPassword from "./components/Auth/ForgotPassword";
import ResetPassword from "./components/Auth/ResetPassword";
import ProtectedRoute from "./components/Auth/ProtectedRoute";

// ── Shared layout ──────────────────────────────────────────────────────────
import Header from "./components/Common/Header";
import MyProfile from "./components/Common/MyProfile.jsx";

// ── Admin ──────────────────────────────────────────────────────────────────
import AdminDashboard from "./components/Admin/AdminDashboard";
import ManageEmployees from "./components/Admin/ManageEmployees";
import ManualAttendance from "./components/Admin/ManualAttendance";
import PayrollReports from "./components/Admin/PayrollReports";
import NotificationCenter from "./components/Admin/NotificationCenter";

// ── Employee ───────────────────────────────────────────────────────────────
import EmployeeDashboard from "./components/Employee/EmployeeDashboard";
import AttendanceHistory from "./components/Employee/AttendanceHistory";
import MySalary from "./components/Employee/MySalary";
import MyRequests from "./components/Employee/MyRequests";

// ── Hybrid ─────────────────────────────────────────────────────────────────
import Sidebar from "./components/Common/Sidebar.jsx";
import { useWindowSize } from "./hooks/useWindowSize.js";
import ProfileGate from "./components/Common/ProfileGate";
import NotFound from "./components/Common/404.jsx";

// ─── Shared layout wrapper ────────────────────────────────────────────────────

function AppLayout({ SidebarComponent, children }) {
  const { isMobile } = useWindowSize();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user } = useAuth(); // Move useAuth inside component

  return (
    <div className="flex h-screen bg-gray-100">
      <SidebarComponent 
        isOpen={sidebarOpen} 
        isMobile={isMobile}
        onClose={() => setSidebarOpen(false)}
        onToggle={() => setSidebarOpen(v => !v)}
        user={user}
      />

      {isMobile && sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-20"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header onMenuClick={() => setSidebarOpen((v) => !v)} />
        <div className="flex-1 overflow-auto">{children}</div>
      </div>
    </div>
  );
}

// ─── Admin layout ─────────────────────────────────────────────────────────────

function AdminLayoutWrapper() {
  return (
    <AppLayout SidebarComponent={(props) => <Sidebar {...props} userRole="admin" />}>
      <ProfileGate profilePath="/admin/profile">
        <Routes>
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="employees" element={<ManageEmployees />} />
          <Route path="attendance" element={<ManualAttendance />} />
          <Route path="payroll" element={<PayrollReports />} />
          <Route path="notifications" element={<NotificationCenter />} />
          <Route path="profile" element={<MyProfile />} />
          <Route path="/" element={<Navigate to="dashboard" replace />} />
          <Route path="*" element={<Navigate to="dashboard" replace />} />
        </Routes>
      </ProfileGate>
    </AppLayout>
  );
}

// ─── Employee layout ──────────────────────────────────────────────────────────

function EmployeeLayoutWrapper() {
  return (
    <AppLayout SidebarComponent={(props) => <Sidebar {...props} userRole="employee" />}>
      <ProfileGate profilePath="/employee/profile">
        <Routes>
          <Route path="dashboard" element={<EmployeeDashboard />} />
          <Route path="attendance" element={<AttendanceHistory />} />
          <Route path="salary" element={<MySalary />} />
          <Route path="requests" element={<MyRequests />} />
          <Route path="profile" element={<MyProfile />} />
          <Route path="/" element={<Navigate to="dashboard" replace />} />
          <Route path="*" element={<Navigate to="dashboard" replace />} />
        </Routes>
      </ProfileGate>
    </AppLayout>
  );
}

// ─── Hybrid layout ────────────────────────────────────────────────────────────

function HybridLayoutWrapper() {
  return (
    <AppLayout SidebarComponent={(props) => <Sidebar {...props} userRole="hybrid" />}>
      <ProfileGate profilePath="/hybrid/profile">
        <Routes>
          <Route path="dashboard" element={<EmployeeDashboard />} />
          <Route path="attendance" element={<AttendanceHistory />} />
          <Route path="salary" element={<MySalary />} />
          <Route path="requests" element={<MyRequests />} />
          <Route path="profile" element={<MyProfile />} />
          <Route path="manage-attendance" element={<ManualAttendance />} />
          <Route path="notifications" element={<NotificationCenter />} />
          <Route path="/" element={<Navigate to="dashboard" replace />} />
          <Route path="*" element={<Navigate to="dashboard" replace />} />
        </Routes>
      </ProfileGate>
    </AppLayout>
  );
}

// ─── Root redirect ────────────────────────────────────────────────────────────

function RootRedirect() {
  const { user, role, loading } = useAuth(); // Move useAuth inside component
  
  if (loading) return null;
  if (user && role) {
    if (role === "admin" || role === "superadmin" || role === "owner")
      return <Navigate to="/admin/dashboard" replace />;
    if (role === "hybrid") return <Navigate to="/hybrid/dashboard" replace />;
    return <Navigate to="/employee/dashboard" replace />;
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
              style: { borderRadius: "8px", fontSize: "14px" },
              success: { iconTheme: { primary: "#2563eb", secondary: "#fff" } },
              error: { iconTheme: { primary: "#dc2626", secondary: "#fff" } },
            }}
          />

          <Routes>
            {/* Public */}
            <Route path="/login" element={<Login />} />
            <Route path="/join/:token" element={<EmployeeOnboarding />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />

            {/* Admin — superadmin + admin */}
            <Route
              path="/admin/*"
              element={
                <ProtectedRoute requiredRole={["admin", "superadmin", "owner"]}>
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
            <Route path="/" element={<RootRedirect />} />
            <Route path="*" element={<Navigate to="/" replace />} />

             <Route path="*" element={<NotFound />} />
          </Routes>
        </Router>
      </NotificationProvider>
    </AuthProvider>
  );
}