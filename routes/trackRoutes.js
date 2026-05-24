import express from "express";
import {
  trackVisitorController,
  trackEventController,
  trackSessionController,
  trackHeartbeatController,
} from "../controllers/statsController.js";
import { trackBotFilter, trackRateLimit } from "../middlewares/trackMiddleware.js";
import { optionalProtect } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.use(optionalProtect);

// Track first visitor hit / page load (with device fingerprint)
router.post("/visit", trackBotFilter, trackRateLimit, trackVisitorController);

// Track granular events (click, scroll, rage_click, exit_intent, heartbeat, etc.)
router.post("/event", trackBotFilter, trackRateLimit, trackEventController);

// Track session end with full summary (engagement score, scroll depth, etc.)
router.post("/session", trackBotFilter, trackRateLimit, trackSessionController);

// Heartbeat — every 5s, proves user is actively on page
router.post("/heartbeat", trackBotFilter, trackHeartbeatController);

// Batch — handles batched events (efficient for mobile/high-traffic)
router.post("/batch", trackBotFilter, trackEventController);

export default router;

