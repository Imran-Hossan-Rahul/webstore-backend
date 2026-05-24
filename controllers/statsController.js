// controllers/statsController.js — UPGRADED
// World-class visitor & session tracking with full behavioral data
import asyncHandler from "express-async-handler";
import mongoose from "mongoose";
import {
  trackVisitSchema,
  trackEventSchema,
  trackSessionSchema,
} from "../validation/trackSchemas.js";
import Visitor from "../models/Visitor.js";
import Session from "../models/Session.js";
import Event from "../models/Event.js";
import UserBehaviorEvent from "../models/UserBehaviorEvent.model.js";
import User from "../models/User.model.js";
import geoip from "geoip-lite";
import { UAParser } from "ua-parser-js";

const getpatronIP = (req) => {
  let ip =
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    req.ip;
  if (ip === "::1") ip = "127.0.0.1";
  return ip || "0.0.0.0";
};

const parseUserAgent = (uaString) => {
  const ua = new UAParser(uaString || "");
  const deviceType = ua.getDevice().type || "Desktop";
  const os = ua.getOS().name || "Unknown";
  const browser = ua.getBrowser().name || "Unknown";
  const osVersion = ua.getOS().version || "";
  const browserVersion = ua.getBrowser().version || "";
  return { device: deviceType, os, browser, osVersion, browserVersion };
};

/**
 * @desc   Track Visitor (First Hit / Each Page Load)
 * @route  POST /api/v1/track/visit
 */
export const trackVisitorController = asyncHandler(async (req, res) => {
  const { error, value } = trackVisitSchema().validate(req.body);
  if (error)
    return res
      .status(400)
      .json({ success: false, message: error.details[0].message });

  const {
    sessionId,
    visitorId,
    landingPath,
    referrer,
    utm,
    userAgent,
    timestamp,
    // NEW: device fingerprint fields from frontend
    screenResolution,
    screenColorDepth,
    language,
    languages,
    connectionType,
    touchSupport,
    cookiesEnabled,
    timezone,
    timezoneOffset,
    platform,
    doNotTrack,
    hardwareConcurrency,
  } = value;

  const { device, browser, os } = parseUserAgent(userAgent);

  const ip = getpatronIP(req);
  const geo = geoip.lookup(ip) || {};
  const location = {
    country: geo.country || "Unknown",
    city: geo.city || "Unknown",
    region: geo.region || "Unknown",
    countryCode: geo.country || "??",
    timezone: geo.timezone || timezone || "Unknown",
  };

  // Upsert Visitor with all fingerprint data
  const visitor = await Visitor.findOneAndUpdate(
    { visitorId },
    {
      $setOnInsert: {
        visitorId,
        firstVisit: timestamp,
      },
      $set: {
        ...(req.user?._id && { linkedUser: req.user._id }),
        lastVisit: timestamp,
        lastPage: landingPath,
        landingPath,
        referrer: referrer || "Direct",
        utm,
        device,
        browser,
        os,
        ip,
        location,
        userAgent,
        // Device fingerprint
        ...(screenResolution && { screenResolution }),
        ...(screenColorDepth && { screenColorDepth }),
        ...(language && { language }),
        ...(languages?.length && { languages }),
        ...(connectionType && { connectionType }),
        ...(touchSupport !== undefined && { touchSupport }),
        ...(cookiesEnabled !== undefined && { cookiesEnabled }),
        ...(timezone && { timezone }),
        ...(timezoneOffset !== undefined && { timezoneOffset }),
        ...(platform && { platform }),
        ...(doNotTrack !== undefined && { doNotTrack }),
        ...(hardwareConcurrency && { hardwareConcurrency }),
      },
      $inc: {
        totalPageViews: 1,
      },
    },
    { upsert: true, new: true }
  );

  // Upsession Logic: Increment visitor session count if this is a new session
  const existingSession = await Session.findOne({ sessionId });
  if (!existingSession) {
    await Visitor.updateOne(
      { _id: visitor._id },
      { $inc: { sessionCount: 1 } }
    );
  }

  // Upsert Session
  const session = await Session.findOneAndUpdate(
    { sessionId },
    {
      $setOnInsert: {
        sessionId,
        visitor: visitor._id,
        visitorId,
        linkedUser: req.user?._id || null,
        start: timestamp,
        startedAt: timestamp,
        landingPage: landingPath,
        referrer: referrer || "Direct",
        utm,
        device,
        browser,
        os,
        ip,
      },
      $set: { lastActivity: timestamp },
      $addToSet: { pagesVisited: landingPath },
    },
    { upsert: true, new: true }
  );

  // Emit to admin live monitor via Socket.io
  const io = req.app.get("io");
  if (io) {
    let userName = null;
    const targetUserId = req.user?._id || visitor.linkedUser || null;
    if (targetUserId) {
      const user = await User.findById(targetUserId).select('name').lean();
      if (user) userName = user.name;
    }

    io.emit("newVisitor", {
      visitorId: visitor.visitorId,
      linkedUser: targetUserId,
      userName: userName,
      loggedIn: !!targetUserId,
      ip: visitor.ip,
      location: visitor.location,
      device: visitor.device,
      browser: visitor.browser,
      os: visitor.os,
      page: landingPath,
      referrer: visitor.referrer,
      timestamp,
      // Also emit as admin live stream event
      eventType: "page_visit",
    });
  }

  return res.status(200).json({ success: true, visitorId, sessionId });
});

