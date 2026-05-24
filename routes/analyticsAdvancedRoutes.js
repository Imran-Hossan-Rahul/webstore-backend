// routes/analyticsAdvancedRoutes.js
// Routes for session replay, user journey, A/B testing, predictive analytics, etc.
import express from "express";
import {
  // Session Replay
  startSessionRecording,
  addSnapshot,
  addInteraction,
  endSessionRecording,
  getSessionReplay,
  getAllSessionReplays,
  getHighValueSessions,
  addBookmark,
  addComment,
  getSessionStatistics,
} from "../controllers/sessionReplayController.js";
import {
  // User Journey
  getUserJourneyOverview,
  trackUserJourney,
  getCommonPaths,
  getFunnelAnalysis,
  // A/B Testing
  createABTest,
  startABTest,
  getVariantForUser,
  recordConversion,
  getAllABTests,
  // Predictive Analytics
  getUserPredictions,
  getHighRiskUsers,
  getHighValueOpportunities,
  getSegmentDistribution,
  // Form Analytics
  trackFormAnalytics,
  getFormPerformance,
  // Video Engagement
  trackVideoEngagement,
  getVideoPerformance,
  // Search Analytics
  trackSearch,
  getPopularSearches,
  getZeroResultQueries,
  // Social Graph
  getUserSocialGraph,
  getInfluencers,
  getNetworkStatistics,
  // Advanced Biometrics & Perf
  getKeyboardAnalytics,
  getClipboardAnalytics,
  getTabAnalytics,
  getNetworkAnalytics,
  getDeviceAnalytics,
  getAdvancedStats,
  getMouseHeatmap,
} from "../controllers/analyticsAdvancedController.js";
import { verifyAccessToken } from "../middlewares/verifyAccessToken.js";
import { trackBotFilter, trackRateLimit } from "../middlewares/trackMiddleware.js";

const router = express.Router();

// ==================== SESSION REPLAY ====================
router.post("/replay/start", trackBotFilter, startSessionRecording);
router.post("/replay/snapshot", trackBotFilter, addSnapshot);
router.post("/replay/interaction", trackBotFilter, addInteraction);
router.post("/replay/end", trackBotFilter, endSessionRecording);
router.get("/replay/:sessionId", verifyAccessToken, getSessionReplay);
router.get("/replay", verifyAccessToken, getAllSessionReplays);
router.get("/replay/high-value", verifyAccessToken, getHighValueSessions);
router.post("/replay/:sessionId/bookmark", verifyAccessToken, addBookmark);
router.post("/replay/:sessionId/comment", verifyAccessToken, addComment);
router.get("/replay/stats", verifyAccessToken, getSessionStatistics);

// ==================== USER JOURNEY ====================
router.get("/journey/overview", verifyAccessToken, getUserJourneyOverview);
router.post("/journey/track", trackBotFilter, trackRateLimit, trackUserJourney);
router.get("/journey/common-paths", verifyAccessToken, getCommonPaths);
router.get("/journey/funnel/:funnelName", verifyAccessToken, getFunnelAnalysis);

// ==================== A/B TESTING ====================
router.post("/abtest", verifyAccessToken, createABTest);
router.post("/abtest/:id/start", verifyAccessToken, startABTest);
router.get("/abtest/:id/variant", getVariantForUser);
router.post("/abtest/:id/conversion", recordConversion);
router.get("/abtest", verifyAccessToken, getAllABTests);

// ==================== PREDICTIVE ANALYTICS ====================
router.get("/predict/:userId", verifyAccessToken, getUserPredictions);
router.get("/predict/high-risk", verifyAccessToken, getHighRiskUsers);
router.get("/predict/opportunities", verifyAccessToken, getHighValueOpportunities);
router.get("/predict/segments", verifyAccessToken, getSegmentDistribution);

// ==================== FORM ANALYTICS ====================
router.post("/form", trackBotFilter, trackRateLimit, trackFormAnalytics);
router.get("/form/:formId/performance", verifyAccessToken, getFormPerformance);

// ==================== VIDEO ENGAGEMENT ====================
router.post("/video", trackBotFilter, trackRateLimit, trackVideoEngagement);
router.get("/video/:videoId/performance", verifyAccessToken, getVideoPerformance);

// ==================== SEARCH ANALYTICS ====================
router.post("/search", trackBotFilter, trackRateLimit, trackSearch);
router.get("/search/popular", verifyAccessToken, getPopularSearches);
router.get("/search/zero-results", verifyAccessToken, getZeroResultQueries);

// ==================== SOCIAL GRAPH ====================
router.get("/social/stats", verifyAccessToken, getNetworkStatistics);
router.get("/social/influencers", verifyAccessToken, getInfluencers);
router.get("/social/:userId", verifyAccessToken, getUserSocialGraph);

// ==================== ADVANCED BIOMETRICS & PERF ====================
router.get("/stats", verifyAccessToken, getAdvancedStats);
router.get("/keyboard", verifyAccessToken, getKeyboardAnalytics);
router.get("/clipboard", verifyAccessToken, getClipboardAnalytics);
router.get("/tabs", verifyAccessToken, getTabAnalytics);
router.get("/network", verifyAccessToken, getNetworkAnalytics);
router.get("/device", verifyAccessToken, getDeviceAnalytics);
router.get("/mouse/heatmap", verifyAccessToken, getMouseHeatmap);

export default router;
