/**
 * utils/pdfGenerator.js
 * PDF generation for payroll reports and salary slips.
 * Requires: npm install jspdf
 * Optional: npm install html2canvas (only for generatePayrollPDF)
 */

// ─── helpers ──────────────────────────────────────────────────────────────────

const fmt = (n) => (parseFloat(n) || 0).toFixed(2);

// ─── payroll report PDF (html2canvas approach) ────────────────────────────────

/**
 * Generate a visual payroll report PDF using html2canvas.
 *
 * @param {string} employeeName
 * @param {Object} summary — { baseSalary, totalOt, totalDeduction, netPayable }
 *   NOTE: field names match backend — NOT basicEarned/otTotal
 */
export async function generatePayrollPDF(employeeName, summary) {
  try {
    // Dynamic import — works in Vite/ESM (no require())
    const [{ jsPDF }, html2canvas] = await Promise.all([
      import('jspdf'),
      import('html2canvas').then(m => m.default)
    ]);

    const container = document.createElement('div');
    Object.assign(container.style, {
      padding:         '20px',
      backgroundColor: '#ffffff',
      width:           '800px',
      position:        'fixed',
      left:            '-9999px',
      top:             '0'
    });

    container.innerHTML = `
      <h1 style="text-align:center;color:#333;font-family:Arial,sans-serif">Payroll Report</h1>
      <p  style="text-align:center;color:#666;font-family:Arial,sans-serif">
        ${new Date().toLocaleDateString('en-GB')}
      </p>

      <h2 style="color:#0066cc;margin-top:30px;font-family:Arial,sans-serif">
        Employee: ${employeeName}
      </h2>

      <table style="width:100%;border-collapse:collapse;margin-top:20px;font-family:Arial,sans-serif">
        <tr style="background:#f0f0f0">
          <th style="border:1px solid #ddd;padding:10px;text-align:left">Description</th>
          <th style="border:1px solid #ddd;padding:10px;text-align:right">Amount (PKR)</th>
        </tr>
        <tr>
          <td style="border:1px solid #ddd;padding:10px">Basic Earned</td>
          <td style="border:1px solid #ddd;padding:10px;text-align:right">${fmt(summary.baseSalary)}</td>
        </tr>
        <tr style="background:#f9f9f9">
          <td style="border:1px solid #ddd;padding:10px">OT Amount</td>
          <td style="border:1px solid #ddd;padding:10px;text-align:right">${fmt(summary.totalOt)}</td>
        </tr>
        <tr>
          <td style="border:1px solid #ddd;padding:10px">Deductions</td>
          <td style="border:1px solid #ddd;padding:10px;text-align:right">${fmt(summary.totalDeduction)}</td>
        </tr>
        <tr style="background:#e8f4f8;font-weight:bold">
          <td style="border:1px solid #ddd;padding:10px">Net Payable</td>
          <td style="border:1px solid #ddd;padding:10px;text-align:right;color:#0066cc">
            ${fmt(summary.netPayable)}
          </td>
        </tr>
      </table>

      <p style="margin-top:30px;font-size:11px;color:#999;font-family:Arial,sans-serif">
        Generated: ${new Date().toLocaleString('en-GB')}
      </p>
    `;

    document.body.appendChild(container);

    const canvas  = await html2canvas(container, { scale: 2 });
    const imgData = canvas.toDataURL('image/png');

    const pdf      = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const imgWidth = 210;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);

    const safeName = employeeName.replace(/[^a-zA-Z0-9_-]/g, '_');
    pdf.save(`payroll-${safeName}-${new Date().toISOString().slice(0, 10)}.pdf`);

    document.body.removeChild(container);
  } catch (err) {
    console.error('generatePayrollPDF error:', err);
    throw new Error('PDF generation failed. Ensure jspdf and html2canvas are installed.');
  }
}

// ─── salary slip PDF (pure jsPDF — no html2canvas needed) ────────────────────

