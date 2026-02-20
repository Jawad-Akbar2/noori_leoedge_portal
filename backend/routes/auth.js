import express from 'express';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import Employee from '../models/Employee.js';

const router = express.Router();

// **LOGIN ENDPOINT: Single endpoint, no role parameter**
// Backend determines role from department field
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password required' });
    }

    const employee = await Employee.findOne({ email, isDeleted: false });
    
    if (!employee) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    if (employee.status === 'Inactive' && !employee.inviteToken) {
      return res.status(401).json({ message: 'Account not activated. Please check your email for activation link.' });
    }

    const isMatch = await employee.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Determine role based on department
    const role = employee.department === 'Manager' ? 'admin' : 'employee';

    // Create JWT token
    const token = jwt.sign(
      { 
        id: employee._id, 
        email: employee.email,
        role: role
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE }
    );

    res.json({
      token,
      user: {
        id: employee._id,
        email: employee.email,
        firstName: employee.firstName,
        lastName: employee.lastName,
        department: employee.department,
        role: role,
        employeeNumber: employee.employeeNumber,
        status: employee.status
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Employee Onboarding
router.post('/employee/onboard', async (req, res) => {
  try {
    const { token, firstName, lastName, password, bankDetails } = req.body;
    
    const employee = await Employee.findOne({
      inviteToken: token,
      inviteTokenExpires: { $gt: Date.now() }
    });
    
    if (!employee) {
      return res.status(400).json({ message: 'Invalid or expired token' });
    }
    
    employee.firstName = firstName;
    employee.lastName = lastName;
    employee.password = password;
    employee.bank = bankDetails;
    employee.status = 'Active';
    employee.inviteToken = undefined;
    employee.inviteTokenExpires = undefined;
    
    await employee.save();
    
    const role = employee.department === 'Manager' ? 'admin' : 'employee';
    
    const authToken = jwt.sign(
      { id: employee._id, role: role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE }
    );
    
    res.json({
      message: 'Onboarding complete',
      token: authToken,
      user: {
        id: employee._id,
        email: employee.email,
        firstName: employee.firstName,
        lastName: employee.lastName,
        role: role,
        status: employee.status
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Validate Token
router.post('/validate-token', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'No token' });
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await Employee.findById(decoded.id).select('-password -tempPassword');
    
    if (!user) return res.status(404).json({ message: 'User not found' });
    
    const role = decoded.role || (user.department === 'Manager' ? 'admin' : 'employee');
    
    res.json({ 
      valid: true, 
      user: { ...user.toObject(), role },
      role 
    });
  } catch (error) {
    res.status(401).json({ message: 'Invalid token' });
  }
});

// Change Password
router.post('/change-password', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { newPassword } = req.body;

    const employee = await Employee.findById(decoded.id);
    if (!employee) return res.status(404).json({ message: 'Employee not found' });

    employee.password = newPassword;
    await employee.save();

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;