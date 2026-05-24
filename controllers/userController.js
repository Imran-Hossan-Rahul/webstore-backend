import User from "../models/User.model.js";
import { generateUniqueUsername } from "../utils/generateUsername.js";
import crypto from "crypto";
import logger from "../utils/logger.js";
import { sendEmailChangeVerification } from "../services/email.service.js";
import { OTP } from "otplib";
const authenticator = new OTP();
import QRCode from "qrcode";
import bcrypt from "bcryptjs";
import Follow from "../models/Follow.model.js";
import AuditLog from "../models/AuditLog.model.js";
import GamificationService from "../services/GamificationService.js";
import TokenTransaction from "../models/TokenTransaction.model.js";


/**
 * @desc    Get user profile
 * @route   GET /api/v1/user/profile
 * @access  Private
 */
export const getUserProfile = async (req, res) => {
    try {
      const user = await User.findById(req.user._id)
          .populate("craftsmanProfileId", "profilePicture");
  
      if (user) {
        // Automatically check-in the user when they fetch their profile (triggers once a day)
        await GamificationService.updateStreak(user._id).catch(err => logger.error("Daily check-in error:", err));

        res.json({
          success: true,
          data: {
              _id: user._id,
              name: user.name,
              username: user.username,
              email: user.email,
              role: user.role,
              bio: user.bio,
              profilePicture: user.profilePicture || user.craftsmanProfileId?.profilePicture || "",
              coverPicture: user.coverPicture,
              skills: user.skills,
              interests: user.interests,
              workType: user.workType,
              gender: user.gender,
              hasCraftsmanAccount: user.hasCraftsmanAccount,
              isHost: user.isHost,
              hasCompletedOnboarding: user.hasCompletedOnboarding,
              payoutMethod: user.payoutMethod,
              bankDetails: user.bankDetails,
              location: user.location,
              professionalLinks: user.professionalLinks,
              companyDetails: user.companyDetails,
              pronouns: user.pronouns,
              availabilityStatus: user.availabilityStatus,
              hourlyRate: user.hourlyRate,
              openToWork: user.openToWork,
              dateOfBirth: user.dateOfBirth,
              walletBalance: user.walletBalance || 0,
              totalEarnings: user.totalEarnings || 0,
              pendingPayout: user.pendingPayout || 0,
              gamification: {
                level: user.gamification?.level || 1,
                xp: user.gamification?.xp || 0,
                badges: user.gamification?.badges || [],
              },
              twoFactorEnabled: user.twoFactorEnabled,
              emailVerified: user.emailVerified,
              lastActiveAt: user.lastActiveAt,
              createdAt: user.createdAt,
              connectedAccounts: user.connectedAccounts || {},
          }
        });
      } else {
        res.status(404).json({ success: false, message: "User not found" });
      }
    } catch (error) {
    console.error("Get Profile Error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

/**
 * @desc    Get public profile by username
 * @route   GET /api/v1/user/profile/:username
 * @access  Public
 */
export const getPublicProfile = async (req, res) => {
  try {
    const { username } = req.params;
    const requesterId = req.user?._id;

    const user = await User.findOne({ username: username.toLowerCase() })
      .populate("craftsmanProfileId", "profilePicture");

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const isOwner = requesterId && requesterId.toString() === user._id.toString();
    const privacy = user.privacySettings || {};

    // â”€â”€ 1. Profile Visibility Check â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    let canSeeFullProfile = true;
    
    if (!isOwner) {
      if (privacy.profileVisibility === "private") {
        canSeeFullProfile = false;
      } else if (privacy.profileVisibility === "connections") {
        if (!requesterId) {
          canSeeFullProfile = false;
        } else {
          // Check if connected (either follows or is followed by)
          const isConnected = await Follow.exists({
            $or: [
              { follower: requesterId, following: user._id },
              { follower: user._id, following: requesterId }
            ]
          });
          if (!isConnected) canSeeFullProfile = false;
        }
      }
    }

    // â”€â”€ 2. Data Gating â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    
    // Basic data (always public unless private, but we show a placeholder for private)
    const data = {
      _id: user._id,
      name: user.name,
      username: user.username,
      profilePicture: user.profilePicture || user.craftsmanProfileId?.profilePicture || "",
      isVerified: user.isVerified,
      createdAt: user.createdAt,
      connectedAccounts: user.connectedAccounts || {},
      privacy: { // Let frontend know it's restricted
        isRestricted: !canSeeFullProfile,
        visibility: privacy.profileVisibility,
        allowSearchIndexing: privacy.allowSearchIndexing
      }
    };

    if (canSeeFullProfile) {
      data.bio = user.bio;
      data.coverPicture = user.coverPicture;
      data.skills = user.skills;
      data.interests = user.interests;
      data.workType = user.workType;
      data.gender = user.gender;
      data.professionalLinks = user.professionalLinks;
      data.companyDetails = user.companyDetails;
      data.pronouns = user.pronouns;
      data.availabilityStatus = user.availabilityStatus;
      data.hourlyRate = user.hourlyRate;
      data.openToWork = user.openToWork;
      data.gamification = {
        level: user.gamification?.level || 1,
        xp: user.gamification?.xp || 0,
        badges: user.gamification?.badges || [],
      };

      // Respect individual preference toggles
      if (privacy.showLocation !== false || isOwner) {
        data.location = user.location;
      }

      if (privacy.showFollowerCount !== false || isOwner) {
        // Query counts from the dedicated Follow model for scalability
        const [followersCount, followingCount] = await Promise.all([
          Follow.countDocuments({ following: user._id }),
          Follow.countDocuments({ follower: user._id })
        ]);
        data.followersCount = followersCount;
        data.followingCount = followingCount;
      }

      if (privacy.showOnlineStatus !== false || isOwner) {
        data.lastActiveAt = user.lastActiveAt;
      }
    }

    res.json({ success: true, data });
  } catch (error) {
    console.error("Get Public Profile Error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

/**
 * @desc    Update user profile
 * @route   PATCH /api/v1/user/profile
 * @access  Private
 */
export const updateUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    user.name = req.body.name || user.name;
    user.bio = req.body.bio || user.bio;
    user.profilePicture = req.body.profilePicture || user.profilePicture;
    user.skills = req.body.skills || user.skills;
    user.interests = req.body.interests || user.interests;
    user.workType = req.body.workType || user.workType;
    if (req.body.gender !== undefined) user.gender = req.body.gender;
    user.location = req.body.location || user.location;
    user.professionalLinks = req.body.professionalLinks || user.professionalLinks;
    user.companyDetails = req.body.companyDetails || user.companyDetails;
    user.payoutMethod = req.body.payoutMethod || user.payoutMethod;
    user.bankDetails = req.body.bankDetails || user.bankDetails;
    user.dateOfBirth = req.body.dateOfBirth || user.dateOfBirth;
    
    if (req.body.username && req.body.username !== user.username) {
      const usernameExists = await User.findOne({ username: req.body.username.toLowerCase() });
      if (usernameExists) return res.status(400).json({ success: false, message: "Username is already taken" });
      user.username = req.body.username.toLowerCase();
    }
    
    if (req.body.role && ["user", "patron"].includes(req.body.role)) {
        user.role = req.body.role;
    }
    
    if (req.body.hasCompletedOnboarding !== undefined) {
       user.hasCompletedOnboarding = req.body.hasCompletedOnboarding;
    }

    if (req.body.password) {
      user.password = req.body.password;
    }

    const updatedUser = await user.save();
    res.json({ success: true, data: updatedUser });
  } catch (error) {
     console.error("Update Profile Error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

/**
 * @desc Get current user
 * @route GET /api/v1/user/me
 */
export const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("-password -passwordHistory");
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    res.status(200).json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch achievements" });
  }
};

/**
 * @desc    Get user XP history
 * @route   GET /api/v1/user/xp-history
 * @access  Private
 */
export const getXPHistory = async (req, res) => {
  try {
    const TokenTransaction = (await import("../models/TokenTransaction.model.js")).default;
    const transactions = await TokenTransaction.find({ 
      user: req.user._id, 
      xpAmount: { $gt: 0 } 
    }).sort({ createdAt: -1 }).limit(50).lean();

    res.json({
      success: true,
      data: transactions
    });
  } catch (error) {
    logger.error("Fetch XP history error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch XP history" });
  }
};

/**
 * @desc    Get user gamification achievements & token rewards status
 * @route   GET /api/v1/user/achievements
 * @access  Private
 */
export const getUserAchievements = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const lastCheckIn = user.gamification?.streak?.lastCheckIn;
    const dailyInteractionCompleted = lastCheckIn && new Date(lastCheckIn) >= today;

    const Post = (await import("../models/Post.model.js")).default;
    const devlogCount = await Post.countDocuments({ user: userId, postType: 'devlog', status: { $ne: 'deleted' } });
    
    const Codex = (await import("../models/Codex.model.js")).default;
    const codexCount = await Codex.countDocuments({ author: userId, isPublished: true, isDeleted: false });

    const achievements = [
      { id: 'daily_interaction', label: 'Daily Interaction', xp: '+50 XP', completed: !!dailyInteractionCompleted },
      { id: 'devlog_launch', label: 'Devlog Launch', xp: '+300 XP', completed: devlogCount > 0 },
      { id: 'codex_publication', label: 'Codex Publication', xp: '+200 XP', completed: codexCount > 0 },
      { id: 'identity_verification', label: 'Identity Verification', xp: '+500 XP', completed: !!user.isVerified }
    ];

    const tokenRewards = [
      { id: 'daily_reward', label: 'Daily Reward', amount: '0.5 TKNS', description: 'Log in every day', completed: !!dailyInteractionCompleted },
      { id: 'devlog_reward', label: 'Devlog Launch', amount: '1 TKNS', description: 'Launch your first devlog', completed: devlogCount > 0 },
      { id: 'codex_reward', label: 'Codex Quality', amount: '20 TKNS', description: 'Publish a high-quality codex', completed: codexCount > 0 },
      { id: 'referral_reward', label: 'Refer Friends', amount: '10 TKNS', description: 'Invite craftsmen to join', completed: false }
    ];

    res.json({
      success: true,
      data: {
        achievements,
        tokenRewards,
        totalTokens: user.walletBalance || 0,
        totalXP: user.gamification?.xp || 0,
        level: user.gamification?.level || 1
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

/**
 * @desc    Get top users by XP for leaderboard
 * @route   GET /api/v1/user/leaderboard
 */
export const getLeaderboard = async (req, res) => {
  try {
    const topUsers = await User.find({ "gamification.xp": { $gt: 0 } })
      .select("name username profilePicture gamification.xp gamification.level")
      .sort({ "gamification.xp": -1 })
      .limit(10);

    res.json({ success: true, data: topUsers });
  } catch (error) {
    console.error("Get Leaderboard Error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

/**
 * @desc    Request email change
 */
export const requestEmailChange = async (req, res) => {
  try {
    const { newEmail } = req.body;
    if (!newEmail) return res.status(400).json({ success: false, message: "New email is required" });

    const emailExists = await User.findOne({ email: newEmail.toLowerCase() });
    if (emailExists) return res.status(400).json({ success: false, message: "Email is already in use" });

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const token = crypto.randomBytes(32).toString("hex");
    user.emailChangeToken = crypto.createHash("sha256").update(token).digest("hex");
    user.emailChangeExpires = Date.now() + 24 * 60 * 60 * 1000;
    user.pendingEmail = newEmail.toLowerCase();

    await user.save();

    try {
      await sendEmailChangeVerification(newEmail, user.name, token);
    } catch (err) {
      user.emailChangeToken = undefined;
      user.emailChangeExpires = undefined;
      user.pendingEmail = undefined;
      await user.save();
      return res.status(500).json({ success: false, message: "Failed to send verification email" });
    }

    res.status(200).json({ success: true, message: "Verification email sent" });
  } catch (error) {
    logger.error("Request Email Change Error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

/**
 * @desc    Verify and complete email change
 */
export const verifyEmailChange = async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ success: false, message: "Token is required" });

    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
    const user = await User.findOne({ emailChangeToken: hashedToken, emailChangeExpires: { $gt: Date.now() } });

    if (!user) return res.status(400).json({ success: false, message: "Invalid or expired token" });

    user.email = user.pendingEmail;
    user.emailChangeToken = undefined;
    user.emailChangeExpires = undefined;
    user.pendingEmail = undefined;

    await user.save();
    res.status(200).json({ success: true, message: "Email successfully updated" });
  } catch (error) {
    logger.error("Verify Email Change Error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

/**
 * @desc    Check username availability (public, debounced from frontend)
 * @route   GET /api/v1/user/check-username?username=abc
 * @access  Private (auth required to exclude own current username)
 */
export const checkUsernameAvailability = async (req, res) => {
  try {
    const { username } = req.query;
    if (!username || username.trim().length < 3) {
      return res.status(400).json({ success: false, message: "Username must be at least 3 characters" });
    }

    const sanitized = username.toLowerCase().replace(/[^a-z0-9_]/g, "");
    if (sanitized !== username.toLowerCase()) {
      return res.status(400).json({ success: false, available: false, message: "Invalid characters in username" });
    }

    // Exclude current user's own username so they don't get "taken" on their own name
    const existingUser = await User.findOne({
      username: sanitized,
      _id: { $ne: req.user._id }
    });

    if (existingUser) {
      return res.json({ success: true, available: false, message: "Username is already taken" });
    }

    return res.json({ success: true, available: true, message: "Username is available" });
  } catch (error) {
    logger.error("Check Username Error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// ============================================================
// =================== NEW SETTINGS CONTROLLERS ==============
// ============================================================

/**
 * @desc    Change password (requires current password verification)
 * @route   POST /api/v1/user/change-password
 */
export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: "Both current and new password are required" });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, message: "New password must be at least 8 characters" });
    }

    const user = await User.findById(req.user._id).select("+password +passwordHistory");
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: "Current password is incorrect" });
    }

    user.password = newPassword;
    await user.save();

    res.json({ success: true, message: "Password updated successfully" });
  } catch (error) {
    logger.error("Change Password Error:", error);
    // Handle password reuse error from model validator
    if (error.message.includes("cannot reuse")) {
      return res.status(400).json({ success: false, message: "You cannot reuse a previous password" });
    }
    res.status(500).json({ success: false, message: error.message || "Server Error" });
  }
};

/**
 * @desc    Generate 2FA secret & QR code
 * @route   GET /api/v1/user/2fa/setup
 */
export const setup2FA = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    if (user.twoFactorEnabled) {
      return res.status(400).json({ success: false, message: "2FA is already enabled" });
    }

    const secret = authenticator.generateSecret();
    const otpauth = authenticator.generateURI({ 
      label: user.email, 
      issuer: "YourPlatform", 
      secret 
    });
    const qrCodeDataURL = await QRCode.toDataURL(otpauth);

    // Store secret temporarily (not enabled yet â€” user must verify first)
    user.twoFactorSecret = secret;
    await user.save();

    res.json({ success: true, data: { secret, qrCode: qrCodeDataURL } });
  } catch (error) {
    logger.error("Setup 2FA Error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

/**
 * @desc    Verify TOTP token and enable 2FA
 * @route   POST /api/v1/user/2fa/enable
 */
export const enable2FA = async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ success: false, message: "TOTP token is required" });

    const user = await User.findById(req.user._id).select("+twoFactorSecret");
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    if (!user.twoFactorSecret) {
      return res.status(400).json({ success: false, message: "Run 2FA setup first" });
    }

    const isValid = authenticator.verifySync({ token, secret: user.twoFactorSecret }).valid;
    if (!isValid) {
      return res.status(400).json({ success: false, message: "Invalid verification code" });
    }

    user.twoFactorEnabled = true;
    await user.save();

    res.json({ success: true, message: "2FA enabled successfully" });
  } catch (error) {
    logger.error("Enable 2FA Error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

/**
 * @desc    Disable 2FA (requires TOTP verification)
 * @route   POST /api/v1/user/2fa/disable
 */
export const disable2FA = async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ success: false, message: "TOTP token is required" });

    const user = await User.findById(req.user._id).select("+twoFactorSecret");
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    if (!user.twoFactorEnabled) {
      return res.status(400).json({ success: false, message: "2FA is not enabled" });
    }

    const isValid = authenticator.verifySync({ token, secret: user.twoFactorSecret }).valid;
    if (!isValid) {
      return res.status(400).json({ success: false, message: "Invalid verification code" });
    }

    user.twoFactorEnabled = false;
    user.twoFactorSecret = undefined;
    await user.save();

    res.json({ success: true, message: "2FA disabled successfully" });
  } catch (error) {
    logger.error("Disable 2FA Error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

/**
 * @desc    Get login history (last 10 sessions)
 * @route   GET /api/v1/user/login-history
 */
export const getLoginHistory = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    // Fetch the last 10 session login logs from the scalable AuditLog collection
    const logs = await AuditLog.find({
      targetId: req.user._id,
      targetType: "User",
      action: "Session Login",
    })
      .sort({ timestamp: -1 })
      .limit(10);

    const normalizeIp = (ip) => {
      if (!ip) return "Unknown";
      if (ip === "::1" || ip === "::ffff:127.0.0.1" || ip === "127.0.0.1") return "Localhost";
      // Strip IPv6 prefix from IPv4-mapped addresses
      if (ip.startsWith("::ffff:")) return ip.slice(7);
      return ip;
    };

    const history = logs.map((s, index) => ({
      device:      s.details?.device  || "Unknown",
      browser:     s.details?.browser || "Unknown",
      ip:          normalizeIp(s.ip),
      timestamp:   s.timestamp || null,
      referrer:    s.details?.referrer && s.details?.referrer !== "Direct" ? s.details?.referrer : null,
      landingPage: s.details?.landingPage || null,
      isCurrent:   index === 0, // Most recent session is current
    }));

    res.json({ success: true, data: history });
  } catch (error) {
    logger.error("Login History Error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

/**
 * @desc    Update notification preferences
 * @route   PATCH /api/v1/user/notifications
 */
export const updateNotificationPreferences = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const { email, inApp } = req.body;

    if (email) {
      user.notificationPreferences = user.notificationPreferences || {};
      user.notificationPreferences.email = {
        ...((user.notificationPreferences?.email || {})),
        ...email
      };
    }
    if (inApp) {
      user.notificationPreferences = user.notificationPreferences || {};
      user.notificationPreferences.inApp = {
        ...((user.notificationPreferences?.inApp || {})),
        ...inApp
      };
    }

    user.markModified("notificationPreferences");
    await user.save();

    res.json({ success: true, message: "Notification preferences saved", data: user.notificationPreferences });
  } catch (error) {
    logger.error("Update Notification Prefs Error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

/**
 * @desc    Update privacy settings
 * @route   PATCH /api/v1/user/privacy
 */
export const updatePrivacySettings = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const allowed = ["profileVisibility","whoCanMessage","showOnlineStatus","showLocation","allowSearchIndexing","readReceipts","showFollowerCount"];
    const updates = {};
    allowed.forEach(key => { if (req.body[key] !== undefined) updates[key] = req.body[key]; });

    user.privacySettings = { ...((user.privacySettings?.toObject ? user.privacySettings.toObject() : user.privacySettings) || {}), ...updates };
    user.markModified("privacySettings");
    await user.save();

    res.json({ success: true, message: "Privacy settings updated", data: user.privacySettings });
  } catch (error) {
    logger.error("Update Privacy Error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

/**
 * @desc    Update appearance preferences
 * @route   PATCH /api/v1/user/appearance
 */
export const updateAppearancePreferences = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const allowed = ["theme","language","timezone","currency","defaultFeed"];
    const updates = {};
    allowed.forEach(key => { if (req.body[key] !== undefined) updates[key] = req.body[key]; });

    user.appearancePreferences = { ...((user.appearancePreferences?.toObject ? user.appearancePreferences.toObject() : user.appearancePreferences) || {}), ...updates };
    user.markModified("appearancePreferences");
    await user.save();

    res.json({ success: true, message: "Appearance preferences updated", data: user.appearancePreferences });
  } catch (error) {
    logger.error("Update Appearance Error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

/**
 * @desc    Update profile extras (pronouns, availability, hourly rate, open to work)
 * @route   PATCH /api/v1/user/profile-extras
 */
export const updateProfileExtras = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const { pronouns, availabilityStatus, hourlyRate, mentorshipRate, openToWork } = req.body;
    if (pronouns        !== undefined) user.pronouns          = pronouns;
    if (availabilityStatus !== undefined) user.availabilityStatus = availabilityStatus;
    if (hourlyRate      !== undefined) user.hourlyRate        = parseFloat(hourlyRate) || 0;
    if (mentorshipRate  !== undefined) user.mentorshipRate    = parseFloat(mentorshipRate) || 0;
    if (openToWork      !== undefined) user.openToWork        = Boolean(openToWork);

    await user.save();
    res.json({ success: true, message: "Profile extras updated" });
  } catch (error) {
    logger.error("Update Profile Extras Error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

/**
 * @desc    Block a user
 * @route   POST /api/v1/user/block/:userId
 */
export const blockUser = async (req, res) => {
  try {
    const { userId } = req.params;
    if (userId === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: "You cannot block yourself" });
    }

    const [me, target] = await Promise.all([
      User.findById(req.user._id),
      User.findById(userId).select("name username profilePicture")
    ]);
    if (!me || !target) return res.status(404).json({ success: false, message: "User not found" });

    if (me.blockedUsers.some(id => id.toString() === userId)) {
      return res.status(400).json({ success: false, message: "User is already blocked" });
    }

    me.blockedUsers.push(userId);
    await me.save();

    res.json({ success: true, message: `${target.name} has been blocked`, data: target });
  } catch (error) {
    logger.error("Block User Error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

/**
 * @desc    Unblock a user
 * @route   DELETE /api/v1/user/block/:userId
 */
export const unblockUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    user.blockedUsers = user.blockedUsers.filter(id => id.toString() !== userId);
    await user.save();

    res.json({ success: true, message: "User unblocked" });
  } catch (error) {
    logger.error("Unblock User Error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

/**
 * @desc    Get blocked users list
 * @route   GET /api/v1/user/blocked
 */
export const getBlockedUsers = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate("blockedUsers", "name username profilePicture");
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    res.json({ success: true, data: user.blockedUsers });
  } catch (error) {
    logger.error("Get Blocked Users Error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

/**
 * @desc    Update muted keywords
 * @route   PATCH /api/v1/user/muted-keywords
 */
export const updateMutedKeywords = async (req, res) => {
  try {
    const { keywords } = req.body;
    if (!Array.isArray(keywords)) {
      return res.status(400).json({ success: false, message: "Keywords must be an array" });
    }

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    user.mutedKeywords = keywords.slice(0, 50).map(k => k.trim().toLowerCase()).filter(Boolean);
    await user.save();

    res.json({ success: true, message: "Muted keywords updated", data: user.mutedKeywords });
  } catch (error) {
    logger.error("Update Muted Keywords Error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

/**
 * @desc    Create a personal API token
 * @route   POST /api/v1/user/api-tokens
 */
export const createApiToken = async (req, res) => {
  try {
    const { name, expiresIn } = req.body;
    if (!name) return res.status(400).json({ success: false, message: "Token name is required" });

    const user = await User.findById(req.user._id).select("+apiTokens");
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    if ((user.apiTokens || []).length >= 10) {
      return res.status(400).json({ success: false, message: "Maximum 10 API tokens allowed" });
    }

    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const prefix = rawToken.slice(0, 8);

    const tokenData = {
      name,
      tokenHash,
      prefix,
      createdAt: new Date(),
      expiresAt: expiresIn ? new Date(Date.now() + expiresIn * 24 * 60 * 60 * 1000) : null
    };

    if (!user.apiTokens) user.apiTokens = [];
    user.apiTokens.push(tokenData);
    await user.save();

    const savedToken = user.apiTokens[user.apiTokens.length - 1];

    res.json({
      success: true,
      message: "API token created. Copy it now â€” it won't be shown again.",
      data: {
        _id:      savedToken._id,
        name:     savedToken.name,
        prefix:   savedToken.prefix,
        token:    rawToken, // shown once
        createdAt: savedToken.createdAt,
        expiresAt: savedToken.expiresAt
      }
    });
  } catch (error) {
    logger.error("Create API Token Error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

/**
 * @desc    Revoke an API token
 * @route   DELETE /api/v1/user/api-tokens/:tokenId
 */
export const revokeApiToken = async (req, res) => {
  try {
    const { tokenId } = req.params;
    const user = await User.findById(req.user._id).select("+apiTokens");
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const before = user.apiTokens.length;
    user.apiTokens = user.apiTokens.filter(t => t._id.toString() !== tokenId);
    if (user.apiTokens.length === before) {
      return res.status(404).json({ success: false, message: "Token not found" });
    }
    await user.save();

    res.json({ success: true, message: "Token revoked" });
  } catch (error) {
    logger.error("Revoke API Token Error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

/**
 * @desc    Get all API tokens (without hashes)
 * @route   GET /api/v1/user/api-tokens
 */
export const getApiTokens = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("apiTokens");
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const tokens = (user.apiTokens || []).map(t => ({
      _id:      t._id,
      name:     t.name,
      prefix:   t.prefix,
      lastUsed: t.lastUsed,
      createdAt:t.createdAt,
      expiresAt:t.expiresAt
    }));

    res.json({ success: true, data: tokens });
  } catch (error) {
    logger.error("Get API Tokens Error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

/**
 * @desc    Deactivate account (soft delete)
 * @route   POST /api/v1/user/deactivate
 */
export const deactivateAccount = async (req, res) => {
  try {
    const { password, reason } = req.body;
    if (!password) return res.status(400).json({ success: false, message: "Password confirmation required" });

    const user = await User.findById(req.user._id).select("+password");
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: "Incorrect password" });
    }

    user.isActive = false;
    user.deactivatedAt = new Date();
    user.deactivationReason = reason || "User requested";
    await user.save();

    res.json({ success: true, message: "Account deactivated successfully" });
  } catch (error) {
    logger.error("Deactivate Account Error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

/**
 * @desc    Get user full settings data (all tabs)
 * @route   GET /api/v1/user/settings
 */
export const getSettingsData = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select("name email username profilePicture coverPicture bio skills interests notificationPreferences privacySettings appearancePreferences connectedAccounts blockedUsers isHost professionalLinks pronouns availabilityStatus hourlyRate openToWork emailVerified twoFactorEnabled gender workType location")
      .populate("blockedUsers", "name username profilePicture")
      .lean();

    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    res.json({ success: true, data: user });
  } catch (error) {
    logger.error("Get Settings Data Error:", error);
    res.status(500).json({ 
      success: false, 
      message: error.message || "Server Error",
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined
    });
  }
};

