// controllers/authController.js
import User from "../models/User.model.js";
import { generateUniqueUsername } from "../utils/generateUsername.js";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
} from "../services/auth.service.js";
import { registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema } from "../validation/authValidation.js";
import { normalizeEmail } from "../utils/normalizeEmail.js";
import logger from "../utils/logger.js";
import { NODE_ENV, CLIENT_URL, JWT_ACCESS_SECRET } from "../config/index.js";
import { sendVerificationEmail, sendPasswordResetEmail } from "../services/email.service.js";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { OTP } from "otplib";
const authenticator = new OTP();

// ---- Helpers for setting cookies ----
const setTokenCookies = (res, accessToken, refreshTokenDoc, refreshToken) => {
  // ✅ FIX: Access Token Cookie — 15 minutes matches proper JWT short-lived token policy.
  // NOTE: JWT_SECRET_ACCESS_TOKEN_EXPIRY in .env should also be set to "15m" not "7d"
  // "7d" JWT + "15m" cookie means extracted JWT tokens stay valid for 7 days if leaked.
  res.cookie("accessToken", accessToken, {
    httpOnly: true,
    secure: NODE_ENV === "production",
    sameSite: NODE_ENV === "production" ? "none" : "lax",
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days to match JWT expiry
  });


  // Refresh Token Cookie
  const maxAge = refreshTokenDoc.expiresAt.getTime() - Date.now();
  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: NODE_ENV === "production",
    sameSite: NODE_ENV === "production" ? "none" : "lax",
    path: "/api/v1/auth/refresh-token",
    maxAge,
  });
};

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

    // Generate unique username
    const { generateUniqueUsername } = await import("../utils/generateUsername.js");
    const username = await generateUniqueUsername(name, User);

    // Create user (platform account by default)
    const user = await User.create({ 
      name, 
      username,
      email, 
      password,
    });

    // Generate tokens
    const accessToken = generateAccessToken(user);
    const { token: refreshToken, refreshTokenDoc } = await generateRefreshToken(
      user,
      req.headers["user-agent"] || null,
      req.ip
    );

    setTokenCookies(res, accessToken, refreshTokenDoc, refreshToken);

    // --- Email Verification Step ---
    const verificationToken = await user.generateEmailVerification();
    try {
      await sendVerificationEmail(user.email, user.name, verificationToken, "link_only");
    } catch (emailErr) {
      logger.error("Initial verification email failed: ", emailErr);
    }

    return res.status(201).json({
      success: true,
      message: "User registered successfully. Please verify your email.",
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        accessToken,
        csrfToken: req.csrfToken,
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

    // --- 2FA Check ---
    /* 
    if (user.twoFactorEnabled) {
      // Return temporary token and requires2FA flag
      // Use user ID as temporary token for simplicity in this flow, signed via jwt or just return ID.
      // Better to generate a short-lived temp token. We'll use a short JWT token for the tempToken.
      const tempToken = jwt.sign({ tempId: user._id }, JWT_ACCESS_SECRET, { expiresIn: '5m' });
      return res.status(200).json({
        success: true,
        requires2FA: true,
        tempToken,
        message: "Two-Factor Authentication required",
      });
    }
    */

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

    await user.save();

    // 📈 Scalable Audit Log: Record login telemetry in separate collection
    await user.addAuditLog("Session Login", req.ip, {
      device,
      browser,
      referrer: req.headers.referer || "Direct",
      landingPage: req.originalUrl,
    });

    // --- Gamification: Update Streak ---
    const GamificationService = (await import("../services/GamificationService.js")).default;
    await GamificationService.updateStreak(user._id);

    const accessToken = generateAccessToken(user);
    const { token: refreshToken, refreshTokenDoc } = await generateRefreshToken(
      user,
      req.headers["user-agent"] || null,
      req.ip
    );
    setTokenCookies(res, accessToken, refreshTokenDoc, refreshToken);

    return res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        accessToken,
        csrfToken: req.csrfToken,
      },
    });
  } catch (err) {
    logger.error("Login Error: ", {
      message: err.message,
      stack: err.stack,
      email: req.body.email
    });
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

// ---- Verify 2FA Login ----
export const verify2FALogin = async (req, res) => {
  try {
    const { tempToken, code } = req.body;
    if (!tempToken || !code) {
      return res.status(400).json({ success: false, message: "Token and code are required" });
    }

    // Verify temp token
    let decoded;
    try {
      decoded = jwt.verify(tempToken, JWT_ACCESS_SECRET);
    } catch (e) {
      return res.status(401).json({ success: false, message: "Session expired or invalid" });
    }

    const user = await User.findById(decoded.tempId).select("+twoFactorSecret");
    if (!user || !user.isActive || !user.twoFactorEnabled) {
      return res.status(401).json({ success: false, message: "Invalid 2FA session" });
    }

    // Verify TOTP code
    const isVerified = authenticator.verifySync({
      token: code,
      secret: user.twoFactorSecret,
    }).valid;

    if (!isVerified) {
      return res.status(401).json({ success: false, message: "Invalid authenticator code" });
    }

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

    await user.save();

    // 📈 Scalable Audit Log: Record 2FA login telemetry in separate collection
    await user.addAuditLog("Session Login", req.ip, {
      device,
      browser,
      referrer: req.headers.referer || "Direct",
      landingPage: req.originalUrl,
    });

    // --- Gamification: Update Streak ---
    const GamificationService = (await import("../services/GamificationService.js")).default;
    await GamificationService.updateStreak(user._id);

    const accessToken = generateAccessToken(user);
    const { token: refreshToken, refreshTokenDoc } = await generateRefreshToken(
      user,
      req.headers["user-agent"] || null,
      req.ip
    );
    setTokenCookies(res, accessToken, refreshTokenDoc, refreshToken);

    return res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        accessToken,
        csrfToken: req.csrfToken,
      },
    });

  } catch (err) {
    logger.error("2FA Login Error: ", {
      message: err.message,
      stack: err.stack
    });
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

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

    // ✅ FIX: Generate accessToken BEFORE using it in setTokenCookies (was hoisting bug)
    const accessToken = generateAccessToken(check.record.user);
    setTokenCookies(res, accessToken, refreshTokenDoc, newRefreshToken);

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
    const isProd = process.env.NODE_ENV === "production";
    res.clearCookie("accessToken", {
      secure: isProd,
      sameSite: isProd ? "none" : "lax",
    });
    res.clearCookie("refreshToken", { 
      path: "/api/v1/auth/refresh-token",
      secure: isProd,
      sameSite: isProd ? "none" : "lax",
    });
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
    const { name, email, password, role } = req.body;

    const userExists = await User.findOne({ email });
    if (userExists) return res.status(409).json({ success: false, message: "User already exists" });

    const username = await generateUniqueUsername(name);
    const user = await User.create({ 
      name, 
      email, 
      password, 
      role, 
      username
    });

    return res.status(201).json({
      success: true,
      message: "User created successfully",
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
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

    if (req.user.role !== "admin") {
      return res
        .status(403)
        .json({ success: false, message: "Only admins can delete admins" });
    }

    const user = await User.findById(id);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }



    user.isActive = false; 
    await user.save();

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
    const admins = await User.countDocuments({ role: "admin" });
    const regularUsers = await User.countDocuments({ role: "user" });

    return res.status(200).json({
      success: true,
      total: totalUsers,
      online: onlineUsers,
      admins,
      users: regularUsers,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const getCraftsmen = async (req, res) => {
  try {
    const CraftsmanProfile = (await import("../models/CraftsmanProfile.model.js")).default;
    
    const craftsmen = await CraftsmanProfile.find({
      isActive: true,
    })
      .populate("userId", "name profilePicture")
      .lean();

    const result = craftsmen.map((craftsman) => ({
      _id: craftsman._id.toString(),
      userId: craftsman.userId?._id?.toString() || "",
      name: craftsman.displayName || craftsman.userId?.name || "Unknown",
      profilePic: craftsman.userId?.profilePicture || "/default-profile.png",
      skills: craftsman.skills && craftsman.skills.length
        ? craftsman.skills
        : ["#React", "#Next.js", "#Software Development"],
      workType: craftsman.workType || "solo",
      status: "offline", 
    }));

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// ---- Email Verification Logic ----

export const verifyEmail = async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).json({ success: false, message: "Verification token is required" });

    const user = await User.findOne({
      emailVerificationToken: token,
      emailVerificationExpires: { $gt: Date.now() }
    });

    if (!user) return res.status(400).json({ success: false, message: "Invalid or expired verification token" });

    user.emailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    return res.status(200).json({ success: true, message: "Identity endpoint successfully verified." });
  } catch (err) {
    console.error("Email Verification Error: ", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const resendVerificationEmail = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    if (user.emailVerified) return res.status(400).json({ success: false, message: "Email is already verified" });

    const token = await user.generateEmailVerification();
    await sendVerificationEmail(user.email, user.name, token);

    return res.status(200).json({ success: true, message: "A new verification link has been dispatched to your endpoint." });
  } catch (err) {
    console.error("Resend Verification Error: ", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ---- Forgot Password Flow ----
export const forgotPassword = async (req, res) => {
  try {
    const { error } = forgotPasswordSchema().validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        errors: error.details.map((e) => e.message),
      });
    }

    let { email } = req.body;
    const normalized = normalizeEmail(email);
    if (!normalized.valid) {
      return res.status(400).json({ success: false, message: "Invalid email" });
    }
    email = normalized.email;

    const user = await User.findOne({ email });
    if (!user) {
      // Always return 200/success for security reasons so attackers can't enumerate emails
      return res.status(200).json({
        success: true,
        message: "If an account with that email exists, a password reset link has been dispatched.",
      });
    }

    const token = await user.generatePasswordReset();
    await sendPasswordResetEmail(user.email, user.name, token);

    return res.status(200).json({
      success: true,
      message: "If an account with that email exists, a password reset link has been dispatched.",
    });
  } catch (err) {
    logger.error("Forgot Password Error: ", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ---- Reset Password Flow ----
export const resetPassword = async (req, res) => {
  try {
    const { error } = resetPasswordSchema().validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        errors: error.details.map((e) => e.message),
      });
    }

    const { token, password } = req.body;

    const user = await User.findOne({
      passwordResetToken: token,
      passwordResetExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ success: false, message: "Invalid or expired reset token" });
    }

    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    return res.status(200).json({ success: true, message: "Password has been reset successfully" });
  } catch (err) {
    logger.error("Reset Password Error: ", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};


export const guestLogin = async (req, res) => {
  try {
    const uuid = crypto.randomUUID ? crypto.randomUUID().split("-")[0] : crypto.randomBytes(4).toString("hex");
    const guestUsername = `guest_${uuid}`;
    const guestEmail = `${guestUsername}@codalina.guest`;
    const randomPassword = crypto.randomBytes(16).toString("hex") + "Aa1@";

    const newUser = new User({
      name: "Guest User",
      username: guestUsername,
      email: guestEmail,
      password: randomPassword, // Will be hashed in pre-save hook
      role: "guest",
      emailVerified: true, // Auto verify since it's fake
      hasCompletedOnboarding: true,
      isActive: true
    });

    await newUser.save();

    const ip = req.headers["x-forwarded-for"] || req.connection.remoteAddress;
    const userAgent = req.headers["user-agent"] || "unknown";

    // Create session tokens
    const accessToken = await generateAccessToken(newUser);
    const { token: refreshToken, refreshTokenDoc } = await generateRefreshToken(newUser, userAgent, ip);

    setTokenCookies(res, accessToken, refreshTokenDoc, refreshToken);

    return res.status(201).json({
      success: true,
      message: "Guest session started successfully",
      user: {
        id: newUser._id,
        name: newUser.name,
        username: newUser.username,
        email: newUser.email,
        role: newUser.role,
        profilePicture: newUser.profilePicture,
      },
    });
  } catch (error) {
    logger.error("Guest login error: ", error);
    return res.status(500).json({ success: false, message: "Server Error", error: error.message });
  }
};
