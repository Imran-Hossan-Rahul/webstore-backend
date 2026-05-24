// routes/craftsmanRoutes.js
import express from "express";
import {
  createCraftsmanAccount,
  getCraftsmanProfile,
  updateCraftsmanProfile,
  deleteCraftsmanAccount,
  getPublicCraftsmanProfile,
  followUser,
} from "../controllers/craftsmanController.js";
import { protect, craftsmanOnly } from "../middlewares/authMiddleware.js";
import { validate } from "../middlewares/validate.js";
import {
  createCraftsmanSchema,
  updateCraftsmanSchema,
} from "../validation/craftsmanValidation.js";

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
  validate(createCraftsmanSchema()),
  createCraftsmanAccount
);

router.get("/profile", protect, getCraftsmanProfile);

router.patch(
  "/profile",
  protect,
  validate(updateCraftsmanSchema()),
  updateCraftsmanProfile
);

router.delete("/account", protect, deleteCraftsmanAccount);

// Public routes
router.get("/profiles/all", async (req, res) => {
  try {
    const CraftsmanProfile = (await import("../models/CraftsmanProfile.model.js")).default;
    const craftsmen = await CraftsmanProfile.find({ isActive: true })
      .populate("userId", "name email profilePicture username")
      .sort({ createdAt: -1 })
      .limit(50);
    
    return res.status(200).json({
      success: true,
      data: craftsmen,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Get public profile — uses optional auth so isFollowing can be returned
router.get("/:userId", optionalAuth, getPublicCraftsmanProfile);

// Follow / Unfollow — requires auth
router.post("/:userId/follow", protect, followUser);

export default router;
