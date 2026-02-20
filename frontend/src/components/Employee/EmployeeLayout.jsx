import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import EmployeeSidebar from './EmployeeSidebar';
import Header from '../Common/Header';

export default function EmployeeLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  React.useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleMenuClick = () => {
    if (isMobile) {
      setSidebarOpen(!sidebarOpen);
    } else {
      setSidebarOpen(!sidebarOpen);
    }
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {/* PERSISTENT DRAWER - Never unmounted on route change */}
      <EmployeeSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Overlay for mobile */}
      {isMobile && sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-20 md:hidden"
          onClick={() => setSidebarOpen(false)}
        ></div>
      )}

      {/* Main content area - Changes when routing, but drawer stays mounted */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header - Also persistent */}
        <Header onMenuClick={handleMenuClick} />

        {/* Page content area - This changes on route navigation */}
        <div className="flex-1 overflow-auto">
          {/* Outlet renders the current page component */}
          <Outlet />
        </div>
      </div>
    </div>
  );
}