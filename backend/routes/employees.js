import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import Employee from '../models/Employee.js';
import { adminAuth, auth } from '../middleware/auth.js';   // ← added `auth`
import { parseDDMMYYYY } from '../utils/dateUtils.js';

const router = express.Router();

// ─── helpers ──────────────────────────────────────────────────────────────────

const generateInviteToken = () => uuidv4();

const constructInviteLink = (token) => {
  const base = process.env.FRONTEND_URL || 'http://localhost:3000';
  return `${base}/join/${token}`;
};

/** Safe employee payload — never expose password hashes */
const publicEmployee = (emp) => {
  const obj = emp.toObject ? emp.toObject() : { ...emp };
  delete obj.password;
  delete obj.tempPassword;
  delete obj.inviteToken;
  delete obj.inviteTokenExpires;
  return obj;
};

const roleVisibilityFilter = (requestingRole) => {
  if (requestingRole === 'superadmin') return {};
  return { role: 'employee' };
};

const resolveNewRole = (creatorRole, requestedRole) => {
  if (creatorRole === 'superadmin') {
    return ['employee', 'admin', 'superadmin'].includes(requestedRole)
      ? requestedRole
      : 'employee';
  }
  return 'employee';
};

// ─── GET /api/employees/me ────────────────────────────────────────────────────

