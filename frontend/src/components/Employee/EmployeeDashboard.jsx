import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';

export default function EmployeeDashboard() {
  const [showEarnings, setShowEarnings] = useState(true);
  const [currentEarnings, setCurrentEarnings] = useState(0);
  const [stats, setStats] = useState({
    daysWorked: 0,
    otHours: 0,
    totalDeductions: 0,
    nextPayDate: ''
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const token = localStorage.getItem('token');
      const user = JSON.parse(localStorage.getItem('user'));

      const currentDate = new Date();
      let fromDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 18);
      if (currentDate.getDate() < 18) {
        fromDate.setMonth(fromDate.getMonth() - 1);
      }

      const response = await axios.get(
        `/api/payroll/employee/${user.id}`,
        {
          params: {
            fromDate: fromDate.toISOString().split('T')[0],
            toDate: currentDate.toISOString().split('T')[0]
          },
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      setCurrentEarnings(response.data.totals.netPayable);
      setStats({
        daysWorked: response.data.dailyBreakdown.filter(d => d.hoursPerDay > 0).length,
        otHours: response.data.dailyBreakdown.reduce((sum, d) => sum + (d.otAmount ? 1 : 0), 0),
        totalDeductions: response.data.totals.deductionTotal,
        nextPayDate: '1st of next month'
      });

      setLoading(false);
    } catch (error) {
      toast.error('Failed to load dashboard data');
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 overflow-auto">
      {/* Header */}
      <header className="bg-white shadow sticky top-0 z-30">
        <div className="flex items-center justify-between p-4 md:p-6">
          <h1 className="text-2xl font-bold text-gray-800">My Dashboard</h1>
          <div className="w-10 h-10 bg-blue-500 rounded-full"></div>
        </div>
      </header>

      {/* Dashboard Content */}
      <main className="p-4 md:p-6">
        {loading ? (
          <div className="text-center py-12">Loading...</div>
        ) : (
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-lg shadow-lg p-8">
              <div className="flex justify-between items-start mb-8">
                <div>
                  <p className="text-blue-100 mb-2">Current Earning (This Month)</p>
                  <h2 className="text-4xl font-bold">
                    {showEarnings ? `PKR ${currentEarnings.toFixed(2)}` : '★★★★★'}
                  </h2>
                </div>
                <button
                  onClick={() => setShowEarnings(!showEarnings)}
                  className="p-3 bg-blue-500 rounded-lg hover:bg-blue-600 transition"
                >
                  {showEarnings ? <EyeOff size={24} /> : <Eye size={24} />}
                </button>
              </div>
              <p className="text-blue-100">Next Payout: {stats.nextPayDate}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white rounded-lg shadow p-6">
                <p className="text-gray-600 text-sm mb-2">Days Worked</p>
                <p className="text-3xl font-bold text-gray-800">{stats.daysWorked}</p>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <p className="text-gray-600 text-sm mb-2">OT Hours</p>
                <p className="text-3xl font-bold text-gray-800">{stats.otHours}</p>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <p className="text-gray-600 text-sm mb-2">Total Deductions</p>
                <p className="text-3xl font-bold text-red-600">PKR {stats.totalDeductions.toFixed(2)}</p>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Quick Actions</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button className="p-4 border border-gray-300 rounded-lg hover:bg-gray-50 transition text-left">
                  <p className="font-medium text-gray-800">View Attendance</p>
                  <p className="text-sm text-gray-600">Check your records</p>
                </button>
                <button className="p-4 border border-gray-300 rounded-lg hover:bg-gray-50 transition text-left">
                  <p className="font-medium text-gray-800">Submit Request</p>
                  <p className="text-sm text-gray-600">Leave or Correction</p>
                </button>
                <button className="p-4 border border-gray-300 rounded-lg hover:bg-gray-50 transition text-left">
                  <p className="font-medium text-gray-800">View Salary Details</p>
                  <p className="text-sm text-gray-600">Detailed breakdown</p>
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}