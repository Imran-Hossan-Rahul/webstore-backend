import mongoose from "mongoose";

const messageSchema = new mongoose.Schema({
  author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  content: { type: String },
  attachments: [{
    type: { type: String, enum: ["image", "video", "file"] },
    url: String,
    name: String,
    size: Number
  }],
  replyTo: { type: mongoose.Schema.Types.ObjectId, ref: "Discussion.messages" },
  replies: [{ type: mongoose.Schema.Types.ObjectId }],
  readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  createdAt: { type: Date, default: Date.now }
}, { _id: true });

const discussionSchema = new mongoose.Schema({
  craftsman: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  topic: { type: String, required: true },
  description: { type: String },
  category: { 
    type: String, 
    enum: ["general", "technical", "design", "business", "feedback", "announcement"],
    default: "general"
  },
  tags: [String],
  messages: [messageSchema],
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  isActive: { type: Boolean, default: true },
  isPinned: { type: Boolean, default: false },
  messageCount: { type: Number, default: 0 }
}, { timestamps: true });

discussionSchema.pre('save', function(next) {
  this.messageCount = this.messages.length;
  next();
});

discussionSchema.index({ craftsman: 1, createdAt: -1 });
discussionSchema.index({ isActive: 1, createdAt: -1 });
discussionSchema.index({ messageCount: -1 });

export default mongoose.model("Discussion", discussionSchema);
