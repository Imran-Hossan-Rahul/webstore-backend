import mongoose from "mongoose";

const messageSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  content: { type: String, required: true },
  type: { type: String, enum: ["text", "image", "file"], default: "text" },
  fileUrl: String,
  fileName: String,
  read: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

const chatSchema = new mongoose.Schema({
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  messages: [messageSchema],
  lastMessage: {
    content: String,
    sender: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    createdAt: Date
  },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

chatSchema.index({ participants: 1 });
chatSchema.index({ "messages.createdAt": -1 });

export default mongoose.model("Chat", chatSchema);
