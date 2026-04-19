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
    },

    // optional: connect visitor to actual user (later)
    linkedUser: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

const Visitor =
  mongoose.models.Visitor ||
  mongoose.model("Visitor", visitorSchema, "visitors");

export default Visitor;
