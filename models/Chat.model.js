import mongoose from "mongoose";

const chatSchema = new mongoose.Schema({
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  isSupportChat: { type: Boolean, default: false },
  // Set for order collaboration rooms (one room per order)
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: "MarketOrder" },
  lastMessage: {
    content: String,
    sender: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    createdAt: Date
  },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

chatSchema.index({ participants: 1 });
chatSchema.index({ orderId: 1 }, { unique: true, sparse: true });

export default mongoose.models.Chat || mongoose.model("Chat", chatSchema);
