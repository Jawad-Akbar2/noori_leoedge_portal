/**
 * Payroll Routes Configuration
 * Centralized payroll-related API endpoints
 */

import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || '/api';

const payrollAPI = {
  // Attendance Overview - Section 1
  getAttendanceOverview: async (fromDate, toDate, filterType = 'all') => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API_BASE_URL}/payroll/attendance-overview`,
        { fromDate, toDate, filterType },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return response.data;
    } catch (error) {
      console.error('Error fetching attendance overview:', error);
      throw error;
    }
  },

  // Performance Overview - Section 2
  getPerformanceOverview: async (fromDate, toDate) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API_BASE_URL}/payroll/performance-overview`,
        { fromDate, toDate },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return response.data;
    } catch (error) {
      console.error('Error fetching performance overview:', error);
      throw error;
    }
  },

  // Salary Summary - Section 3
  getSalarySummary: async (fromDate, toDate) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API_BASE_URL}/payroll/salary-summary`,
        { fromDate, toDate },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return response.data;
    } catch (error) {
      console.error('Error fetching salary summary:', error);
      throw error;
    }
  },


  // Consolidated payroll report with employee totals + nested daily rows
  getPayrollReport: async (fromDate, toDate, search = '') => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API_BASE_URL}/payroll/report`,
        { fromDate, toDate, search },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return response.data;
    } catch (error) {
      console.error('Error fetching payroll report:', error);
      throw error;
    }
  },

  // Employee Detailed Breakdown
  getEmployeeBreakdown: async (empId, fromDate, toDate) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${API_BASE_URL}/payroll/employee-breakdown/${empId}`,
        {
          params: { fromDate, toDate },
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      return response.data;
    } catch (error) {
      console.error('Error fetching employee breakdown:', error);
      throw error;
    }
  },

  // Live Monthly Payroll
  getLivePayroll: async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${API_BASE_URL}/payroll/live-payroll`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return response.data;
    } catch (error) {
      console.error('Error fetching live payroll:', error);
      throw error;
    }
  },

  // Export Payroll
  exportPayroll: async (fromDate, toDate, format = 'csv') => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API_BASE_URL}/payroll/export`,
        { fromDate, toDate, format },
        {
          headers: { Authorization: `Bearer ${token}` },
          responseType: format === 'pdf' ? 'blob' : 'text'
        }
      );
      return response.data;
    } catch (error) {
      console.error('Error exporting payroll:', error);
      throw error;
    }
  }
};

export default payrollAPI;