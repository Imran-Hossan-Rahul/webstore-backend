import express from "express";
import {
  getPayoutSummary,
  requestPayout,
  updatePayoutSettings,
  getAllPayouts,
  processPayout,
  cancelPayout,
} from "../controllers/payoutController.js";
import { verifyAccessToken } from "../middlewares/verifyAccessToken.js";

const router = express.Router();

// Craftsman routes
router.get("/summary", verifyAccessToken, getPayoutSummary);
router.post("/request", verifyAccessToken, requestPayout);
router.put("/settings", verifyAccessToken, updatePayoutSettings);

// Admin routes
router.get("/all", verifyAccessToken, getAllPayouts);
router.post("/:payoutId/process", verifyAccessToken, processPayout);
router.post("/:payoutId/cancel", verifyAccessToken, cancelPayout);

export default router;

