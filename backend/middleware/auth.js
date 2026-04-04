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

  // ⚠️ Reject tokens issued before the last password change
  if (user.passwordChangedAt) {
    const tokenIssuedAt = decoded.iat * 1000;
    if (user.passwordChangedAt.getTime() > tokenIssuedAt) {
      res.status(401).json({
        success: false,
        message: "Password was changed. Please log in again.",
      });
      return null;
    }
  }

  // Role is the source of truth from the DB, not the token payload.
  req.user = user;
  req.userId = String(user._id);
  req.role = user.role; // 'admin' | 'employee' | 'hybrid'

  return user;
}

// ─── middleware functions ─────────────────────────────────────────────────────

/**
 * auth — any authenticated user (admin, employee, hybrid)
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
 * profileComplete — blocks any route if the employee's profile is incomplete.
 * Must be used AFTER `auth` or `employeeAuth`.
 * Admins / superadmins / owners are exempt — they're never blocked.
 */
async function profileComplete(req, res, next) {
  try {
    const user = req.user;

    // Only owner and superadmin are exempt — they're system accounts with no payroll
    if (["owner", "superadmin"].includes(user.role)) {
      return next();
    }

    const missing = [];

    if (!user.bank?.bankName?.trim())      missing.push("Bank name");
    if (!user.bank?.accountName?.trim())   missing.push("Account name");
    if (!user.bank?.accountNumber?.trim()) missing.push("Account number (IBAN)");
    if (!user.idCard?.front?.url)          missing.push("ID card front");
    if (!user.idCard?.back?.url)           missing.push("ID card back");
    if (!user.emergencyContact?.name?.trim())  missing.push("Emergency contact name");
    if (!user.emergencyContact?.phone?.trim()) missing.push("Emergency contact phone");

    if (missing.length > 0) {
      return res.status(403).json({
        success: false,
        code: "PROFILE_INCOMPLETE",
        message: "Complete your profile to access this feature.",
        missing,
      });
    }

    next();
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}


/**
 * adminAuth — authenticated AND role === 'admin' or 'superadmin' or 'hybrid'
 */
async function adminAuth(req, res, next) {
  try {
    const user = await resolveUser(req, res);
    if (!user) return;

    if (!["admin", "superadmin", "hybrid", "owner"].includes(user.role)) {
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
 * employeeAuth — authenticated AND role === 'employee' OR 'hybrid' with Active status
 * Admins are intentionally blocked here; use `auth` if both should be allowed.
 */
async function employeeAuth(req, res, next) {
  try {
    const user = await resolveUser(req, res);
    if (!user) return;

    if (!["employee", "hybrid"].includes(user.role)) {
      return res
        .status(403)
        .json({ success: false, message: "Employee access required" });
    }

    if (user.status !== "Active" && user.status !== "Frozen") {
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

export { auth, adminAuth, employeeAuth, profileComplete };
export default auth;