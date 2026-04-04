import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Clock,
  DollarSign,
  FileText,
  User,
  Bell,
  ClipboardList,
  Users,
  BarChart3,
  LogOut,
  Settings,
  HelpCircle,
  ChevronLeft,
  Menu,
  Shield,
  Briefcase
} from 'lucide-react';
import { logout } from '../../services/auth';
import toast from 'react-hot-toast';

// ─── Navigation Configuration ──────────────────────────────────────────────

const NAV_CONFIG = {
  employee: {
    role: 'Employee',
    icon: Briefcase,
    color: 'blue',
    sections: [
      {
        title: 'MAIN MENU',
        items: [
          { path: '/employee/dashboard', label: 'Dashboard', icon: LayoutDashboard },
          { path: '/employee/attendance', label: 'My Attendance', icon: Clock },
          { path: '/employee/salary', label: 'My Salary', icon: DollarSign },
          { path: '/employee/requests', label: 'My Requests', icon: FileText },
        ]
      },
      {
        title: 'PERSONAL',
        items: [
          { path: '/employee/profile', label: 'My Profile', icon: User },
        ]
      }
    ]
  },
  admin: {
    role: 'Administrator',
    icon: Shield,
    color: 'purple',
    sections: [
      {
        title: 'MANAGEMENT',
        items: [
          { path: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
          { path: '/admin/employees', label: 'Employees', icon: Users },
          { path: '/admin/attendance', label: 'Attendance', icon: Clock },
          { path: '/admin/payroll', label: 'Payroll', icon: BarChart3 },
        ]
      },
      {
        title: 'COMMUNICATION',
        items: [
          { path: '/admin/notifications', label: 'Notifications', icon: Bell },
        ]
      },
      {
        title: 'PERSONAL',
        items: [
          { path: '/admin/profile', label: 'My Profile', icon: User },
        ]
      }
    ]
  },
  hybrid: {
    role: 'Hybrid User',
    icon: Users,
    color: 'purple',
    sections: [
      {
        title: 'MY WORKSPACE',
        items: [
          { path: '/hybrid/dashboard', label: 'Dashboard', icon: LayoutDashboard },
          { path: '/hybrid/attendance', label: 'My Attendance', icon: Clock },
          { path: '/hybrid/salary', label: 'My Salary', icon: DollarSign },
          { path: '/hybrid/requests', label: 'My Requests', icon: FileText },
          { path: '/hybrid/profile', label: 'My Profile', icon: User },
        ]
      },
      {
        title: 'ADMIN ACCESS',
        items: [
          { path: '/hybrid/manage-attendance', label: 'Manage Attendance', icon: ClipboardList },
          { path: '/hybrid/notifications', label: 'Notifications', icon: Bell },
        ]
      }
    ]
  }
};

// ─── Helper Functions ──────────────────────────────────────────────────────

const getColorClasses = (color, isActive = false) => {
  const colors = {
    blue: {
      gradient: 'from-blue-600 to-blue-700',
      bg: 'bg-blue-600',
      bgLight: 'bg-blue-50',
      text: 'text-blue-600',
      textLight: 'text-blue-400',
      ring: 'ring-blue-500',
      hover: 'hover:bg-blue-50',
      active: 'bg-blue-600 text-white shadow-lg shadow-blue-500/25',
      inactive: 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
    },
    purple: {
      gradient: 'from-purple-600 to-purple-700',
      bg: 'bg-purple-600',
      bgLight: 'bg-purple-50',
      text: 'text-purple-600',
      textLight: 'text-purple-400',
      ring: 'ring-purple-500',
      hover: 'hover:bg-purple-50',
      active: 'bg-purple-600 text-white shadow-lg shadow-purple-500/25',
      inactive: 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
    }
  };
  return colors[color] || colors.blue;
};

// ─── Sub-components ────────────────────────────────────────────────────────

const NavItem = ({ item, color, isCollapsed, onClick }) => {
  const colorClasses = getColorClasses(color);

  return (
    <NavLink
      to={item.path}
      onClick={onClick}
      className={({ isActive }) => `
        group relative flex items-center gap-3 px-3 py-2.5 rounded-xl
        transition-all duration-200 ease-in-out
        ${isCollapsed ? 'justify-center' : ''}
        ${isActive 
          ? colorClasses.active 
          : `${colorClasses.inactive} hover:${colorClasses.hover}`
        }
      `}
      title={isCollapsed ? item.label : undefined}
    >
      {({ isActive }) => (
        <>
          <item.icon 
            size={20} 
            className={`
              flex-shrink-0 transition-all duration-200
              ${isActive ? 'text-white' : 'text-gray-400 group-hover:text-gray-600'}
              ${isCollapsed ? 'mx-auto' : ''}
            `}
          />
          
          {!isCollapsed && (
            <span className="text-sm font-medium flex-1">{item.label}</span>
          )}

          {/* Active indicator dot for collapsed mode */}
          {isCollapsed && isActive && (
            <span className="absolute -right-1 w-1 h-6 rounded-full bg-white opacity-75" />
          )}
        </>
      )}
    </NavLink>
  );
};

const SectionHeader = ({ title, isCollapsed }) => {
  if (isCollapsed) return null;
  
  return (
    <div className="px-3 pt-6 pb-2">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
        {title}
      </p>
    </div>
  );
};

const UserProfile = ({ user, color, isCollapsed, onLogout }) => {
  const colorClasses = getColorClasses(color);
  const [showLogoutConfirm, setShowLogoutConfirm] = React.useState(false);

  const handleLogout = () => {
    logout();
    toast.success('Logged out successfully');
    onLogout();
  };

  return (
    <div className="border-t border-gray-200 py-4 mt-4">
      <div className="px-3">
        <div className={`
          flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r ${colorClasses.gradient}
          transition-all duration-200
          ${isCollapsed ? 'justify-center' : ''}
        `}>
          <div className="flex-shrink-0">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
              <User size={20} className="text-white" />
            </div>
          </div>
          
          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-semibold truncate">
                {user?.name || 'Guest User'}
              </p>
              <p className="text-white/70 text-xs truncate">
                {user?.email || 'user@example.com'}
              </p>
            </div>
          )}
        </div>

        {!isCollapsed && (
          <button
            onClick={() => setShowLogoutConfirm(true)}
            className="mt-3 flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl
                       text-red-600 bg-red-50 hover:bg-red-100 transition-all duration-200
                       text-sm font-medium"
          >
            <LogOut size={18} />
            <span>Logout</span>
          </button>
        )}

        {isCollapsed && (
          <button
            onClick={() => setShowLogoutConfirm(true)}
            className="mt-3 flex items-center justify-center w-full p-2.5 rounded-xl
                       text-red-600 bg-red-50 hover:bg-red-100 transition-all duration-200"
            title="Logout"
          >
            <LogOut size={18} />
          </button>
        )}
      </div>

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-sm mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Confirm Logout</h3>
            <p className="text-gray-600 mb-6">Are you sure you want to logout?</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 px-4 py-2 rounded-lg border border-gray-300 text-gray-700
                         hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleLogout}
                className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white
                         hover:bg-red-700 transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Main Sidebar Component ────────────────────────────────────────────────

