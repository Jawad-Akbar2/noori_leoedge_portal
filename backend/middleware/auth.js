// middleware/auth.js

import jwt from "jsonwebtoken";
import Employee from "../models/Employee.js";

/**
 * Resolve user once per request (FAST)
 */
async function resolveUser(req, res) {
  // ✅ already loaded → skip everything
  if (req.user) return req.user;

  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    res.status(401).json({ success: false, message: "No token provided" });
    return null;
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return res.status(401).json({
      success: false,
      message:
        err.name === "TokenExpiredError" ? "Token expired" : "Invalid token",
    });
  }

  try {
    const user = await Employee.findById(decoded.id)
      .select("-password -tempPassword")
      .lean(); // ⚡ FAST

    if (!user || user.isDeleted) {
      res.status(401).json({ success: false, message: "User not found" });
      return null;
    }

    // password changed check
    if (user.passwordChangedAt) {
      const tokenIssuedAt = decoded.iat * 1000;
      if (user.passwordChangedAt.getTime() > tokenIssuedAt) {
        res.status(401).json({
          success: false,
          message: "Password changed. Login again.",
        });
        return null;
      }
    }

    // attach once
    req.user = user;
    req.userId = String(user._id);
    req.role = user.role;

    return user;
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
    return null;
  }
}

/**
 * ANY logged-in user
 */
async function auth(req, res, next) {
  const user = await resolveUser(req, res);
  if (!user) return;
  next();
}

/**
 * ADMIN ONLY
 */
async function adminAuth(req, res, next) {
  const user = await resolveUser(req, res);
  if (!user) return;

  if (!["admin", "superadmin", "hybrid", "owner"].includes(user.role)) {
    return res.status(403).json({
      success: false,
      message: "Admin access required",
    });
  }

  next();
}

/**
 * EMPLOYEE ONLY
 */
async function employeeAuth(req, res, next) {
  const user = await resolveUser(req, res);
  if (!user) return;

  if (!["employee", "hybrid"].includes(user.role)) {
    return res.status(403).json({
      success: false,
      message: "Employee access required",
    });
  }

  if (!["Active", "Frozen"].includes(user.status)) {
    return res.status(403).json({
      success: false,
      message: "Account not active",
    });
  }

  next();
}

/**
 * PROFILE COMPLETE CHECK
 */
async function profileComplete(req, res, next) {
  try {
    const user = req.user;

    if (["owner", "superadmin"].includes(user.role)) {
      return next();
    }

    const fields = [
      ["Bank name", user.bank?.bankName],
      ["Account name", user.bank?.accountName],
      ["Account number (IBAN)", user.bank?.accountNumber],
      ["ID card front", user.idCard?.front?.url],
      ["ID card back", user.idCard?.back?.url],
      ["Emergency contact name", user.emergencyContact?.name],
      ["Emergency contact phone", user.emergencyContact?.phone],
    ];

    const missing = fields
      .filter(([_, val]) => !val?.toString().trim())
      .map(([label]) => label);

    if (missing.length > 0) {
      return res.status(403).json({
        success: false,
        code: "PROFILE_INCOMPLETE",
        message: "Complete your profile first",
        missing,
      });
    }

    next();
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export { auth, adminAuth, employeeAuth, profileComplete };
export default auth;