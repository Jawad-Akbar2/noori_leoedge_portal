import mongoose from 'mongoose';
import Employee from '../models/Employee.js';
import AttendanceLog from '../models/AttendanceLog.js';
import dotenv from 'dotenv';

dotenv.config();

async function seedDemoData() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✓ Connected to MongoDB');

    // Clear existing attendance logs
    await AttendanceLog.deleteMany({ isDeleted: false });
    console.log('✓ Cleared existing attendance logs');

    // Get all active employees
    const employees = await Employee.find({
      status: 'Active',
      isArchived: false,
      isDeleted: false
    });

    console.log(`✓ Found ${employees.length} active employees`);

    // Generate attendance for last 30 days
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - 30);

    const statuses = ['Present', 'Late', 'Absent', 'Leave'];
    const attendanceRecords = [];

    for (let d = new Date(startDate); d <= today; d.setDate(d.getDate() + 1)) {
      // Skip weekends
      if (d.getDay() === 0 || d.getDay() === 6) continue;

      for (const emp of employees) {
        const status = statuses[Math.floor(Math.random() * statuses.length)];
        let inTime = null;
        let outTime = null;
        let hoursPerDay = 0;
        let basePay = 0;
        let finalDayEarning = 0;

        if (status === 'Present' || status === 'Late') {
          const lateMin = status === 'Late' ? Math.floor(Math.random() * 30) + 5 : 0;
          const [startH, startM] = emp.shift.start.split(':').map(Number);
          const [endH, endM] = emp.shift.end.split(':').map(Number);

          const inHour = startH + Math.floor((startM + lateMin) / 60);
          const inMin = (startM + lateMin) % 60;

          inTime = `${String(inHour).padStart(2, '0')}:${String(inMin).padStart(2, '0')}`;
          outTime = emp.shift.end;

          hoursPerDay = ((endH * 60 + endM) - (startH * 60 + startM)) / 60;
          basePay = hoursPerDay * emp.hourlyRate;
          finalDayEarning = basePay;
        } else if (status === 'Leave') {
          const [startH, startM] = emp.shift.start.split(':').map(Number);
          const [endH, endM] = emp.shift.end.split(':').map(Number);
          hoursPerDay = ((endH * 60 + endM) - (startH * 60 + startM)) / 60;
          basePay = hoursPerDay * emp.hourlyRate;
          finalDayEarning = basePay;
        }

        attendanceRecords.push({
          date: new Date(d),
          empId: emp._id,
          empNumber: emp.employeeNumber,
          empName: `${emp.firstName} ${emp.lastName}`,
          department: emp.department,
          status,
          inOut: { in: inTime, out: outTime },
          shift: emp.shift,
          hourlyRate: emp.hourlyRate,
          financials: {
            hoursPerDay,
            basePay,
            deduction: 0,
            otMultiplier: 1,
            otHours: 0,
            otAmount: 0,
            finalDayEarning
          },
          manualOverride: false,
          metadata: {
            source: 'system'
          }
        });
      }
    }

    // Insert attendance records
    if (attendanceRecords.length > 0) {
      await AttendanceLog.insertMany(attendanceRecords);
      console.log(`✓ Created ${attendanceRecords.length} attendance records`);
    }

    console.log('✓ Demo data seeding complete!');
    process.exit(0);
  } catch (error) {
    console.error('✗ Seeding error:', error.message);
    process.exit(1);
  }
}

seedDemoData();