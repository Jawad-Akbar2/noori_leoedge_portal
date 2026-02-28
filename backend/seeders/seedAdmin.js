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
  // ── leo edge Agents (hourly) ───────────────────────────────────────────
{
  email: 'iqbalrafay9@gmail.com',
  employeeNumber: '1',
  firstName: 'Rafay',
  lastName: 'Iqbal',
  department: 'Customer Support',
  role: 'employee',
  joiningDate: new Date(Date.now() - 49 * 86_400_000),
  shift: { start: '14:00', end: '23:00' },
  salaryType: 'hourly',
  hourlyRate: 354,
  monthlySalary: null,
  status: 'Active',
  password: 'iqbalrafay9@123456'
},
{
  email: 'mutiurrehman29@gmail.com',
  employeeNumber: '5',
  firstName: 'Muti',
  lastName: 'Rehman',
  department: 'Customer Support',
  role: 'employee',
  joiningDate: new Date(Date.now() - 49 * 86_400_000),
  shift: { start: '14:00', end: '23:00' },
  salaryType: 'hourly',
  hourlyRate: 343,
  monthlySalary: null,
  status: 'Active',
  password: 'mutiurrehman29@123456'
},
{
  email: 'samiur665@gmail.com',
  employeeNumber: '14',
  firstName: 'Sami',
  lastName: 'Rehman',
  department: 'Customer Support',
  role: 'employee',
  joiningDate: new Date(Date.now() - 49 * 86_400_000),
  shift: { start: '22:00', end: '07:00' },
  salaryType: 'hourly',
  hourlyRate: 303,
  monthlySalary: null,
  status: 'Active',
  password: 'samiur665@123456'
},
{
  email: 'ammarkhalid730@gmail.com',
  employeeNumber: '7',
  firstName: 'Muhammad Ammar',
  lastName: 'Khalid',
  department: 'Customer Support',
  role: 'employee',
  joiningDate: new Date(Date.now() - 49 * 86_400_000),
  shift: { start: '06:00', end: '15:00' },
  salaryType: 'hourly',
  hourlyRate: 278,
  monthlySalary: null,
  status: 'Active',
  password: 'ammarkhalid730@123456'
},
{
  email: 'shampiii147@gmail.com',
  employeeNumber: '9',
  firstName: 'Hamza',
  lastName: 'Shakeel',
  department: 'Customer Support',
  role: 'employee',
  joiningDate: new Date(Date.now() - 49 * 86_400_000),
  shift: { start: '06:00', end: '15:00' },
  salaryType: 'hourly',
  hourlyRate: 278,
  monthlySalary: null,
  status: 'Active',
  password: 'shampiii147@123456'
},
{
  email: 'fauzbabar015@gmail.com',
  employeeNumber: '4',
  firstName: 'Fauz',
  lastName: 'Babar',
  department: 'Customer Support',
  role: 'employee',
  joiningDate: new Date(Date.now() - 49 * 86_400_000),
  shift: { start: '14:00', end: '23:00' },
  salaryType: 'hourly',
  hourlyRate: 278,
  monthlySalary: null,
  status: 'Active',
  password: 'fauzbabar015@123456'
},
{
  email: 'momin.23166@gmail.com',
  employeeNumber: '16',
  firstName: 'Momin',
  lastName: 'Munir',
  department: 'Customer Support',
  role: 'employee',
  joiningDate: new Date(Date.now() - 49 * 86_400_000),
  shift: { start: '22:00', end: '07:00' },
  salaryType: 'hourly',
  hourlyRate: 278,
  monthlySalary: null,
  status: 'Active',
  password: 'momin.23166@123456'
},
{
  email: 'Hammadbhai151@gmail.com',
  employeeNumber: '11',
  firstName: 'Hammad',
  lastName: 'Nadeem',
  department: 'Customer Support',
  role: 'employee',
  joiningDate: new Date(Date.now() - 49 * 86_400_000),
  shift: { start: '06:00', end: '15:00' },
  salaryType: 'hourly',
  hourlyRate: 278,
  monthlySalary: null,
  status: 'Active',
  password: 'Hammadbhai151@123456'
},
{
  email: 'maazusmanpk@gmail.com',
  employeeNumber: '6',
  firstName: 'Maaz',
  lastName: 'Usman',
  department: 'Customer Support',
  role: 'employee',
  joiningDate: new Date(Date.now() - 49 * 86_400_000),
  shift: { start: '14:00', end: '23:00' },
  salaryType: 'hourly',
  hourlyRate: 278,
  monthlySalary: null,
  status: 'Active',
  password: 'maazusmanpk@123456'
},
{
  email: 'Kurd.abdulahad22@gmail.com',
  employeeNumber: '13',
  firstName: 'Abdul',
  lastName: 'Ahad',
  department: 'Customer Support',
  role: 'employee',
  joiningDate: new Date(Date.now() - 49 * 86_400_000),
  shift: { start: '22:00', end: '07:00' },
  salaryType: 'hourly',
  hourlyRate: 278,
  monthlySalary: null,
  status: 'Active',
  password: 'Kurd.abdulahad22@123456'
},
{
  email: 'chaudharysam302@gmail.com',
  employeeNumber: '15',
  firstName: 'Osama',
  lastName: 'Babar',
  department: 'Customer Support',
  role: 'employee',
  joiningDate: new Date(Date.now() - 49 * 86_400_000),
  shift: { start: '22:00', end: '07:00' },
  salaryType: 'hourly',
  hourlyRate: 278,
  monthlySalary: null,
  status: 'Active',
  password: 'chaudharysam302@123456'
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