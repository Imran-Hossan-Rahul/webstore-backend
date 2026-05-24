// controllers/advancedTrackingController.js
// Handles all advanced tracking: mouse, keyboard, clipboard, tab, network, device
//
// PERFORMANCE NOTES:
// ──────────────────
// NetworkPerformance timings (resourceTimings, apiCalls, speedTests, events)
// are routed through TelemetryBuffer to batch DB writes.  The $slice operator
// ensures no array grows beyond 500 items in a single document.
//
// UserBehaviorEvent.create calls are fire-and-forget (not awaited) to keep
// the response latency minimal — analytics logging should never block the 2xx.
import asyncHandler from "express-async-handler";
import MouseMovement from "../models/MouseMovement.model.js";
import KeystrokeTiming from "../models/KeystrokeTiming.model.js";
import ClipboardActivity from "../models/ClipboardActivity.model.js";
import TabActivity from "../models/TabActivity.model.js";
import NetworkPerformance from "../models/NetworkPerformance.model.js";
import DeviceMetrics from "../models/DeviceMetrics.model.js";
import UserBehaviorEvent from "../models/UserBehaviorEvent.model.js";
import User from "../models/User.model.js";
import crypto from "crypto";
import mongoose from "mongoose";
import { getTelemetryBuffer } from "../utils/telemetryBuffer.js";

// ── Network performance buffer — flush every 5 s, eager-flush at 150 events ──
const networkBuffer = getTelemetryBuffer(NetworkPerformance, "sessionId", {
  flushIntervalMs: 5000,
  maxBufferSize: 150,
});

// Helper to sanitize and parse telemetry arrays (prevents CastError)
const sanitizeTelemetryArray = (data) => {
  if (!data) return [];
  
  let parsed = data;
  if (typeof data === "string") {
    try {
      parsed = JSON.parse(data);
    } catch (e) {
      console.error("[Telemetry] Failed to parse telemetry string:", data.substring(0, 100));
      return [];
    }
  }
  
  if (!Array.isArray(parsed)) {
    // If it's a single object, wrap it
    if (typeof parsed === "object" && parsed !== null) {
      parsed = [parsed];
    } else {
      return [];
    }
  }

  // Filter and normalize each element
  return parsed.map(item => {
    if (typeof item === "string") {
      try {
        return JSON.parse(item);
      } catch (e) {
        return null;
      }
    }
    return item;
  }).filter(item => item !== null && typeof item === "object");
};

/**
 * @desc    Track mouse movements
 * @route   POST /api/v1/track/mouse
 * @access  Public
 */
export const trackMouseMovement = asyncHandler(async (req, res) => {
  const { visitorId, sessionId, userId, page, compressedPath, viewport, metrics, clicks, scrollEvents } = req.body;
  console.log(`[Telemetry] Received mouse movement for session ${sessionId} on page ${page} (${compressedPath.length} points)`);

  if (!visitorId || !sessionId || !page || !compressedPath) {
    return res.status(400).json({ success: false, message: "Missing required fields" });
  }

  // Calculate analytics
  const totalPoints = compressedPath.length;
  const totalDistance = metrics?.totalDistance || 0;
  const speeds = metrics?.speeds || [];
  const avgSpeed = speeds.length > 0 ? speeds.reduce((a, b) => a + b, 0) / speeds.length : 0;
  const maxSpeed = speeds.length > 0 ? Math.max(...speeds) : 0;
  const minSpeed = speeds.length > 0 ? Math.min(...speeds) : 0;

  // Bot detection
  const botScore = metrics?.botScore || 0;

  const mouseMovement = await MouseMovement.create({
    visitorId,
    sessionId,
    userId,
    page,
    compressedPath,
    totalPoints,
    compressionRatio: totalPoints / (metrics?.originalPoints || totalPoints),
    viewportWidth: viewport?.width,
    viewportHeight: viewport?.height,
    devicePixelRatio: viewport?.pixelRatio,
    scrollHeight: viewport?.scrollHeight,
    scrollWidth: viewport?.scrollWidth,
    totalDistance,
    avgSpeed,
    maxSpeed,
    minSpeed,
    avgAcceleration: metrics?.avgAcceleration,
    straightLineRatio: metrics?.straightLineRatio,
    curvatureIndex: metrics?.curvatureIndex,
    idleTimeMs: metrics?.idleTimeMs,
    hoverTimeMs: metrics?.hoverTimeMs,
    clicks: clicks || [],
    scrollEvents: scrollEvents || [],
    botScore,
    botIndicators: {
      perfectLines: metrics?.straightLineRatio > 0.95,
      constantSpeed: speeds.length > 0 && Math.max(...speeds) - Math.min(...speeds) < 100,
      impossibleSpeed: maxSpeed > 5000,
      noAcceleration: !metrics?.avgAcceleration || metrics.avgAcceleration < 0.1,
    },
    features: metrics?.features || {},
    startTime: new Date(),
    endTime: new Date(),
    duration: metrics?.duration,
  });

  // Emit real-time event
  if (global.io) {
    let userName = null;
    if (userId) {
      const user = await User.findById(userId).select('name').lean();
      if (user) userName = user.name;
    }

    const eventData = {
      visitorId,
      sessionId,
      userId,
      userName,
      eventType: "mouse_movement",
      page,
      metadata: { 
        avgSpeed, 
        botScore, 
        totalPoints,
        distance: totalDistance 
      },
      timestamp: new Date(),
    };

    // Save to general behavior events
    await UserBehaviorEvent.create(eventData);
    
    // Emit to socket listeners
    global.io.emit('mouseMovement', {
      visitorId,
      sessionId,
      page,
      botScore,
      avgSpeed,
    });
    
    // Emit to admin live monitor
    global.io.emit('adminLiveEvent', eventData);
  }

  res.status(201).json({ success: true, data: mouseMovement });
});