export default function Sidebar({ 
  userRole = 'employee', // 'employee', 'admin', 'hybrid'
  user = null,
  isOpen = true,
  isMobile = false,
  onToggle,
  onClose,
  onLogout
}) {
  const navigate = useNavigate();
  const config = NAV_CONFIG[userRole] || NAV_CONFIG.employee;
  const colorClasses = getColorClasses(config.color);
  const [isCollapsed, setIsCollapsed] = React.useState(!isOpen && !isMobile);

  // Handle sidebar state
  React.useEffect(() => {
    if (!isMobile) {
      setIsCollapsed(!isOpen);
    }
  }, [isOpen, isMobile]);

  const handleNavClick = () => {
    if (isMobile && onClose) {
      onClose();
    }
  };

  const handleToggle = () => {
    if (isMobile && onClose) {
      onClose();
    } else if (onToggle) {
      onToggle();
    } else {
      setIsCollapsed(!isCollapsed);
    }
  };

  const handleLogout = () => {
    if (onLogout) {
      onLogout();
    } else {
      navigate('/', { replace: true });
      window.location.reload();
    }
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobile && isOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-20"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          ${isCollapsed ? 'w-20' : 'w-72'}
          bg-white shadow-2xl flex flex-col transition-all duration-300 ease-in-out
          ${isMobile ? 'fixed left-0 top-0 h-screen z-30' : 'relative h-screen'}
          ${isMobile && !isOpen ? '-translate-x-full' : 'translate-x-0'}
        `}
      >
        {/* Header */}
        <div className={`
          flex items-center justify-between p-4 border-b border-gray-200
          ${isCollapsed ? 'flex-col gap-3' : ''}
        `}>
          <div className={`flex items-center gap-3 ${isCollapsed ? 'flex-col' : ''}`}>
            <div className={`
              w-10 h-10 rounded-xl bg-gradient-to-r ${colorClasses.gradient}
              flex items-center justify-center shadow-lg
            `}>
              <config.icon size={22} className="text-white" />
            </div>
            
            {!isCollapsed && (
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
                  HR Portal
                </h1>
                <p className={`text-xs ${colorClasses.text} font-medium`}>
                  {config.role}
                </p>
              </div>
            )}
          </div>

          {/* Toggle Button */}
          {!isMobile && (
            <button
              onClick={handleToggle}
              className={`
                p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100
                transition-all duration-200
                ${isCollapsed ? 'mx-auto' : ''}
              `}
            >
              <ChevronLeft 
                size={20} 
                className={`transition-transform duration-300 ${isCollapsed ? 'rotate-180' : ''}`}
              />
            </button>
          )}

          {/* Mobile Close Button */}
          {isMobile && isOpen && (
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
            >
              <Menu size={20} />
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4">
          {config.sections.map((section, idx) => (
            <div key={idx}>
              <SectionHeader title={section.title} isCollapsed={isCollapsed} />
              <div className="px-3 space-y-1">
                {section.items.map((item) => (
                  <NavItem
                    key={item.path}
                    item={item}
                    color={config.color}
                    isCollapsed={isCollapsed}
                    onClick={handleNavClick}
                  />
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer - User Profile & Logout */}
        <UserProfile
          user={user}
          color={config.color}
          isCollapsed={isCollapsed}
          onLogout={handleLogout}
        />
      </aside>
    </>
  );
}