// middleware/auth.js

import jwt from "jsonwebtoken";
import Employee from "../models/Employee.js";

// ─── shared token → user resolution ──────────────────────────────────────────

/**
 * Verify the Bearer token, load the employee from DB, attach to req.
 * Returns the employee on success, or sends the error response and returns null.
 */
async function resolveUser(req, res) {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    res.status(401).json({ success: false, message: "No token provided" });
    return null;
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    const message =
      err.name === "TokenExpiredError" ? "Token expired" : "Invalid token";
    res.status(401).json({ success: false, message });
    return null;
  }

  const user = await Employee.findById(decoded.id).select(
    "-password -tempPassword",
  );

  if (!user || user.isDeleted) {
    res.status(401).json({ success: false, message: "User not found" });
    return null;
  }

  // Frozen accounts cannot access anything
  if (user.status === "Frozen") {
    res
      .status(403)
      .json({
        success: false,
        message: "Account is frozen. Contact admin/super admin.",
      });
    return null;
  }

  // Role is the source of truth from the DB, not the token payload.
  // Token role is kept for quick reads but DB always wins.
  req.user = user;
  req.userId = String(user._id);
  req.role = user.role; // 'admin' | 'employee'

  return user;
}

// ─── middleware functions ─────────────────────────────────────────────────────

/**
 * auth — any authenticated user (admin or active employee).
 */
async function auth(req, res, next) {
  try {
    const user = await resolveUser(req, res);
    if (!user) return;
    next();
  } catch (err) {
    res
      .status(500)
      .json({ success: false, message: "Auth error", error: err.message });
  }
}

/**
 * adminAuth — authenticated AND role === 'admin'.
 */
async function adminAuth(req, res, next) {
  try {
    const user = await resolveUser(req, res);
    if (!user) return;

    if (!["admin", "superadmin"].includes(user.role)) {
      return res
        .status(403)
        .json({ success: false, message: "Admin access required" });
    }

    next();
  } catch (err) {
    res
      .status(500)
      .json({ success: false, message: "Auth error", error: err.message });
  }
}

/**
 * employeeAuth — authenticated AND (role === 'employee' with Active status).
 * Admins are intentionally blocked here; use `auth` if both should be allowed.
 */
async function employeeAuth(req, res, next) {
  try {
    const user = await resolveUser(req, res);
    if (!user) return;

    if (user.role !== "employee") {
      return res
        .status(403)
        .json({ success: false, message: "Employee access required" });
    }

    if (user.status !== "Active") {
      return res
        .status(403)
        .json({ success: false, message: "Account is not active" });
    }

    next();
  } catch (err) {
    res
      .status(500)
      .json({ success: false, message: "Auth error", error: err.message });
  }
}

export { auth, adminAuth, employeeAuth };
export default auth;