/**
 * @desc    Track keystroke timing
 * @route   POST /api/v1/track/keystroke
 * @access  Public
 */
export const trackKeystrokeTiming = asyncHandler(async (req, res) => {
  const { visitorId, sessionId, page, keystrokes, digraphs, trigraphs, metrics } = req.body;
  const userId = req.user?._id || req.body.userId || null;

  if (!visitorId || !sessionId || !page || !keystrokes) {
    return res.status(400).json({ success: false, message: "Missing required fields" });
  }

  // Calculate biometric signature
  const dwellTimes = keystrokes.map(k => k.dwellTime).filter(Boolean);
  const flightTimes = keystrokes.map(k => k.flightTime).filter(Boolean);
  
  const biometricSignature = {
    dwellTimeVector: [],
    flightTimeVector: [],
    commonDigraphs: digraphs?.slice(0, 10) || [],
    uniquenessScore: 50,
    confidenceLevel: keystrokes.length >= 50 ? 80 : keystrokes.length * 1.6,
  };

  // Bot detection
  const botScore = metrics?.botScore || 0;

  const keystrokeTiming = await KeystrokeTiming.create({
    visitorId,
    sessionId,
    userId,
    page,
    keystrokes,
    digraphs: digraphs || [],
    trigraphs: trigraphs || [],
    metrics: {
      totalKeystrokes: keystrokes.length,
      netKeystrokes: keystrokes.length - (metrics?.backspaceCount || 0),
      wpm: metrics?.wpm || 0,
      cpm: metrics?.cpm || 0,
      burstSpeed: metrics?.burstSpeed || 0,
      avgDwellTime: dwellTimes.length > 0 ? dwellTimes.reduce((a, b) => a + b, 0) / dwellTimes.length : 0,
      stdDevDwellTime: 0,
      avgFlightTime: flightTimes.length > 0 ? flightTimes.reduce((a, b) => a + b, 0) / flightTimes.length : 0,
      stdDevFlightTime: 0,
      rhythmConsistency: metrics?.rhythmConsistency || 0,
      typingCadence: metrics?.typingCadence || 'medium',
      backspaceCount: metrics?.backspaceCount || 0,
      backspaceRatio: keystrokes.length > 0 ? (metrics?.backspaceCount || 0) / keystrokes.length : 0,
      errorCorrectionSpeed: metrics?.errorCorrectionSpeed || 0,
      shortPauseCount: metrics?.shortPauseCount || 0,
      mediumPauseCount: metrics?.mediumPauseCount || 0,
      longPauseCount: metrics?.longPauseCount || 0,
      avgPauseLength: metrics?.avgPauseLength || 0,
      pasteCount: metrics?.pasteCount || 0,
      pasteRatio: keystrokes.length > 0 ? (metrics?.pasteCount || 0) / keystrokes.length : 0,
    },
    biometricSignature,
    patterns: metrics?.patterns || {},
    botScore,
    botIndicators: {
      perfectTiming: calculateStdDev(dwellTimes) < 5,
      impossibleSpeed: metrics?.wpm > 200,
      noVariation: calculateStdDev(flightTimes) < 5,
      macroPattern: false, // TODO: implement
      noErrors: metrics?.backspaceCount === 0 && keystrokes.length > 100,
    },
    startTime: new Date(),
    endTime: new Date(),
    duration: metrics?.duration,
  });

  // Emit to admin live monitor
  if (global.io) {
    let userName = null;
    if (userId) {
      const user = await User.findById(userId).select('name').lean();
      if (user) userName = user.name;
    }

    const eventData = {
      visitorId,
      sessionId,
      userId,
      userName,
      eventType: "keystroke",
      page,
      metadata: { wpm: metrics?.wpm, keystrokeCount: keystrokes.length },
      timestamp: new Date(),
    };

    await UserBehaviorEvent.create(eventData);
    global.io.emit('adminLiveEvent', eventData);
  }

  res.status(201).json({ success: true, data: keystrokeTiming });
});

