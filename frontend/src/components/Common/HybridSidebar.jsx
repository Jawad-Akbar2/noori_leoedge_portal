import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Clock,
  DollarSign,
  FileText,
  User,
  Bell,
  ClipboardList,
  ChevronRight,
} from 'lucide-react';

// ─── Nav definitions ──────────────────────────────────────────────────────────

const EMPLOYEE_NAV = [
  { path: '/hybrid/dashboard',  label: 'Dashboard',     icon: LayoutDashboard },
  { path: '/hybrid/attendance', label: 'My Attendance', icon: Clock           },
  { path: '/hybrid/salary',     label: 'My Salary',     icon: DollarSign      },
  { path: '/hybrid/requests',   label: 'My Requests',   icon: FileText        },
  { path: '/hybrid/profile',    label: 'My Profile',    icon: User            },
];

const ADMIN_NAV = [
  { path: '/hybrid/manage-attendance', label: 'Manage Attendance', icon: ClipboardList },
  { path: '/hybrid/notifications',     label: 'Notifications',     icon: Bell          },
];

// ─── NavItem ──────────────────────────────────────────────────────────────────

function NavItem({ path, label, icon: Icon }) {
  return (
    <NavLink
      to={path}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group ${
          isActive
            ? 'bg-purple-600 text-white shadow-sm'
            : 'text-gray-300 hover:bg-white/10 hover:text-white'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <Icon
            size={18}
            className={isActive ? 'text-white' : 'text-gray-400 group-hover:text-white'}
          />
          <span className="flex-1">{label}</span>
          {isActive && <ChevronRight size={14} className="text-purple-200" />}
        </>
      )}
    </NavLink>
  );
}

function SectionLabel({ children }) {
  return (
    <p className="px-3 pt-5 pb-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-500 select-none">
      {children}
    </p>
  );
}

// ─── HybridSidebar ────────────────────────────────────────────────────────────

export default function HybridSidebar({ isOpen, isMobile }) {
  const sidebarClass = isMobile
    ? `fixed inset-y-0 left-0 z-30 w-64 transform transition-transform duration-300 ease-in-out bg-gray-900 flex flex-col ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      }`
    : `relative flex-shrink-0 transition-all duration-300 bg-gray-900 flex flex-col ${
        isOpen ? 'w-64' : 'w-0 overflow-hidden'
      }`;

  return (
    <div className={sidebarClass}>

      {/* Brand */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-white/10 flex-shrink-0">
        <div className="w-8 h-8 rounded-lg bg-purple-600 flex items-center justify-center flex-shrink-0">
          <span className="text-white text-xs font-bold">H</span>
        </div>
        <div className="min-w-0">
          <p className="text-white text-sm font-bold truncate">Hybrid Portal</p>
          <p className="text-purple-300 text-xs">Employee + Admin</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">

        <SectionLabel>My Workspace</SectionLabel>
        {EMPLOYEE_NAV.map((item) => (
          <NavItem key={item.path} {...item} />
        ))}

        <div className="my-3 border-t border-white/10" />

        <SectionLabel>Admin Access</SectionLabel>
        {ADMIN_NAV.map((item) => (
          <NavItem key={item.path} {...item} />
        ))}

      </nav>

      {/* Role badge */}
      <div className="px-4 py-4 border-t border-white/10 flex-shrink-0">
        <div className="flex items-center gap-2 px-3 py-2 bg-purple-900/50 rounded-lg">
          <div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse flex-shrink-0" />
          <span className="text-xs text-purple-300 font-medium">Hybrid Role</span>
        </div>
      </div>

    </div>
  );
}