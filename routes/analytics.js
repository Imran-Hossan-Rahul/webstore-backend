import express from "express";
import { getDailyUserStats, getUserSourceStats, getUsersAnalysis, } from "../controllers/oldStatsController.js";
import { protect, adminOnly, superAdminOnly } from "../middlewares/authMiddleware.js";
import { 
  getActiveSessions, 
  getAllCountries, 
  getPageviews, 
  getTopCountries, 
  getVisitorAccountStats, 
  getVisitorDeviceStats, 
  getEngineerViewsHistory 
} from "../controllers/analyticsController.js";
import { getDashboardOverview, getAllUsers, getUserFullDossier, getUserFullDossierV2, getPlatformHealth, getConversionFunnel, getRetentionCohort, getFeatureUsage, getHourlyTraffic, getLiveEventStream } from "../controllers/adminController.js";
import { getEventStats } from "../controllers/analyticsController.js";
import Visitor from "../models/Visitor.js";
import { trackEventController, trackVisitorController } from "../controllers/statsController.js";
import Event from "../models/Event.js";
import Session from "../models/Session.js";


const router = express.Router();

/**
 * ----------------------------
 * Analytics Routes (Admin / SuperAdmin)
 * ----------------------------
 * Protect routes with `protect` + `adminOnly`
 * Future: optionally restrict some endpoints to superAdminOnly
 */

/**
 * @desc Get daily user stats (last 30 days)
 * @route GET /api/analytics/daily-users
 * @access Admin / SuperAdmin
 */
router.get("/daily-users", protect, adminOnly, getDailyUserStats);

/**
 * @desc Get comprehensive dashboard overview
 * @route GET /api/v1/stats/overview
 * @access Admin / SuperAdmin
 */
router.get("/overview", protect, adminOnly, getDashboardOverview);
router.get("/users", protect, adminOnly, getAllUsers);
router.get("/user/:id/dossier", protect, adminOnly, getUserFullDossier);
router.get("/user/:id/intelligence", protect, adminOnly, getUserFullDossierV2); // V2 — full deep intel

// ===== NEW: World-class Admin Intelligence Endpoints =====
router.get("/platform-health", protect, adminOnly, getPlatformHealth);
router.get("/funnel", protect, adminOnly, getConversionFunnel);
router.get("/retention", protect, adminOnly, getRetentionCohort);
router.get("/feature-usage", protect, adminOnly, getFeatureUsage);
router.get("/hourly-traffic", protect, adminOnly, getHourlyTraffic);
router.get("/live-events", protect, adminOnly, getLiveEventStream);

/**
 * @desc Get user analysis: total/new/repeated users, device/browser distribution, account type, last logins
 * @route GET /api/analytics/user-analysis
 * @access Admin / SuperAdmin
 */
router.get("/user-analysis", protect, adminOnly, getUsersAnalysis);

/**
 * @desc Get user source / referrer stats
 * @route GET /api/analytics/user-source
 * @access Admin / SuperAdmin
 */
router.get("/user-source", protect, adminOnly, getUserSourceStats);

/**
 * @desc Get event stats: clicks, scrolls, pageviews, custom events
 * @route GET /api/analytics/event-stats
 * @access Admin / SuperAdmin
 */
router.get("/event-stats", protect, adminOnly, getEventStats);

/**
 * @desc Get active sessions: currently live sessions, duration, pageviews
 * @route GET /api/analytics/active-sessions
 * @access Admin / SuperAdmin
 */
router.get("/active-sessions", protect, adminOnly, getActiveSessions);

router.get("/pageviews", protect, adminOnly, getPageviews);

router.get("/visitor-accounts", protect, adminOnly, getVisitorAccountStats);

router.get("/visitor-devices", protect, adminOnly, getVisitorDeviceStats);

router.get("/countries/top5", protect, adminOnly, getTopCountries);
router.get("/countries/all", protect, adminOnly, getAllCountries);

// Engineer specific routes
router.get("/engineer/views-history", protect, getEngineerViewsHistory);

router.get("/engineer/debug-views", protect, async (req, res) => {
  try {
    const artifacts = await Artifact.find({ user: req.user._id })
      .select('title viewsCount viewHistory')
      .lean();
    
    const summary = artifacts.map(t => ({
      title: t.title,
      viewsCount: t.viewsCount,
      historyEntries: t.viewHistory?.length || 0,
      lastEntry: t.viewHistory?.[t.viewHistory.length - 1]
    }));
    
    res.json({ success: true, artifacts: summary });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get("/visitors", async (req, res) => {
  try {
    const visitors = await Visitor.find()
      .populate("linkedUser", "name username profilePicture")
      .sort({ lastVisit: -1 }) 
      .limit(500); 

    const visitorData = visitors.map(v => ({
      ...v.toObject(),
      userName: v.linkedUser?.name || v.visitorId || "Guest",
      isRegistered: !!v.linkedUser
    }));

    res.json(visitorData);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});


// routes/events.js
router.get("/sessions", async (req, res) => {
  try {
    // Fetch latest 100 sessions directly from the Session model
    const sessions = await Session.find()
      .populate("visitor")
      .populate("linkedUser", "name username")
      .sort({ lastActivity: -1 })
      .limit(100);

    // Map to frontend expectation
    const sessionData = sessions.map((s) => ({
      sessionId: s.sessionId,
      visitorId: s.visitorId,
      userName: s.linkedUser?.name || s.visitor?.visitorId || "Guest",
      startTime: s.startedAt || s.start,
      lastActivity: s.lastActivity,
      pageViews: s.pageViews || 0,
      browser: s.browser || "Unknown",
      device: s.device || "Desktop",
      duration: s.duration || 0,
      location: s.visitor?.location || {},
    }));

    res.json({ 
      status: "success", 
      results: sessionData.length, 
      data: sessionData 
    });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

router.post("/event", trackEventController);

/**
 * Future endpoints examples:
 *
 * // Top referrers
 * router.get("/top-referrers", protect, superAdminOnly, getTopReferrers);
 */

export default router;


