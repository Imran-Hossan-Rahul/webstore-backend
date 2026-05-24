import mongoose from "mongoose";

const activitySchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  type: {
    type: String,
    enum: [
      "working_on_devlog",
      "sharing_task",
      "solving_problem",
      "joined_collaboration",
      "completed_task",
      "started_chatting",
      "created_post",
      "updated_profile"
    ],
    required: true
  },
  title: { type: String, required: true }, // e.g., "Working on Landing Page Design"
  description: String,
  devlogId: { type: mongoose.Schema.Types.ObjectId, ref: "Post" }, // if related to a devlog
  taskId: { type: mongoose.Schema.Types.ObjectId, ref: "CommunityTask" }, // if related to a task
  roomId: { type: mongoose.Schema.Types.ObjectId, ref: "CollaborationRoom" }, // if related to a room
  metadata: { type: mongoose.Schema.Types.Mixed }, // additional data
  isActive: { type: Boolean, default: true }, // for real-time status
  expiresAt: { type: Date, default: () => new Date(Date.now() + 24 * 60 * 60 * 1000) } // auto expire after 24 hours
}, { timestamps: true });

// Index for efficient queries
activitySchema.index({ user: 1, createdAt: -1 });
activitySchema.index({ isActive: 1, createdAt: -1 });
activitySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index

export default mongoose.model("Activity", activitySchema);

