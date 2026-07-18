import express from "express";
import { protect, optionalProtect } from "../middlewares/authMiddleware.js";
import { allowRoles } from "../middlewares/rolesMiddleware.js";
import { cacheMiddleware } from "../utils/cache.js";

import { 
  updateUserProfile, 
  getUserProfile, 
  getMe, 
  getPublicProfile,
  getUserAchievements,
  getXPHistory,
  getLeaderboard,
  requestEmailChange,
  verifyEmailChange,
  checkUsernameAvailability,
  // ─── New Settings Controllers ───
  changePassword,
  setup2FA,
  enable2FA,
  disable2FA,
  getLoginHistory,
  updateNotificationPreferences,
  updatePrivacySettings,
  updateAppearancePreferences,
  updateProfileExtras,
  blockUser,
  unblockUser,
  getBlockedUsers,
  updateMutedKeywords,
  createApiToken,
  revokeApiToken,
  getApiTokens,
  deactivateAccount,
  getSettingsData,
} from "../controllers/userController.js";
import { getFeaturedCraftsmen } from "../controllers/featuredCraftsmenController.js";
import { getEngineerHistory } from "../controllers/analyticsController.js";

const router = express.Router();

// Featured Craftsmen (Public)
router.get("/featured-craftsmen", getFeaturedCraftsmen);

// Profile Routes
router.get("/profile", optionalProtect, getUserProfile);
router.patch("/profile", protect, updateUserProfile);
router.get("/profile/:username", cacheMiddleware(300), getPublicProfile);
router.get("/achievements", protect, getUserAchievements);
router.get("/xp-history", protect, getXPHistory);
router.get("/leaderboard", getLeaderboard);

// Get Current User (Identity Audit)
router.get("/me", protect, getMe);

// Email Change Flow
router.post("/request-email-change", protect, requestEmailChange);
router.post("/verify-email-change", verifyEmailChange);

// Username Availability Check
router.get("/check-username", protect, checkUsernameAvailability);

// ─────────────────────────────────────────────────────────────────
// Settings Endpoints
// ─────────────────────────────────────────────────────────────────

// Full Settings Data
router.get("/settings", protect, getSettingsData);

// Security
router.post("/change-password", protect, changePassword);
router.get("/login-history",    protect, getLoginHistory);

// 2FA (TOTP)
router.get("/2fa/setup",    protect, setup2FA);
router.post("/2fa/enable",  protect, enable2FA);
router.post("/2fa/disable", protect, disable2FA);

// Notification Preferences
router.patch("/notifications", protect, updateNotificationPreferences);

// Privacy Settings
router.patch("/privacy", protect, updatePrivacySettings);

// Appearance Preferences
router.patch("/appearance", protect, updateAppearancePreferences);

// Profile Extras
router.patch("/profile-extras", protect, updateProfileExtras);

// Block / Unblock Users
router.post("/block/:userId",   protect, blockUser);
router.delete("/block/:userId", protect, unblockUser);
router.get("/blocked",          protect, getBlockedUsers);

// Muted Keywords
router.patch("/muted-keywords", protect, updateMutedKeywords);

// API Tokens
router.get("/api-tokens",             protect, getApiTokens);
router.post("/api-tokens",            protect, createApiToken);
router.delete("/api-tokens/:tokenId", protect, revokeApiToken);

// Account Deactivation
router.post("/deactivate", protect, deactivateAccount);

// ─────────────────────────────────────────────────────────────────
// Follow Routes
// ─────────────────────────────────────────────────────────────────
import { toggleFollow, getFollowStatus, getFollowStats, getFollowing } from "../controllers/followController.js";
router.post("/follow/:targetUserId", protect, toggleFollow);
router.get("/follow-status/:targetUserId", protect, getFollowStatus);
router.get("/follow-stats/:userId", getFollowStats);
router.get("/following", protect, getFollowing);

// Craftsman / Craftsman route
router.get("/engineer", protect, allowRoles("craftsman"), (req, res) => {
  res.json({ success: true, message: "Craftsman dashboard" });
});
router.get("/engineer/history", protect, allowRoles("craftsman"), getEngineerHistory);

// Patron / Hirer route
router.get("/hirer", protect, allowRoles("patron"), (req, res) => {
  res.json({ success: true, message: "Patron dashboard" });
});

export default router;


