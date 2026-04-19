import express from "express";
import { trackVisitorController, trackEventController, trackSessionController } from "../controllers/statsController.js";
import { protect, adminOnly, superAdminOnly } from "../middlewares/authMiddleware.js";
import { trackBotFilter, trackRateLimit } from "../middlewares/trackMiddleware.js";

const router = express.Router();

/**
 * ----------------------------
 * Tracking Routes
 * ----------------------------
 * Public or logged-in users
 * Bot filter + Rate-limit applied
 * Logged-in users attach linkedUser
 */

// Track first visitor hit / page load
// Track first visitor hit / page load
router.post(
  "/visit",
  trackBotFilter,
  trackRateLimit,
  trackVisitorController
);

// Track events (click, scroll, pageview, custom)
router.post(
  "/event",
  trackBotFilter,
  trackRateLimit,
  trackEventController
);

// Track session end / update
router.post(
  "/session",
  trackBotFilter,
  trackRateLimit,
  trackSessionController
);
export default router;
