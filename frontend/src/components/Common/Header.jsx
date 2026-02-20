import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, User, Bell, Menu, X } from 'lucide-react';
import { logout, getUser } from '../../services/auth';
import toast from 'react-hot-toast';

export default function Header({ onMenuClick }) {
  const navigate = useNavigate();
  const user = getUser();
  const [showDropdown, setShowDropdown] = useState(false);

  const handleLogout = () => {
    logout();
    toast.success('Logged out successfully');
    navigate('/login');
  };

  return (
    <header className="bg-white shadow sticky top-0 z-40 border-b border-gray-200">
      <div className="flex items-center justify-between p-4 md:p-6">
        {/* Left: Menu Button */}
        <button
          onClick={onMenuClick}
          className="text-gray-600 hover:text-gray-800 transition"
        >
          <Menu size={24} />
        </button>

        {/* Center: Title */}
        <h1 className="text-lg md:text-xl font-bold text-gray-800 flex-1 text-center md:text-left ml-4 md:ml-0">
          NOORI
        </h1>

        {/* Right: User Menu */}
        <div className="flex items-center gap-4">
          {/* Notifications */}
          <button className="relative p-2 text-gray-600 hover:text-gray-800 rounded-lg hover:bg-gray-100 transition">
            <Bell size={20} />
          </button>

          {/* User Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-100 transition"
            >
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                {user?.firstName?.charAt(0)}{user?.lastName?.charAt(0)}
              </div>
              <span className="hidden md:inline text-sm font-medium text-gray-700">
                {user?.firstName}
              </span>
            </button>

            {/* Dropdown Menu */}
            {showDropdown && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg z-50 border border-gray-200">
                <div className="p-4 border-b border-gray-200">
                  <p className="font-semibold text-gray-800">
                    {user?.firstName} {user?.lastName}
                  </p>
                  <p className="text-sm text-gray-600">{user?.email}</p>
                </div>

                <button
                  onClick={() => {
                    const role = localStorage.getItem('role');
                    navigate(role === 'admin' ? '/admin/profile' : '/employee/profile');
                    setShowDropdown(false);
                  }}
                  className="w-full flex items-center gap-2 px-4 py-2 text-left text-gray-700 hover:bg-gray-50 transition text-sm border-b"
                >
                  <User size={18} />
                  My Profile
                </button>

                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-4 py-2 text-left text-red-600 hover:bg-red-50 transition text-sm"
                >
                  <LogOut size={18} />
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}