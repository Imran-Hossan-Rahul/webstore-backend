// models/Session.js
import mongoose, { Schema } from "mongoose";

const sessionSchema = new Schema(
  {
    sessionId: { type: String, unique: true, index: true },

    visitorId: { type: String, index: true },

    landingPage: String,
    referrer: String,

    utm: {
      source: String,
      medium: String,
      campaign: String,
      term: String,
      content: String,
    },

    device: String,
    browser: String,
    os: String,

    ip: String,

    startedAt: { type: Date, default: Date.now },
    endedAt: { type: Date },
    duration: { type: Number }, // ms

    pageViews: { type: Number, default: 1 },
  },
  { timestamps: true }
);

const Session =
  mongoose.models.Session ||
  mongoose.model("Session", sessionSchema, "sessions");

export default Session;
