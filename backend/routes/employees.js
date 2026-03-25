import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import Employee from '../models/Employee.js';
import { adminAuth, auth } from '../middleware/auth.js';
import { parseDDMMYYYY } from '../utils/dateUtils.js';

const router = express.Router();

// ─── helpers ──────────────────────────────────────────────────────────────────

const generateInviteToken = () => uuidv4();

const constructInviteLink = (token) => {
  const base = process.env.FRONTEND_URL || 'http://localhost:3000';
  return `${base}/join/${token}`;
};

/** Safe employee payload — never expose password hashes or tokens */
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

// ─── Helper function to validate and process Base64 image ───────────────────
const processBase64Image = (base64String, existingFileName = null) => {
  if (!base64String) return null;
  
  const base64Regex = /^data:image\/(jpeg|jpg|png|gif|webp);base64,/;
  if (!base64Regex.test(base64String)) {
    throw new Error('Invalid image format. Must be JPEG, PNG, GIF, or WebP');
  }
  
  const mimeType = base64String.match(/^data:([^;]+);/)[1];
  const extension = mimeType.split('/')[1];
  const fileName = existingFileName || `profile_${Date.now()}.${extension}`;
  
  return {
    data: base64String,
    fileName,
    mimeType,
    uploadedAt: new Date()
  };
};

