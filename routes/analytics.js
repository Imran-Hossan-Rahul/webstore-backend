import express from "express";
import { getDailyUserStats, getUserSourceStats, getUsersAnalysis, } from "../controllers/oldStatsController.js";
import { protect, adminOnly, superAdminOnly } from "../middlewares/authMiddleware.js";
import { getActiveSessions, getAllCountries, getPageviews, getTopCountries, getVisitorAccountStats, getVisitorDeviceStats, getEngineerViewsHistory } from "../controllers/analyticsController.js";
import { getEventStats } from "../controllers/analyticsController.js";
import Visitor from "../models/Visitor.js";
import { trackEventController, trackVisitorController } from "../controllers/statsController.js";
import Event from "../models/Event.js";


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
    const templates = await ButtonTemplate.find({ user: req.user._id })
      .select('title viewsCount viewHistory')
      .lean();
    
    const summary = templates.map(t => ({
      title: t.title,
      viewsCount: t.viewsCount,
      historyEntries: t.viewHistory?.length || 0,
      lastEntry: t.viewHistory?.[t.viewHistory.length - 1]
    }));
    
    res.json({ success: true, templates: summary });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get("/visitors", async (req, res) => {
  const visitors = await Visitor.find().sort({ lastVisit: -1 }).limit(50); // last 50
  res.json(visitors);
});


// routes/events.js
router.get("/sessions", async (req, res) => {
  try {
    // Latest 50 events
    const events = await Event.find()
      .populate("visitor") // visitor info
      .sort({ timestamp: -1 })
      .limit(50);

    // Aggregate by sessionId
    const sessionsMap = new Map();

    events.forEach((e) => {
      const sid = e.sessionId || e.session?.sessionId || "Unknown";
      if (!sessionsMap.has(sid)) {
        sessionsMap.set(sid, {
          sessionId: sid,
          visitorId: e.visitor?.visitorId || e.visitorId || "Unknown",
          startTime: e.timestamp,
          lastActivity: e.timestamp,
          pageViews: 1,
          eventTypes: [e.eventType],
        });
      } else {
        const s = sessionsMap.get(sid);
        s.lastActivity = e.timestamp > s.lastActivity ? e.timestamp : s.lastActivity;
        s.pageViews += 1;
        if (!s.eventTypes.includes(e.eventType)) s.eventTypes.push(e.eventType);
        sessionsMap.set(sid, s);
      }
    });

    const sessionData = Array.from(sessionsMap.values());

    res.json({ status: "success", results: sessionData.length, data: sessionData });
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
