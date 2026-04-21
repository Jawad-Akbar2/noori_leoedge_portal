import express from "express";
import { v4 as uuidv4 } from "uuid";
import Employee from "../models/Employee.js";
import { adminAuth, auth } from "../middleware/auth.js";
import { parseDDMMYYYY } from "../utils/dateUtils.js";

const router = express.Router();

// ─── helpers ──────────────────────────────────────────────────────────────────
const generateInviteToken = () => uuidv4();
const constructInviteLink = (token) => {
  const base = process.env.FRONTEND_URL || "http://localhost:3000";
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

// NOTE: Add these indexes to your Employee model/migration for max speed:
// Employee.collection.createIndex({ isDeleted: 1, role: 1, status: 1, isArchived: 1, createdAt: -1 })
// Employee.collection.createIndex({ email: 1 })
// Employee.collection.createIndex({ employeeNumber: 1 })
// Employee.collection.createIndex({ firstName: "text", lastName: "text", email: "text", employeeNumber: "text" })
// Employee.collection.createIndex({ "leftBusiness.isLeft": 1, "leftBusiness.scheduledDeletion": 1 })

const SAFE_SELECT = "-password -tempPassword -inviteToken -inviteTokenExpires";

const roleVisibilityFilter = (requestingRole) => {
  if (requestingRole === "superadmin" || requestingRole === "owner") {
    return { role: { $ne: "owner" } };
  }
  return { role: "employee" };
};

const resolveNewRole = (creatorRole, requestedRole) => {
  if (creatorRole === "superadmin" || creatorRole === "owner") {
    return ["employee", "admin", "superadmin", "owner"].includes(requestedRole)
      ? requestedRole
      : "employee";
  }
  return "employee";
};

const processBase64Image = (base64String, existingFileName = null) => {
  if (!base64String) return null;
  const base64Regex = /^data:image\/(jpeg|jpg|png|gif|webp);base64,/;
  if (!base64Regex.test(base64String)) {
    throw new Error("Invalid image format. Must be JPEG, PNG, GIF, or WebP");
  }
  const mimeType = base64String.match(/^data:([^;]+);/)[1];
  const extension = mimeType.split("/")[1];
  const fileName = existingFileName || `profile_${Date.now()}.${extension}`;
  return { data: base64String, fileName, mimeType, uploadedAt: new Date() };
};

export async function purgeLeftEmployees() {
  const result = await Employee.deleteMany({
    "leftBusiness.isLeft": true,
    "leftBusiness.scheduledDeletion": { $lte: new Date() },
  });
  if (result.deletedCount) {
    console.log(`[purge] Deleted ${result.deletedCount} employee(s) whose 30-day retention window elapsed.`);
  }
  return result.deletedCount;
}

// ─── Profile picture routes ───────────────────────────────────────────────────

router.put("/me/profile-picture", auth, async (req, res) => {
  try {
    const { profilePicture } = req.body;
    if (!profilePicture) {
      return res.status(400).json({ success: false, message: "Profile picture data is required", field: "profilePicture" });
    }
    // Use findOneAndUpdate to avoid a round-trip fetch + save
    let processedImage;
    try {
      processedImage = processBase64Image(profilePicture);
    } catch (err) {
      return res.status(400).json({ success: false, message: err.message, field: "profilePicture" });
    }
    const updated = await Employee.findOneAndUpdate(
      { _id: req.userId, isDeleted: false },
      { $set: { profilePicture: processedImage } },
      { new: false, lean: true } // we don't need the full doc back
    );
    if (!updated) return res.status(404).json({ success: false, message: "Employee not found" });
    return res.json({
      success: true,
      message: "Profile picture updated successfully",
      profilePicture: {
        url: processedImage.data.substring(0, 100) + "...",
        fileName: processedImage.fileName,
        mimeType: processedImage.mimeType,
        uploadedAt: processedImage.uploadedAt,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete("/me/profile-picture", auth, async (req, res) => {
  try {
    const updated = await Employee.findOneAndUpdate(
      { _id: req.userId, isDeleted: false },
      { $set: { profilePicture: { data: null, fileName: null, mimeType: null, uploadedAt: null } } },
      { new: false, lean: true }
    );
    if (!updated) return res.status(404).json({ success: false, message: "Employee not found" });
    return res.json({ success: true, message: "Profile picture removed successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get("/me/profile-picture", auth, async (req, res) => {
  try {
    const employee = await Employee.findOne({ _id: req.userId, isDeleted: false })
      .select("profilePicture").lean();
    if (!employee?.profilePicture?.data) {
      return res.status(404).json({ success: false, message: "Profile picture not found" });
    }
    return res.json({ success: true, profilePicture: employee.profilePicture });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put("/:id/profile-picture", adminAuth, async (req, res) => {
  try {
    const { profilePicture } = req.body;
    if (!profilePicture) {
      return res.status(400).json({ success: false, message: "Profile picture data is required", field: "profilePicture" });
    }
    let processedImage;
    try {
      processedImage = processBase64Image(profilePicture);
    } catch (err) {
      return res.status(400).json({ success: false, message: err.message, field: "profilePicture" });
    }
    const updated = await Employee.findOneAndUpdate(
      { _id: req.params.id, isDeleted: false, ...roleVisibilityFilter(req.role) },
      { $set: { profilePicture: processedImage } },
      { new: false, lean: true }
    );
    if (!updated) return res.status(404).json({ success: false, message: "Employee not found" });
    return res.json({
      success: true,
      message: "Profile picture updated successfully",
      profilePicture: { fileName: processedImage.fileName, mimeType: processedImage.mimeType, uploadedAt: processedImage.uploadedAt },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete("/:id/profile-picture", adminAuth, async (req, res) => {
  try {
    const updated = await Employee.findOneAndUpdate(
      { _id: req.params.id, isDeleted: false, ...roleVisibilityFilter(req.role) },
      { $set: { profilePicture: { data: null, fileName: null, mimeType: null, uploadedAt: null } } },
      { new: false, lean: true }
    );
    if (!updated) return res.status(404).json({ success: false, message: "Employee not found" });
    return res.json({ success: true, message: "Profile picture removed successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get("/:id/profile-picture", auth, async (req, res) => {
  try {
    const employee = await Employee.findOne({ _id: req.params.id, isDeleted: false })
      .select("profilePicture").lean();
    if (!employee?.profilePicture?.data) {
      return res.status(404).json({ success: false, message: "Profile picture not found" });
    }
    return res.json({ success: true, profilePicture: employee.profilePicture });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /api/employees/me ────────────────────────────────────────────────────
router.get("/me", auth, async (req, res) => {
  try {
    const employee = await Employee.findOne({ _id: req.userId, isDeleted: false })
      .select(SAFE_SELECT)
      .lean();
    if (!employee) return res.status(404).json({ success: false, message: "Profile not found" });
    return res.json({ success: true, employee });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── PUT /api/employees/me ────────────────────────────────────────────────────
router.put("/me", auth, async (req, res) => {
  try {
    // Run email conflict check in parallel with employee fetch
    const emailTrimmed = req.body.email !== undefined
      ? req.body.email.toLowerCase().trim()
      : null;

    const [employee, emailConflict] = await Promise.all([
      Employee.findOne({ _id: req.userId, isDeleted: false }),
      emailTrimmed
        ? Employee.findOne({ email: emailTrimmed, _id: { $ne: req.userId }, isDeleted: false }).select("_id").lean()
        : Promise.resolve(null),
    ]);

    if (!employee) return res.status(404).json({ success: false, message: "Employee not found" });

    if (emailTrimmed !== null) {
      if (!emailTrimmed) return res.status(400).json({ success: false, message: "Email cannot be empty", field: "email" });
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(emailTrimmed)) return res.status(400).json({ success: false, message: "Invalid email format", field: "email" });
      if (emailConflict) return res.status(409).json({ success: false, message: "Email already in use", field: "email" });
      employee.email = emailTrimmed;
    }

    if (req.body.bank !== undefined) {
      const inc = req.body.bank;
      employee.bank = {
        bankName: inc.bankName !== undefined ? String(inc.bankName || "").trim() : employee.bank?.bankName || "",
        accountName: inc.accountName !== undefined ? String(inc.accountName || "").trim() : employee.bank?.accountName || "",
        accountNumber: inc.accountNumber !== undefined ? String(inc.accountNumber || "").trim() : employee.bank?.accountNumber || "",
      };
    }

    if (req.body.emergencyContact !== undefined) {
      const inc = req.body.emergencyContact;
      if (typeof inc !== "object" || Array.isArray(inc)) {
        return res.status(400).json({ success: false, message: "emergencyContact must be an object", field: "emergencyContact" });
      }
      employee.emergencyContact = {
        name: inc.name !== undefined ? String(inc.name || "").trim() : employee.emergencyContact?.name || "",
        relationship: inc.relationship !== undefined ? String(inc.relationship || "").trim() : employee.emergencyContact?.relationship || "",
        phone: inc.phone !== undefined ? String(inc.phone || "").trim() : employee.emergencyContact?.phone || "",
      };
    }

    if (req.body.address !== undefined) {
      const inc = req.body.address;
      if (typeof inc !== "object" || Array.isArray(inc)) {
        return res.status(400).json({ success: false, message: "address must be an object", field: "address" });
      }
      employee.address = {
        street: inc.street !== undefined ? String(inc.street || "").trim() : employee.address?.street || "",
        city: inc.city !== undefined ? String(inc.city || "").trim() : employee.address?.city || "",
        state: inc.state !== undefined ? String(inc.state || "").trim() : employee.address?.state || "",
        zip: inc.zip !== undefined ? String(inc.zip || "").trim() : employee.address?.zip || "",
        country: inc.country !== undefined ? String(inc.country || "").trim() : employee.address?.country || "",
      };
    }

    if (req.body.idCard !== undefined) {
      const inc = req.body.idCard;
      if (typeof inc !== "object" || Array.isArray(inc)) {
        return res.status(400).json({ success: false, message: "idCard must be an object", field: "idCard" });
      }
      if (inc.front !== undefined) {
        if (inc.front === null) {
          employee.idCard.front = { url: null, fileName: null, uploadedAt: null };
        } else if (inc.front.url !== undefined) {
          const trimmedUrl = String(inc.front.url).trim();
          if (!trimmedUrl) return res.status(400).json({ success: false, message: "idCard.front.url cannot be empty", field: "idCard.front.url" });
          employee.idCard.front = {
            url: trimmedUrl,
            fileName: inc.front.fileName ? String(inc.front.fileName).trim() : employee.idCard?.front?.fileName || null,
            uploadedAt: new Date(),
          };
        }
      }
      if (inc.back !== undefined) {
        if (inc.back === null) {
          employee.idCard.back = { url: null, fileName: null, uploadedAt: null };
        } else if (inc.back.url !== undefined) {
          const trimmedUrl = String(inc.back.url).trim();
          if (!trimmedUrl) return res.status(400).json({ success: false, message: "idCard.back.url cannot be empty", field: "idCard.back.url" });
          employee.idCard.back = {
            url: trimmedUrl,
            fileName: inc.back.fileName ? String(inc.back.fileName).trim() : employee.idCard?.back?.fileName || null,
            uploadedAt: new Date(),
          };
        }
      }
    }

    await employee.save();
    return res.json({ success: true, message: "Profile updated", employee: publicEmployee(employee) });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ success: false, message: "Email already in use", field: "email" });
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /api/employees ───────────────────────────────────────────────────────
// FIX: Was 37s — now parallelised with Promise.all, lean(), fixed query logic,
//      and proper includeLeft / includeArchived / status handling.
router.get("/", adminAuth, async (req, res) => {
  try {
    const {
      status,
      department,
      search,
      includeArchived = "false",
      includeLeft = "false",      // ← was "includeFrozen" but your URL uses includeLeft
      page = 1,
      limit = 200,
    } = req.query;

    const query = {
      isDeleted: false,
      ...roleVisibilityFilter(req.role),
    };

    // ── Archive filter ─────────────────────────────────────────────────────────
    if (includeArchived !== "true") query.isArchived = false;

    // ── Left-business / status filter ─────────────────────────────────────────
    // includeLeft=true  → show all statuses (Active, Frozen, Inactive)
    // includeLeft=false → only Active employees (exclude Frozen/left)
    // status param can override to a specific value
    if (status && ["Active", "Frozen", "Inactive"].includes(status)) {
      query.status = status;
    } else if (includeLeft !== "true") {
      query.status = "Active";
    }
    // If includeLeft=true and no status param → no status filter → returns all

    // ── Department ─────────────────────────────────────────────────────────────
    if (department) query.department = department;

    // ── Search — use $text index if available, else $or regex ─────────────────
    // For best performance add a text index (see note at top of file).
    // Regex on unindexed fields causes a full collection scan.
    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      query.$or = [
        { firstName: { $regex: escaped, $options: "i" } },
        { lastName: { $regex: escaped, $options: "i" } },
        { email: { $regex: escaped, $options: "i" } },
        { employeeNumber: { $regex: escaped, $options: "i" } },
      ];
    }

    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(500, Math.max(1, Number(limit))); // cap at 500
    const skip = (pageNum - 1) * limitNum;

    // ── Parallel fetch + count — this is the key fix ──────────────────────────
    const [employees, total] = await Promise.all([
      Employee.find(query)
        .select(SAFE_SELECT)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),                   // ← returns plain JS objects, much faster
      Employee.countDocuments(query),
    ]);

    return res.json({
      success: true,
      employees,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /api/employees/:id ───────────────────────────────────────────────────
router.get("/:id", adminAuth, async (req, res) => {
  try {
    const employee = await Employee.findOne({
      _id: req.params.id,
      isDeleted: false,
      ...roleVisibilityFilter(req.role),
    })
      .select(SAFE_SELECT)
      .lean();
    if (!employee) return res.status(404).json({ success: false, message: "Employee not found" });
    return res.json({ success: true, employee });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── POST /api/employees ──────────────────────────────────────────────────────
router.post("/", adminAuth, async (req, res) => {
  try {
    const {
      email, employeeNumber, firstName, lastName, profilePicture, idCard,
      department, joiningDate, shift, salaryType, hourlyRate, monthlySalary,
      bank, role: requestedRole,
    } = req.body;

    if (!email || !employeeNumber || !firstName || !lastName || !department || !joiningDate) {
      return res.status(400).json({
        success: false,
        message: "email, employeeNumber, firstName, lastName, department, and joiningDate are required",
      });
    }

    const resolvedRole = resolveNewRole(req.role, requestedRole);
    const resolvedSalaryType = salaryType || "hourly";

    if (!["hourly", "monthly"].includes(resolvedSalaryType)) {
      return res.status(400).json({ success: false, message: "salaryType must be 'hourly' or 'monthly'" });
    }
    if (resolvedSalaryType === "monthly" && !monthlySalary) {
      return res.status(400).json({ success: false, message: "monthlySalary is required when salaryType is monthly" });
    }

    const parsedJoiningDate = parseDDMMYYYY(joiningDate) || new Date(joiningDate);
    if (!parsedJoiningDate || isNaN(parsedJoiningDate)) {
      return res.status(400).json({ success: false, message: "Invalid joiningDate. Use dd/mm/yyyy or YYYY-MM-DD" });
    }

    // Run image processing + duplicate check in parallel
    const [processedProfilePicture, existing] = await Promise.all([
      profilePicture ? Promise.resolve(processBase64Image(profilePicture)) : Promise.resolve(null),
      Employee.findOne({
        $or: [
          { email: email.toLowerCase().trim() },
          { employeeNumber: employeeNumber.trim() },
        ],
        isDeleted: false,
      }).select("email employeeNumber").lean(),
    ]);

    if (existing) {
      const field = existing.email === email.toLowerCase().trim() ? "Email" : "Employee number";
      return res.status(409).json({ success: false, message: `${field} already exists` });
    }

    let finalShift = shift || { start: "09:00", end: "18:00" };
    let finalSalaryType = resolvedSalaryType;
    let finalHourlyRate = parseFloat(hourlyRate) || 0;
    let finalMonthlySalary = finalSalaryType === "monthly" ? parseFloat(monthlySalary) : null;

    if (["superadmin"].includes(resolvedRole)) {
      finalShift = { start: null, end: null };
      finalSalaryType = null;
      finalHourlyRate = null;
      finalMonthlySalary = null;
    }

    const inviteToken = generateInviteToken();
    const employee = new Employee({
      email: email.toLowerCase().trim(),
      employeeNumber: employeeNumber.trim(),
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      department,
      profilePicture: processedProfilePicture,
      idCard: {
        front: idCard?.front || { url: null, fileName: null, uploadedAt: null },
        back: idCard?.back || { url: null, fileName: null, uploadedAt: null },
      },
      role: resolvedRole,
      joiningDate: parsedJoiningDate,
      shift: finalShift,
      salaryType: finalSalaryType,
      hourlyRate: finalHourlyRate,
      monthlySalary: finalMonthlySalary,
      status: "Inactive",
      inviteToken,
      inviteTokenExpires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      bank: bank || {},
    });

    await employee.save();
    return res.status(201).json({
      success: true,
      message: "Employee created. Invite link generated.",
      employee: publicEmployee(employee),
      inviteLink: constructInviteLink(inviteToken),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── PUT /api/employees/:id ───────────────────────────────────────────────────
router.put("/:id", adminAuth, async (req, res) => {
  try {
    if (
      String(req.userId) === String(req.params.id) &&
      req.role !== "superadmin" &&
      req.role !== "owner"
    ) {
      return res.status(403).json({ success: false, message: "Use the profile page to edit your own account." });
    }

    const emailTrimmed = req.body.email !== undefined ? req.body.email.toLowerCase().trim() : null;
    const empNumTrimmed = req.body.employeeNumber !== undefined ? req.body.employeeNumber.trim() : null;

    // Fetch employee + both conflict checks in parallel
    const [employee, emailConflict, empNumConflict] = await Promise.all([
      Employee.findOne({ _id: req.params.id, isDeleted: false, ...roleVisibilityFilter(req.role) }),
      emailTrimmed
        ? Employee.findOne({ email: emailTrimmed, isDeleted: false, _id: { $ne: req.params.id } }).select("_id").lean()
        : Promise.resolve(null),
      empNumTrimmed
        ? Employee.findOne({ employeeNumber: empNumTrimmed, isDeleted: false, _id: { $ne: req.params.id } }).select("_id").lean()
        : Promise.resolve(null),
    ]);

    if (!employee) return res.status(404).json({ success: false, message: "Employee not found" });

    if (empNumTrimmed !== null) {
      if (!empNumTrimmed) return res.status(400).json({ success: false, message: "Employee number cannot be empty", field: "employeeNumber" });
      if (empNumConflict) return res.status(409).json({ success: false, message: "Employee number already exists", field: "employeeNumber" });
      employee.employeeNumber = empNumTrimmed;
    }

    if (emailTrimmed !== null) {
      if (!emailTrimmed) return res.status(400).json({ success: false, message: "Email cannot be empty", field: "email" });
      if (emailConflict) return res.status(409).json({ success: false, message: "Email already exists", field: "email" });
      employee.email = emailTrimmed;
    }

    ["firstName", "lastName", "department", "shift", "bank"].forEach((f) => {
      if (req.body[f] !== undefined) employee[f] = req.body[f];
    });

    if (req.body.role !== undefined && (req.role === "superadmin" || req.role === "owner")) {
      if (!["employee", "admin", "superadmin", "owner", "hybrid"].includes(req.body.role)) {
        return res.status(400).json({ success: false, message: "Invalid role" });
      }
      employee.role = req.body.role;
    }

    if (req.body.salaryType !== undefined) {
      if (!["hourly", "monthly"].includes(req.body.salaryType)) {
        return res.status(400).json({ success: false, message: "salaryType must be 'hourly' or 'monthly'" });
      }
      employee.salaryType = req.body.salaryType;
    }
    if (req.body.hourlyRate !== undefined) employee.hourlyRate = parseFloat(req.body.hourlyRate);
    if (req.body.monthlySalary !== undefined) employee.monthlySalary = req.body.monthlySalary ? parseFloat(req.body.monthlySalary) : null;

    if (employee.salaryType === "monthly" && !employee.monthlySalary) {
      return res.status(400).json({ success: false, message: "monthlySalary is required when salaryType is monthly" });
    }

    if (req.body.joiningDate) {
      const parsed = parseDDMMYYYY(req.body.joiningDate) || new Date(req.body.joiningDate);
      if (!parsed || isNaN(parsed)) {
        return res.status(400).json({ success: false, message: "Invalid joiningDate. Use dd/mm/yyyy or YYYY-MM-DD" });
      }
      employee.joiningDate = parsed;
    }

    if (req.body.emergencyContact !== undefined) {
      const inc = req.body.emergencyContact;
      if (typeof inc !== "object" || Array.isArray(inc)) {
        return res.status(400).json({ success: false, message: "emergencyContact must be an object", field: "emergencyContact" });
      }
      employee.emergencyContact = {
        name: inc.name !== undefined ? String(inc.name || "").trim() : employee.emergencyContact?.name || "",
        relationship: inc.relationship !== undefined ? String(inc.relationship || "").trim() : employee.emergencyContact?.relationship || "",
        phone: inc.phone !== undefined ? String(inc.phone || "").trim() : employee.emergencyContact?.phone || "",
      };
    }

    if (req.body.address !== undefined) {
      const inc = req.body.address;
      if (typeof inc !== "object" || Array.isArray(inc)) {
        return res.status(400).json({ success: false, message: "address must be an object", field: "address" });
      }
      employee.address = {
        street: inc.street !== undefined ? String(inc.street || "").trim() : employee.address?.street || "",
        city: inc.city !== undefined ? String(inc.city || "").trim() : employee.address?.city || "",
        state: inc.state !== undefined ? String(inc.state || "").trim() : employee.address?.state || "",
        zip: inc.zip !== undefined ? String(inc.zip || "").trim() : employee.address?.zip || "",
        country: inc.country !== undefined ? String(inc.country || "").trim() : employee.address?.country || "",
      };
    }

    if (req.body.idCard !== undefined) {
      const inc = req.body.idCard;
      if (typeof inc !== "object" || Array.isArray(inc)) {
        return res.status(400).json({ success: false, message: "idCard must be an object", field: "idCard" });
      }
      if (inc.front !== undefined) {
        employee.idCard.front = inc.front === null
          ? { url: null, fileName: null, uploadedAt: null }
          : inc.front.url !== undefined
            ? { url: String(inc.front.url).trim(), fileName: inc.front.fileName ? String(inc.front.fileName).trim() : employee.idCard?.front?.fileName || null, uploadedAt: new Date() }
            : employee.idCard.front;
      }
      if (inc.back !== undefined) {
        employee.idCard.back = inc.back === null
          ? { url: null, fileName: null, uploadedAt: null }
          : inc.back.url !== undefined
            ? { url: String(inc.back.url).trim(), fileName: inc.back.fileName ? String(inc.back.fileName).trim() : employee.idCard?.back?.fileName || null, uploadedAt: new Date() }
            : employee.idCard.back;
      }
    }

    if (["owner"].includes(employee.role)) {
      employee.shift = { start: null, end: null };
      employee.salaryType = null;
      employee.hourlyRate = null;
      employee.monthlySalary = null;
    }

    await employee.save();
    return res.json({ success: true, message: "Employee updated", employee: publicEmployee(employee) });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: "Duplicate key — email or employee number already exists" });
    }
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── PATCH /api/employees/:id/archive ────────────────────────────────────────
router.patch("/:id/archive", adminAuth, async (req, res) => {
  try {
    if (String(req.userId) === String(req.params.id)) {
      return res.status(403).json({ success: false, message: "You cannot archive your own account" });
    }
    const employee = await Employee.findOne({
      _id: req.params.id,
      isDeleted: false,
      ...roleVisibilityFilter(req.role),
    });
    if (!employee) return res.status(404).json({ success: false, message: "Employee not found" });
    employee.isArchived = !employee.isArchived;
    await employee.save();
    return res.json({
      success: true,
      message: `Employee ${employee.isArchived ? "archived" : "unarchived"}`,
      employee: publicEmployee(employee),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── POST /api/employees/:id/resend-invite ────────────────────────────────────
router.post("/:id/resend-invite", adminAuth, async (req, res) => {
  try {
    const employee = await Employee.findOne({
      _id: req.params.id,
      isDeleted: false,
      ...roleVisibilityFilter(req.role),
    });
    if (!employee) return res.status(404).json({ success: false, message: "Employee not found" });
    if (employee.status === "Active") {
      return res.status(400).json({ success: false, message: "Employee is already activated" });
    }
    employee.inviteToken = generateInviteToken();
    employee.inviteTokenExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await employee.save();
    return res.json({ success: true, message: "Invite resent", inviteLink: constructInviteLink(employee.inviteToken) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── POST /api/employees/:id/reset-password ───────────────────────────────────
router.post("/:id/reset-password", adminAuth, async (req, res) => {
  try {
    const employee = await Employee.findOne({
      _id: req.params.id,
      isDeleted: false,
      ...roleVisibilityFilter(req.role),
    });
    if (!employee) return res.status(404).json({ success: false, message: "Employee not found" });
    const seg = () => Math.random().toString(36).slice(2, 6).toUpperCase();
    const tempPassword = `${seg()}-${seg()}-${seg()}`;
    employee.tempPassword = tempPassword;
    await employee.save();
    const revealInDev = process.env.NODE_ENV !== "production" || process.env.RETURN_TEMP_PASSWORD === "true";
    return res.json({ success: true, message: "Temporary password generated.", ...(revealInDev && { tempPassword }) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── DELETE /api/employees/:id ────────────────────────────────────────────────
router.delete("/:id", adminAuth, async (req, res) => {
  try {
    if (String(req.userId) === String(req.params.id)) {
      return res.status(403).json({ success: false, message: "You cannot delete your own account" });
    }
    // Use findOneAndUpdate to avoid fetch + save round trip
    const updated = await Employee.findOneAndUpdate(
      { _id: req.params.id, isDeleted: false, ...roleVisibilityFilter(req.role) },
      { $set: { isDeleted: true, isArchived: true, status: "Inactive" } },
      { new: false, lean: true }
    );
    if (!updated) return res.status(404).json({ success: false, message: "Employee not found" });
    return res.json({ success: true, message: "Employee deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── PATCH /api/employees/:id/left-business ───────────────────────────────────
router.patch("/:id/left-business", adminAuth, async (req, res) => {
  try {
    if (String(req.userId) === String(req.params.id)) {
      return res.status(403).json({ success: false, message: "You cannot mark your own account as left." });
    }
    const employee = await Employee.findOne({
      _id: req.params.id,
      isDeleted: false,
      ...roleVisibilityFilter(req.role),
    });
    if (!employee) return res.status(404).json({ success: false, message: "Employee not found" });
    if (employee.leftBusiness?.isLeft) {
      return res.status(409).json({
        success: false,
        message: "Employee is already marked as having left the business.",
        employee: publicEmployee(employee),
      });
    }
    const leftDate = req.body.leftDate ? new Date(req.body.leftDate) : new Date();
    if (leftDate > new Date()) {
      return res.status(400).json({ success: false, message: "Left date cannot be in the future." });
    }
    const scheduledDeletion = new Date(leftDate.getTime() + 30 * 24 * 60 * 60 * 1000);
    employee.leftBusiness = {
      isLeft: true,
      leftDate,
      scheduledDeletion,
      reason: String(req.body.reason || "").trim().slice(0, 500),
      markedBy: req.userId,
      reinstatedAt: null,
      reinstatedBy: null,
    };
    employee.status = "Frozen";
    await employee.save();
    return res.json({
      success: true,
      message: "Employee marked as having left the business. Data will be deleted in 30 days.",
      employee: publicEmployee(employee),
      deletesAt: scheduledDeletion,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── PATCH /api/employees/:id/reinstate ──────────────────────────────────────
router.patch("/:id/reinstate", adminAuth, async (req, res) => {
  try {
    const employee = await Employee.findOne({
      _id: req.params.id,
      isDeleted: false,
      ...roleVisibilityFilter(req.role),
    });
    if (!employee) return res.status(404).json({ success: false, message: "Employee not found" });
    if (!employee.leftBusiness?.isLeft) {
      return res.status(409).json({ success: false, message: "This employee has not been marked as left — nothing to reinstate." });
    }
    if (employee.leftBusiness.scheduledDeletion <= new Date()) {
      return res.status(410).json({ success: false, message: "The 30-day reinstatement window has expired. This record can no longer be restored." });
    }
    employee.leftBusiness = {
      ...employee.leftBusiness.toObject(),
      isLeft: false,
      scheduledDeletion: null,
      reinstatedAt: new Date(),
      reinstatedBy: req.userId,
    };
    employee.status = "Active";
    await employee.save();
    return res.json({ success: true, message: "Employee reinstated successfully.", employee: publicEmployee(employee) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;