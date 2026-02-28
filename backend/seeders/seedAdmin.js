// seeders/seedAdmin.js
//
// Creates:
//   1. Superadmin users      (no salary / shift — system owners, not payroll employees)
//   2. Admin user            (no salary / shift)
//   3. Day-shift employees   (hourly)
//   4. Night-shift employee  (monthly) — needed to test CSV night-shift import (req #4)
//   5. A few more employees across departments for performance/payroll charts

import mongoose from 'mongoose';
import Employee from '../models/Employee.js';
import dotenv from 'dotenv';

dotenv.config();

const EMPLOYEES = [
  // ── Super Admins ─────────────────────────────────────────────────────────────
  // System accounts — no shift, no salary.
  // The pre-validate hook in Employee.js will enforce null for these fields.
  {
    email:          'waleed@leoedgeconsulting.com',
    employeeNumber: 'superadmin001',
    firstName:      'waleed',
    lastName:       'raja',
    department:     'Manager',
    role:           'superadmin',
    joiningDate:    new Date(),
    status:         'Active',
    password:       'Admin@123456'
  },
  {
    email:          'jawadakbar770@gmail.com',
    employeeNumber: 'superadmin002',
    firstName:      'jawad',
    lastName:       'akbar',
    department:     'Manager',
    role:           'superadmin',
    joiningDate:    new Date(),
    status:         'Active',
    password:       'Admin@123456'
  },

  // ── Admin ─────────────────────────────────────────────────────────────────────
  // System account — no shift, no salary.
  {
    email:          'admin@example.com',
    employeeNumber: 'ADMIN001',
    firstName:      'Admin',
    lastName:       'User',
    department:     'Manager',
    role:           'admin',
    joiningDate:    new Date(),
    status:         'Active',
    password:       'Admin@123456'
  },

  // ── Day-shift employees (hourly) ────────────────────────────────────────────
  {
    email:          'john.doe@example.com',
    employeeNumber: 'EMP001',
    firstName:      'John',
    lastName:       'Doe',
    department:     'IT',
    role:           'employee',
    joiningDate:    new Date(Date.now() - 200 * 86_400_000),
    shift:          { start: '09:00', end: '18:00' },
    salaryType:     'hourly',
    hourlyRate:     300,
    monthlySalary:  null,
    status:         'Active',
    password:       'Employee@123456'
  },
  {
    email:          'sara.khan@example.com',
    employeeNumber: 'EMP002',
    firstName:      'Sara',
    lastName:       'Khan',
    department:     'HR',
    role:           'employee',
    joiningDate:    new Date(Date.now() - 300 * 86_400_000),
    shift:          { start: '09:00', end: '18:00' },
    salaryType:     'monthly',
    hourlyRate:     250,
    monthlySalary:  65000,
    status:         'Active',
    password:       'Employee@123456'
  },
  {
    email:          'ali.raza@example.com',
    employeeNumber: 'EMP003',
    firstName:      'Ali',
    lastName:       'Raza',
    department:     'Finance',
    role:           'employee',
    joiningDate:    new Date(Date.now() - 120 * 86_400_000),
    shift:          { start: '09:00', end: '18:00' },
    salaryType:     'hourly',
    hourlyRate:     280,
    monthlySalary:  null,
    status:         'Active',
    password:       'Employee@123456'
  },
  {
    email:          'fatima.malik@example.com',
    employeeNumber: 'EMP004',
    firstName:      'Fatima',
    lastName:       'Malik',
    department:     'Marketing',
    role:           'employee',
    joiningDate:    new Date(Date.now() - 400 * 86_400_000),
    shift:          { start: '09:00', end: '18:00' },
    salaryType:     'monthly',
    hourlyRate:     270,
    monthlySalary:  70000,
    status:         'Active',
    password:       'Employee@123456'
  },
  {
    email:          'usman.tariq@example.com',
    employeeNumber: 'EMP005',
    firstName:      'Usman',
    lastName:       'Tariq',
    department:     'Customer Support',
    role:           'employee',
    joiningDate:    new Date(Date.now() - 90 * 86_400_000),
    shift:          { start: '09:00', end: '18:00' },
    salaryType:     'hourly',
    hourlyRate:     220,
    monthlySalary:  null,
    status:         'Active',
    password:       'Employee@123456'
  },

  // ── Night-shift employee (monthly) ──────────────────────────────────────────
  // Used specifically to test CSV import with the 14-hour window rule (req #4).
  // shift.end < shift.start  →  isNightShift = true (set in AttendanceLog pre-save)
  {
    email:          'night.watch@example.com',
    employeeNumber: 'EMP006',
    firstName:      'Bilal',
    lastName:       'Siddiqui',
    department:     'IT',
    role:           'employee',
    joiningDate:    new Date(Date.now() - 180 * 86_400_000),
    shift:          { start: '22:00', end: '06:00' },   // crosses midnight
    salaryType:     'monthly',
    hourlyRate:     350,
    monthlySalary:  90000,
    status:         'Active',
    password:       'Employee@123456'
  }
];

async function seedAdmin() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✓ Connected to MongoDB');

    for (const data of EMPLOYEES) {
      const existing = await Employee.findOne({ email: data.email });

      if (existing) {
        console.log(`  → already exists: ${data.email}`);
        continue;
      }

      const emp = new Employee(data);
      await emp.save();

      const isSystem = emp.isSystemAccount();
      console.log(`✓ Created [${emp.role.padEnd(10)}] ${emp.firstName} ${emp.lastName}`);
      console.log(`    email    : ${emp.email}`);
      console.log(`    empNo    : ${emp.employeeNumber}`);
      if (isSystem) {
        console.log(`    shift    : N/A (system account)`);
        console.log(`    salary   : N/A (system account)`);
      } else {
        console.log(`    shift    : ${emp.shift.start} – ${emp.shift.end}`);
        console.log(`    salary   : ${emp.salaryType === 'monthly'
          ? `monthly = PKR ${emp.monthlySalary}`
          : `hourly  = PKR ${emp.hourlyRate}/hr`}`);
      }
    }

    console.log('\n✓ seedAdmin complete');
    process.exit(0);
  } catch (err) {
    console.error('✗ seedAdmin error:', err.message);
    process.exit(1);
  }
}

seedAdmin();