// controllers/authController.js
import User from "../models/User.model.js";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
} from "../services/auth.service.js";
import { registerSchema, loginSchema } from "../validation/authValidation.js";
import { normalizeEmail } from "../utils/normalizeEmail.js";
import logger from "../utils/logger.js";
import { NODE_ENV } from "../config/index.js";

// ---- Helper for setting refresh cookie ----
const setRefreshCookie = (res, tokenDoc, token) => {
  const maxAge = tokenDoc.expiresAt.getTime() - Date.now();
  res.cookie("refreshToken", token, {
    httpOnly: true,
    secure: NODE_ENV === "production",
    sameSite: "Strict",
    path: "/api/v1/auth/refresh-token",
    maxAge,
  });
};

// ---- Register ----
// ---- Register User with Auto-Login ----
export const registerUser = async (req, res) => {
  try {
    // Joi validation
    const schema = registerSchema();
    const { error } = schema.validate(req.body);

    if (error) {
      return res.status(400).json({
        success: false,
        errors: error.details.map((e) => e.message),
      });
    }

    let { name, email, password } = req.body;

    // Email normalization
    const normalized = normalizeEmail(email);
    if (!normalized.valid) {
      return res.status(400).json({ success: false, message: "Invalid email" });
    }
    email = normalized.email;

    // Already exists
    if (await User.findOne({ email })) {
      return res.status(409).json({
        success: false,
        message: "User already exists",
      });
    }

    // Create user (platform account by default)
    const user = await User.create({ 
      name, 
      email, 
      password,
      hasCreatorAccount: false,
    });

    // Auto-create PlatformProfile
    const PlatformProfile = (await import("../models/PlatformProfile.model.js")).default;
    await PlatformProfile.create({
      userId: user._id,
      isActive: true,
    });

    // Generate tokens
    const accessToken = generateAccessToken(user);
    const { token: refreshToken, refreshTokenDoc } = await generateRefreshToken(
      user,
      req.headers["user-agent"] || null,
      req.ip
    );

    setRefreshCookie(res, refreshTokenDoc, refreshToken);

    return res.status(201).json({
      success: true,
      message: "User registered successfully",
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        hasCreatorAccount: user.hasCreatorAccount,
        accessToken,
      },
    });
  } catch (err) {
    logger.error("Register Error: ", err);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};





