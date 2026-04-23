// routes/creatorRoutes.js
import express from "express";
import {
  createCreatorAccount,
  getCreatorProfile,
  updateCreatorProfile,
  deleteCreatorAccount,
  getPublicCreatorProfile,
  followUser,
} from "../controllers/creatorController.js";
import { protect, creatorOnly } from "../middlewares/authMiddleware.js";
import { validate } from "../middlewares/validate.js";
import {
  createCreatorSchema,
  updateCreatorSchema,
} from "../validation/creatorValidation.js";

const router = express.Router();

// Optional auth middleware — attaches req.user if token present, but doesn't block if not
const optionalAuth = async (req, res, next) => {
  try {
    const { verifyToken } = await import("../services/auth.service.js");
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      req.user = await verifyToken(token);
    }
  } catch (e) {
    // silently ignore — optional auth
  }
  next();
};

// Protected routes (require authentication)
router.post(
  "/create",
  protect,
  // creatorOnly, // Commented out - anyone can create creator account now
  validate(createCreatorSchema()),
  createCreatorAccount
);

router.get("/profile", protect, getCreatorProfile);

router.patch(
  "/profile",
  protect,
  validate(updateCreatorSchema()),
  updateCreatorProfile
);

router.delete("/account", protect, deleteCreatorAccount);

// Public routes
router.get("/profiles/all", async (req, res) => {
  try {
    const CreatorProfile = (await import("../models/CreatorProfile.model.js")).default;
    const creators = await CreatorProfile.find({ isActive: true })
      .populate("userId", "name email profilePicture")
      .sort({ createdAt: -1 })
      .limit(50);
    
    return res.status(200).json({
      success: true,
      creators: creators,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Get public profile — uses optional auth so isFollowing can be returned
router.get("/:userId", optionalAuth, getPublicCreatorProfile);

// Follow / Unfollow — requires auth
router.post("/:userId/follow", protect, followUser);

export default router;
