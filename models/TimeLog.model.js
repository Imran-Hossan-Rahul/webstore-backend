import mongoose from "mongoose";

const timeLogSchema = new mongoose.Schema({
  contract: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Contract",
    required: true
  },
  craftsman: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  startTime: {
    type: Date,
    required: true
  },
  endTime: {
    type: Date
  },
  duration: {
    type: Number, // In minutes
    default: 0
  },
  memo: {
    type: String,
    trim: true,
    required: true
  },
  // Upwork style segments (10-minute blocks)
  segments: [{
    timeSlot: Date, // Round to nearest 10m
    activityLevel: { type: Number, min: 0, max: 10, default: 0 }, 
    screenshots: [String], // Array for multi-monitor support
    activeWindow: String, // Foreground app title
    keyboardCount: { type: Number, default: 0 },
    mouseCount: { type: Number, default: 0 },
    capturedAt: Date
  }],
  status: {
    type: String,
    enum: ["active", "completed"],
    default: "active"
  }
}, { timestamps: true });

const TimeLog = mongoose.model("TimeLog", timeLogSchema);
export default TimeLog;
