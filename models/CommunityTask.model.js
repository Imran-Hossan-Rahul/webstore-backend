import mongoose from "mongoose";

const solutionSchema = new mongoose.Schema({
  author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  content: { type: String, required: true },
  type: { type: String, enum: ["solution", "suggestion", "question"], default: "solution" },
  attachments: [{
    type: { type: String, enum: ["image", "file", "link"] },
    url: String,
    name: String
  }],
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  isAccepted: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

const communityTaskSchema = new mongoose.Schema({
  creator: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  category: {
    type: String,
    enum: [
      "design",
      "development",
      "ui/ux",
      "frontend",
      "backend",
      "fullstack",
      "mobile",
      "marketing",
      "business",
      "other"
    ],
    required: true
  },
  tags: [String],
  priority: { type: String, enum: ["low", "medium", "high", "urgent"], default: "medium" },
  status: {
    type: String,
    enum: ["open", "in_progress", "solved", "closed"],
    default: "open"
  },
  solutions: [solutionSchema],
  collaborators: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  watchers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  attachments: [{
    type: { type: String, enum: ["image", "file", "link"] },
    url: String,
    name: String
  }],
  isPublic: { type: Boolean, default: true },
  bounty: {
    amount: Number,
    currency: { type: String, default: "USD" },
    isActive: { type: Boolean, default: false }
  },
  metadata: { type: mongoose.Schema.Types.Mixed }, // additional data
  expiresAt: { type: Date, default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) } // 30 days
}, { timestamps: true });

// Indexes for efficient queries
communityTaskSchema.index({ creator: 1, createdAt: -1 });
communityTaskSchema.index({ category: 1, status: 1, createdAt: -1 });
communityTaskSchema.index({ tags: 1 });
communityTaskSchema.index({ status: 1, createdAt: -1 });
communityTaskSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index

export default mongoose.model("CommunityTask", communityTaskSchema);