/**
 * @desc    Track clipboard activity
 * @route   POST /api/v1/track/clipboard
 * @access  Public
 */
export const trackClipboardActivity = asyncHandler(async (req, res) => {
  const { visitorId, sessionId, page, eventType, content, source, target, behavior } = req.body;
  const userId = req.user?._id || req.body.userId || null;

  if (!visitorId || !sessionId || !page || !eventType) {
    return res.status(400).json({ success: false, message: "Missing required fields" });
  }

  // Analyze content (without storing actual content)
  const contentAnalysis = ClipboardActivity.analyzeContent(content?.text || '');
  
  // Generate hash
  const contentHash = crypto
    .createHash('sha256')
    .update(content?.text || '')
    .digest('hex');

  // Detect security threats
  const threats = [];
  if (content?.length > 1000 && source?.isFormField) {
    threats.push({ type: 'data_exfiltration', confidence: 70, reason: 'Large copy from form field' });
  }
  if (contentAnalysis.hasCode && eventType === 'paste') {
    threats.push({ type: 'code_injection', confidence: 60, reason: 'Code pasted into input' });
  }
  if (/<script|javascript:|onerror=/i.test(content?.text || '')) {
    threats.push({ type: 'xss_attempt', confidence: 90, reason: 'Script tags detected' });
  }

  const clipboardActivity = await ClipboardActivity.create({
    visitorId,
    sessionId,
    userId,
    page,
    eventType,
    content: {
      length: content?.length || 0,
      type: content?.type || 'text/plain',
      hash: contentHash,
      ...contentAnalysis,
    },
    source: source || {},
    target: target || {},
    timestamp: new Date(),
    timeSincePageLoad: content?.timeSincePageLoad,
    behavior: behavior || {},
    security: {
      threatLevel: threats.length > 0 ? 'high' : 'none',
      threats,
      isPotentialDataTheft: threats.some(t => t.type === 'data_exfiltration'),
      isPotentialXSS: threats.some(t => t.type === 'xss_attempt'),
      anomalyScore: threats.reduce((sum, t) => sum + t.confidence, 0) / (threats.length || 1),
    },
  });

  // Alert if high threat or just log activity
  if (global.io) {
    let userName = null;
    if (userId) {
      const user = await User.findById(userId).select('name').lean();
      if (user) userName = user.name;
    }

    if (threats.length > 0) {
      global.io.emit('securityAlert', {
        type: 'clipboard_threat',
        visitorId,
        userName,
        threats,
        timestamp: new Date(),
      });
    }

    const eventData = {
      visitorId,
      sessionId,
      userId,
      userName,
      eventType: "clipboard",
      page,
      metadata: { action: eventType, threatLevel: threats.length > 0 ? 'high' : 'none' },
      timestamp: new Date(),
    };

    await UserBehaviorEvent.create(eventData);
    global.io.emit('adminLiveEvent', eventData);
  }

  res.status(201).json({ success: true, data: clipboardActivity });
});

/**
 * @desc    Track tab activity
 * @route   POST /api/v1/track/tab
 * @access  Public
 */
export const trackTabActivity = asyncHandler(async (req, res) => {
  const { visitorId, sessionId, page, events, metrics, context } = req.body;
  const userId = req.user?._id || req.body.userId || null;

  if (!visitorId || !sessionId || !page || !events) {
    return res.status(400).json({ success: false, message: "Missing required fields" });
  }

  const tabActivity = await TabActivity.create({
    visitorId,
    sessionId,
    userId,
    page,
    events,
    metrics: metrics || {},
    attention: {
      isHighlyDistracted: metrics?.switchesPerMinute > 10,
      isMultitasking: metrics?.switchesPerMinute > 5,
    },
    multitasking: {
      score: Math.min((metrics?.switchesPerMinute || 0) * 10, 100),
      rapidSwitching: metrics?.switchesPerMinute > 10,
    },
    device: context?.device || {},
    startTime: new Date(),
    endTime: new Date(),
    duration: metrics?.duration,
  });

  // Emit to admin live monitor
  if (global.io) {
    let userName = null;
    if (userId) {
      const user = await User.findById(userId).select('name').lean();
      if (user) userName = user.name;
    }

    const eventData = {
      visitorId,
      sessionId,
      userId,
      userName,
      eventType: "tab_activity",
      page,
      metadata: { attentionScore: tabActivity.attention.score, switches: metrics?.switchesPerMinute },
      timestamp: new Date(),
    };

    await UserBehaviorEvent.create(eventData);
    global.io.emit('adminLiveEvent', eventData);
  }

  res.status(201).json({ success: true, data: tabActivity });
});

