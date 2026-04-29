// routes/employees.js
import express        from "express";
import { v4 as uuidv4 } from "uuid";
import { Readable }   from "stream";
import Employee       from "../models/Employee.js";
import { adminAuth, auth } from "../middleware/auth.js";
import { parseDDMMYYYY }   from "../utils/dateUtils.js";
import { getBucket, FILE_TYPES } from "../utils/gridfs.js";
import mongoose from "mongoose";
const { ObjectId } = mongoose.Types;

const router = express.Router();

// ─── helpers ──────────────────────────────────────────────────────────────────
const generateInviteToken = () => uuidv4();
const constructInviteLink = (token) => {
  const base = process.env.FRONTEND_URL || "http://localhost:3000";
  return `${base}/join/${token}`;
};

const publicEmployee = (emp) => {
  const obj = emp.toObject ? emp.toObject() : { ...emp };
  delete obj.password;
  delete obj.tempPassword;
  delete obj.inviteToken;
  delete obj.inviteTokenExpires;
  return obj;
};

// Pass excludeImages: true to strip all image fields from a lean doc
// (profilePicture, idCard front/back) — used in list endpoints
const stripImages = (emp) => {
  const obj = { ...emp };
  if (obj.profilePicture) obj.profilePicture = null;
  if (obj.idCard) {
    obj.idCard = {
      front: { fileId: null, fileName: null, uploadedAt: null },
      back:  { fileId: null, fileName: null, uploadedAt: null },
    };
  }
  return obj;
};

const SAFE_SELECT        = "-password -tempPassword -inviteToken -inviteTokenExpires";
const SAFE_SELECT_NO_IMG = "-password -tempPassword -inviteToken -inviteTokenExpires -profilePicture -idCard.front.fileId -idCard.back.fileId";

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

// ─── GridFS helpers ───────────────────────────────────────────────────────────

/**
 * Upload a buffer to GridFS.
 * Returns the new file's ObjectId.
 */
const uploadToGridFS = (buffer, fileName, mimeType, employeeId, fileType) => {
  return new Promise((resolve, reject) => {
    const bucket = getBucket();
    const uploadStream = bucket.openUploadStream(fileName, {
      contentType: mimeType,
      metadata: {
        type:       fileType,   // FILE_TYPES constant — lets you query by type
        employeeId: String(employeeId),
      },
    });
    const readable = Readable.from(buffer);
    readable.pipe(uploadStream);
    uploadStream.on("finish", () => resolve(uploadStream.id));   // ObjectId
    uploadStream.on("error",  reject);
  });
};

/**
 * Delete a file from GridFS by its ObjectId.
 * Silently ignores "file not found" — safe to call on nulls.
 */
const deleteFromGridFS = async (fileId) => {
  if (!fileId) return;
  try {
    await getBucket().delete(fileId);
  } catch (err) {
    // File might already be gone — not fatal
    if (!err.message?.includes("File not found")) throw err;
  }
};

/**
 * Parse a multipart/base64 image upload.
 * Accepts:  { data: "<base64 string>", fileName: "...", mimeType: "..." }
 * Returns:  { buffer, fileName, mimeType }
 */
