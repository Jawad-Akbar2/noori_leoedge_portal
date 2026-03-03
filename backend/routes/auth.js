// routes/auth.js

import express from 'express';
import jwt from 'jsonwebtoken';
import Employee from '../models/Employee.js';
import { auth } from '../middleware/auth.js';

const router = express.Router();

// ─── helpers ──────────────────────────────────────────────────────────────────

/** Safe user payload — never expose password hashes */
const publicUser = (emp) => ({
  id:             emp._id,
  email:          emp.email,
  firstName:      emp.firstName,
  lastName:       emp.lastName,
  employeeNumber: emp.employeeNumber,
  department:     emp.department,
  role:           emp.role,          // source of truth: DB field, not department
  status:         emp.status,
  shift:          emp.shift
});

const signToken = (emp) =>
  jwt.sign(
    { id: emp._id, email: emp.email, role: emp.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '8h' }
  );

// ─── POST /api/auth/login ─────────────────────────────────────────────────────

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    const employee = await Employee.findOne({
      email: email.toLowerCase().trim(),
      isDeleted: false
    });

    // Use a generic message — don't reveal whether email exists
    if (!employee) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Frozen accounts cannot log in at all
    if (employee.status === 'Frozen') {
      return res.status(403).json({
        success: false,
        message: 'Account is frozen. Please contact your administrator.'
      });
    }

    // Inactive + no invite token = never activated
    if (employee.status === 'Inactive' && !employee.inviteToken) {
      return res.status(401).json({
        success: false,
        message: 'Account not yet activated. Please check your email for an activation link.'
      });
    }

    const isMatch = await employee.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const token = signToken(employee);

    return res.json({
      success: true,
      token,
      user: publicUser(employee)
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});


// logout
// Since we're using JWTs, logout is handled client-side by simply deleting the token.


// ─── POST /api/auth/employee-onboard ─────────────────────────────────────────
// Called when a new employee clicks the invite link and sets up their account.

router.post('/employee-onboard', async (req, res) => {
  try {
    const { token, firstName, lastName, password, bankDetails } = req.body;

    if (!token || !firstName || !lastName || !password) {
      return res.status(400).json({
        success: false,
        message: 'token, firstName, lastName, and password are required'
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters'
      });
    }

    const employee = await Employee.findOne({
      inviteToken:        token,
      inviteTokenExpires: { $gt: Date.now() }
    });

    if (!employee) {
      return res.status(400).json({
        success: false,
        message: 'Invitation link is invalid or has expired'
      });
    }

    employee.firstName          = firstName.trim();
    employee.lastName           = lastName.trim();
    employee.password           = password;          // hashed by pre-save hook
    employee.bank               = bankDetails || {};
    employee.status             = 'Active';
    employee.inviteToken        = undefined;
    employee.inviteTokenExpires = undefined;

    await employee.save();

    // Auto-login after onboarding
    const jwtToken = signToken(employee);

    return res.json({
      success: true,
      message: 'Onboarding complete. Welcome!',
      token:   jwtToken,
      user:    publicUser(employee)
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /api/auth/validate-token ────────────────────────────────────────────
// Frontend calls this on app load to check if stored token is still valid.
// Uses `auth` middleware — it handles token verification and user loading.

router.get('/validate-token', auth, async (req, res) => {
  try {
    // req.user is already loaded and sanitised by auth middleware
    return res.json({
      success: true,
      valid:   true,
      user:    publicUser(req.user),
      role:    req.user.role
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── POST /api/auth/change-password ──────────────────────────────────────────
// Any authenticated user can change their own password.
// Requires the current password to prevent session-hijack password changes.

router.post('/change-password', auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'currentPassword and newPassword are required'
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 8 characters'
      });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({
        success: false,
        message: 'New password must be different from current password'
      });
    }

    // Reload with password hash (auth middleware selects -password)
    const employee = await Employee.findById(req.userId);
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    const isMatch = await employee.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect' });
    }

    employee.password = newPassword;   // hashed by pre-save hook
    await employee.save();

    return res.json({ success: true, message: 'Password changed successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;