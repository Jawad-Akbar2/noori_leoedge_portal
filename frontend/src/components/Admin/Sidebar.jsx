import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Clock,
  BarChart3,
  Bell,
  LogOut
} from 'lucide-react';
import { logout } from '../../services/auth';
import toast from 'react-hot-toast';

const menuItems = [
  { icon: LayoutDashboard, label: 'Dashboard',     path: '/admin/dashboard' },
  { icon: Users,           label: 'Employees',     path: '/admin/employees' },
  { icon: Clock,           label: 'Attendance',    path: '/admin/attendance' },
  { icon: BarChart3,       label: 'Report',       path: '/admin/payroll' },
  { icon: Bell,            label: 'Notifications', path: '/admin/notifications' }
];

export default function AdminSidebar({ isOpen, isMobile, onClose }) {
  const location = useLocation();
  const navigate  = useNavigate();

  const isActive = (path) => location.pathname === path;

  const handleLogout = () => {
    logout();
    toast.success('Logged out successfully');
    navigate('/login');
  };

  // FIX #1: on mobile, clicking a nav link should close the sidebar
  const handleNavClick = () => {
    if (isMobile && onClose) onClose();
  };

  return (
    <>
      {/* FIX #2: mobile backdrop — was noted as "handled in parent" but never was */}
      {isMobile && isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-20"
          onClick={onClose}
        />
      )}

      <div className={`
        ${isOpen ? 'w-64' : isMobile ? 'w-0 overflow-hidden' : 'w-20'}
        bg-gray-900 text-white transition-all duration-300 flex flex-col
        ${isMobile ? 'fixed' : 'relative'} h-screen z-30
      `}>
        {/* Logo */}
        <div className="p-6 border-b border-gray-800 flex-shrink-0">
          <h1 className={`font-bold text-blue-400 transition-all ${
            isOpen ? 'text-2xl' : 'text-center text-xl'
          }`}>
            {isOpen ? 'HR Portal' : 'HR'}
          </h1>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {menuItems.map(item => (
            <Link
              key={item.path}
              to={item.path}
              onClick={handleNavClick}
              className={`flex items-center gap-4 px-4 py-3 rounded-lg transition ${
                isActive(item.path)
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:bg-gray-800'
              }`}
            >
              <item.icon size={20} className="flex-shrink-0" />
              {isOpen && <span className="text-sm font-medium">{item.label}</span>}
            </Link>
          ))}
        </nav>

        {/* Logout */}
        <div className="p-4 border-t border-gray-800 flex-shrink-0">
          <button
            onClick={handleLogout}
            className="flex items-center gap-4 w-full px-4 py-3 rounded-lg text-gray-300 hover:bg-red-600 hover:text-white transition"
          >
            <LogOut size={20} className="flex-shrink-0" />
            {isOpen && <span className="text-sm font-medium">Logout</span>}
          </button>
        </div>
      </div>
    </>
  );
}