/**
 * Generate a salary slip PDF for one employee.
 *
 * @param {Object}   employee       — { name, employeeNumber, salaryType, hourlyRate, monthlySalary }
 * @param {Object[]} dailyBreakdown — from /api/payroll/my/summary or /employee-breakdown/:id
 * @param {Object}   totals         — { baseSalary, totalOt, totalDeduction, netPayable }
 *   NOTE: uses backend field names — NOT basicEarned / otTotal
 */
export async function generateSalarySlipPDF(employee, dailyBreakdown, totals) {
  try {
    const { jsPDF } = await import('jspdf');

    const pdf       = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW     = pdf.internal.pageSize.getWidth();
    const pageH     = pdf.internal.pageSize.getHeight();
    let   y         = 20;

    const line = (text, x, bold = false) => {
      pdf.setFont('helvetica', bold ? 'bold' : 'normal');
      pdf.text(String(text), x, y);
    };

    // ── header ───────────────────────────────────────────────────────────────
    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'bold');
    pdf.text('SALARY SLIP', pageW / 2, y, { align: 'center' });

    y += 7;
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Generated: ${new Date().toLocaleDateString('en-GB')}`, pageW / 2, y, { align: 'center' });

    // ── employee info ─────────────────────────────────────────────────────────
    y += 12;
    pdf.setFontSize(11);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Employee Information', 20, y);

    y += 6;
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    [
      ['Name',         employee.name],
      ['Employee ID',  employee.employeeNumber],
      ['Salary Type',  employee.salaryType === 'monthly'
                         ? `Monthly (PKR ${fmt(employee.monthlySalary)})`
                         : `Hourly (PKR ${fmt(employee.hourlyRate)}/hr)`]
    ].forEach(([label, value]) => {
      pdf.text(`${label}:`, 25, y);
      pdf.text(String(value), 80, y);
      y += 5;
    });

    // ── earnings summary ──────────────────────────────────────────────────────
    y += 8;
    pdf.setFontSize(11);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Earnings Summary', 20, y);

    y += 6;
    pdf.setFontSize(10);
    [
      ['Base Salary',   fmt(totals.baseSalary)],
      ['OT Amount',     fmt(totals.totalOt)],           // correct field
      ['Deductions',    fmt(totals.totalDeduction)],    // correct field
      ['Net Payable',   fmt(totals.netPayable)]
    ].forEach(([label, value], idx) => {
      const isBold = idx === 3;
      pdf.setFont('helvetica', isBold ? 'bold' : 'normal');
      pdf.text(`${label}:`, 25, y);
      pdf.text(`PKR ${value}`, 100, y);
      y += 5;
    });

    // ── daily breakdown ───────────────────────────────────────────────────────
    y += 8;
    pdf.setFontSize(11);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Daily Attendance', 20, y);

    y += 6;
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'bold');
    ['Date', 'Status', 'In', 'Out', 'Hours', 'Earning'].forEach((h, i) => {
      pdf.text(h, [20, 50, 75, 100, 125, 150][i], y);
    });

    y += 1;
    pdf.line(20, y, 185, y);
    y += 4;

    pdf.setFont('helvetica', 'normal');

    for (const day of dailyBreakdown) {
      if (y > pageH - 20) {
        pdf.addPage();
        y = 20;
      }

      [
        day.date,
        day.status,
        day.inTime  || '--',
        day.outTime || '--',
        fmt(day.hoursWorked),           // correct field name (not hoursPerDay)
        fmt(day.finalDayEarning)        // correct field name (not dailyEarning)
      ].forEach((val, i) => {
        pdf.text(String(val), [20, 50, 75, 100, 125, 150][i], y);
      });

      y += 5;
    }

    // ── footer ────────────────────────────────────────────────────────────────
    pdf.setFontSize(7);
    pdf.setFont('helvetica', 'italic');
    pdf.text('This is a system-generated salary slip.', pageW / 2, pageH - 10, { align: 'center' });

    const safeName = (employee.employeeNumber || 'emp').replace(/[^a-zA-Z0-9_-]/g, '_');
    pdf.save(`salary-slip-${safeName}-${new Date().toISOString().slice(0, 10)}.pdf`);
  } catch (err) {
    console.error('generateSalarySlipPDF error:', err);
    throw new Error('Salary slip PDF generation failed. Ensure jspdf is installed.');
  }
}