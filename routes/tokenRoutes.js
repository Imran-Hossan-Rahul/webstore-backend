import express from "express";
import { protect, adminOnly } from "../middlewares/authMiddleware.js";
import { tokenRewardLimiter } from "../middlewares/rateLimiter.js";
import { 
  getTokenBalance, 
  getTokenHistory, 
  rewardTokens 
} from "../controllers/tokenController.js";

const router = express.Router();

router.use(protect); // All token routes require authentication

router.get("/balance", getTokenBalance);
router.get("/history", getTokenHistory);

// 🔒 SECURITY FIX: adminOnly — Regular users CANNOT self-award tokens.
// Internal platform rewards (verification, contracts, challenges) use direct DB calls,
// so they are not affected by this restriction.
router.post("/reward", adminOnly, tokenRewardLimiter, rewardTokens);

export default router;
