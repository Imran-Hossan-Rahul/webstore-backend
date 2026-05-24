import express from "express";
import { 
  submitVerificationRequest, 
  getMyVerificationStatus, 
  getAllRequests, 
  reviewRequest,
  verifyProfessionalLink,
  claimProfileReward
} from "../controllers/verificationController.js";
import { protect, adminOnly } from "../middlewares/authMiddleware.js";
import { verificationLimiter } from "../middlewares/rateLimiter.js";

const router = express.Router();

// Publicly available to authenticated users
router.post("/apply", protect, verificationLimiter, submitVerificationRequest);
router.get("/status", protect, getMyVerificationStatus);

// Tiered Rewards
router.post("/professional-link", protect, verificationLimiter, verifyProfessionalLink);
router.post("/claim-profile-reward", protect, verificationLimiter, claimProfileReward);

// Admin only routes
router.get("/admin/requests", protect, adminOnly, getAllRequests);
router.put("/admin/review/:id", protect, adminOnly, reviewRequest);

export default router;
