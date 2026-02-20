import express from 'express';
import AttendanceLog from '../models/AttendanceLog.js';
import Employee from '../models/Employee.js';
import { adminAuth } from '../middleware/auth.js';
import { calculateHours, isLate, isValidTime } from '../utils/timeCalculator.js';
import { parseCSV, sortCSVRows, mergeWithDatabase } from '../utils/csvParser.js'; // Added CSV utilities

const router = express.Router();



// **Generate Worksheet (No Gaps)**
router.post('/worksheet', adminAuth, async (req, res) => {
  try {
    const { fromDate, toDate } = req.body;
    
    if (!fromDate || !toDate) {
      return res.status(400).json({ message: 'From and To dates required' });
    }

    const start = new Date(fromDate);
    const end = new Date(toDate);

    const employees = await Employee.find({
      status: 'Active',
      isArchived: false,
      isDeleted: false
    }).sort({ employeeNumber: 1, firstName: 1 });

    const worksheet = [];

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const currentDate = new Date(d);
      currentDate.setHours(0, 0, 0, 0);

      for (const emp of employees) {
        const existing = await AttendanceLog.findOne({
          empId: emp._id,
          date: currentDate
        });

        if (existing) {
          worksheet.push({
            _id: existing._id,
            date: existing.date,
            empId: emp._id,
            empNumber: emp.employeeNumber,
            empName: `${emp.firstName} ${emp.lastName}`,
            department: emp.department,
            shift: emp.shift,
            hourlyRate: emp.hourlyRate,
            status: existing.status,
            inOut: existing.inOut,
            financials: existing.financials,
            manualOverride: existing.manualOverride,
            isVirtual: false,
            isModified: false
          });
        } else {
          worksheet.push({
            date: currentDate,
            empId: emp._id,
            empNumber: emp.employeeNumber,
            empName: `${emp.firstName} ${emp.lastName}`,
            department: emp.department,
            shift: emp.shift,
            hourlyRate: emp.hourlyRate,
            status: 'Absent',
            inOut: { in: null, out: null },
            financials: {
              hoursPerDay: 0,
              basePay: 0,
              deduction: 0,
              otMultiplier: 1,
              otHours: 0,
              otAmount: 0,
              finalDayEarning: 0
            },
            manualOverride: false,
            isVirtual: true,
            isModified: false
          });
        }
      }
    }

    worksheet.sort((a, b) => {
      const dateCompare = new Date(a.date) - new Date(b.date);
      if (dateCompare !== 0) return dateCompare;
      
      const empCompare = a.empNumber.localeCompare(b.empNumber);
      if (empCompare !== 0) return empCompare;
      
      return a.empName.localeCompare(b.empName);
    });

    res.json({ worksheet, total: worksheet.length });
  } catch (error) {
    console.error('Error in worksheet:', error);
    res.status(500).json({ message: error.message });
  }
});

// **Save Single Row (UPSERT - No duplicates)**
router.post('/save-row', adminAuth, async (req, res) => {
  try {
    const {
      empId,
      date,
      status,
      inTime,
      outTime,
      otHours,
      otMultiplier,
      deduction
    } = req.body;

    const employee = await Employee.findById(empId);
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    const dateObj = new Date(date);
    dateObj.setHours(0, 0, 0, 0);

    // Calculate financials
    let hoursPerDay = 0;
    let basePay = 0;
    let otAmount = 0;
    let finalDayEarning = 0;

    if (status === 'Leave') {
      hoursPerDay = calculateHours(employee.shift.start, employee.shift.end);
      basePay = hoursPerDay * employee.hourlyRate;
      finalDayEarning = basePay;
    } else if (status === 'Absent' || (!inTime && !outTime)) {
      finalDayEarning = 0;
    } else if (inTime && outTime) {
      hoursPerDay = calculateHours(inTime, outTime);
      basePay = hoursPerDay * employee.hourlyRate;
      otAmount = (otHours || 0) * employee.hourlyRate * (otMultiplier || 1);
      finalDayEarning = basePay + otAmount - (deduction || 0);
      finalDayEarning = Math.max(0, finalDayEarning);
    } else if (inTime || outTime) {
      hoursPerDay = calculateHours(employee.shift.start, employee.shift.end);
      basePay = hoursPerDay * employee.hourlyRate;
      otAmount = (otHours || 0) * employee.hourlyRate * (otMultiplier || 1);
      finalDayEarning = (basePay * 0.5) + otAmount - (deduction || 0);
      finalDayEarning = Math.max(0, finalDayEarning);
    }

    const attendance = await AttendanceLog.findOneAndUpdate(
      { empId: employee._id, date: dateObj },
      {
        $set: {
          empNumber: employee.employeeNumber,
          empName: `${employee.firstName} ${employee.lastName}`,
          department: employee.department,
          status: status || 'Present',
          inOut: {
            in: inTime || null,
            out: outTime || null
          },
          shift: employee.shift,
          hourlyRate: employee.hourlyRate,
          financials: {
            hoursPerDay,
            basePay,
            deduction: deduction || 0,
            otMultiplier: otMultiplier || 1,
            otHours: otHours || 0,
            otAmount,
            finalDayEarning
          },
          manualOverride: true,
          metadata: {
            lastUpdatedBy: req.userId,
            source: 'manual'
          },
          updatedAt: new Date()
        }
      },
      { upsert: true, new: true, runValidators: true }
    );

    res.json({
      message: 'Attendance saved successfully (upserted)',
      record: attendance
    });
  } catch (error) {
    console.error('Error in save-row:', error);
    res.status(500).json({ message: error.message });
  }
});

