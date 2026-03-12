// routes/auth.js

import express from 'express';
import jwt from 'jsonwebtoken';
import Employee from '../models/Employee.js';
import Verification from '../models/Verification.js';
import { sendPasswordResetEmail } from '../utils/mailer.js';
import { auth } from '../middleware/auth.js';

const router = express.Router();
import dotenv from 'dotenv';

dotenv.config();

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


// routes/auth.js  — ADD THESE TWO ROUTES to your existing auth router


router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    const employee = await Employee.findOne({
      email:     email.toLowerCase().trim(),
      isDeleted: false,
      status:    { $ne: 'Frozen' }
    });

    // Always respond 200 — never reveal whether the email exists
    if (!employee) {
      return res.json({
        success: true,
        message: 'If that email is registered, a reset link has been sent.'
      });
    }

    const plainToken = await Verification.createForEmail(employee.email, 15); // 15-min TTL

    await sendPasswordResetEmail(employee.email, employee.firstName, plainToken);

    return res.json({
      success: true,
      message: 'If that email is registered, a reset link has been sent.'
    });
  } catch (err) {
    console.error('[forgot-password]', err);
    res.status(500).json({ success: false, message: 'Failed to send reset email. Please try again.' });
  }
});

// ─── POST /api/auth/reset-password ───────────────────────────────────────────
// Validates the token from the email link and sets a new password.

router.post('/reset-password', async (req, res) => {
  try {
    const { email, token, newPassword } = req.body;

    if (!email || !token || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'email, token, and newPassword are required'
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters'
      });
    }

    const verification = await Verification.findValid(email, token);

    if (!verification) {
      return res.status(400).json({
        success: false,
        message: 'Reset link is invalid or has expired. Please request a new one.'
      });
    }

    const employee = await Employee.findOne({
      email:     email.toLowerCase().trim(),
      isDeleted: false
    });

    if (!employee) {
      return res.status(404).json({ success: false, message: 'Account not found' });
    }

    employee.password = newPassword;   // hashed by pre-save hook
    await employee.save();

    // Invalidate the token immediately after use
    await verification.deleteOne();

    return res.json({ success: true, message: 'Password has been reset successfully. You can now log in.' });
  } catch (err) {
    console.error('[reset-password]', err);
    res.status(500).json({ success: false, message: err.message });
  }
});


router.post('/verify-reset-token', async (req, res) => {
  try {
    const { email, token } = req.body;

    if (!email || !token) {
      return res.status(400).json({ success: false, valid: false, message: 'email and token are required' });
    }

    const verification = await Verification.findValid(email, token);

    if (!verification) {
      return res.status(400).json({
        success: false,
        valid:   false,
        message: 'Reset link is invalid or has expired.'
      });
    }

    // Tell the client it's valid and how many seconds remain
    const secondsLeft = Math.floor((new Date(verification.expiresAt) - Date.now()) / 1000);

    return res.json({ success: true, valid: true, expiresInSeconds: secondsLeft });
  } catch (err) {
    console.error('[verify-reset-token]', err);
    res.status(500).json({ success: false, valid: false, message: err.message });
  }
});

export default router;