/**
 * Excel Exporter Utility
 * Exports data to Excel format using SheetJS
 * Note: Requires npm install xlsx
 */

export function exportToExcel(data, sheetName = 'Sheet1', fileName = 'export.xlsx') {
  try {
    // Dynamic import for optional dependency
    const XLSX = require('xlsx');

    if (!data || data.length === 0) {
      console.warn('No data to export');
      return;
    }

    // Create workbook
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);

    // Style headers
    const range = XLSX.utils.decode_range(ws['!ref']);
    for (let col = range.s.c; col <= range.e.c; col++) {
      const address = XLSX.utils.encode_cell({ r: 0, c: col });
      ws[address].s = {
        fill: { fgColor: { rgb: 'FFD9D9D9' } },
        font: { bold: true },
        alignment: { horizontal: 'center', vertical: 'center' }
      };
    }

    // Auto-width columns
    const colWidths = [];
    const headerRow = data[0];
    for (let key in headerRow) {
      colWidths.push({ wch: Math.max(key.length, String(headerRow[key]).length) + 2 });
    }
    ws['!cols'] = colWidths;

    // Download
    XLSX.writeFile(wb, fileName);
  } catch (error) {
    console.error('Excel export error:', error);
    alert('Failed to export to Excel. Make sure xlsx is installed: npm install xlsx');
  }
}

export function exportPayrollToExcel(summary) {
  const data = summary.map(emp => ({
    'Employee Number': emp.empNumber,
    'Name': emp.name,
    'Basic Earned': emp.basicEarned.toFixed(2),
    'OT Total': emp.otTotal.toFixed(2),
    'Deductions': emp.deductionTotal.toFixed(2),
    'Net Payable': emp.netPayable.toFixed(2)
  }));

  exportToExcel(data, 'Payroll', `payroll-${new Date().toISOString().split('T')[0]}.xlsx`);
}