// -------- Updated login controller ----------
export const loginUser = async (req, res) => {
  try {
    const schema = loginSchema();
    const { error } = schema.validate(req.body);
    if (error)
      return res
        .status(400)
        .json({ success: false, errors: error.details.map((e) => e.message) });

    let { email, password } = req.body;
    const normalized = normalizeEmail(email);
    if (!normalized.valid)
      return res.status(400).json({ success: false, message: "Invalid email" });
    email = normalized.email;

    const user = await User.findOne({ email }).select("+password");
    if (!user || !user.isActive)
      return res
        .status(401)
        .json({ success: false, message: "Invalid email or password" });

    // Check if account is locked before password check
    const locked = await user.isLocked();
    if (locked) {
      return res
        .status(423)
        .json({ success: false, message: "Account temporarily locked. Try later." });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      await user.incrementLoginAttempts(req.ip);
      return res
        .status(401)
        .json({ success: false, message: "Invalid email or password" });
    }

    await user.resetLoginAttempts(req.ip); // reset on successful login

    // --- Analytics Tracking ---
    const ua = req.headers["user-agent"] || "Unknown";

    let device = "Other";
    if (/mobile/i.test(ua)) device = "Mobile";
    else if (/windows|win32/i.test(ua)) device = "Windows";
    else if (/macintosh|mac os/i.test(ua)) device = "Mac";
    else if (/linux/i.test(ua)) device = "Linux";

    let browser = "Unknown";
    if (/chrome/i.test(ua)) browser = "Chrome";
    else if (/firefox/i.test(ua)) browser = "Firefox";
    else if (/safari/i.test(ua) && !/chrome/i.test(ua)) browser = "Safari";
    else if (/edg/i.test(ua)) browser = "Edge";
    else if (/opera|opr/i.test(ua)) browser = "Opera";

    user.device = device;
    user.browser = browser;
    user.ip = req.ip;
    user.referrer = req.headers.referer || "Direct";
    user.lastLogin = new Date();

    user.sessions.push({
      device,
      browser,
      ip: req.ip,
      referrer: req.headers.referer || "Direct",
      landingPage: req.originalUrl,
    });

    await user.save();

    // --- Gamification: Update Streak ---
    const GamificationService = (await import("../services/GamificationService.js")).default;
    await GamificationService.updateStreak(user._id);

    const accessToken = generateAccessToken(user);
    const { token: refreshToken, refreshTokenDoc } = await generateRefreshToken(
      user,
      req.headers["user-agent"] || null,
      req.ip
    );
    setRefreshCookie(res, refreshTokenDoc, refreshToken);

    return res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        hasCreatorAccount: user.hasCreatorAccount,
        accessToken,
      },
    });
  } catch (err) {
    console.error("Login Error: ", err.stack || err);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

// ---- Refresh Token ----
// ---- Refresh Token ----
export const refreshTokenHandler = async (req, res) => {
  try {
    const token = req.cookies.refreshToken;
    if (!token)
      return res
        .status(401)
        .json({ success: false, message: "No refresh token provided" });

    const check = await verifyRefreshToken(
      token,
      req.headers["user-agent"] || null,
      req.ip
    );
    if (!check.valid)
      return res.status(403).json({
        success: false,
        message: "Invalid refresh token",
        reason: check.reason,
      });

    await check.record.touch(req.ip, req.headers["user-agent"] || null);

    const { token: newRefreshToken, refreshTokenDoc } =
      await rotateRefreshToken(
        check.record,
        req.headers["user-agent"] || null,
        req.ip
      );
    setRefreshCookie(res, refreshTokenDoc, newRefreshToken);

    const accessToken = generateAccessToken(check.record.user);

    // ✅ Response updated: return JSON with accessToken
    return res.status(200).json({
      success: true,
      message: "Access token refreshed",
      data: {
        accessToken,
      },
    });
  } catch (err) {
    logger.error("Refresh Token Error: ", err.stack || err);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

// ---- Logout ----
export const logoutHandler = async (req, res) => {
  try {
    const token = req.cookies.refreshToken;
    if (token) await revokeRefreshToken(token);
    res.clearCookie("refreshToken", { path: "/api/v1/auth/refresh-token" });
    return res.status(200).json({ success: true, message: "Logged out" });
  } catch (err) {
    logger.error("Logout Error: ", err.stack || err);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

// ---- Admin / SuperAdmin Controllers ----

export const createAdminUserController = async (req, res) => {
  try {
    const { name, email, password, role, isSuperAdmin } = req.body;

    // Prevent anyone except superadmin from creating another superadmin
    if (isSuperAdmin && !req.user.isSuperAdmin) {
      return res.status(403).json({ success: false, message: "Only superadmin can create another superadmin" });
    }

    // Only superadmin can assign admin role
    if (role === "admin" && !req.user.isSuperAdmin) {
      return res.status(403).json({ success: false, message: "Only superadmin can assign admin role" });
    }

    const userExists = await User.findOne({ email });
    if (userExists) return res.status(409).json({ success: false, message: "User already exists" });

    const user = await User.create({ name, email, password, role, isSuperAdmin: !!isSuperAdmin });

    return res.status(201).json({
      success: true,
      message: "User created successfully",
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isSuperAdmin: user.isSuperAdmin,
      },
    });
  } catch (err) {
    logger.error("Create Admin User Error: ", err.stack || err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const deleteAdminController = async (req, res) => {
  try {
    const { id } = req.params;

    // শুধু super admin ডিলিট করতে পারবে
    if (!req.user.isSuperAdmin) {
      return res
        .status(403)
        .json({ success: false, message: "Only superadmin can delete admins" });
    }

    const user = await User.findById(id);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // Super admin নিজেকে ডিলিট করতে পারবে না
    if (user.isSuperAdmin) {
      return res
        .status(403)
        .json({ success: false, message: "Cannot delete another superadmin" });
    }

    // Soft delete বা permanent delete, তুমি চাইলে
    user.isActive = false; // soft delete
    await user.save();

    // অথবা permanent delete করতে চাইলে uncomment করো:
    // await User.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: `Admin user ${user.name} has been deleted`,
    });
  } catch (err) {
    logger.error("Delete Admin User Error: ", err.stack || err);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

export const getUserCount = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const onlineUsers = await User.countDocuments({ status: "online" });
    const creators = await User.countDocuments({
      hasCreatorAccount: true,
    });
    const platformUsers = await User.countDocuments({ 
      hasCreatorAccount: false 
    });

    return res.status(200).json({
      success: true,
      total: totalUsers,
      online: onlineUsers,
      creators,
      platformUsers,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const getCreators = async (req, res) => {
  try {
    const CreatorProfile = (await import("../models/CreatorProfile.model.js")).default;
    
    const creators = await CreatorProfile.find({
      isActive: true,
    })
      .populate("userId", "name profilePicture")
      .lean();

    const result = creators.map((creator) => ({
      _id: creator._id.toString(),
      userId: creator.userId._id.toString(),
      name: creator.displayName || creator.userId.name || "Unknown",
      profilePic: creator.userId.profilePicture || "/default-profile.png",
      skills: creator.skills && creator.skills.length
        ? creator.skills
        : ["#React", "#Next.js", "#Software Development"],
      workType: creator.workType || "solo",
      status: "offline", // default status, later update with real-time online info if needed
    }));

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};