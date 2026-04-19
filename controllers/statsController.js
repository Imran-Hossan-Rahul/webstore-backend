// controllers/trackController.js
import asyncHandler from "express-async-handler";
import {
  trackVisitSchema,
  trackEventSchema,
  trackSessionSchema,
} from "../validation/trackSchemas.js";
import Visitor from "../models/Visitor.js";
import Session from "../models/Session.js";
import Event from "../models/Event.js";
import geoip from "geoip-lite";
import { UAParser } from "ua-parser-js";

const getClientIP = (req) => {
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
  return { device: deviceType, os, browser };
};

/**
 * ----------------------------
 * Track Visitor (First Hit)
 * ----------------------------
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
  } = value;

  const { device, browser } = parseUserAgent(userAgent);

  const ip = getClientIP(req);
  const geo = geoip.lookup(ip) || {};
  const location = {
    country: geo.country || "Unknown",
    city: geo.city || "Unknown",
  };

  const visitor = await Visitor.findOneAndUpdate(
    { visitorId },
    {
      $setOnInsert: {
        visitorId,
        linkedUser: req.user?._id || null,
        firstVisit: timestamp,
      },
      $set: {
        lastVisit: timestamp,
        landingPath,
        referrer: referrer || "Direct",
        utm,
        device,
        browser,
        ip,
        location,
      },
    },
    { upsert: true, new: true }
  );

  await Session.findOneAndUpdate(
    { sessionId },
    {
      $setOnInsert: { sessionId, visitor: visitor._id, start: timestamp },
      $set: { lastActivity: timestamp },
    },
    { upsert: true, new: true }
  );

  // ----------------------------
  // Live update via Socket.io
  // ----------------------------
  const io = req.app.get("io");
  if (io) {
    const visitorData = {
      visitorId: visitor.visitorId,
      linkedUser: visitor.linkedUser || null,
      loggedIn: visitor.linkedUser ? true : false,
      firstVisit: visitor.firstVisit,
      lastVisit: visitor.lastVisit,
      ip: visitor.ip,
      location: visitor.location || { country: "Unknown", city: "Unknown" },
      device: visitor.device,
      browser: visitor.browser,
      landingPath: visitor.landingPath,
      referrer: visitor.referrer,
      utm: visitor.utm,
    };
    
    io.emit("newVisitor", JSON.parse(JSON.stringify(visitorData)));
  }

  return res.status(200).json({ success: true, visitorId, sessionId });
});

/**
 * ----------------------------
 * Track Event (Click / Scroll / Custom)
 * ----------------------------
 */
export const trackEventController = asyncHandler(async (req, res) => {
  // Validate request
  const { error, value } = trackEventSchema().validate(req.body);
  if (error)
    return res
      .status(400)
      .json({ success: false, message: error.details[0].message });

  const {
    sessionId,
    visitorId,
    eventType,
    page,
    element,
    value: eventValue,
    timestamp,
  } = value;

  // Find or create visitor (handles race condition where event arrives before visit)
  const visitor = await Visitor.findOneAndUpdate(
    { visitorId },
    {
      $setOnInsert: { visitorId, firstVisit: timestamp },
      $set: { lastVisit: timestamp },
    },
    { upsert: true, new: true }
  );

  // Find or create session
  let session = await Session.findOneAndUpdate(
    { sessionId },
    {
      $setOnInsert: { sessionId, visitor: visitor._id, start: timestamp },
      $set: { lastActivity: timestamp },
    },
    { upsert: true, new: true }
  );

  // Check duplicate
  const existing = await Event.findOne({
    session: session._id,
    eventType,
    page,
    element,
    timestamp,
  });
  if (existing)
    return res
      .status(200)
      .json({ success: true, eventId: existing._id, duplicate: true });

  // Create event
  const event = await Event.create({
    visitor: visitor._id,
    visitorId,
    session: session._id,
    sessionId,
    eventType,
    page,
    element,
    value: eventValue,
    timestamp,
    linkedUser: req.user?._id || null,
  });

  // Update session stats
  session.lastActivity = timestamp;
  session.pageViews = (session.pageViews || 0) + 1;
  await session.save();

  // Socket.io live update
  const io = req.app.get("io");
  if (io) {
    const eventData = {
      visitorId: visitor.visitorId,
      sessionId: session.sessionId,
      eventType: event.eventType,
      page: event.page,
      element: event.element,
      value: event.value,
      timestamp: event.timestamp,
    };
    io.emit("newEvent", JSON.parse(JSON.stringify(eventData)));
  }

  return res.status(200).json({ success: true, eventId: event._id });
});
/**
 * ----------------------------
 * Track Session End / Update
 * ----------------------------
 */
export const trackSessionController = asyncHandler(async (req, res) => {
  const { error, value } = trackSessionSchema().validate(req.body);
  if (error)
    return res
      .status(400)
      .json({ success: false, message: error.details[0].message });

  const { sessionId, visitorId, endedAt, duration, pageViews } = value;

  const session = await Session.findOne({ sessionId });
  if (!session)
    return res
      .status(404)
      .json({ success: false, message: "Session not found" });

  session.endedAt = endedAt;
  session.duration = duration;
  session.pageViews = pageViews;
  await session.save();

  const visitor = await Visitor.findOne({ visitorId });
  if (visitor) {
    visitor.lastVisit = endedAt;
    await visitor.save();
  }

  return res.status(200).json({ success: true, sessionId });
});
