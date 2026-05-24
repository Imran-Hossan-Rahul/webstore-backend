// controllers/sessionReplayController.js
// Session replay — record, store, and playback user sessions like a video.
//
// PERFORMANCE ARCHITECTURE:
// ─────────────────────────
// High-frequency writes (addSnapshot, addInteraction) are routed through the
// TelemetryBuffer which batches events in-memory and flushes to MongoDB every
// 3 seconds via a single findOneAndUpdate with $push + $each + $slice.
//
// This replaces the previous pattern of one findOneAndUpdate per HTTP request,
// which caused write contention and Mongoose buffering timeouts under load.
//
// Document array size is hard-capped at 500 entries per field via $slice
// to prevent documents from approaching MongoDB's 16 MB limit.
import asyncHandler from "express-async-handler";
import SessionReplay from "../models/SessionReplay.model.js";
import { getTelemetryBuffer } from "../utils/telemetryBuffer.js";

// ── Buffer: flush every 3 s, eager-flush if a session accumulates ≥200 events ──
const replayBuffer = getTelemetryBuffer(SessionReplay, "sessionId", {
  flushIntervalMs: 3000,
  maxBufferSize: 200,
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/analytics/advanced/replay/start
// ─────────────────────────────────────────────────────────────────────────────
/**
 * @desc   Start a new session recording or return the existing one.
 * @access Public
 */
export const startSessionRecording = asyncHandler(async (req, res) => {
  const { visitorId, sessionId, userId, metadata } = req.body;

  if (!visitorId || !sessionId) {
    return res.status(400).json({ success: false, message: "visitorId and sessionId are required." });
  }

  // Upsert: create if not present, ignore if already started.
  const sessionReplay = await SessionReplay.findOneAndUpdate(
    { sessionId },
    {
      $setOnInsert: {
        visitorId,
        sessionId,
        userId: userId || null,
        recording: {
          startTime: new Date(),
          status: "recording",
          quality: "medium",
          fps: 30,
          totalEvents: 0,
        },
        snapshots:       [],
        interactions:    [],
        networkActivity: [],
        consoleLogs:     [],
        errors:          [],
        performance:     [],
        pageViews:       [],
        customEvents:    [],
        metadata:        metadata || {},
        privacy: {
          textSanitized:    true,
          inputsSanitized:  true,
          imagesSanitized:  false,
          consentGiven:     true,
          consentTimestamp: new Date(),
        },
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: false }
  );

  return res.status(201).json({
    success: true,
    data: { sessionId, replayId: sessionReplay._id },
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/analytics/advanced/replay/snapshot
// ─────────────────────────────────────────────────────────────────────────────
/**
 * @desc   Buffer DOM snapshot(s) for a session.
 *         Does NOT write to DB immediately — events are batched and flushed
 *         by the TelemetryBuffer every 3 seconds.
 * @access Public
 */
export const addSnapshot = asyncHandler(async (req, res) => {
  const { sessionId, snapshot } = req.body;

  if (!sessionId || !snapshot) {
    return res.status(400).json({ success: false, message: "sessionId and snapshot are required." });
  }

  const snapshots = Array.isArray(snapshot) ? snapshot : [snapshot];

  // Route to buffer — zero DB writes on this request path
  replayBuffer.push(sessionId, "snapshots", snapshots, {
    "recording.totalEvents": snapshots.length, // approximate; overwritten on end
  });

  return res.status(200).json({ success: true, buffered: snapshots.length });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/analytics/advanced/replay/interaction
// ─────────────────────────────────────────────────────────────────────────────
/**
 * @desc   Buffer user interaction event(s) for a session.
 * @access Public
 */
export const addInteraction = asyncHandler(async (req, res) => {
  const { sessionId, interaction } = req.body;

  if (!sessionId || !interaction) {
    return res.status(400).json({ success: false, message: "sessionId and interaction are required." });
  }

  const interactions = Array.isArray(interaction) ? interaction : [interaction];

  replayBuffer.push(sessionId, "interactions", interactions);

  return res.status(200).json({ success: true, buffered: interactions.length });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/analytics/advanced/replay/end
// ─────────────────────────────────────────────────────────────────────────────
/**
 * @desc   Finalise a session recording.
 *         Eagerly flushes the buffer for this session before computing analytics,
 *         so all buffered events are persisted before we compute scores.
 * @access Public
 */
export const endSessionRecording = asyncHandler(async (req, res) => {
  const { sessionId, analysis } = req.body;

  if (!sessionId) {
    return res.status(400).json({ success: false, message: "sessionId is required." });
  }

  // Eagerly flush any buffered events for this session before finalising.
  await replayBuffer.flushAll();

  const sessionReplay = await SessionReplay.findOne({ sessionId });
  if (!sessionReplay) {
    return res.status(404).json({ success: false, message: "Session not found." });
  }

  const endTime   = new Date();
  const startTime = sessionReplay.recording.startTime;

  sessionReplay.recording.endTime  = endTime;
  sessionReplay.recording.duration = endTime - startTime;
  sessionReplay.recording.status   = "processing";

  // Compute engagement score
  sessionReplay.analysis = sessionReplay.analysis || {};
  sessionReplay.analysis.engagementScore = sessionReplay.calculateEngagementScore();

  // Merge caller-provided analysis fields
  if (analysis) {
    Object.assign(sessionReplay.analysis, analysis);
  }

  // Derive tags
  const tags = [];
  if (sessionReplay.analysis.converted)     tags.push("converted");
  if (sessionReplay.analysis.hadErrors)      tags.push("had_error");
  if (sessionReplay.analysis.hasRageClicks)  tags.push("frustrated");
  if ((sessionReplay.analysis.engagementScore || 0) >= 80) tags.push("high_engagement");
  sessionReplay.tags = tags;

  sessionReplay.recording.status = "ready";
  await sessionReplay.save();

  // Broadcast to admin dashboard
  if (global.io) {
    global.io.emit("sessionCompleted", {
      sessionId,
      engagementScore: sessionReplay.analysis.engagementScore,
      converted:       sessionReplay.analysis.converted,
      hadErrors:       sessionReplay.analysis.hadErrors,
    });
  }

  return res.status(200).json({ success: true, data: sessionReplay });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/analytics/advanced/replay/:sessionId
// ─────────────────────────────────────────────────────────────────────────────
export const getSessionReplay = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;

  const sessionReplay = await SessionReplay
    .findOne({ sessionId })
    .populate("userId", "name email avatar")
    .lean();

  if (!sessionReplay) {
    return res.status(404).json({ success: false, message: "Session not found." });
  }

  // Record view (non-lean update)
  await SessionReplay.findOneAndUpdate(
    { sessionId },
    {
      $inc: { "playback.viewCount": 1 },
      $set: {
        "playback.lastViewedAt": new Date(),
        "playback.lastViewedBy": req.user?._id || null,
      },
    },
    { runValidators: false }
  );

  // Merge and sort all timed events for the playback player
  const startMs = new Date(sessionReplay.recording.startTime).getTime();
  const events  = [
    ...(sessionReplay.snapshots    || []).map(s => ({ ...s, _category: "snapshot",     relativeTime: (s.timestamp || 0) })),
    ...(sessionReplay.interactions || []).map(i => ({ ...i, _category: "interaction",  relativeTime: (i.timestamp || 0) })),
  ].sort((a, b) => a.relativeTime - b.relativeTime);

  const endMs     = sessionReplay.recording.endTime ? new Date(sessionReplay.recording.endTime).getTime() : Date.now();
  const durationS = ((endMs - startMs) / 1000).toFixed(1);

  return res.status(200).json({
    success: true,
    data: { ...sessionReplay, events, duration: durationS },
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/analytics/advanced/replay         (paginated list)
// ─────────────────────────────────────────────────────────────────────────────
export const getAllSessionReplays = asyncHandler(async (req, res) => {
  const page   = Math.max(1, parseInt(req.query.page)  || 1);
  const limit  = Math.min(100, parseInt(req.query.limit) || 20);
  const filter = req.query.filter || "all";

  const query = { "recording.status": "ready" };
  if (filter === "converted") query["analysis.converted"]   = true;
  if (filter === "errors")    query["analysis.hadErrors"]    = true;
  if (filter === "frustrated") query["analysis.hasRageClicks"] = true;

  const [total, sessions] = await Promise.all([
    SessionReplay.countDocuments(query),
    SessionReplay.find(query)
      .sort({ "recording.startTime": -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select("-snapshots -interactions -networkActivity -consoleLogs") // Exclude heavy arrays
      .populate("userId", "name email avatar")
      .lean(),
  ]);

  return res.status(200).json({
    success: true,
    data: sessions,
    pagination: { total, page, pages: Math.ceil(total / limit) },
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/analytics/advanced/replay/high-value
// ─────────────────────────────────────────────────────────────────────────────
export const getHighValueSessions = asyncHandler(async (req, res) => {
  const limit    = Math.min(50, parseInt(req.query.limit) || 10);
  const sessions = await SessionReplay.findHighValueSessions(limit);
  return res.status(200).json({ success: true, data: sessions });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/analytics/advanced/replay/:sessionId/bookmark
// ─────────────────────────────────────────────────────────────────────────────
export const addBookmark = asyncHandler(async (req, res) => {
  const { sessionId }          = req.params;
  const { timestamp, label, type } = req.body;

  const sessionReplay = await SessionReplay.findOne({ sessionId });
  if (!sessionReplay) {
    return res.status(404).json({ success: false, message: "Session not found." });
  }

  await sessionReplay.addBookmark(timestamp, label, type, req.user._id);
  return res.status(200).json({ success: true, message: "Bookmark added." });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/analytics/advanced/replay/:sessionId/comment
// ─────────────────────────────────────────────────────────────────────────────
export const addComment = asyncHandler(async (req, res) => {
  const { sessionId }       = req.params;
  const { timestamp, text } = req.body;

  const sessionReplay = await SessionReplay.findOne({ sessionId });
  if (!sessionReplay) {
    return res.status(404).json({ success: false, message: "Session not found." });
  }

  await sessionReplay.addComment(timestamp, text, req.user._id);
  return res.status(200).json({ success: true, message: "Comment added." });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/analytics/advanced/replay/stats
// ─────────────────────────────────────────────────────────────────────────────
export const getSessionStatistics = asyncHandler(async (req, res) => {
  const stats = await SessionReplay.getStatistics();
  return res.status(200).json({ success: true, data: stats[0] || {} });
});
