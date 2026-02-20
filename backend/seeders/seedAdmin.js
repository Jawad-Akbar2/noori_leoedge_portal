import mongoose from 'mongoose';
import Employee from '../models/Employee.js';
import dotenv from 'dotenv';

dotenv.config();

async function seedAdmin() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✓ Connected to MongoDB');

    // Check if admin exists
    const adminExists = await Employee.findOne({ email: 'admin@example.com' });
    if (adminExists) {
      console.log('✓ Admin already exists');
      process.exit(0);
    }

    // Create admin user
    const admin = new Employee({
      email: 'admin@example.com',
      employeeNumber: 'ADMIN001',
      firstName: 'Admin',
      lastName: 'User',
      department: 'Manager',
      role: 'admin',
      joiningDate: new Date(),
      shift: { start: '09:00', end: '18:00' },
      hourlyRate: 500,
      status: 'Active',
      password: 'Admin@123456'
    });

    await admin.save();
    console.log('✓ Admin user created successfully');
    console.log('  Email: admin@example.com');
    console.log('  Password: Admin@123456');

    // Create a test employee
    const employee = new Employee({
      email: 'employee@example.com',
      employeeNumber: 'EMP001',
      firstName: 'John',
      lastName: 'Doe',
      department: 'IT',
      role: 'employee',
      joiningDate: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000), // 100 days ago
      shift: { start: '09:00', end: '18:00' },
      hourlyRate: 300,
      status: 'Active',
      password: 'Employee@123456'
    });

    await employee.save();
    console.log('✓ Test employee created');
    console.log('  Email: employee@example.com');
    console.log('  Password: Employee@123456');

    process.exit(0);
  } catch (error) {
    console.error('✗ Seeding error:', error.message);
    process.exit(1);
  }
}

seedAdmin();