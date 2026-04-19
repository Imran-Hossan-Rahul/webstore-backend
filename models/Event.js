import mongoose, { Schema } from "mongoose";

const eventSchema = new Schema(
  {
    sessionId: { type: String, index: true }, // sessionId সরাসরি save
    session: { type: mongoose.Schema.Types.ObjectId, ref: "Session" }, // populate করার জন্য
    visitor: { type: mongoose.Schema.Types.ObjectId, ref: "Visitor" },
    visitorId: { type: String, index: true },

    eventType: {
      type: String,
      enum: ["pageview", "click", "scroll", "signup_click", "custom"],
      required: true,
    },

    page: String,
    element: String,
    value: Schema.Types.Mixed,

    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

const Event =
  mongoose.models.Event || mongoose.model("Event", eventSchema, "events");

export default Event;
