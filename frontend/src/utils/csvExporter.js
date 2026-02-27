/**
 * CSV Exporter Utility
 * Exports data to CSV format
 */

export function exportToCSV(data, filename = 'export.csv') {
  if (!data || data.length === 0) {
    console.warn('No data to export');
    return;
  }

  // Get headers from first object
  const headers = Object.keys(data[0]);

  // Create CSV content
  let csv = headers.join(',') + '\n';

  data.forEach(row => {
    const values = headers.map(header => {
      const value = row[header];
      // Escape quotes and wrap in quotes if contains comma
      if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    });
    csv += values.join(',') + '\n';
  });

  // Create blob and download
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function exportPayrollToCSV(summary) {
  const data = summary.map(emp => ({
    'Employee Number': emp.empNumber,
    'Name': emp.name,
    'Basic Earned': emp.basicEarned.toFixed(2),
    'OT Total': emp.otTotal.toFixed(2),
    'Deductions': emp.deductionTotal.toFixed(2),
    'Net Payable': emp.netPayable.toFixed(2)
  }));

  // Updated filename format to dd-mm-yyyy
  const d = new Date();
  const dateStr = `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
  exportToCSV(data, `payroll-${dateStr}.csv`);
}

export function exportAttendanceToCSV(attendance, filename = 'attendance.csv') {
  const data = attendance.map(record => ({
    'Date': record.date, // Assumes date is already in dd/mm/yyyy format from state
    'Employee ID': record.empId,
    'Name': record.name,
    'Status': record.status,
    'In Time': record.inOut?.in || '--',
    'Out Time': record.inOut?.out || '--',
    'Hours': record.hoursPerDay || 0,
    'Earning': record.dailyEarning || 0
  }));

  exportToCSV(data, filename);
}