/**
 * @desc    Track network performance
 * @route   POST /api/v1/track/advanced/network
 * @access  Public
 *
 * STRATEGY:
 *   1. Upsert a base document (connection info, quality score, $set fields) —
 *      this is one lightweight DB write per session, done only when the
 *      document doesn't yet exist or quality metadata changes.
 *   2. Push array payloads (resourceTimings, apiCalls, etc.) through the
 *      TelemetryBuffer so many concurrent requests batch into a single
 *      findOneAndUpdate flush every 5 seconds.
 *   3. UserBehaviorEvent logging is fire-and-forget (no await) to prevent
 *      analytics from slowing the response.
 */
export const trackNetworkPerformance = asyncHandler(async (req, res) => {
  const {
    visitorId, sessionId, userId, page,
    connection, speedTests, apiCalls, resourceTimings, metrics, navigation, events
  } = req.body;

  if (!visitorId || !sessionId || !page) {
    return res.status(400).json({ success: false, message: "visitorId, sessionId, and page are required." });
  }

  // Sanitise all incoming telemetry arrays defensively
  const sanitizedResourceTimings = sanitizeTelemetryArray(resourceTimings);
  const sanitizedSpeedTests      = sanitizeTelemetryArray(speedTests);
  const sanitizedApiCalls        = sanitizeTelemetryArray(apiCalls);
  const sanitizedEvents          = sanitizeTelemetryArray(events);

  // Compute quality score (pure function, no DB access)
  const networkQualityScore = calculateNetworkQuality(metrics?.downloadSpeed, metrics?.latency);
  let rating = 'critical';
  if (networkQualityScore >= 80)      rating = 'excellent';
  else if (networkQualityScore >= 60) rating = 'good';
  else if (networkQualityScore >= 40) rating = 'fair';
  else if (networkQualityScore >= 20) rating = 'poor';

  // ── Step 1: Upsert base document ($set metadata — lightweight) ──────────
  // This only writes scalar fields so it is always fast regardless of doc size.
  await NetworkPerformance.findOneAndUpdate(
    { sessionId, visitorId },
    {
      $setOnInsert: { visitorId, sessionId },
      $set: {
        userId:      userId || null,
        page,
        connection:  connection  || {},
        metrics:     metrics     || {},
        navigation:  navigation  || {},
        "quality.score":  networkQualityScore,
        "quality.rating": rating,
      },
    },
    { upsert: true, new: false, runValidators: false }
  );

  // ── Step 2: Buffer array payloads (batched flush, no immediate DB write) ─
  const hasArrayData =
    sanitizedResourceTimings.length > 0 ||
    sanitizedSpeedTests.length > 0 ||
    sanitizedApiCalls.length > 0 ||
    sanitizedEvents.length > 0;

  if (hasArrayData) {
    // Push each populated array individually into the buffer.
    // The buffer merges them per-session and flushes with $each + $slice.
    if (sanitizedResourceTimings.length) networkBuffer.push(sessionId, "resourceTimings", sanitizedResourceTimings);
    if (sanitizedSpeedTests.length)      networkBuffer.push(sessionId, "speedTests",      sanitizedSpeedTests);
    if (sanitizedApiCalls.length)        networkBuffer.push(sessionId, "apiCalls",        sanitizedApiCalls);
    if (sanitizedEvents.length)          networkBuffer.push(sessionId, "events",          sanitizedEvents);
  }

  // ── Step 3: Fire-and-forget analytics event (never blocks the response) ──
  if (global.io) {
    const eventData = {
      visitorId,
      sessionId,
      userId,
      eventType: "network_performance",
      page,
      metadata: {
        quality:        networkQualityScore,
        downloadSpeed:  metrics?.downloadSpeed,
        effectiveType:  connection?.effectiveType,
      },
      timestamp: new Date(),
    };

    // Non-blocking: do not await either of these
    UserBehaviorEvent.create(eventData).catch(err =>
      console.error("[TrackNetwork] UserBehaviorEvent write error:", err.message)
    );
    global.io.emit("adminLiveEvent", eventData);
  }

  return res.status(200).json({
    success: true,
    buffered: hasArrayData,
    qualityScore: networkQualityScore,
  });
});

