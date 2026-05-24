// models/UserBehaviorEvent.model.js
// Granular millisecond-level behavioral event tracking
// Similar to what Mixpanel, Hotjar, and FullStory collect
import mongoose, { Schema } from "mongoose";

const behaviorEventSchema = new Schema(
  {
    // Identity
    visitorId: { type: String, index: true },
    sessionId: { type: String, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    userName: { type: String },

    // Event Classification
    eventType: {
      type: String,
      required: true,
      enum: [
        // Navigation
        "pageview",       // user visited a page
        "page_exit",      // user left a page
        "page_focus",     // tab became active
        "page_blur",      // tab became hidden

        // Interaction
        "click",          // any click
        "rage_click",     // 3+ clicks in 500ms same area
        "double_click",
        "right_click",
        "long_press",     // mobile

        // Scroll
        "scroll_25",      // reached 25% scroll
        "scroll_50",
        "scroll_75",
        "scroll_100",     // bottom of page

        // Forms
        "form_focus",     // focused an input
        "form_blur",      // left an input
        "form_submit",    // submitted a form
        "form_error",     // validation error shown

        // Intent signals
        "exit_intent",    // mouse moved toward browser top/close
        "copy",           // Ctrl+C / text copy
        "paste",          // Ctrl+V
        "search",         // used search

        // Media
        "video_play",
        "video_pause",
        "video_complete",

        // Platform-specific
        "feature_use",    // used a platform feature (chat, job, challenge)
        "download_start", // started downloading a artifact
        "purchase",       // completed a token purchase
        "share",          // shared something
        "print_screen",   // user pressed PrintScreen key

        // Heartbeat
        "heartbeat",      // every 5s — proves user is alive & active
        "idle_start",     // user stopped interacting
        "idle_end",       // user resumed

        // Errors
        "js_error",       // JS error caught
        "api_error",      // API call failed
        "unhandled_rejection", // promise rejection
        
        // Advanced Telemetry
        "keystroke",
        "clipboard",
        "tab_activity",
        "device_metrics",
        "network_performance",
        "mouse_movement",
      ],
      index: true,
    },

    // Location context
    page: { type: String, index: true },     // pathname e.g. "/buttons/card-ui"
    section: { type: String },               // "hero", "pricing", "features"

    // Element context
    element: { type: String },               // CSS selector or element ID
    elementText: { type: String },           // visible text of element (max 200 chars)
    elementTag: { type: String },            // "button", "a", "input"

    // Position (for heatmaps)
    position: {
      x: { type: Number },                  // click x coordinate
      y: { type: Number },                  // click y coordinate
      xPercent: { type: Number },           // x as % of viewport width
      yPercent: { type: Number },           // y as % of viewport height
    },

    // Scroll context
    scrollDepth: { type: Number },           // % of page at time of event
    scrollY: { type: Number },               // pixels scrolled

    // Time context
    timeOnPage: { type: Number },            // ms since page loaded
    timestamp: { type: Date, default: Date.now, index: true },

    // Feature tracking
    featureName: { type: String },           // "chat", "marketplace", "jobs", etc.

    // Value / metadata
    value: { type: Schema.Types.Mixed },     // form values, search queries, etc.
    metadata: { type: Schema.Types.Mixed },  // extra context

    // Error tracking
    errorMessage: { type: String },
    errorStack: { type: String },

    // Infrastructure context
    country: { type: String },
    ip: { type: String },
  },
  {
    timestamps: true,
    // Auto-expire old events after 90 days (saves storage)
    expireAfterSeconds: 7776000, // 90 days
  }
);

// Compound indexes for admin queries
behaviorEventSchema.index({ sessionId: 1, timestamp: -1 });
behaviorEventSchema.index({ userId: 1, eventType: 1, timestamp: -1 });
behaviorEventSchema.index({ page: 1, eventType: 1 });
behaviorEventSchema.index({ eventType: 1, timestamp: -1 });
behaviorEventSchema.index({ "position.x": 1, "position.y": 1 }); // heatmap queries

const UserBehaviorEvent =
  mongoose.models.UserBehaviorEvent ||
  mongoose.model("UserBehaviorEvent", behaviorEventSchema, "userBehaviorEvents");

export default UserBehaviorEvent;

