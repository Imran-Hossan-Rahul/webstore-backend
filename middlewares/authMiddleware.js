// middlewares/auth.js
import jwt from "jsonwebtoken";
import asyncHandler from "express-async-handler";
import User from "../models/User.model.js" // তোমার User model path ঠিক করে নাও
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
  if (req.user && (req.user.role === "admin" || req.user.role === "superadmin" || req.user.isSuperAdmin === true)) {
    return next();
  }
  return res
    .status(403)
    .json({ success: false, message: "Access denied: Admins only" });
};



// --------------------
// Restrict to specific roles
// --------------------
const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to perform this action",
      });
    }
    next();
  };
};