/**
 * @desc    Track device metrics
 * @route   POST /api/v1/track/device
 * @access  Public
 */
export const trackDeviceMetrics = asyncHandler(async (req, res) => {
  const { visitorId, sessionId, userId, page, memory, battery, cpu, storage, display } = req.body;

  if (!visitorId || !sessionId || !page) {
    return res.status(400).json({ success: false, message: "Missing required fields" });
  }

  const deviceMetrics = await DeviceMetrics.create({
    visitorId,
    sessionId,
    userId,
    page,
    memory: memory || {},
    battery: battery || {},
    cpu: cpu || {},
    storage: storage || {},
    display: display || {},
    timestamp: new Date(),
  });

  // Emit to admin live monitor
  if (global.io) {
    let userName = null;
    if (userId) {
      const user = await User.findById(userId).select('name').lean();
      if (user) userName = user.name;
    }

    if (battery?.level < 20) {
      global.io.emit('lowBattery', {
        visitorId,
        userName,
        level: battery.level,
        timestamp: new Date(),
      });
    }

    const eventData = {
      visitorId,
      sessionId,
      userId,
      userName,
      eventType: "device_metrics",
      page,
      metadata: { batteryLevel: battery?.level },
      timestamp: new Date(),
    };

    await UserBehaviorEvent.create(eventData);
    global.io.emit('adminLiveEvent', eventData);
  }

  res.status(201).json({ success: true, data: deviceMetrics });
});

// Helper functions
function calculateDistance(path) {
  let distance = 0;
  for (let i = 1; i < path.length; i++) {
    const dx = path[i][0] - path[i-1][0];
    const dy = path[i][1] - path[i-1][1];
    distance += Math.sqrt(dx * dx + dy * dy);
  }
  return distance;
}

function calculateSpeeds(path) {
  const speeds = [];
  for (let i = 1; i < path.length; i++) {
    const dx = path[i][0] - path[i-1][0];
    const dy = path[i][1] - path[i-1][1];
    const dt = (path[i][2] - path[i-1][2]) / 1000; // convert to seconds
    const distance = Math.sqrt(dx * dx + dy * dy);
    speeds.push(dt > 0 ? distance / dt : 0);
  }
  return speeds;
}

function detectMouseBot(path, avgSpeed, maxSpeed) {
  let score = 0;
  if (maxSpeed > 5000) score += 40;
  if (avgSpeed > 3000) score += 30;
  if (path.length < 10) score += 30;
  return Math.min(score, 100);
}

function detectKeystrokeBot(metrics) {
  let score = 0;
  if (metrics?.wpm > 200) score += 40;
  if (metrics?.stdDevDwellTime < 5) score += 30;
  if (metrics?.backspaceCount === 0 && metrics?.totalKeystrokes > 100) score += 30;
  return Math.min(score, 100);
}

function calculateDistribution(values) {
  // Simple histogram
  const bins = [0, 50, 100, 150, 200, 250, 300];
  const dist = new Array(bins.length).fill(0);
  values.forEach(v => {
    for (let i = 0; i < bins.length; i++) {
      if (v < bins[i]) {
        dist[i]++;
        break;
      }
    }
  });
  return dist;
}

function calculateStdDev(values) {
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / values.length;
  return Math.sqrt(variance);
}

function calculateUniqueness(dwellTimes, flightTimes) {
  const dwellStdDev = calculateStdDev(dwellTimes);
  const flightStdDev = calculateStdDev(flightTimes);
  return Math.min((dwellStdDev + flightStdDev) / 2, 100);
}

function calculateAttentionScore(metrics) {
  if (!metrics) return 50;
  let score = 100;
  score -= (1 - (metrics.visibleRatio || 0.5)) * 40;
  score -= Math.min((metrics.switchesPerMinute || 0) * 5, 40);
  return Math.max(0, Math.min(100, score));
}

function getAttentionQuality(score) {
  if (score >= 80) return 'excellent';
  if (score >= 60) return 'good';
  if (score >= 40) return 'fair';
  if (score >= 20) return 'poor';
  return 'distracted';
}

function calculateNetworkQuality(speed, latency) {
  let score = 100;
  if (speed < 1) score -= 50;
  else if (speed < 5) score -= 30;
  else if (speed < 10) score -= 20;
  
  if (latency > 500) score -= 30;
  else if (latency > 200) score -= 20;
  else if (latency > 100) score -= 10;
  
  return Math.max(0, Math.min(100, score));
}
