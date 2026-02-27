import express from "express";
import { v4 as uuidv4 } from "uuid";
import Employee from "../models/Employee.js";
import { adminAuth } from "../middleware/auth.js";

const router = express.Router();
import { parseDDMMYYYY } from '../utils/dateUtils.js';

// Helper function to generate invite token
function generateInviteToken() {
  return uuidv4();
}

// Helper function to construct invite link
function constructInviteLink(token) {
  const baseUrl = process.env.FRONTEND_URL || "http://localhost:3000";
  return `${baseUrl}/join/${token}`;
}

// **GET /employees - List all (Admin only)**
router.get("/", adminAuth, async (req, res) => {
  try {
    const { status, department, page = 1, limit = 20, search } = req.query;

    let query = { isDeleted: false };

    if (status) query.status = status;
    if (department) query.department = department;
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { employeeNumber: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (page - 1) * limit;
    const employees = await Employee.find(query)
      .select("-password -tempPassword")
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    const total = await Employee.countDocuments(query);

    res.json({
      employees,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// **GET /employees/:id - Get single employee (Admin only)**
router.get("/:id", adminAuth, async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id).select(
      "-password -tempPassword",
    );

    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    res.json(employee);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// **POST /employees - Create new employee (Admin only)**
router.post("/", adminAuth, async (req, res) => {
  try {
    const {
      email,
      employeeNumber,
      firstName,
      lastName,
      department,
      joiningDate,
      shift,
      hourlyRate,
      bank,
    } = req.body;

    if (!email || !employeeNumber || !firstName || !lastName) {
      return res.status(400).json({ message: "Required fields missing" });
    }

    const existing = await Employee.findOne({
      $or: [{ email }, { employeeNumber }],
    });

    if (existing) {
      return res.status(400).json({
        message:
          existing.email === email
            ? "Email already exists"
            : "Employee number already exists",
      });
    }

    const inviteToken = generateInviteToken();
    const inviteExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const parsedJoiningDate = parseDDMMYYYY(joiningDate);

    if (!parsedJoiningDate) {
      return res.status(400).json({
        message: "Invalid joining date format. Use dd/mm/yyyy",
      });
    }

    const employee = new Employee({
      email,
      employeeNumber,
      firstName,
      lastName,
      department,
      role: "employee",
      joiningDate: parsedJoiningDate,
      shift,
      hourlyRate: parseFloat(hourlyRate),
      status: "Inactive",
      inviteToken,
      inviteTokenExpires: inviteExpires,
      bank,
    });

    await employee.save();

    const inviteLink = constructInviteLink(inviteToken);

    res.json({
      message: "Employee created successfully",
      employee: {
        _id: employee._id,
        email: employee.email,
        employeeNumber: employee.employeeNumber,
        firstName: employee.firstName,
        lastName: employee.lastName,
        department: employee.department,
        status: employee.status,
      },
      inviteLink,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// **PUT /employees/:id - Update employee (Admin only, cannot edit own info)**
router.put("/:id", adminAuth, async (req, res) => {
  try {
    if (req.userId === req.params.id) {
      return res.status(403).json({
        message: "You cannot edit your own employee information. Contact HR.",
      });
    }

    const employee = await Employee.findById(req.params.id);
    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    // Handle joiningDate update specifically with dd/mm/yyyy parsing
    if (req.body.joiningDate) {
      const parsed = parseDDMMYYYY(req.body.joiningDate);
      if (!parsed) {
        return res.status(400).json({ message: "Invalid joining date format. Use dd/mm/yyyy" });
      }
      employee.joiningDate = parsed;
    }

    const allowedFields = [
      "firstName",
      "lastName",
      "department",
      "shift",
      "hourlyRate",
      "bank",
    ];

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        employee[field] = req.body[field];
      }
    });

    employee.updatedAt = new Date();
    await employee.save();

    res.json({
      message: "Employee updated successfully",
      employee: employee.toObject(),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// **PATCH /employees/:id/freeze - Toggle freeze status (Admin only)**
router.patch("/:id/freeze", adminAuth, async (req, res) => {
  try {
    if (req.userId === req.params.id) {
      return res
        .status(403)
        .json({ message: "You cannot freeze your own account" });
    }

    const employee = await Employee.findById(req.params.id);
    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    employee.status = employee.status === "Frozen" ? "Active" : "Frozen";
    await employee.save();

    res.json({
      message: `Employee ${employee.status === "Frozen" ? "frozen" : "unfrozen"}`,
      employee,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// **PATCH /employees/:id/archive - Archive employee (Admin only)**
router.patch("/:id/archive", adminAuth, async (req, res) => {
  try {
    if (req.userId === req.params.id) {
      return res
        .status(403)
        .json({ message: "You cannot archive your own account" });
    }

    const employee = await Employee.findById(req.params.id);
    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    employee.isArchived = !employee.isArchived;
    await employee.save();

    res.json({
      message: `Employee ${employee.isArchived ? "archived" : "unarchived"}`,
      employee,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// **POST /employees/:id/resend-invite - Resend activation (Admin only)**
router.post("/:id/resend-invite", adminAuth, async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id);
    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    if (employee.status === "Active") {
      return res.status(400).json({ message: "Employee already activated" });
    }

    const inviteToken = generateInviteToken();
    employee.inviteToken = inviteToken;
    employee.inviteTokenExpires = new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000,
    );

    await employee.save();

    const inviteLink = constructInviteLink(inviteToken);

    res.json({
      message: "Invite resent",
      inviteLink,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// **POST /employees/:id/reset-password - Admin password reset**
router.post("/:id/reset-password", adminAuth, async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id);
    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    const tempPassword = Math.random().toString(36).slice(-10).toUpperCase();
    employee.tempPassword = tempPassword;
    await employee.save();

    res.json({
      message: "Password reset. New temp password sent to employee.",
      tempPassword,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;