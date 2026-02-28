import React, { useState, useEffect } from 'react'; 
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Users, Clock, DollarSign, Menu, X } from 'lucide-react';
import Sidebar from './Sidebar';
import DashboardStats from './DashboardStats';

export default function AdminDashboard() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/employees/', {
        headers: { Authorization: `Bearer ${token}` }
      });

      const employees = response.data.employees || [];

      // ✅ Only employees (exclude admins, managers, etc.)
      const onlyEmployees = employees.filter(e => e.role === 'employee');

      const totalEmployees = onlyEmployees.length;
      const activeEmployees = onlyEmployees.filter(e => e.status === 'Active').length;

      setStats({
        totalEmployees,
        presentToday: activeEmployees,
        livePayroll: 0
      });
      setLoading(false);
    } catch (error) {
      console.error('Error fetching stats:', error);
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      {/* ❌ REMOVED: Sidebar is already rendered in AdminLayout */}

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        {/* Header */}
        <header className="bg-white shadow sticky top-0 z-30">
          <div className="flex items-center justify-between p-4 md:p-6">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="md:hidden text-gray-600"
            >
              {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
            <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
            <div className="w-10 h-10 bg-blue-500 rounded-full"></div>
          </div>
        </header>

        {/* Dashboard Content */}
        <main className="p-4 md:p-6">
          {loading || !stats ? (
            <div className="text-center py-12">
              <p>{loading ? "Loading..." : "Failed to load stats. Please refresh."}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <DashboardStats
                title="Total Employees"
                value={stats.totalEmployees}
                icon={<Users size={32} />}
                color="bg-blue-500"
                onClick={() => navigate('/admin/employees')}
              />

              <DashboardStats
                title="Attendance Today"
                value={`${stats.presentToday} Present`}
                icon={<Clock size={32} />}
                color="bg-green-500"
                onClick={() => navigate('/admin/attendance')}
              />

              <DashboardStats
                title="Live Payroll report"
                value="PKR 12,450.00"
                
                color="bg-purple-500"
                onClick={() => navigate('/admin/payroll')}
              />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}