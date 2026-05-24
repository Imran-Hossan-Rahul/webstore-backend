import mongoose from "mongoose";

const chatSchema = new mongoose.Schema({
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  lastMessage: {
    content: String,
    sender: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    createdAt: Date
  },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

chatSchema.index({ participants: 1 });

export default mongoose.model("Chat", chatSchema);