// ─── PUT /api/employees/me/profile-picture ────────────────────────────────────
router.put('/me/profile-picture', auth, async (req, res) => {
  try {
    const { profilePicture } = req.body;
    
    if (!profilePicture) {
      return res.status(400).json({ success: false, message: 'Profile picture data is required', field: 'profilePicture' });
    }
    
    const employee = await Employee.findOne({ _id: req.userId, isDeleted: false });
    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });
    
    const processedImage = processBase64Image(profilePicture, employee.profilePicture?.fileName);
    employee.profilePicture = processedImage;
    await employee.save();
    
    return res.json({
      success: true,
      message: 'Profile picture updated successfully',
      profilePicture: {
        url: processedImage.data.substring(0, 100) + '...',
        fileName: processedImage.fileName,
        mimeType: processedImage.mimeType,
        uploadedAt: processedImage.uploadedAt
      }
    });
  } catch (err) {
    if (err.message.includes('Invalid image')) {
      return res.status(400).json({ success: false, message: err.message, field: 'profilePicture' });
    }
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── DELETE /api/employees/me/profile-picture ─────────────────────────────────
router.delete('/me/profile-picture', auth, async (req, res) => {
  try {
    const employee = await Employee.findOne({ _id: req.userId, isDeleted: false });
    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });
    
    employee.profilePicture = { data: null, fileName: null, mimeType: null, uploadedAt: null };
    await employee.save();
    
    return res.json({ success: true, message: 'Profile picture removed successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /api/employees/me/profile-picture ───────────────────────────────────
router.get('/me/profile-picture', auth, async (req, res) => {
  try {
    const employee = await Employee.findOne({ _id: req.userId, isDeleted: false }).select('profilePicture');
    
    if (!employee || !employee.profilePicture?.data) {
      return res.status(404).json({ success: false, message: 'Profile picture not found' });
    }
    
    return res.json({
      success: true,
      profilePicture: {
        data: employee.profilePicture.data,
        fileName: employee.profilePicture.fileName,
        mimeType: employee.profilePicture.mimeType,
        uploadedAt: employee.profilePicture.uploadedAt
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── PUT /api/employees/:id/profile-picture (Admin) ─────────────────────────
router.put('/:id/profile-picture', adminAuth, async (req, res) => {
  try {
    const { profilePicture } = req.body;
    
    if (!profilePicture) {
      return res.status(400).json({ success: false, message: 'Profile picture data is required', field: 'profilePicture' });
    }
    
    const employee = await Employee.findOne({
      _id: req.params.id,
      isDeleted: false,
      ...roleVisibilityFilter(req.role),
    });
    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });
    
    const processedImage = processBase64Image(profilePicture, employee.profilePicture?.fileName);
    employee.profilePicture = processedImage;
    await employee.save();
    
    return res.json({
      success: true,
      message: 'Profile picture updated successfully',
      profilePicture: {
        fileName: processedImage.fileName,
        mimeType: processedImage.mimeType,
        uploadedAt: processedImage.uploadedAt
      }
    });
  } catch (err) {
    if (err.message.includes('Invalid image')) {
      return res.status(400).json({ success: false, message: err.message, field: 'profilePicture' });
    }
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── DELETE /api/employees/:id/profile-picture (Admin) ─────────────────────
router.delete('/:id/profile-picture', adminAuth, async (req, res) => {
  try {
    const employee = await Employee.findOne({
      _id: req.params.id,
      isDeleted: false,
      ...roleVisibilityFilter(req.role),
    });
    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });
    
    employee.profilePicture = { data: null, fileName: null, mimeType: null, uploadedAt: null };
    await employee.save();
    
    return res.json({ success: true, message: 'Profile picture removed successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /api/employees/:id/profile-picture ─────────────────────────────────
router.get('/:id/profile-picture', auth, async (req, res) => {
  try {
    const employee = await Employee.findOne({ _id: req.params.id, isDeleted: false }).select('profilePicture');
    
    if (!employee || !employee.profilePicture?.data) {
      return res.status(404).json({ success: false, message: 'Profile picture not found' });
    }
    
    return res.json({
      success: true,
      profilePicture: {
        data: employee.profilePicture.data,
        fileName: employee.profilePicture.fileName,
        mimeType: employee.profilePicture.mimeType,
        uploadedAt: employee.profilePicture.uploadedAt
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /api/employees/me ────────────────────────────────────────────────────
router.get('/me', auth, async (req, res) => {
  try {
    const employee = await Employee.findOne({
      _id: req.userId,
      isDeleted: false,
    }).select('-password -tempPassword -inviteToken -inviteTokenExpires');

    if (!employee) {
      return res.status(404).json({ success: false, message: 'Profile not found' });
    }
    return res.json({ success: true, employee });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── PUT /api/employees/me ────────────────────────────────────────────────────
// Any authenticated user can update their own:
//   • email, bank, emergencyContact (optional), address (optional), idCard (front + back)

router.put('/me', auth, async (req, res) => {
  try {
    const employee = await Employee.findOne({ _id: req.userId, isDeleted: false });
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    // ── Email ──────────────────────────────────────────────────────────────────
    if (req.body.email !== undefined) {
      const trimmed = req.body.email.toLowerCase().trim();
      if (!trimmed) return res.status(400).json({ success: false, message: 'Email cannot be empty', field: 'email' });
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(trimmed)) return res.status(400).json({ success: false, message: 'Invalid email format', field: 'email' });
      const conflict = await Employee.findOne({ email: trimmed, _id: { $ne: req.userId }, isDeleted: false });
      if (conflict) return res.status(409).json({ success: false, message: 'Email already in use', field: 'email' });
      employee.email = trimmed;
    }

    // ── Bank ───────────────────────────────────────────────────────────────────
    if (req.body.bank !== undefined) {
      const inc = req.body.bank;
      employee.bank = {
        bankName:      inc.bankName      !== undefined ? String(inc.bankName      || '').trim() : (employee.bank?.bankName      || ''),
        accountName:   inc.accountName   !== undefined ? String(inc.accountName   || '').trim() : (employee.bank?.accountName   || ''),
        accountNumber: inc.accountNumber !== undefined ? String(inc.accountNumber || '').trim() : (employee.bank?.accountNumber || ''),
      };
    }

    // ── Emergency contact (optional) ──────────────────────────────────────────
    if (req.body.emergencyContact !== undefined) {
      const inc = req.body.emergencyContact;
      if (typeof inc !== 'object' || Array.isArray(inc)) {
        return res.status(400).json({ success: false, message: 'emergencyContact must be an object', field: 'emergencyContact' });
      }
      employee.emergencyContact = {
        name:         inc.name         !== undefined ? String(inc.name         || '').trim() : (employee.emergencyContact?.name         || ''),
        relationship: inc.relationship !== undefined ? String(inc.relationship || '').trim() : (employee.emergencyContact?.relationship || ''),
        phone:        inc.phone        !== undefined ? String(inc.phone        || '').trim() : (employee.emergencyContact?.phone        || ''),
      };
    }

    // ── Address (optional) ────────────────────────────────────────────────────
    if (req.body.address !== undefined) {
      const inc = req.body.address;
      if (typeof inc !== 'object' || Array.isArray(inc)) {
        return res.status(400).json({ success: false, message: 'address must be an object', field: 'address' });
      }
      employee.address = {
        street:  inc.street  !== undefined ? String(inc.street  || '').trim() : (employee.address?.street  || ''),
        city:    inc.city    !== undefined ? String(inc.city    || '').trim() : (employee.address?.city    || ''),
        state:   inc.state   !== undefined ? String(inc.state   || '').trim() : (employee.address?.state   || ''),
        zip:     inc.zip     !== undefined ? String(inc.zip     || '').trim() : (employee.address?.zip     || ''),
        country: inc.country !== undefined ? String(inc.country || '').trim() : (employee.address?.country || ''),
      };
    }

    // ── ID card (front + back, both optional but if provided both are stored) ──
    if (req.body.idCard !== undefined) {
      const inc = req.body.idCard;
      if (typeof inc !== 'object' || Array.isArray(inc)) {
        return res.status(400).json({ success: false, message: 'idCard must be an object', field: 'idCard' });
      }

      // front
      if (inc.front !== undefined) {
        if (inc.front === null) {
          employee.idCard.front = { url: null, fileName: null, uploadedAt: null };
        } else if (inc.front.url !== undefined) {
          const trimmedUrl = String(inc.front.url).trim();
          if (!trimmedUrl) return res.status(400).json({ success: false, message: 'idCard.front.url cannot be empty', field: 'idCard.front.url' });
          employee.idCard = employee.idCard || {};
          employee.idCard.front = {
            url:        trimmedUrl,
            fileName:   inc.front.fileName ? String(inc.front.fileName).trim() : (employee.idCard?.front?.fileName || null),
            uploadedAt: new Date(),
          };
        }
      }

      // back
      if (inc.back !== undefined) {
        if (inc.back === null) {
          employee.idCard.back = { url: null, fileName: null, uploadedAt: null };
        } else if (inc.back.url !== undefined) {
          const trimmedUrl = String(inc.back.url).trim();
          if (!trimmedUrl) return res.status(400).json({ success: false, message: 'idCard.back.url cannot be empty', field: 'idCard.back.url' });
          employee.idCard = employee.idCard || {};
          employee.idCard.back = {
            url:        trimmedUrl,
            fileName:   inc.back.fileName ? String(inc.back.fileName).trim() : (employee.idCard?.back?.fileName || null),
            uploadedAt: new Date(),
          };
        }
      }
    }

    await employee.save();
    return res.json({ success: true, message: 'Profile updated', employee: publicEmployee(employee) });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: 'Email already in use', field: 'email' });
    }
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /api/employees ───────────────────────────────────────────────────────
router.get('/', adminAuth, async (req, res) => {
  try {
    const {
      status, department, search,
      includeArchived = 'false',
      page = 1, limit = 200,
    } = req.query;

    const query = { isDeleted: false, ...roleVisibilityFilter(req.role) };
    if (includeArchived !== 'true') query.isArchived = false;
    if (status)     query.status     = status;
    if (department) query.department = department;
    if (search) {
      query.$or = [
        { firstName:      { $regex: search, $options: 'i' } },
        { lastName:       { $regex: search, $options: 'i' } },
        { email:          { $regex: search, $options: 'i' } },
        { employeeNumber: { $regex: search, $options: 'i' } },
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
      Employee.countDocuments(query),
    ]);

    return res.json({
      success: true,
      employees,
      pagination: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / Number(limit)) },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /api/employees/:id ───────────────────────────────────────────────────
router.get('/:id', adminAuth, async (req, res) => {
  try {
    const employee = await Employee.findOne({
      _id: req.params.id,
      isDeleted: false,
      ...roleVisibilityFilter(req.role),
    }).select('-password -tempPassword -inviteToken -inviteTokenExpires');

    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });
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
      bank, role: requestedRole,
    } = req.body;

    if (!email || !employeeNumber || !firstName || !lastName || !department || !joiningDate) {
      return res.status(400).json({
        success: false,
        message: 'email, employeeNumber, firstName, lastName, department, and joiningDate are required',
      });
    }

    const resolvedRole = resolveNewRole(req.role, requestedRole);

    const existing = await Employee.findOne({
      $or: [{ email: email.toLowerCase().trim() }, { employeeNumber: employeeNumber.trim() }],
      isDeleted: false,
    });
    if (existing) {
      const field = existing.email === email.toLowerCase().trim() ? 'Email' : 'Employee number';
      return res.status(409).json({ success: false, message: `${field} already exists` });
    }

    const parsedJoiningDate = parseDDMMYYYY(joiningDate) || new Date(joiningDate);
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
      bank:               bank || {},
    });

    await employee.save();
    return res.status(201).json({
      success: true,
      message: 'Employee created. Invite link generated.',
      employee: publicEmployee(employee),
      inviteLink: constructInviteLink(inviteToken),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── PUT /api/employees/:id ───────────────────────────────────────────────────
// FIX: Now also handles emergencyContact, address, and idCard (front+back)

router.put('/:id', adminAuth, async (req, res) => {
  try {
    if (String(req.userId) === String(req.params.id) && req.role !== 'superadmin') {
      return res.status(403).json({ success: false, message: 'Use the profile page to edit your own account.' });
    }

    const employee = await Employee.findOne({
      _id: req.params.id,
      isDeleted: false,
      ...roleVisibilityFilter(req.role),
    });
    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });

    // ── employeeNumber ─────────────────────────────────────────────────────────
    if (req.body.employeeNumber !== undefined) {
      const trimmed = req.body.employeeNumber.trim();
      if (!trimmed) return res.status(400).json({ success: false, message: 'Employee number cannot be empty', field: 'employeeNumber' });
      const conflict = await Employee.findOne({ employeeNumber: trimmed, isDeleted: false, _id: { $ne: req.params.id } });
      if (conflict) return res.status(409).json({ success: false, message: 'Employee number already exists', field: 'employeeNumber' });
      employee.employeeNumber = trimmed;
    }

    // ── email ──────────────────────────────────────────────────────────────────
    if (req.body.email !== undefined) {
      const trimmed = req.body.email.toLowerCase().trim();
      if (!trimmed) return res.status(400).json({ success: false, message: 'Email cannot be empty', field: 'email' });
      const conflict = await Employee.findOne({ email: trimmed, isDeleted: false, _id: { $ne: req.params.id } });
      if (conflict) return res.status(409).json({ success: false, message: 'Email already exists', field: 'email' });
      employee.email = trimmed;
    }

    // ── Basic fields ───────────────────────────────────────────────────────────
    ['firstName', 'lastName', 'department', 'shift', 'bank'].forEach(f => {
      if (req.body[f] !== undefined) employee[f] = req.body[f];
    });

    // ── Role (superadmin only) ─────────────────────────────────────────────────
    if (req.body.role !== undefined && req.role === 'superadmin') {
      if (!['employee', 'admin', 'superadmin', 'hybrid'].includes(req.body.role)) {
        return res.status(400).json({ success: false, message: 'Invalid role' });
      }
      employee.role = req.body.role;
    }

    // ── Salary ─────────────────────────────────────────────────────────────────
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

    // ── Joining date ───────────────────────────────────────────────────────────
    if (req.body.joiningDate) {
      const parsed = parseDDMMYYYY(req.body.joiningDate) || new Date(req.body.joiningDate);
      if (!parsed || isNaN(parsed)) {
        return res.status(400).json({ success: false, message: 'Invalid joiningDate. Use dd/mm/yyyy or YYYY-MM-DD' });
      }
      employee.joiningDate = parsed;
    }

    // ── Emergency contact (optional) — merge patch ────────────────────────────
    if (req.body.emergencyContact !== undefined) {
      const inc = req.body.emergencyContact;
      if (typeof inc !== 'object' || Array.isArray(inc)) {
        return res.status(400).json({ success: false, message: 'emergencyContact must be an object', field: 'emergencyContact' });
      }
      employee.emergencyContact = {
        name:         inc.name         !== undefined ? String(inc.name         || '').trim() : (employee.emergencyContact?.name         || ''),
        relationship: inc.relationship !== undefined ? String(inc.relationship || '').trim() : (employee.emergencyContact?.relationship || ''),
        phone:        inc.phone        !== undefined ? String(inc.phone        || '').trim() : (employee.emergencyContact?.phone        || ''),
      };
    }

    // ── Address (optional) — merge patch ──────────────────────────────────────
    if (req.body.address !== undefined) {
      const inc = req.body.address;
      if (typeof inc !== 'object' || Array.isArray(inc)) {
        return res.status(400).json({ success: false, message: 'address must be an object', field: 'address' });
      }
      employee.address = {
        street:  inc.street  !== undefined ? String(inc.street  || '').trim() : (employee.address?.street  || ''),
        city:    inc.city    !== undefined ? String(inc.city    || '').trim() : (employee.address?.city    || ''),
        state:   inc.state   !== undefined ? String(inc.state   || '').trim() : (employee.address?.state   || ''),
        zip:     inc.zip     !== undefined ? String(inc.zip     || '').trim() : (employee.address?.zip     || ''),
        country: inc.country !== undefined ? String(inc.country || '').trim() : (employee.address?.country || ''),
      };
    }

    // ── ID card front + back (optional) ───────────────────────────────────────
    if (req.body.idCard !== undefined) {
      const inc = req.body.idCard;
      if (typeof inc !== 'object' || Array.isArray(inc)) {
        return res.status(400).json({ success: false, message: 'idCard must be an object', field: 'idCard' });
      }
      if (inc.front !== undefined) {
        if (inc.front === null) {
          employee.idCard.front = { url: null, fileName: null, uploadedAt: null };
        } else if (inc.front.url !== undefined) {
          employee.idCard = employee.idCard || {};
          employee.idCard.front = {
            url:        String(inc.front.url).trim(),
            fileName:   inc.front.fileName ? String(inc.front.fileName).trim() : (employee.idCard?.front?.fileName || null),
            uploadedAt: new Date(),
          };
        }
      }
      if (inc.back !== undefined) {
        if (inc.back === null) {
          employee.idCard.back = { url: null, fileName: null, uploadedAt: null };
        } else if (inc.back.url !== undefined) {
          employee.idCard = employee.idCard || {};
          employee.idCard.back = {
            url:        String(inc.back.url).trim(),
            fileName:   inc.back.fileName ? String(inc.back.fileName).trim() : (employee.idCard?.back?.fileName || null),
            uploadedAt: new Date(),
          };
        }
      }
    }

    await employee.save();
    return res.json({ success: true, message: 'Employee updated', employee: publicEmployee(employee) });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: 'Duplicate key — email or employee number already exists' });
    }
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── PATCH /api/employees/:id/freeze ─────────────────────────────────────────
router.patch('/:id/freeze', adminAuth, async (req, res) => {
  try {
    if (String(req.userId) === String(req.params.id)) {
      return res.status(403).json({ success: false, message: 'You cannot freeze your own account' });
    }
    const employee = await Employee.findOne({
      _id: req.params.id, isDeleted: false, ...roleVisibilityFilter(req.role),
    });
    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });
    if (employee.status === 'Inactive') {
      return res.status(400).json({ success: false, message: 'Cannot freeze an inactive account.' });
    }
    employee.status = employee.status === 'Frozen' ? 'Active' : 'Frozen';
    await employee.save();
    return res.json({
      success: true,
      message: `Employee ${employee.status === 'Frozen' ? 'frozen' : 'unfrozen'}`,
      employee: publicEmployee(employee),
    });
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
    const employee = await Employee.findOne({
      _id: req.params.id, isDeleted: false, ...roleVisibilityFilter(req.role),
    });
    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });
    employee.isArchived = !employee.isArchived;
    await employee.save();
    return res.json({
      success: true,
      message: `Employee ${employee.isArchived ? 'archived' : 'unarchived'}`,
      employee: publicEmployee(employee),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── POST /api/employees/:id/resend-invite ────────────────────────────────────
router.post('/:id/resend-invite', adminAuth, async (req, res) => {
  try {
    const employee = await Employee.findOne({
      _id: req.params.id, isDeleted: false, ...roleVisibilityFilter(req.role),
    });
    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });
    if (employee.status === 'Active') {
      return res.status(400).json({ success: false, message: 'Employee is already activated' });
    }
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
    const employee = await Employee.findOne({
      _id: req.params.id, isDeleted: false, ...roleVisibilityFilter(req.role),
    });
    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });

    const seg = () => Math.random().toString(36).slice(2, 6).toUpperCase();
    const tempPassword = `${seg()}-${seg()}-${seg()}`;
    employee.tempPassword = tempPassword;
    await employee.save();

    const revealInDev = process.env.NODE_ENV !== 'production' || process.env.RETURN_TEMP_PASSWORD === 'true';
    return res.json({
      success: true,
      message: 'Temporary password generated.',
      ...(revealInDev && { tempPassword }),
    });
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
    const employee = await Employee.findOne({
      _id: req.params.id, isDeleted: false, ...roleVisibilityFilter(req.role),
    });
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