/**
 * @desc   Track Event (Click / Scroll / Custom / Heartbeat)
 * @route  POST /api/v1/track/event
 */
export const trackEventController = asyncHandler(async (req, res) => {
  const { sessionId, visitorId, events: batchEvents } = req.body;

  // Convert single event to batch for unified processing
  const eventsToProcess = batchEvents || [req.body];

  if (!visitorId || !sessionId || eventsToProcess.length === 0) {
    return res.status(400).json({ success: false, message: "visitorId, sessionId, and at least one event required" });
  }

  const io = req.app.get("io");
  let lastEventId = null;

  // Process all events in the batch
  for (const eventData of eventsToProcess) {
    const {
      eventType,
      page,
      element,
      elementText,
      elementTag,
      value: eventValue,
      timestamp,
      section,
      position,
      scrollDepth,
      scrollY,
      timeOnPage,
      featureName,
      metadata,
      errorMessage,
      errorStack,
    } = eventData;

    if (!eventType) continue;

    const now = timestamp ? new Date(timestamp) : new Date();

    // 1. Upsert visitor lastVisit
    const visitor = await Visitor.findOneAndUpdate(
      { visitorId },
      {
        $setOnInsert: { visitorId, firstVisit: now },
        $set: { lastVisit: now, lastPage: page },
        $inc: {
          totalPageViews: eventType === "pageview" ? 1 : 0,
          rageClickCount: eventType === "rage_click" ? 1 : 0,
          exitIntentCount: eventType === "exit_intent" ? 1 : 0,
        },
      },
      { upsert: true, new: true }
    );

    // 2. Upsert session
    const session = await Session.findOneAndUpdate(
      { sessionId },
      {
        $setOnInsert: { sessionId, visitor: visitor._id, visitorId, start: now, startedAt: now },
        $set: { lastActivity: now },
        $addToSet: page ? { pagesVisited: page } : {},
        $inc: {
          pageViews: eventType === "pageview" ? 1 : 0,
          clickCount: eventType === "click" || eventType === "rage_click" ? 1 : 0,
          rageClicks: eventType === "rage_click" ? 1 : 0,
          copyCount: eventType === "copy" ? 1 : 0,
          tabSwitchCount: eventType === "page_blur" || eventType === "page_focus" ? 1 : 0,
        },
        ...(eventType === "exit_intent" ? { $set: { exitIntentFired: true, lastActivity: now } } : {}),
        ...(scrollDepth && { $max: { scrollDepthMax: scrollDepth } }),
      },
      { upsert: true, new: true }
    );

    // 3. Fire-and-forget logging (non-blocking)
    const targetUserId = req.user?._id || visitor.linkedUser || null;
    
    // We don't await these to keep response time fast
    UserBehaviorEvent.create({
      visitorId,
      sessionId,
      userId: targetUserId,
      eventType,
      page,
      section,
      element,
      elementText: elementText?.slice(0, 200),
      elementTag,
      position,
      scrollDepth,
      scrollY,
      timeOnPage,
      timestamp: now,
      featureName,
      value: eventValue,
      metadata,
      errorStack,
      country: visitor.location?.country,
      ip: getpatronIP(req),
    }).catch(err => console.error("[TrackEvent] Behavior log error:", err.message));

    Event.create({
      visitor: visitor._id,
      visitorId,
      session: session._id,
      sessionId,
      eventType: ["pageview","click","scroll","signup_click","custom"].includes(eventType)
        ? eventType
        : "custom",
      page,
      element,
      value: eventValue,
      timestamp: now,
    }).catch(() => {});
    
    lastEventId = "buffered"; // Placeholder as we didn't await

    // 5. Emit to admin live monitor via Socket.io
    if (io) {
      const significantEvents = [
        "pageview","click","rage_click","purchase","feature_use",
        "download_start","share","exit_intent","js_error","api_error","form_submit",
        "keystroke", "clipboard", "tab_activity", "device_metrics"
      ];
      
      if (significantEvents.includes(eventType)) {
        // Find user name if possible
        let userName = null;
        if (visitor.linkedUser) {
          const user = await User.findById(visitor.linkedUser).select('name').lean();
          if (user) userName = user.name;
        }

        io.emit("adminLiveEvent", {
          visitorId,
          sessionId,
          userId: req.user?._id || visitor.linkedUser || null,
          userName: userName,
          eventType,
          page,
          element,
          featureName,
          timestamp: now,
          country: visitor.location?.country,
          ip: req.ip,
        });
      }
    }
  }

  return res.status(200).json({ success: true, count: eventsToProcess.length, lastEventId });
});

