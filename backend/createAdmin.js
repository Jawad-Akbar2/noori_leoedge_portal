// createAdmin.js
//
// Quick utility to create a single admin account.
// For full demo data (employees + attendance + payroll) run:
//   node seeders/seedAdmin.js
//   node seeders/seedDemoData.js

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Employee from './models/Employee.js';

dotenv.config();

const createAdmin = async () => {
  try {
    console.log('Connecting to MongoDB...');

    await mongoose.connect(process.env.MONGODB_URI, {
      family: 4  // force IPv4 — avoids SRV/DNS issues on Windows
    });

    console.log('✅ Connected to MongoDB');

    const adminEmail = 'admin@example.com';
    const exists = await Employee.findOne({ email: adminEmail });

    if (exists) {
      console.log('ℹ️  Admin already exists — nothing to do.');
      process.exit(0);
    }

    const admin = new Employee({
      email:          adminEmail,
      employeeNumber: 'ADMIN001',
      firstName:      'System',
      lastName:       'Admin',
      department:     'Manager',
      role:           'admin',           // explicit — don't rely on default
      joiningDate:    new Date().toLocaleString("en-US", {timeZone: "Asia/Karachi"}),
      shift:          { start: '09:00', end: '18:00' },
      salaryType:     'monthly',
      hourlyRate:     500,               // required by schema
      monthlySalary:  150000,
      status:         'Active',
      password:       'Admin@123456'
    });

    await admin.save();

    console.log('🚀 Admin created successfully!');
    console.log('   Email   :', adminEmail);
    console.log('   Password: Admin@123456');

    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
};

createAdmin();