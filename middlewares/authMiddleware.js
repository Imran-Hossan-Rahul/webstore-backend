// middlewares/auth.js
import jwt from "jsonwebtoken";
import asyncHandler from "express-async-handler";
import User from "../models/User.model.js" // তোমার User model path ঠিক করে নাও
import Artifact from "../models/Artifact.model.js";
import { JWT_ACCESS_SECRET } from "../config/index.js";
import logger from "../utils/logger.js"; // ✅ FIX: was missing — caused ReferenceError in craftsmanOnly


// --------------------
// Protect routes - only authenticated users
// --------------------
export const protect = asyncHandler(async (req, res, next) => {
  let token;

  // 🔹 1️⃣ Authorization header
  if (req.headers.authorization?.startsWith("Bearer")) {
    token = req.headers.authorization.split(" ")[1];
  }

  // 🔹 2️⃣ Cookie (Priority for million-dollar security)
  if (!token && req.cookies?.accessToken) {
    token = req.cookies.accessToken;
  }

  if (!token) {
    return res
      .status(401)
      .json({ success: false, message: "Not authorized, no token" });
  }

  try {
    const decoded = jwt.verify(token, JWT_ACCESS_SECRET);

    // 🔹 User find
    // ✅ FIX: +isSuperAdmin needed because it has select:false in schema
    // Without this, generateAccessToken() would always set isSuperAdmin: false after a token refresh
    const user = await User.findById(decoded.id).select("-password +isSuperAdmin");

    if (!user) {
      return res
        .status(401)
        .json({ success: false, message: "User not found" });
    }

    // 🔹 Attach user to request
    req.user = user;

    next();
  } catch (err) {
    // If it's a JWT error (expired, invalid signature, etc), return 401.
    // If it's a DB connection error during server restart, return 500 so frontend doesn't log out.
    if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
      return res
        .status(401)
        .json({ success: false, message: "Not authorized, token failed" });
    }
    return res
      .status(500)
      .json({ success: false, message: "Internal server error during authentication" });
  }
});

// --------------------
// Optional Protect - populate user if token exists, otherwise proceed
// --------------------
export const optionalProtect = asyncHandler(async (req, res, next) => {
  let token;

  if (req.headers.authorization?.startsWith("Bearer")) {
    token = req.headers.authorization.split(" ")[1];
  } else if (req.cookies?.accessToken) {
    token = req.cookies.accessToken;
  }

  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_ACCESS_SECRET);
      req.user = await User.findById(decoded.id).select("-password");
    } catch (error) {
       // Token invalid - proceed without user
    }
  }
  next();
});
// --------------------
// Allow only admin (or super admin)
// --------------------
export const adminOnly = (req, res, next) => {
  if (req.user && (req.user.role === "admin" || req.user.role === "superadmin" || req.user.isSuperAdmin)) {
    return next();
  }
  return res
    .status(403)
    .json({ success: false, message: "Access denied: Admins only" });
};

// --------------------
// Allow verified hosts or admins
// --------------------
export const hostOnly = (req, res, next) => {
  if (req.user && (req.user.role === "admin" || req.user.role === "superadmin" || req.user.isSuperAdmin || req.user.isHost)) {
    return next();
  }
  return res
    .status(403)
    .json({ success: false, message: "Access denied: Verified hosts or admins only" });
};

// --------------------
// Allow only super admin
// --------------------
export const superAdminOnly = (req, res, next) => {
  if (req.user && (req.user.role === "superadmin" || req.user.isSuperAdmin)) {
    return next();
  }
  return res
    .status(403)
    .json({ success: false, message: "Access denied: Super admin only" });
};

// --------------------
// Restrict to specific roles
// --------------------
export const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!req.user || (!roles.includes(req.user.role) && !req.user.isSuperAdmin)) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to perform this action",
      });
    }
    next();
  };
};

// --------------------
// Craftsman-only gate
// Only the whitelisted craftsman email can call craftsman routes.
// --------------------
export const craftsmanOnly = (req, res, next) => {
  // Support multiple whitelisted emails from .env
  const emailsStr = process.env.WHITELISTED_CRAFTSMAN_EMAILS || "";
  const whitelistedEmails = new Set(
    emailsStr.toLowerCase().split(",").map(e => e.trim()).filter(Boolean)
  );

  // MUST use environment variables for whitelisting. 
  // If not set, nobody is a craftsman by default (Zero Trust).
  if (whitelistedEmails.size === 0) {
    logger.warn("[SECURITY] No craftsman emails whitelisted in .env!");
  }

  if (
    req.user &&
    req.user.email &&
    whitelistedEmails.has(req.user.email.toLowerCase())
  ) {
    return next();
  }
  return res.status(403).json({
    success: false,
    message: "Craftsman access is not available for this account.",
  });
};

// --------------------
// Artifact ownership or admin check
// Only craftsman OR admin/superadmin can update/delete
// --------------------
export const artifactOwnerOrAdmin = asyncHandler(async (req, res, next) => {
  const artifact = await Artifact.findById(req.params.id);
  if (!artifact || !artifact.isActive) {
    return res
      .status(404)
      .json({ success: false, message: "Artifact not found" });
  }

  // Craftsman or admin/superadmin
  if (
    artifact.user.toString() === req.user._id.toString() ||
    req.user.isSuperAdmin ||
    req.user.role === "admin"
  ) {
    req.artifact = artifact; // attach artifact for controller use
    return next();
  }

  return res.status(403).json({ success: false, message: "Access denied" });
});


