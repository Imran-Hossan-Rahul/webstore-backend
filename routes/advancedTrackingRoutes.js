// routes/advancedTrackingRoutes.js
// Routes for advanced tracking: mouse, keyboard, clipboard, tab, network, device
import express from "express";
import {
  trackMouseMovement,
  trackKeystrokeTiming,
  trackClipboardActivity,
  trackTabActivity,
  trackNetworkPerformance,
  trackDeviceMetrics,
} from "../controllers/advancedTrackingController.js";
import { trackBotFilter, trackRateLimit } from "../middlewares/trackMiddleware.js";
import { optionalProtect } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.use(optionalProtect);

// Mouse tracking
router.post("/mouse", trackBotFilter, trackRateLimit, trackMouseMovement);

// Keystroke tracking
router.post("/keystroke", trackBotFilter, trackRateLimit, trackKeystrokeTiming);

// Clipboard tracking
router.post("/clipboard", trackBotFilter, trackRateLimit, trackClipboardActivity);

// Tab activity tracking
router.post("/tab", trackBotFilter, trackRateLimit, trackTabActivity);

// Network performance tracking
router.post("/network", trackBotFilter, trackRateLimit, trackNetworkPerformance);

// Device metrics tracking
router.post("/device", trackBotFilter, trackRateLimit, trackDeviceMetrics);

export default router;
