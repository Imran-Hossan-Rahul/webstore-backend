import express from "express";
import { protect } from "../middlewares/authMiddleware.js";
import { allowRoles } from "../middlewares/rolesMiddleware.js";


import { updateUserProfile, getUserProfile } from "../controllers/userController.js";
import { getFeaturedCreators } from "../controllers/featuredCreatorsController.js";
import { getEngineerHistory } from "../controllers/analyticsController.js";

const router = express.Router();

// Featured Creators (Public)
router.get("/featured-creators", getFeaturedCreators);

// Update Profile (Onboarding)
router.route("/profile").get(protect, getUserProfile).patch(protect, updateUserProfile);

// Freelancer / Engineer route
router.get("/engineer", protect, allowRoles("freelancer"), (req, res) => {
  res.json({ success: true, message: "Engineer dashboard" });
});

// Engineer Analytics History
router.get("/engineer/history", protect, allowRoles("freelancer"), getEngineerHistory);

// Client / Hirer route
router.get("/hirer", protect, allowRoles("client"), (req, res) => {
  res.json({ success: true, message: "Hirer dashboard" });
});

// Follow Routes
import { toggleFollow, getFollowStatus, getFollowStats, getFollowing } from "../controllers/followController.js";
router.post("/follow/:targetUserId", protect, toggleFollow);
router.get("/follow-status/:targetUserId", protect, getFollowStatus);
router.get("/follow-stats/:userId", getFollowStats);
router.get("/following", protect, getFollowing);

export default router;
