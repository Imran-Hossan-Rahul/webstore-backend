// models/Visitor.js
import mongoose, { Schema } from "mongoose";

const visitorSchema = new Schema(
  {
    visitorId: { type: String, unique: true, index: true },

    firstVisit: { type: Date, default: Date.now },
    lastVisit: { type: Date, default: Date.now },

    device: { type: String },
    os: { type: String },
    browser: { type: String },
    userAgent: { type: String },
    ip: { type: String },

    location: {
      country: { type: String },
      city: { type: String },
      region: { type: String },
      countryCode: { type: String },
      timezone: { type: String },
    },

    // ===== Device Fingerprint =====
    screenResolution: { type: String },        // "1920x1080"
    screenColorDepth: { type: Number },        // 24
    language: { type: String },                // "en-US"
    languages: [{ type: String }],             // ["en-US","en","bn"]
    connectionType: { type: String },          // "4g","wifi","ethernet"
    touchSupport: { type: Boolean },
    cookiesEnabled: { type: Boolean },
    timezone: { type: String },                // "Asia/Dhaka"
    timezoneOffset: { type: Number },          // UTC offset in minutes
    platform: { type: String },                // "Win32","MacIntel","Linux x86_64"
    doNotTrack: { type: Boolean },
    hardwareConcurrency: { type: Number },     // CPU cores

    // ===== Behavioral Aggregates =====
    sessionCount: { type: Number, default: 0 },
    totalTimeSpentMs: { type: Number, default: 0 },
    totalPageViews: { type: Number, default: 0 },
    bounceCount: { type: Number, default: 0 },
    rageClickCount: { type: Number, default: 0 },
    exitIntentCount: { type: Number, default: 0 },
    lastPage: { type: String },
    maxScrollDepth: { type: Number, default: 0 },

    // ===== UTM & Referral =====
    landingPath: { type: String },
    referrer: { type: String },
    utm: {
      source: String,
      medium: String,
      campaign: String,
      term: String,
      content: String,
    },

    // Link to registered user
    linkedUser: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

// Indexes for fast admin queries
visitorSchema.index({ lastVisit: -1 });
visitorSchema.index({ "location.country": 1 });
visitorSchema.index({ linkedUser: 1 });
visitorSchema.index({ sessionCount: -1 });
visitorSchema.index({ createdAt: -1 });

const Visitor =
  mongoose.models.Visitor ||
  mongoose.model("Visitor", visitorSchema, "visitors");

export default Visitor;