const parseImagePayload = (payload) => {
  if (!payload?.data) throw new Error("Image data is required");

  const base64Regex = /^data:(image\/(?:jpeg|jpg|png|gif|webp));base64,(.+)$/;
  const match = payload.data.match(base64Regex);
  if (!match) throw new Error("Invalid image format. Must be JPEG, PNG, GIF, or WebP base64 data URI");

  const mimeType = match[1];
  const base64   = match[2];
  const buffer   = Buffer.from(base64, "base64");

  if (buffer.length > 5 * 1024 * 1024) {   // 5 MB hard cap
    throw new Error("Image size exceeds 5 MB limit");
  }

  const ext      = mimeType.split("/")[1];
  const fileName = payload.fileName || `file_${Date.now()}.${ext}`;

  return { buffer, fileName, mimeType };
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

// ═══════════════════════════════════════════════════════════════════════════════
// ─── Profile picture routes ───────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

// PUT /me/profile-picture  — employee updates own picture
router.put("/me/profile-picture", auth, async (req, res) => {
  try {
    const { profilePicture } = req.body;
    if (!profilePicture) {
      return res.status(400).json({ success: false, message: "profilePicture is required", field: "profilePicture" });
    }

    let parsed;
    try { parsed = parseImagePayload(profilePicture); }
    catch (err) { return res.status(400).json({ success: false, message: err.message, field: "profilePicture" }); }

    // Fetch existing so we can delete the old GridFS file
    const employee = await Employee.findOne({ _id: req.userId, isDeleted: false })
      .select("profilePicture").lean();
    if (!employee) return res.status(404).json({ success: false, message: "Employee not found" });

    // Delete old file first (fire-and-forget ok — non-fatal if missing)
    await deleteFromGridFS(employee.profilePicture?.fileId);

    const fileId = await uploadToGridFS(
      parsed.buffer, parsed.fileName, parsed.mimeType,
      req.userId, FILE_TYPES.PROFILE_PICTURE
    );

    await Employee.updateOne(
      { _id: req.userId },
      { $set: { profilePicture: { fileId, fileName: parsed.fileName, mimeType: parsed.mimeType, uploadedAt: new Date() } } }
    );

    return res.json({
      success: true,
      message: "Profile picture updated",
      profilePicture: { fileId, fileName: parsed.fileName, mimeType: parsed.mimeType, uploadedAt: new Date() },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /me/profile-picture
router.delete("/me/profile-picture", auth, async (req, res) => {
  try {
    const employee = await Employee.findOne({ _id: req.userId, isDeleted: false })
      .select("profilePicture").lean();
    if (!employee) return res.status(404).json({ success: false, message: "Employee not found" });

    await deleteFromGridFS(employee.profilePicture?.fileId);

    await Employee.updateOne(
      { _id: req.userId },
      { $set: { profilePicture: { fileId: null, fileName: null, mimeType: null, uploadedAt: null } } }
    );

    return res.json({ success: true, message: "Profile picture removed" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /me/profile-picture  — streams the image binary back
router.get("/me/profile-picture", auth, async (req, res) => {
  try {
    const employee = await Employee.findOne({
      _id: req.userId,
      isDeleted: false,
    }).select("profilePicture").lean();

    if (!employee?.profilePicture?.fileId) {
      return res.status(404).json({
        success: false,
        message: "No profile picture",
      });
    }

    const { fileId, mimeType } = employee.profilePicture;

    const stream = getBucket().openDownloadStream(new ObjectId(fileId));

    // 🔥 Set headers ONCE before piping
    res.set("Content-Type", mimeType || "image/jpeg");
    res.set("Cache-Control", "private, max-age=3600");

    stream.on("error", (err) => {
      console.error("GridFS error:", err);

      if (!res.headersSent) {
        return res.status(404).json({
          success: false,
          message: "File not found",
        });
      }

      // If already streaming → just destroy
      stream.destroy();
    });

    stream.pipe(res); // ✅ SINGLE RESPONSE
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
});

// PUT /:id/profile-picture  — admin updates someone else's picture
router.put("/:id/profile-picture", adminAuth, async (req, res) => {
  try {
    const { profilePicture } = req.body;
    if (!profilePicture) {
      return res.status(400).json({ success: false, message: "profilePicture is required", field: "profilePicture" });
    }

    let parsed;
    try { parsed = parseImagePayload(profilePicture); }
    catch (err) { return res.status(400).json({ success: false, message: err.message, field: "profilePicture" }); }

    const employee = await Employee.findOne({
      _id: req.params.id, isDeleted: false, ...roleVisibilityFilter(req.role),
    }).select("profilePicture").lean();
    if (!employee) return res.status(404).json({ success: false, message: "Employee not found" });

    await deleteFromGridFS(employee.profilePicture?.fileId);

    const fileId = await uploadToGridFS(
      parsed.buffer, parsed.fileName, parsed.mimeType,
      req.params.id, FILE_TYPES.PROFILE_PICTURE
    );

    await Employee.updateOne(
      { _id: req.params.id },
      { $set: { profilePicture: { fileId, fileName: parsed.fileName, mimeType: parsed.mimeType, uploadedAt: new Date() } } }
    );

    return res.json({
      success: true,
      message: "Profile picture updated",
      profilePicture: { fileId, fileName: parsed.fileName, mimeType: parsed.mimeType, uploadedAt: new Date() },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /:id/profile-picture  — admin removes someone else's picture
router.delete("/:id/profile-picture", adminAuth, async (req, res) => {
  try {
    const employee = await Employee.findOne({
      _id: req.params.id, isDeleted: false, ...roleVisibilityFilter(req.role),
    }).select("profilePicture").lean();
    if (!employee) return res.status(404).json({ success: false, message: "Employee not found" });

    await deleteFromGridFS(employee.profilePicture?.fileId);

    await Employee.updateOne(
      { _id: req.params.id },
      { $set: { profilePicture: { fileId: null, fileName: null, mimeType: null, uploadedAt: null } } }
    );

    return res.json({ success: true, message: "Profile picture removed" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /:id/profile-picture  — streams image (any authenticated user can view)
router.get("/:id/profile-picture", auth, async (req, res) => {
  try {
    const employee = await Employee.findOne({ _id: req.params.id, isDeleted: false })
      .select("profilePicture").lean();
    if (!employee?.profilePicture?.fileId) {
      return res.status(404).json({ success: false, message: "No profile picture" });
    }
    const { fileId, mimeType } = employee.profilePicture;
    // ✅ Set headers ONCE only
    res.set("Content-Type", mimeType || "image/jpeg");
    res.set("Cache-Control", "private, max-age=3600");
    const stream = getBucket().openDownloadStream(new ObjectId(fileId));
    stream.on("error", (err) => {
      console.error("GridFS error:", err);
      if (!res.headersSent) {
        return res.status(404).json({ success: false, message: "File not found" });
      }
      stream.destroy();
    });
    stream.pipe(res);
  } catch (err) {
    if (!res.headersSent) res.status(500).json({ success: false, message: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// ─── ID Card routes ───────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

router.put("/me/id-card/:side", auth, async (req, res) => {
  try {
    const { side } = req.params;
    if (!["front", "back"].includes(side)) {
      return res.status(400).json({ success: false, message: "side must be 'front' or 'back'" });
    }
    const { idCard } = req.body;
    if (!idCard?.data) {  // ← fix: was idCard?.fileId
      return res.status(400).json({ success: false, message: "idCard.data is required" });
    }
    let parsed;
    try { parsed = parseImagePayload(idCard); }
    catch (err) { return res.status(400).json({ success: false, message: err.message }); }
    const employee = await Employee.findOne({ _id: req.userId, isDeleted: false })
      .select("idCard").lean();
    if (!employee) return res.status(404).json({ success: false, message: "Employee not found" });
    const fileType = side === "front" ? FILE_TYPES.ID_CARD_FRONT : FILE_TYPES.ID_CARD_BACK;
    await deleteFromGridFS(employee.idCard?.[side]?.fileId);
    const fileId = await uploadToGridFS(
      parsed.buffer, parsed.fileName, parsed.mimeType, req.userId, fileType
    );
    await Employee.updateOne(
      { _id: req.userId },
      { $set: { [`idCard.${side}`]: { fileId, fileName: parsed.fileName, uploadedAt: new Date() } } }
    );
    return res.json({
      success: true,
      message: `ID card ${side} updated`,
      idCard: { [side]: { fileId, fileName: parsed.fileName, uploadedAt: new Date() } },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /me/id-card/:side
router.delete("/me/id-card/:side", auth, async (req, res) => {
  try {
    const { side } = req.params;
    if (!["front", "back"].includes(side)) {
      return res.status(400).json({ success: false, message: "side must be 'front' or 'back'" });
    }

    const employee = await Employee.findOne({ _id: req.userId, isDeleted: false })
      .select("idCard").lean();
    if (!employee) return res.status(404).json({ success: false, message: "Employee not found" });

    await deleteFromGridFS(employee.idCard?.[side]?.fileId);

    await Employee.updateOne(
      { _id: req.userId },
      { $set: { [`idCard.${side}`]: { fileId: null, fileName: null, uploadedAt: null } } }
    );

    return res.json({ success: true, message: `ID card ${side} removed` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /me/id-card/:side  — streams the image
router.get("/me/id-card/:side", auth, async (req, res) => {
  try {
    const { side } = req.params;
    if (!["front", "back"].includes(side)) {
      return res.status(400).json({ success: false, message: "side must be 'front' or 'back'" });
    }
    const employee = await Employee.findOne({ _id: req.userId, isDeleted: false })
      .select("idCard").lean();
    if (!employee?.idCard?.[side]?.fileId) {
      return res.status(404).json({ success: false, message: `ID card ${side} not found` });
    }
    // ✅ Set headers ONCE — idCard has no mimeType field, so hardcode or default
    res.set("Content-Type", "image/jpeg");
    res.set("Cache-Control", "private, max-age=3600");
    const stream = getBucket().openDownloadStream(new ObjectId(employee.idCard[side].fileId));
    stream.on("error", (err) => {
      console.error("GridFS error:", err);
      if (!res.headersSent) {
        return res.status(404).json({ success: false, message: "File not found" });
      }
      stream.destroy();
    });
    stream.pipe(res);
  } catch (err) {
    if (!res.headersSent) res.status(500).json({ success: false, message: err.message });
  }
});

// Admin versions: PUT/DELETE/GET /:id/id-card/:side
router.put("/:id/id-card/:side", adminAuth, async (req, res) => {
  try {
    const { side } = req.params;
    if (!["front", "back"].includes(side)) {
      return res.status(400).json({ success: false, message: "side must be 'front' or 'back'" });
    }

    const { idCard } = req.body;
    if (!idCard?.data) {
      return res.status(400).json({ success: false, message: "idCard.data is required" });
    }

    let parsed;
    try { parsed = parseImagePayload(idCard); }
    catch (err) { return res.status(400).json({ success: false, message: err.message }); }

    const employee = await Employee.findOne({
      _id: req.params.id, isDeleted: false, ...roleVisibilityFilter(req.role),
    }).select("idCard").lean();
    if (!employee) return res.status(404).json({ success: false, message: "Employee not found" });

    const fileType = side === "front" ? FILE_TYPES.ID_CARD_FRONT : FILE_TYPES.ID_CARD_BACK;
    await deleteFromGridFS(employee.idCard?.[side]?.fileId);

    const fileId = await uploadToGridFS(
      parsed.buffer, parsed.fileName, parsed.mimeType, req.params.id, fileType
    );

    await Employee.updateOne(
      { _id: req.params.id },
      { $set: { [`idCard.${side}`]: { fileId, fileName: parsed.fileName, uploadedAt: new Date() } } }
    );

    return res.json({
      success: true,
      message: `ID card ${side} updated`,
      idCard: { [side]: { fileId, fileName: parsed.fileName, uploadedAt: new Date() } },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete("/:id/id-card/:side", adminAuth, async (req, res) => {
  try {
    const { side } = req.params;
    if (!["front", "back"].includes(side)) {
      return res.status(400).json({ success: false, message: "side must be 'front' or 'back'" });
    }

    const employee = await Employee.findOne({
      _id: req.params.id, isDeleted: false, ...roleVisibilityFilter(req.role),
    }).select("idCard").lean();
    if (!employee) return res.status(404).json({ success: false, message: "Employee not found" });

    await deleteFromGridFS(employee.idCard?.[side]?.fileId);

    await Employee.updateOne(
      { _id: req.params.id },
      { $set: { [`idCard.${side}`]: { fileId: null, fileName: null, uploadedAt: null } } }
    );

    return res.json({ success: true, message: `ID card ${side} removed` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get("/:id/id-card/:side", adminAuth, async (req, res) => {
  try {
    const { side } = req.params;
    if (!["front", "back"].includes(side)) {
      return res.status(400).json({ success: false, message: "side must be 'front' or 'back'" });
    }
    const employee = await Employee.findOne({
      _id: req.params.id, isDeleted: false, ...roleVisibilityFilter(req.role),
    }).select("idCard").lean();
    if (!employee?.idCard?.[side]?.fileId) {
      return res.status(404).json({ success: false, message: `ID card ${side} not found` });
    }
    // ✅ Set headers ONCE
    res.set("Content-Type", "image/jpeg");
    res.set("Cache-Control", "private, max-age=3600");
    const stream = getBucket().openDownloadStream(new ObjectId(employee.idCard[side].fileId));
    stream.on("error", (err) => {
      console.error("GridFS error:", err);
      if (!res.headersSent) {
        return res.status(404).json({ success: false, message: "File not found" });
      }
      stream.destroy();
    });
    stream.pipe(res);
  } catch (err) {
    if (!res.headersSent) res.status(500).json({ success: false, message: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// ─── GET /api/employees/me ────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

router.get("/me", auth, async (req, res) => {
  try {
    // ?images=false  → exclude image fileIds from response (default: true)
    const includeImages = req.query.images !== "false";

    const employee = await Employee.findOne({ _id: req.userId, isDeleted: false })
      .select(includeImages ? SAFE_SELECT : SAFE_SELECT_NO_IMG)
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
        bankName:      inc.bankName      !== undefined ? String(inc.bankName      || "").trim() : employee.bank?.bankName      || "",
        accountName:   inc.accountName   !== undefined ? String(inc.accountName   || "").trim() : employee.bank?.accountName   || "",
        accountNumber: inc.accountNumber !== undefined ? String(inc.accountNumber || "").trim() : employee.bank?.accountNumber || "",
      };
    }

    if (req.body.emergencyContact !== undefined) {
      const inc = req.body.emergencyContact;
      if (typeof inc !== "object" || Array.isArray(inc)) {
        return res.status(400).json({ success: false, message: "emergencyContact must be an object" });
      }
      employee.emergencyContact = {
        name:         inc.name         !== undefined ? String(inc.name         || "").trim() : employee.emergencyContact?.name         || "",
        relationship: inc.relationship !== undefined ? String(inc.relationship || "").trim() : employee.emergencyContact?.relationship || "",
        phone:        inc.phone        !== undefined ? String(inc.phone        || "").trim() : employee.emergencyContact?.phone        || "",
      };
    }

    if (req.body.address !== undefined) {
      const inc = req.body.address;
      if (typeof inc !== "object" || Array.isArray(inc)) {
        return res.status(400).json({ success: false, message: "address must be an object" });
      }
      employee.address = {
        street:  inc.street  !== undefined ? String(inc.street  || "").trim() : employee.address?.street  || "",
        city:    inc.city    !== undefined ? String(inc.city    || "").trim() : employee.address?.city    || "",
        state:   inc.state   !== undefined ? String(inc.state   || "").trim() : employee.address?.state   || "",
        zip:     inc.zip     !== undefined ? String(inc.zip     || "").trim() : employee.address?.zip     || "",
        country: inc.country !== undefined ? String(inc.country || "").trim() : employee.address?.country || "",
      };
    }

    // NOTE: idCard images are now managed via dedicated PUT /me/id-card/:side routes
    // Reject idCard updates through this route to keep concerns separated
    if (req.body.idCard !== undefined) {
      return res.status(400).json({
        success: false,
        message: "ID card images must be uploaded via PUT /api/employees/me/id-card/front or /back",
      });
    }

    await employee.save();
    return res.json({ success: true, message: "Profile updated", employee: publicEmployee(employee) });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ success: false, message: "Email already in use", field: "email" });
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /api/employees ───────────────────────────────────────────────────────
// ?images=false  → skip profilePicture + idCard fileIds (default: false for lists)
router.get("/", adminAuth, async (req, res) => {
  try {
    const {
      status,
      department,
      search,
      includeArchived = "false",
      includeLeft     = "false",
      page  = 1,
      limit = 200,
      images = "false",    // ← default false for lists — images are large and rarely needed
    } = req.query;

    const query = {
      isDeleted: false,
      ...roleVisibilityFilter(req.role),
    };

    if (includeArchived !== "true") query.isArchived = false;

    if (status && ["Active", "Frozen", "Inactive"].includes(status)) {
      query.status = status;
    } else if (includeLeft !== "true") {
      query.status = "Active";
    }

    if (department) query.department = department;

    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      query.$or = [
        { firstName:      { $regex: escaped, $options: "i" } },
        { lastName:       { $regex: escaped, $options: "i" } },
        { email:          { $regex: escaped, $options: "i" } },
        { employeeNumber: { $regex: escaped, $options: "i" } },
      ];
    }

    const pageNum  = Math.max(1, Number(page));
    const limitNum = Math.min(500, Math.max(1, Number(limit)));
    const skip     = (pageNum - 1) * limitNum;

    // images=false (default) → exclude fileId fields entirely — faster + lighter
    const selectFields = images === "true" ? SAFE_SELECT : SAFE_SELECT_NO_IMG;

    const [employees, total] = await Promise.all([
      Employee.find(query)
        .select(selectFields)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Employee.countDocuments(query),
    ]);

    return res.json({
      success: true,
      employees,
      pagination: {
        total,
        page:  pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /api/employees/:id ───────────────────────────────────────────────────
// ?images=false  → exclude image fields
router.get("/:id", adminAuth, async (req, res) => {
  try {
    const includeImages = req.query.images !== "false";

    const employee = await Employee.findOne({
      _id: req.params.id,
      isDeleted: false,
      ...roleVisibilityFilter(req.role),
    })
      .select(includeImages ? SAFE_SELECT : SAFE_SELECT_NO_IMG)
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
      email, employeeNumber, firstName, lastName,
      department, joiningDate, shift, salaryType, hourlyRate, monthlySalary,
      bank, role: requestedRole,
    } = req.body;

    if (!email || !employeeNumber || !firstName || !lastName || !department || !joiningDate) {
      return res.status(400).json({
        success: false,
        message: "email, employeeNumber, firstName, lastName, department, and joiningDate are required",
      });
    }

    const resolvedRole        = resolveNewRole(req.role, requestedRole);
    const resolvedSalaryType  = salaryType || "hourly";

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

    const existing = await Employee.findOne({
      $or: [
        { email: email.toLowerCase().trim() },
        { employeeNumber: employeeNumber.trim() },
      ],
      isDeleted: false,
    }).select("email employeeNumber").lean();

    if (existing) {
      const field = existing.email === email.toLowerCase().trim() ? "Email" : "Employee number";
      return res.status(409).json({ success: false, message: `${field} already exists` });
    }

    let finalShift        = shift || { start: "09:00", end: "18:00" };
    let finalSalaryType   = resolvedSalaryType;
    let finalHourlyRate   = parseFloat(hourlyRate) || 0;
    let finalMonthlySalary = finalSalaryType === "monthly" ? parseFloat(monthlySalary) : null;

    if (["superadmin"].includes(resolvedRole)) {
      finalShift         = { start: null, end: null };
      finalSalaryType    = null;
      finalHourlyRate    = null;
      finalMonthlySalary = null;
    }

    const inviteToken = generateInviteToken();
    const employee = new Employee({
      email:          email.toLowerCase().trim(),
      employeeNumber: employeeNumber.trim(),
      firstName:      firstName.trim(),
      lastName:       lastName.trim(),
      department,
      // Images are NOT accepted on POST — use dedicated upload routes after creation
      profilePicture: { fileId: null, fileName: null, mimeType: null, uploadedAt: null },
      idCard: {
        front: { fileId: null, fileName: null, uploadedAt: null },
        back:  { fileId: null, fileName: null, uploadedAt: null },
      },
      role:            resolvedRole,
      joiningDate:     parsedJoiningDate,
      shift:           finalShift,
      salaryType:      finalSalaryType,
      hourlyRate:      finalHourlyRate,
      monthlySalary:   finalMonthlySalary,
      status:          "Inactive",
      inviteToken,
      inviteTokenExpires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      bank:            bank || {},
    });

    await employee.save();

    return res.status(201).json({
      success:    true,
      message:    "Employee created. Upload images via dedicated endpoints after creation.",
      employee:   publicEmployee(employee),
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

    const emailTrimmed  = req.body.email          !== undefined ? req.body.email.toLowerCase().trim() : null;
    const empNumTrimmed = req.body.employeeNumber  !== undefined ? req.body.employeeNumber.trim()      : null;

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

    if (req.body.hourlyRate    !== undefined) employee.hourlyRate    = parseFloat(req.body.hourlyRate);
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
        return res.status(400).json({ success: false, message: "emergencyContact must be an object" });
      }
      employee.emergencyContact = {
        name:         inc.name         !== undefined ? String(inc.name         || "").trim() : employee.emergencyContact?.name         || "",
        relationship: inc.relationship !== undefined ? String(inc.relationship || "").trim() : employee.emergencyContact?.relationship || "",
        phone:        inc.phone        !== undefined ? String(inc.phone        || "").trim() : employee.emergencyContact?.phone        || "",
      };
    }

    if (req.body.address !== undefined) {
      const inc = req.body.address;
      if (typeof inc !== "object" || Array.isArray(inc)) {
        return res.status(400).json({ success: false, message: "address must be an object" });
      }
      employee.address = {
        street:  inc.street  !== undefined ? String(inc.street  || "").trim() : employee.address?.street  || "",
        city:    inc.city    !== undefined ? String(inc.city    || "").trim() : employee.address?.city    || "",
        state:   inc.state   !== undefined ? String(inc.state   || "").trim() : employee.address?.state   || "",
        zip:     inc.zip     !== undefined ? String(inc.zip     || "").trim() : employee.address?.zip     || "",
        country: inc.country !== undefined ? String(inc.country || "").trim() : employee.address?.country || "",
      };
    }

    // Block image updates through this route — use dedicated endpoints
    if (req.body.idCard !== undefined || req.body.profilePicture !== undefined) {
      return res.status(400).json({
        success: false,
        message: "Images must be uploaded via dedicated endpoints: PUT /api/employees/:id/profile-picture or /:id/id-card/front|back",
      });
    }

    if (["owner"].includes(employee.role)) {
      employee.shift         = { start: null, end: null };
      employee.salaryType    = null;
      employee.hourlyRate    = null;
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

// ─── All remaining routes unchanged ──────────────────────────────────────────

router.patch("/:id/archive", adminAuth, async (req, res) => {
  try {
    if (String(req.userId) === String(req.params.id)) {
      return res.status(403).json({ success: false, message: "You cannot archive your own account" });
    }
    const employee = await Employee.findOne({ _id: req.params.id, isDeleted: false, ...roleVisibilityFilter(req.role) });
    if (!employee) return res.status(404).json({ success: false, message: "Employee not found" });
    employee.isArchived = !employee.isArchived;
    await employee.save();
    return res.json({ success: true, message: `Employee ${employee.isArchived ? "archived" : "unarchived"}`, employee: publicEmployee(employee) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post("/:id/resend-invite", adminAuth, async (req, res) => {
  try {
    const employee = await Employee.findOne({ _id: req.params.id, isDeleted: false, ...roleVisibilityFilter(req.role) });
    if (!employee) return res.status(404).json({ success: false, message: "Employee not found" });
    if (employee.status === "Active") return res.status(400).json({ success: false, message: "Employee is already activated" });
    employee.inviteToken        = generateInviteToken();
    employee.inviteTokenExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await employee.save();
    return res.json({ success: true, message: "Invite resent", inviteLink: constructInviteLink(employee.inviteToken) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post("/:id/reset-password", adminAuth, async (req, res) => {
  try {
    const employee = await Employee.findOne({ _id: req.params.id, isDeleted: false, ...roleVisibilityFilter(req.role) });
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

router.delete("/:id", adminAuth, async (req, res) => {
  try {
    if (String(req.userId) === String(req.params.id)) {
      return res.status(403).json({ success: false, message: "You cannot delete your own account" });
    }
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

router.patch("/:id/left-business", adminAuth, async (req, res) => {
  try {
    if (String(req.userId) === String(req.params.id)) {
      return res.status(403).json({ success: false, message: "You cannot mark your own account as left." });
    }
    const employee = await Employee.findOne({ _id: req.params.id, isDeleted: false, ...roleVisibilityFilter(req.role) });
    if (!employee) return res.status(404).json({ success: false, message: "Employee not found" });
    if (employee.leftBusiness?.isLeft) {
      return res.status(409).json({ success: false, message: "Employee is already marked as having left the business.", employee: publicEmployee(employee) });
    }
    const leftDate = req.body.leftDate ? new Date(req.body.leftDate) : new Date();
    if (leftDate > new Date()) return res.status(400).json({ success: false, message: "Left date cannot be in the future." });
    const scheduledDeletion = new Date(leftDate.getTime() + 30 * 24 * 60 * 60 * 1000);
    employee.leftBusiness = {
      isLeft: true, leftDate, scheduledDeletion,
      reason: String(req.body.reason || "").trim().slice(0, 500),
      markedBy: req.userId, reinstatedAt: null, reinstatedBy: null,
    };
    employee.status = "Frozen";
    await employee.save();
    return res.json({ success: true, message: "Employee marked as having left. Data deleted in 30 days.", employee: publicEmployee(employee), deletesAt: scheduledDeletion });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.patch("/:id/reinstate", adminAuth, async (req, res) => {
  try {
    const employee = await Employee.findOne({ _id: req.params.id, isDeleted: false, ...roleVisibilityFilter(req.role) });
    if (!employee) return res.status(404).json({ success: false, message: "Employee not found" });
    if (!employee.leftBusiness?.isLeft) return res.status(409).json({ success: false, message: "This employee has not been marked as left." });
    if (employee.leftBusiness.scheduledDeletion <= new Date()) return res.status(410).json({ success: false, message: "The 30-day reinstatement window has expired." });
    employee.leftBusiness = { ...employee.leftBusiness.toObject(), isLeft: false, scheduledDeletion: null, reinstatedAt: new Date(), reinstatedBy: req.userId };
    employee.status = "Active";
    await employee.save();
    return res.json({ success: true, message: "Employee reinstated.", employee: publicEmployee(employee) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});


export default router;
