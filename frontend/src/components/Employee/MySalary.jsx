import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Calendar, Download } from 'lucide-react';
import toast from 'react-hot-toast';

export default function MySalary() {
  const fromDateRef = useRef(null);
  const toDateRef = useRef(null);

  const [fromDate, setFromDate] = useState(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const day = now.getDate();
    let start = new Date(year, month, 18);
    if (day < 18) {
      start = new Date(year, month - 1, 18);
    }
    return start.toISOString().split('T')[0];
  });

  const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);
  const [salaryData, setSalaryData] = useState(null);
  const [loading, setLoading] = useState(false);

  const formatDateToDisplay = (dateStr) => {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  };

  const formatDateToDDMMYYYY = (date) => {
    if (!date) return '';
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  };

  useEffect(() => {
    fetchSalaryData();
  }, []);

  const fetchSalaryData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const user = JSON.parse(localStorage.getItem('user'));

      const response = await axios.get(`/api/payroll/employee/${user.id}`, {
        params: { fromDate, toDate },
        headers: { Authorization: `Bearer ${token}` }
      });

      setSalaryData(response.data);
      setLoading(false);
    } catch (error) {
      toast.error('Failed to fetch salary data');
      setLoading(false);
    }
  };

  const handleUpdateDates = () => {
    fetchSalaryData();
  };

  const handleDownloadPDF = () => {
    // Implement PDF download functionality
    toast.success('PDF download feature coming soon');
  };

  if (!salaryData) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  return (
    <div className="p-4 md:p-6 bg-gray-50 min-h-screen">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800">My Salary</h1>
        <button
          onClick={handleDownloadPDF}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          <Download size={18} />
          Download PDF
        </button>
      </div>

      {/* Date Filter */}
      <div className="bg-white rounded-lg shadow p-4 md:p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">From Date</label>
            <div className="relative">
              <div 
                onClick={() => fromDateRef.current.showPicker()}
                className="flex items-center justify-between w-full px-4 py-2 border border-gray-300 rounded-lg focus-within:ring-2 focus-within:ring-blue-500 cursor-pointer bg-white"
              >
                <span className="text-gray-900">{formatDateToDisplay(fromDate)}</span>
                <Calendar size={18} className="text-gray-400" />
              </div>
              <input
                ref={fromDateRef}
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="absolute opacity-0 pointer-events-none inset-0 w-full"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">To Date</label>
            <div className="relative">
              <div 
                onClick={() => toDateRef.current.showPicker()}
                className="flex items-center justify-between w-full px-4 py-2 border border-gray-300 rounded-lg focus-within:ring-2 focus-within:ring-blue-500 cursor-pointer bg-white"
              >
                <span className="text-gray-900">{formatDateToDisplay(toDate)}</span>
                <Calendar size={18} className="text-gray-400" />
              </div>
              <input
                ref={toDateRef}
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="absolute opacity-0 pointer-events-none inset-0 w-full"
              />
            </div>
          </div>
          <div className="flex items-end">
            <button
              onClick={handleUpdateDates}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              Update
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">Loading salary data...</div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-gray-600 text-sm mb-2">Total Basic Earned</p>
              <p className="text-2xl font-bold text-gray-800">
                PKR {salaryData.totals.basicEarned.toFixed(2)}
              </p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-gray-600 text-sm mb-2">Overtime Total</p>
              <p className="text-2xl font-bold text-green-600">
                PKR {salaryData.totals.otTotal.toFixed(2)}
              </p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-gray-600 text-sm mb-2">Total Deductions</p>
              <p className="text-2xl font-bold text-red-600">
                PKR {salaryData.totals.deductionTotal.toFixed(2)}
              </p>
            </div>
            <div className="bg-blue-600 text-white rounded-lg shadow p-6">
              <p className="text-blue-100 text-sm mb-2">Net Payable</p>
              <p className="text-2xl font-bold">
                PKR {salaryData.totals.netPayable.toFixed(2)}
              </p>
            </div>
          </div>

          {/* Daily Breakdown Table */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="p-4 md:p-6 border-b bg-gray-50">
              <h2 className="text-lg font-semibold text-gray-800">Daily Breakdown</h2>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Date</th>
                    <th className="px-4 py-3 text-left font-semibold">In / Out</th>
                    <th className="px-4 py-3 text-left font-semibold">Hours</th>
                    <th className="px-4 py-3 text-right font-semibold">Base Pay</th>
                    <th className="px-4 py-3 text-right font-semibold">OT Amount</th>
                    <th className="px-4 py-3 text-right font-semibold">Deduction</th>
                    <th className="px-4 py-3 text-right font-semibold">Day Earning</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {salaryData.dailyBreakdown.map((day, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        {formatDateToDDMMYYYY(day.date)}
                      </td>
                      <td className="px-4 py-3">
                        {day.inOut?.in && day.inOut?.out
                          ? `${day.inOut.in} / ${day.inOut.out}`
                          : '--'
                        }
                      </td>
                      <td className="px-4 py-3">{day.hoursPerDay.toFixed(1)}h</td>
                      <td className="px-4 py-3 text-right">
                        PKR {day.basePay.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right text-green-600">
                        PKR {day.otAmount.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right text-red-600">
                        PKR {day.deduction.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">
                        PKR {day.dailyEarning.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-100 border-t-2">
                  <tr>
                    <td colSpan="3" className="px-4 py-3 font-semibold">Total</td>
                    <td className="px-4 py-3 text-right font-semibold">
                      PKR {salaryData.totals.basicEarned.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-green-600">
                      PKR {salaryData.totals.otTotal.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-red-600">
                      PKR {salaryData.totals.deductionTotal.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right font-bold">
                      PKR {salaryData.totals.netPayable.toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}