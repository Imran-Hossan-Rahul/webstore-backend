import mongoose from "mongoose";

const collaborationRoomSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: String,
  craftsman: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  type: { type: String, enum: ["general", "devlog", "task"], default: "general" },
  relatedTask: { type: mongoose.Schema.Types.ObjectId, ref: "CommunityTask" },
  relatedDevlog: { type: mongoose.Schema.Types.ObjectId, ref: "Post" },
  isPublic: { type: Boolean, default: true },
  tags: [String],
  maxParticipants: { type: Number, default: 50 },
  lastActivity: { type: Date, default: Date.now }
}, { timestamps: true });

export default mongoose.model("CollaborationRoom", collaborationRoomSchema);

