import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema({
  targetId: { 
    type: mongoose.Schema.Types.ObjectId, 
    required: true,
    index: true 
  },
  targetType: { 
    type: String, 
    required: true, 
    enum: ["User", "Artifact", "Codex", "System"],
    index: true
  },
  actorId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User",
    index: true
  },
  action: { 
    type: String, 
    required: true,
    index: true
  },
  status: { 
    type: String, 
    enum: ["success", "failure", "warning"],
    default: "success"
  },
  details: { 
    type: mongoose.Schema.Types.Mixed 
  },
  ip: String,
  userAgent: String,
  timestamp: { 
    type: Date, 
    default: Date.now,
    index: true
  }
}, { timestamps: false });

// TTL Index: Keep audit logs for 90 days (can be adjusted for enterprise compliance)
auditLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

export default mongoose.model("AuditLog", auditLogSchema);
