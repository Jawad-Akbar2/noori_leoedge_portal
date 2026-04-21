// routes/auth.js
import express    from "express";
import jwt        from "jsonwebtoken";
import Employee   from "../models/Employee.js";
import Verification from "../models/Verification.js";
import { sendPasswordResetEmail } from "../utils/mailer.js";
import { auth }   from "../middleware/auth.js";
import dotenv     from "dotenv";

dotenv.config();

const router = express.Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

const publicUser = (emp) => ({
  id:             emp._id,
  email:          emp.email,
  firstName:      emp.firstName,
  lastName:       emp.lastName,
  employeeNumber: emp.employeeNumber,
  department:     emp.department,
  role:           emp.role,
  status:         emp.status,
  shift:          emp.shift,
});

const signToken = (emp) =>
  jwt.sign(
    { id: emp._id, email: emp.email, role: emp.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || "8h" },
  );

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Email and password are required" });
    }

    // .lean(false) intentionally kept — comparePassword() is an instance method
    // that needs the full Mongoose document. lean() strips prototype methods.
    // Projection limits what MongoDB sends over the wire: only the 8 fields
    // publicUser() and comparePassword() actually need.
    const employee = await Employee.findOne({
      email:     email.toLowerCase().trim(),
      isDeleted: false,
    }).select("firstName lastName email employeeNumber department role status shift inviteToken password");

    if (!employee) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    if (employee.status === "Inactive" && !employee.inviteToken) {
      return res.status(401).json({ success: false, message: "Account not yet activated." });
    }

    const isMatch = await employee.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    // signToken is synchronous (jwt.sign with no callback) — no parallelism needed,
    // there is nothing else to run concurrently at this point.
    const token = signToken(employee);
    return res.json({ success: true, token, user: publicUser(employee) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── POST /api/auth/employee-onboard ─────────────────────────────────────────
router.post("/employee-onboard", async (req, res) => {
  try {
    const { token, firstName, lastName, password, bankDetails } = req.body;

    if (!token || !firstName || !lastName || !password) {
      return res.status(400).json({
        success: false,
        message: "token, firstName, lastName, and password are required",
      });
    }
    if (password.length < 8) {
      return res.status(400).json({ success: false, message: "Password must be at least 8 characters" });
    }

    // Sparse index on inviteToken means this only scans the small set of
    // employees who still have a pending invite — very fast.
    const employee = await Employee.findOne({
      inviteToken:        token,
      inviteTokenExpires: { $gt: Date.now() },
    });

    if (!employee) {
      return res.status(400).json({ success: false, message: "Invitation link is invalid or has expired" });
    }

    employee.firstName          = firstName.trim();
    employee.lastName           = lastName.trim();
    employee.password           = password; // hashed by pre-save hook
    employee.bank               = bankDetails || {};
    employee.status             = "Active";
    employee.inviteToken        = undefined;
    employee.inviteTokenExpires = undefined;

    await employee.save();

    const jwtToken = signToken(employee);
    return res.json({
      success: true,
      message: "Onboarding complete. Welcome!",
      token:   jwtToken,
      user:    publicUser(employee),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /api/auth/validate-token ────────────────────────────────────────────
// auth middleware already verifies the JWT and loads req.user — nothing extra
// to fetch here, so this handler is intentionally trivial.
router.get("/validate-token", auth, (req, res) => {
  return res.json({
    success: true,
    valid:   true,
    user:    publicUser(req.user),
    role:    req.user.role,
  });
});

// ─── POST /api/auth/change-password ──────────────────────────────────────────
router.post("/change-password", auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: "currentPassword and newPassword are required" });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, message: "New password must be at least 8 characters" });
    }
    if (currentPassword === newPassword) {
      return res.status(400).json({ success: false, message: "New password must be different from current password" });
    }

    // Re-fetch with password hash — auth middleware deliberately omits it.
    // Only select the fields comparePassword() and save() need.
    const employee = await Employee.findById(req.user._id).select("+password");
    if (!employee) {
      return res.status(404).json({ success: false, message: "Employee not found" });
    }

    const isMatch = await employee.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: "Current password is incorrect" });
    }

    employee.password = newPassword; // hashed by pre-save hook
    await employee.save();           // single operation — Promise.all([single]) adds nothing

    return res.json({ success: true, message: "Password changed successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── POST /api/auth/forgot-password ──────────────────────────────────────────
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: "Email is required" });
    }

    // Lean is fine here — we only need email and firstName for the mailer,
    // no instance methods required.
    const employee = await Employee.findOne({
      email:     email.toLowerCase().trim(),
      isDeleted: false,
      status:    { $ne: "Frozen" },
    }).select("email firstName").lean();

    // Always 200 — never reveal whether the email exists in the system.
    if (!employee) {
      return res.json({ success: true, message: "If that email is registered, a reset link has been sent." });
    }

    // createForEmail does a deleteMany + create internally (sequential by design
    // — the token must exist before we email it). The email send can then happen
    // immediately after; no further DB work depends on it.
    const plainToken = await Verification.createForEmail(employee.email, 15);
    await sendPasswordResetEmail(employee.email, employee.firstName, plainToken);

    return res.json({ success: true, message: "If that email is registered, a reset link has been sent." });
  } catch (err) {
    console.error("[forgot-password]", err);
    res.status(500).json({ success: false, message: "Failed to send reset email. Please try again." });
  }
});

// ─── POST /api/auth/reset-password ───────────────────────────────────────────
router.post("/reset-password", async (req, res) => {
  try {
    const { email, token, newPassword } = req.body;

    if (!email || !token || !newPassword) {
      return res.status(400).json({ success: false, message: "email, token, and newPassword are required" });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, message: "Password must be at least 8 characters" });
    }

    // These two queries are fully independent — fire both simultaneously.
    // Combined wait = max(verificationLookup, employeeLookup) instead of their sum.
    const [verification, employee] = await Promise.all([
      Verification.findValid(email, token),
      Employee.findOne({ email: email.toLowerCase().trim(), isDeleted: false })
                .select("email password"),  // only what save() needs
    ]);

    if (!verification) {
      return res.status(400).json({ success: false, message: "Invalid or expired token" });
    }
    if (!employee) {
      return res.status(404).json({ success: false, message: "Account not found" });
    }

    employee.password = newPassword;

    // Save the new password and delete the used token simultaneously.
    // Neither depends on the other's result, so parallel is correct here.
    await Promise.all([employee.save(), verification.deleteOne()]);

    return res.json({ success: true, message: "Password has been reset successfully. You can now log in." });
  } catch (err) {
    console.error("[reset-password]", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── POST /api/auth/verify-reset-token ───────────────────────────────────────
router.post("/verify-reset-token", async (req, res) => {
  try {
    const { email, token } = req.body;
    if (!email || !token) {
      return res.status(400).json({ success: false, valid: false, message: "email and token are required" });
    }

    const verification = await Verification.findValid(email, token);
    if (!verification) {
      return res.status(400).json({ success: false, valid: false, message: "Reset link is invalid or has expired." });
    }

    const secondsLeft = Math.floor((new Date(verification.expiresAt) - Date.now()) / 1000);
    return res.json({ success: true, valid: true, expiresInSeconds: secondsLeft });
  } catch (err) {
    console.error("[verify-reset-token]", err);
    res.status(500).json({ success: false, valid: false, message: err.message });
  }
});

export default router;