/**
 * @desc   Track Session End / Update with full summary
 * @route  POST /api/v1/track/session
 */
export const trackSessionController = asyncHandler(async (req, res) => {
  const {
    sessionId,
    visitorId,
    endedAt,
    duration,
    pageViews,
    // NEW
    scrollDepthMax,
    idleTimeMs,
    activeTimeMs,
    clickCount,
    rageClicks,
    exitIntentFired,
    tabSwitchCount,
    bounced,
    exitPage,
    pagesVisited,
  } = req.body;

  if (!sessionId) {
    return res.status(400).json({ success: false, message: "sessionId required" });
  }

  const endTime = endedAt ? new Date(endedAt) : new Date();

  // Compute engagement score (0-100)
  // Score = weighted combination of: active time %, scroll depth, clicks, pages visited
  const durationMs = duration || 0;
  const activeRatio = durationMs > 0 ? (activeTimeMs || 0) / durationMs : 0;
  const scrollScore = (scrollDepthMax || 0) / 100;
  const clickScore = Math.min((clickCount || 0) / 10, 1); // normalized to 0-1
  const pageScore = Math.min((pageViews || 1) / 5, 1);
  const engagementScore = Math.round(
    (activeRatio * 40 + scrollScore * 25 + clickScore * 20 + pageScore * 15)
  );

  // Update session
  await Session.findOneAndUpdate(
    { sessionId },
    {
      $set: {
        endedAt: endTime,
        duration,
        pageViews,
        scrollDepthMax: scrollDepthMax || 0,
        idleTimeMs: idleTimeMs || 0,
        activeTimeMs: activeTimeMs || 0,
        clickCount: clickCount || 0,
        rageClicks: rageClicks || 0,
        exitIntentFired: exitIntentFired || false,
        tabSwitchCount: tabSwitchCount || 0,
        bounced: bounced !== undefined ? bounced : (pageViews <= 1),
        exitPage,
        engagementScore,
        lastActivity: endTime,
        ...(pagesVisited?.length && { pagesVisited }),
      },
    }
  );

  // Update visitor aggregate stats
  const visitor = await Visitor.findOne({ visitorId });
  if (visitor) {
    visitor.lastVisit = endTime;
    // visitor.sessionCount = (visitor.sessionCount || 0) + 1; // Handled at session start now
    visitor.totalTimeSpentMs = (visitor.totalTimeSpentMs || 0) + (duration || 0);
    if (bounced || pageViews <= 1) visitor.bounceCount = (visitor.bounceCount || 0) + 1;
    if (scrollDepthMax > (visitor.maxScrollDepth || 0)) visitor.maxScrollDepth = scrollScore * 100; // Fix: was using scrollDepthMax
    if (exitPage) visitor.lastPage = exitPage;
    await visitor.save();
  }

  return res.status(200).json({ success: true, sessionId, engagementScore });
});

/**
 * @desc   Track Heartbeat (every 5s — proves user is active)
 * @route  POST /api/v1/track/heartbeat
 */
export const trackHeartbeatController = asyncHandler(async (req, res) => {
  const { sessionId, visitorId, page, activeTimeMs } = req.body;

  if (!sessionId || !visitorId) {
    return res.status(400).json({ success: false, message: "sessionId and visitorId required" });
  }

  const now = new Date();

  // Run Session and Visitor updates in parallel for performance
  Promise.all([
    Session.findOneAndUpdate(
      { sessionId },
      {
        $set: { lastActivity: now },
        $inc: { activeTimeMs: activeTimeMs || 5000 },
      },
      { runValidators: false }
    ),
    Visitor.findOneAndUpdate(
      { visitorId },
      { $set: { lastVisit: now, lastPage: page } },
      { runValidators: false }
    ),
    // Fire-and-forget event log
    UserBehaviorEvent.create({
      visitorId,
      sessionId,
      userId: req.user?._id || null,
      eventType: "heartbeat",
      page,
      timestamp: now,
      metadata: { activeTimeMs },
    })
  ]).catch(err => console.error("[Heartbeat] Optimization error:", err.message));

  return res.status(200).json({ success: true });
});
