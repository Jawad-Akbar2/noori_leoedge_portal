/**
 * PDF Generator Utility
 * Generates PDF reports
 * Note: Requires npm install jspdf html2canvas
 */

export async function generatePayrollPDF(employeeName, summary, totals) {
  try {
    const jsPDF = require('jspdf');
    const html2canvas = require('html2canvas');

    // Create a temporary container
    const container = document.createElement('div');
    container.style.padding = '20px';
    container.style.backgroundColor = 'white';
    container.style.width = '800px';

    // Add content
    container.innerHTML = `
      <h1 style="text-align: center; color: #333;">Payroll Report</h1>
      <p style="text-align: center; color: #666;">${new Date().toLocaleDateString()}</p>
      
      <h2 style="color: #0066cc; margin-top: 30px;">Employee: ${employeeName}</h2>
      
      <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
        <tr style="background-color: #f0f0f0;">
          <th style="border: 1px solid #ddd; padding: 10px; text-align: left;">Description</th>
          <th style="border: 1px solid #ddd; padding: 10px; text-align: right;">Amount (PKR)</th>
        </tr>
        <tr>
          <td style="border: 1px solid #ddd; padding: 10px;">Basic Earned</td>
          <td style="border: 1px solid #ddd; padding: 10px; text-align: right;">${summary.basicEarned.toFixed(2)}</td>
        </tr>
        <tr style="background-color: #f9f9f9;">
          <td style="border: 1px solid #ddd; padding: 10px;">OT Total</td>
          <td style="border: 1px solid #ddd; padding: 10px; text-align: right;">${summary.otTotal.toFixed(2)}</td>
        </tr>
        <tr>
          <td style="border: 1px solid #ddd; padding: 10px;">Deductions</td>
          <td style="border: 1px solid #ddd; padding: 10px; text-align: right;">${summary.deductionTotal.toFixed(2)}</td>
        </tr>
        <tr style="background-color: #e8f4f8; font-weight: bold;">
          <td style="border: 1px solid #ddd; padding: 10px;">Net Payable</td>
          <td style="border: 1px solid #ddd; padding: 10px; text-align: right; color: #0066cc;">${summary.netPayable.toFixed(2)}</td>
        </tr>
      </table>
      
      <p style="margin-top: 30px; font-size: 12px; color: #999;">
        Generated on ${new Date().toLocaleString()}
      </p>
    `;

    document.body.appendChild(container);

    // Convert to canvas
    const canvas = await html2canvas(container, { scale: 2 });
    const imgData = canvas.toDataURL('image/png');

    // Create PDF
    const pdf = new jsPDF.jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const imgWidth = 210;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
    pdf.save(`payroll-${employeeName}-${new Date().toISOString().split('T')[0]}.pdf`);

    document.body.removeChild(container);
  } catch (error) {
    console.error('PDF generation error:', error);
    alert('Failed to generate PDF. Make sure jspdf and html2canvas are installed: npm install jspdf html2canvas');
  }
}

export async function generateSalarySlipPDF(employee, dailyBreakdown, totals) {
  try {
    const jsPDF = require('jspdf');

    const pdf = new jsPDF.jsPDF();
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    let yPosition = 20;

    // Header
    pdf.setFontSize(16);
    pdf.text('SALARY SLIP', pageWidth / 2, yPosition, { align: 'center' });

    yPosition += 10;
    pdf.setFontSize(10);
    pdf.text(`Date: ${new Date().toLocaleDateString()}`, 20, yPosition);

    // Employee Info
    yPosition += 15;
    pdf.setFontSize(11);
    pdf.text('Employee Information:', 20, yPosition);
    yPosition += 7;
    pdf.setFontSize(10);
    pdf.text(`Name: ${employee.name}`, 25, yPosition);
    yPosition += 5;
    pdf.text(`ID: ${employee.employeeNumber}`, 25, yPosition);
    yPosition += 5;
    pdf.text(`Rate: PKR ${employee.hourlyRate}/hour`, 25, yPosition);

    // Summary
    yPosition += 15;
    pdf.setFontSize(11);
    pdf.text('Earnings Summary:', 20, yPosition);
    yPosition += 7;
    pdf.setFontSize(10);

    const summaryData = [
      ['Basic Earned', `PKR ${totals.basicEarned.toFixed(2)}`],
      ['OT Total', `PKR ${totals.otTotal.toFixed(2)}`],
      ['Deductions', `PKR ${totals.deductionTotal.toFixed(2)}`],
      ['Net Payable', `PKR ${totals.netPayable.toFixed(2)}`]
    ];

    summaryData.forEach(([label, value]) => {
      pdf.text(label + ':', 25, yPosition);
      pdf.text(value, 150, yPosition);
      yPosition += 5;
    });

    // Daily breakdown (partial, to fit on page)
    yPosition += 10;
    pdf.setFontSize(11);
    pdf.text('Recent Daily Records:', 20, yPosition);
    yPosition += 7;

    pdf.setFontSize(9);
    dailyBreakdown.slice(0, 10).forEach(day => {
      pdf.text(day.date, 25, yPosition);
      pdf.text(day.inOut?.in || '--', 80, yPosition);
      pdf.text(day.inOut?.out || '--', 110, yPosition);
      pdf.text(`PKR ${day.dailyEarning.toFixed(2)}`, 150, yPosition);
      yPosition += 5;

      if (yPosition > pageHeight - 20) {
        pdf.addPage();
        yPosition = 20;
      }
    });

    // Footer
    pdf.setFontSize(8);
    pdf.text('This is a system-generated salary slip.', pageWidth / 2, pageHeight - 10, { align: 'center' });

    pdf.save(`salary-slip-${employee.employeeNumber}-${new Date().toISOString().split('T')[0]}.pdf`);
  } catch (error) {
    console.error('Salary slip PDF error:', error);
    alert('Failed to generate salary slip PDF. Make sure jspdf and html2canvas are installed.');
  }
}