router.get('/me', auth, async (req, res) => {
  try {
    const employee = await Employee.findOne({
      _id:       req.userId,
      isDeleted: false
    }).select('-password -tempPassword -inviteToken -inviteTokenExpires');

    if (!employee) {
      return res.status(404).json({ success: false, message: 'Profile not found' });
    }
    return res.json({ success: true, employee });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── PUT /api/employees/me ────────────────────────────────────────────────
router.put('/me', auth, async (req, res) => {
  try {
    const employee = await Employee.findOne({ _id: req.userId, isDeleted: false });
    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });

    // Only allow email & bank updates
    const allowedFields = ['email', 'bank'];

    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        // For bank, merge safely if employee.bank is empty
        if (field === 'bank') {
          employee.bank = { ...(employee.bank || {}), ...req.body.bank };
        } else {
          employee[field] = req.body[field];
        }
      }
    });

    // Check email uniqueness
    if (req.body.email) {
      const trimmed = req.body.email.toLowerCase().trim();
      const conflict = await Employee.findOne({ email: trimmed, _id: { $ne: req.userId }, isDeleted: false });
      if (conflict) {
        return res.status(409).json({ success: false, message: 'Email already exists', field: 'email' });
      }
      employee.email = trimmed;
    }

    await employee.save();
    return res.json({ success: true, message: 'Profile updated', employee: publicEmployee(employee) });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /api/employees ───────────────────────────────────────────────────────
router.get('/', adminAuth, async (req, res) => {
  try {
    const {
      status,
      department,
      search,
      includeArchived = 'false',
      page  = 1,
      limit = 200
    } = req.query;

    const query = {
      isDeleted: false,
      ...roleVisibilityFilter(req.role)
    };

    if (includeArchived !== 'true') query.isArchived = false;
    if (status)     query.status     = status;
    if (department) query.department = department;

    if (search) {
      query.$or = [
        { firstName:      { $regex: search, $options: 'i' } },
        { lastName:       { $regex: search, $options: 'i' } },
        { email:          { $regex: search, $options: 'i' } },
        { employeeNumber: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [employees, total] = await Promise.all([
      Employee.find(query)
        .select('-password -tempPassword -inviteToken -inviteTokenExpires')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      Employee.countDocuments(query)
    ]);

    return res.json({
      success: true,
      employees,
      pagination: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / Number(limit)) }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /api/employees/:id ───────────────────────────────────────────────────
router.get('/:id', adminAuth, async (req, res) => {
  try {
    const employee = await Employee.findOne({
      _id:       req.params.id,
      isDeleted: false,
      ...roleVisibilityFilter(req.role)
    }).select('-password -tempPassword -inviteToken -inviteTokenExpires');

    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }
    return res.json({ success: true, employee });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── POST /api/employees ──────────────────────────────────────────────────────
router.post('/', adminAuth, async (req, res) => {
  try {
    const {
      email, employeeNumber, firstName, lastName,
      department, joiningDate, shift,
      salaryType, hourlyRate, monthlySalary,
      bank,
      role: requestedRole
    } = req.body;

    if (!email || !employeeNumber || !firstName || !lastName || !department || !joiningDate) {
      return res.status(400).json({
        success: false,
        message: 'email, employeeNumber, firstName, lastName, department, and joiningDate are required'
      });
    }

    const resolvedRole = resolveNewRole(req.role, requestedRole);

    const existing = await Employee.findOne({
      $or: [
        { email: email.toLowerCase().trim() },
        { employeeNumber: employeeNumber.trim() }
      ],
      isDeleted: false
    });
    if (existing) {
      const field = existing.email === email.toLowerCase().trim() ? 'Email' : 'Employee number';
      return res.status(409).json({ success: false, message: `${field} already exists` });
    }

    let parsedJoiningDate = parseDDMMYYYY(joiningDate) || new Date(joiningDate);
    if (!parsedJoiningDate || isNaN(parsedJoiningDate)) {
      return res.status(400).json({ success: false, message: 'Invalid joiningDate. Use dd/mm/yyyy or YYYY-MM-DD' });
    }

    const resolvedSalaryType = salaryType || 'hourly';
    if (!['hourly', 'monthly'].includes(resolvedSalaryType)) {
      return res.status(400).json({ success: false, message: "salaryType must be 'hourly' or 'monthly'" });
    }
    if (resolvedSalaryType === 'monthly' && !monthlySalary) {
      return res.status(400).json({ success: false, message: 'monthlySalary is required when salaryType is monthly' });
    }

    const inviteToken = generateInviteToken();

    const employee = new Employee({
      email:              email.toLowerCase().trim(),
      employeeNumber:     employeeNumber.trim(),
      firstName:          firstName.trim(),
      lastName:           lastName.trim(),
      department,
      role:               resolvedRole,
      joiningDate:        parsedJoiningDate,
      shift:              shift || { start: '09:00', end: '18:00' },
      salaryType:         resolvedSalaryType,
      hourlyRate:         parseFloat(hourlyRate) || 0,
      monthlySalary:      resolvedSalaryType === 'monthly' ? parseFloat(monthlySalary) : null,
      status:             'Inactive',
      inviteToken,
      inviteTokenExpires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      bank:               bank || {}
    });

    await employee.save();

    return res.status(201).json({
      success:    true,
      message:    'Employee created. Invite link generated.',
      employee:   publicEmployee(employee),
      inviteLink: constructInviteLink(inviteToken)
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── PUT /api/employees/:id ───────────────────────────────────────────────────
router.put('/:id', adminAuth, async (req, res) => {
  try {
    if (String(req.userId) === String(req.params.id)) {
      return res.status(403).json({
        success: false,
        message: 'You cannot edit your own employee record. Contact another admin.'
      });
    }

    const employee = await Employee.findOne({
      _id:       req.params.id,
      isDeleted: false,
      ...roleVisibilityFilter(req.role)
    });
    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });

    // ── employeeNumber — check uniqueness before applying ─────────────────────
    if (req.body.employeeNumber !== undefined) {
      const trimmed = req.body.employeeNumber.trim();
      if (!trimmed) {
        return res.status(400).json({ success: false, message: 'Employee number cannot be empty', field: 'employeeNumber' });
      }
      const conflict = await Employee.findOne({
        employeeNumber: trimmed,
        isDeleted:      false,
        _id:            { $ne: req.params.id }   // exclude the employee being edited
      });
      if (conflict) {
        return res.status(409).json({
          success: false,
          message: 'Employee number already exists',
          field:   'employeeNumber'          // ← frontend uses this to target the field
        });
      }
      employee.employeeNumber = trimmed;
    }

    // ── email — check uniqueness before applying ──────────────────────────────
    if (req.body.email !== undefined) {
      const trimmed = req.body.email.toLowerCase().trim();
      if (!trimmed) {
        return res.status(400).json({ success: false, message: 'Email cannot be empty', field: 'email' });
      }
      const conflict = await Employee.findOne({
        email:     trimmed,
        isDeleted: false,
        _id:       { $ne: req.params.id }
      });
      if (conflict) {
        return res.status(409).json({
          success: false,
          message: 'Email already exists',
          field:   'email'
        });
      }
      employee.email = trimmed;
    }

    ['firstName', 'lastName', 'department', 'shift', 'bank'].forEach(f => {
      if (req.body[f] !== undefined) employee[f] = req.body[f];
    });

    if (req.body.role !== undefined) {
      if (req.role === 'superadmin') {
        if (!['employee', 'admin', 'superadmin'].includes(req.body.role)) {
          return res.status(400).json({ success: false, message: 'Invalid role' });
        }
        employee.role = req.body.role;
      }
    }

    if (req.body.salaryType !== undefined) {
      if (!['hourly', 'monthly'].includes(req.body.salaryType)) {
        return res.status(400).json({ success: false, message: "salaryType must be 'hourly' or 'monthly'" });
      }
      employee.salaryType = req.body.salaryType;
    }
    if (req.body.hourlyRate    !== undefined) employee.hourlyRate    = parseFloat(req.body.hourlyRate);
    if (req.body.monthlySalary !== undefined) employee.monthlySalary = req.body.monthlySalary ? parseFloat(req.body.monthlySalary) : null;

    if (employee.salaryType === 'monthly' && !employee.monthlySalary) {
      return res.status(400).json({ success: false, message: 'monthlySalary is required when salaryType is monthly' });
    }

    if (req.body.joiningDate) {
      const parsed = parseDDMMYYYY(req.body.joiningDate) || new Date(req.body.joiningDate);
      if (!parsed || isNaN(parsed)) {
        return res.status(400).json({ success: false, message: 'Invalid joiningDate. Use dd/mm/yyyy or YYYY-MM-DD' });
      }
      employee.joiningDate = parsed;
    }

    await employee.save();
    return res.json({ success: true, message: 'Employee updated', employee: publicEmployee(employee) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── PATCH /api/employees/:id/freeze ─────────────────────────────────────────
router.patch('/:id/freeze', adminAuth, async (req, res) => {
  try {
    if (String(req.userId) === String(req.params.id)) {
      return res.status(403).json({ success: false, message: 'You cannot freeze your own account' });
    }
    const employee = await Employee.findOne({ _id: req.params.id, isDeleted: false, ...roleVisibilityFilter(req.role) });
    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });

    if (employee.status === 'Inactive') {
      return res.status(400).json({ success: false, message: 'Cannot freeze an inactive account.' });
    }
    employee.status = employee.status === 'Frozen' ? 'Active' : 'Frozen';
    await employee.save();
    return res.json({ success: true, message: `Employee ${employee.status === 'Frozen' ? 'frozen' : 'unfrozen'}`, employee: publicEmployee(employee) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── PATCH /api/employees/:id/archive ────────────────────────────────────────
router.patch('/:id/archive', adminAuth, async (req, res) => {
  try {
    if (String(req.userId) === String(req.params.id)) {
      return res.status(403).json({ success: false, message: 'You cannot archive your own account' });
    }
    const employee = await Employee.findOne({ _id: req.params.id, isDeleted: false, ...roleVisibilityFilter(req.role) });
    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });

    employee.isArchived = !employee.isArchived;
    await employee.save();
    return res.json({ success: true, message: `Employee ${employee.isArchived ? 'archived' : 'unarchived'}`, employee: publicEmployee(employee) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── POST /api/employees/:id/resend-invite ────────────────────────────────────
router.post('/:id/resend-invite', adminAuth, async (req, res) => {
  try {
    const employee = await Employee.findOne({ _id: req.params.id, isDeleted: false, ...roleVisibilityFilter(req.role) });
    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });
    if (employee.status === 'Active') return res.status(400).json({ success: false, message: 'Employee is already activated' });

    employee.inviteToken        = generateInviteToken();
    employee.inviteTokenExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await employee.save();
    return res.json({ success: true, message: 'Invite resent', inviteLink: constructInviteLink(employee.inviteToken) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── POST /api/employees/:id/reset-password ───────────────────────────────────
router.post('/:id/reset-password', adminAuth, async (req, res) => {
  try {
    const employee = await Employee.findOne({ _id: req.params.id, isDeleted: false, ...roleVisibilityFilter(req.role) });
    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });

    const seg = () => Math.random().toString(36).slice(2, 6).toUpperCase();
    const tempPassword = `${seg()}-${seg()}-${seg()}`;
    employee.tempPassword = tempPassword;
    await employee.save();

    const revealInDev = process.env.NODE_ENV !== 'production' || process.env.RETURN_TEMP_PASSWORD === 'true';
    return res.json({ success: true, message: 'Temporary password generated.', ...(revealInDev && { tempPassword }) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── DELETE /api/employees/:id ────────────────────────────────────────────────
router.delete('/:id', adminAuth, async (req, res) => {
  try {
    if (String(req.userId) === String(req.params.id)) {
      return res.status(403).json({ success: false, message: 'You cannot delete your own account' });
    }
    const employee = await Employee.findOne({ _id: req.params.id, isDeleted: false, ...roleVisibilityFilter(req.role) });
    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });

    employee.isDeleted  = true;
    employee.isArchived = true;
    employee.status     = 'Inactive';
    await employee.save();
    return res.json({ success: true, message: 'Employee deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;