// **Bulk Save (UPSERT all, no duplicates)**
router.post('/save-batch', adminAuth, async (req, res) => {
  try {
    const { attendanceData } = req.body;

    if (!attendanceData || !Array.isArray(attendanceData)) {
      return res.status(400).json({ message: 'Invalid attendance data' });
    }

    const bulkOps = [];

    for (const record of attendanceData) {
      const employee = await Employee.findById(record.empId);
      if (!employee) continue;

      const dateObj = new Date(record.date);
      dateObj.setHours(0, 0, 0, 0);

      // Calculate financials
      let hoursPerDay = 0;
      let basePay = 0;
      let otAmount = 0;
      let finalDayEarning = 0;

      if (record.status === 'Leave') {
        hoursPerDay = calculateHours(employee.shift.start, employee.shift.end);
        basePay = hoursPerDay * employee.hourlyRate;
        finalDayEarning = basePay;
      } else if (record.status === 'Absent' || (!record.inOut?.in && !record.inOut?.out)) {
        finalDayEarning = 0;
      } else if (record.inOut?.in && record.inOut?.out) {
        hoursPerDay = calculateHours(record.inOut.in, record.inOut.out);
        basePay = hoursPerDay * employee.hourlyRate;
        otAmount = (record.financials?.otHours || 0) * employee.hourlyRate * (record.financials?.otMultiplier || 1);
        finalDayEarning = basePay + otAmount - (record.financials?.deduction || 0);
        finalDayEarning = Math.max(0, finalDayEarning);
      }

      bulkOps.push({
        updateOne: {
          filter: { empId: employee._id, date: dateObj },
          update: {
            $set: {
              empNumber: employee.employeeNumber,
              empName: `${employee.firstName} ${employee.lastName}`,
              department: employee.department,
              status: record.status,
              inOut: record.inOut || { in: null, out: null },
              shift: employee.shift,
              hourlyRate: employee.hourlyRate,
              financials: {
                hoursPerDay,
                basePay,
                deduction: record.financials?.deduction || 0,
                otMultiplier: record.financials?.otMultiplier || 1,
                otHours: record.financials?.otHours || 0,
                otAmount,
                finalDayEarning
              },
              manualOverride: true,
              metadata: {
                lastUpdatedBy: req.userId,
                source: 'manual'
              },
              updatedAt: new Date()
            }
          },
          upsert: true
        }
      });
    }

    if (bulkOps.length > 0) {
      await AttendanceLog.bulkWrite(bulkOps);
    }

    res.json({
      message: `${bulkOps.length} attendance records saved successfully (upserted)`
    });
  } catch (error) {
    console.error('Error in save-batch:', error);
    res.status(500).json({ message: error.message });
  }
});

// **Get Attendance Range**
router.get('/range', adminAuth, async (req, res) => {
  try {
    const { fromDate, toDate } = req.query;

    const attendance = await AttendanceLog.find({
      date: { $gte: new Date(fromDate), $lte: new Date(toDate) },
      isDeleted: false
    }).populate('empId', 'firstName lastName email').sort({ date: 1 });

    res.json({ attendance });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ------------------ NEW CSV Import Route ------------------
router.post('/csv-import', adminAuth, async (req, res) => {
  try {
    const { csvContent } = req.body;
    if (!csvContent) return res.status(400).json({ message: 'CSV content is required' });

    const parsedRows = sortCSVRows(parseCSV(csvContent));
    let importedCount = 0;

    for (const row of parsedRows) {
      const employee = await Employee.findOne({ employeeNumber: row.empId });
      if (!employee) continue;

      const dateObj = new Date(row.date);
      dateObj.setHours(0, 0, 0, 0);

      const existing = await AttendanceLog.findOne({ empId: employee._id, date: dateObj });

      const mergedInOut = mergeWithDatabase(
        row.type === 0 ? row.time : null,
        row.type === 1 ? row.time : null,
        existing?.inOut?.in || null,
        existing?.inOut?.out || null,
        existing?.manualOverride || false
      );

      let hoursPerDay = 0;
      let basePay = 0;
      let otAmount = 0;
      let finalDayEarning = 0;

      if (mergedInOut.in && mergedInOut.out) {
        hoursPerDay = calculateHours(mergedInOut.in, mergedInOut.out);
        basePay = hoursPerDay * employee.hourlyRate;
        finalDayEarning = basePay;
      }

      await AttendanceLog.findOneAndUpdate(
        { empId: employee._id, date: dateObj },
        {
          $set: {
            empNumber: employee.employeeNumber,
            empName: `${employee.firstName} ${employee.lastName}`,
            department: employee.department,
            status: 'Present',
            inOut: mergedInOut,
            shift: employee.shift,
            hourlyRate: employee.hourlyRate,
            financials: {
              hoursPerDay,
              basePay,
              deduction: 0,
              otMultiplier: 1,
              otHours: 0,
              otAmount,
              finalDayEarning
            },
            manualOverride: false,
            metadata: { source: 'csv-import', lastUpdatedBy: req.userId },
            updatedAt: new Date()
          }
        },
        { upsert: true, new: true, runValidators: true }
      );

      importedCount++;
    }

    res.json({ message: `${importedCount} attendance records imported successfully.` });
  } catch (error) {
    console.error('Error in CSV import:', error);
    res.status(500).json({ message: error.message });
  }
});

export default router;