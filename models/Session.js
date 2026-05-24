// models/Session.js
import mongoose, { Schema } from "mongoose";

const sessionSchema = new Schema(
  {
    sessionId: { type: String, unique: true, index: true },
    visitorId: { type: String, index: true },
    visitor: { type: Schema.Types.ObjectId, ref: "Visitor" },
    linkedUser: { type: Schema.Types.ObjectId, ref: "User" },

    // Entry context
    landingPage: { type: String },
    exitPage: { type: String },
    referrer: { type: String },
    pagesVisited: [{ type: String }],   // ordered journey: ["/", "/buttons", "/buttons/card"]

    // UTM Campaign
    utm: {
      source: String,
      medium: String,
      campaign: String,
      term: String,
      content: String,
    },

    // Device context
    device: { type: String },
    browser: { type: String },
    os: { type: String },
    ip: { type: String },

    // Timing
    start: { type: Date, default: Date.now },
    startedAt: { type: Date, default: Date.now }, // alias for compat
    endedAt: { type: Date },
    duration: { type: Number },         // ms total session

    // Behavior
    pageViews: { type: Number, default: 1 },
    lastActivity: { type: Date, default: Date.now },

    // ===== NEW: Engagement Metrics =====
    scrollDepthMax: { type: Number, default: 0 },    // 0-100 %
    engagementScore: { type: Number, default: 0 },   // computed score
    bounced: { type: Boolean, default: false },       // 1 page = bounce
    rageClicks: { type: Number, default: 0 },         // rapid click bursts
    idleTimeMs: { type: Number, default: 0 },         // ms user was idle
    activeTimeMs: { type: Number, default: 0 },       // ms user was active
    clickCount: { type: Number, default: 0 },         // total clicks
    copyCount: { type: Number, default: 0 },          // Ctrl+C events
    exitIntentFired: { type: Boolean, default: false }, // mouse toward top exit
    tabSwitchCount: { type: Number, default: 0 },     // hidden/visible switches
  },
  { timestamps: true }
);

// Indexes
sessionSchema.index({ startedAt: -1 });
sessionSchema.index({ linkedUser: 1 });
sessionSchema.index({ visitorId: 1 });
sessionSchema.index({ bounced: 1 });
sessionSchema.index({ engagementScore: -1 });

const Session =
  mongoose.models.Session ||
  mongoose.model("Session", sessionSchema, "sessions");

export default Session;
