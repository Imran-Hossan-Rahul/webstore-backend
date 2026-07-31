import mongoose from "mongoose";

const chatSchema = new mongoose.Schema({
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  isSupportChat: { type: Boolean, default: false },
  lastMessage: {
    content: String,
    sender: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    createdAt: Date
  },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

chatSchema.index({ participants: 1 });

export default mongoose.models.Chat || mongoose.model("Chat", chatSchema);
