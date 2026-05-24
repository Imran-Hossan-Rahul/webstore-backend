import mongoose from "mongoose";

const interactionSchema = new mongoose.Schema({
  targetId: { 
    type: mongoose.Schema.Types.ObjectId, 
    required: true,
    index: true 
  },
  targetType: { 
    type: String, 
    required: true, 
    enum: ["Artifact", "Codex", "Post", "User"],
    index: true
  },
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User",
    index: true
  },
  type: { 
    type: String, 
    required: true, 
    enum: ["view", "download", "share", "impression", "like"],
    index: true
  },
  actor: { 
    ip: String,
    userAgent: String,
    country: String,
    visitorId: String // For anonymous tracking
  },
  metadata: { 
    platform: String, // For shares (e.g., 'twitter', 'linkedin')
    referrer: String,
    duration: Number // For views/sessions if applicable
  },
  timestamp: { 
    type: Date, 
    default: Date.now,
    index: true
  }
}, { timestamps: false });

// Compound indexes for common queries
interactionSchema.index({ targetId: 1, type: 1, timestamp: -1 });
interactionSchema.index({ userId: 1, type: 1, timestamp: -1 });
interactionSchema.index({ type: 1, timestamp: -1 });

export default mongoose.model("Interaction", interactionSchema);
