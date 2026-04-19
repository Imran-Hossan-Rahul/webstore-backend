// middlewares/auth.js
import jwt from "jsonwebtoken";
import asyncHandler from "express-async-handler";
import User from "../models/User.model.js" // তোমার User model path ঠিক করে নাও
import ButtonTemplate from "../models/Template.model.js";
import { JWT_ACCESS_SECRET } from "../config/index.js";

// --------------------
// Protect routes - only authenticated users
// --------------------
export const protect = asyncHandler(async (req, res, next) => {
  let token;

  // 🔹 1️⃣ Authorization header
  if (req.headers.authorization?.startsWith("Bearer")) {
    token = req.headers.authorization.split(" ")[1];
  }

  // 🔹 2️⃣ Cookie (frontend থেকে credentials: "include" করলে)
  if (!token && req.cookies?.token) {
    token = req.cookies.token;
  }

  if (!token) {
    return res
      .status(401)
      .json({ success: false, message: "Not authorized, no token" });
  }

  try {
    const decoded = jwt.verify(token, JWT_ACCESS_SECRET);

    // 🔹 User find
    const user = await User.findById(decoded.id).select("-password");
    if (!user) {
      return res
        .status(401)
        .json({ success: false, message: "User not found" });
    }

    // 🔹 Attach user to request
    req.user = user;

    next();
  } catch (err) {
    return res
      .status(401)
      .json({ success: false, message: "Not authorized, token failed" });
  }
});

// --------------------
// Optional Protect - populate user if token exists, otherwise proceed
// --------------------
export const optionalProtect = asyncHandler(async (req, res, next) => {
  let token;

  if (req.headers.authorization?.startsWith("Bearer")) {
    token = req.headers.authorization.split(" ")[1];
  } else if (req.cookies?.token) {
    token = req.cookies.token;
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
  if (req.user && (req.user.role === "admin" || req.user.isSuperAdmin)) {
    return next();
  }
  return res
    .status(403)
    .json({ success: false, message: "Access denied: Admins only" });
};

// --------------------
// Allow only super admin
// --------------------
export const superAdminOnly = (req, res, next) => {
  if (req.user && req.user.isSuperAdmin) {
    return next();
  }
  return res
    .status(403)
    .json({ success: false, message: "Access denied: Super admin only" });
};

// --------------------
// Creator-only gate
// Only the whitelisted creator email can call creator routes.
// --------------------
const WHITELISTED_CREATOR_EMAIL = "imranhossanrahul.dev@gmail.com";

export const creatorOnly = (req, res, next) => {
  if (
    req.user &&
    req.user.email &&
    req.user.email.toLowerCase() === WHITELISTED_CREATOR_EMAIL
  ) {
    return next();
  }
  return res.status(403).json({
    success: false,
    message: "Creator access is not available for this account.",
  });
};

// --------------------
// Template ownership or admin check
// Only creator OR admin/superadmin can update/delete
// --------------------
export const templateOwnerOrAdmin = asyncHandler(async (req, res, next) => {
  const template = await ButtonTemplate.findById(req.params.id);
  if (!template || !template.isActive) {
    return res
      .status(404)
      .json({ success: false, message: "Template not found" });
  }

  // Creator or admin/superadmin
  if (
    template.user.toString() === req.user._id.toString() ||
    req.user.isSuperAdmin ||
    req.user.role === "admin"
  ) {
    req.template = template; // attach template for controller use
    return next();
  }

  return res.status(403).json({ success: false, message: "Access denied" });
});
