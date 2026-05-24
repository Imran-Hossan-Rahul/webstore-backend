import mongoose from "mongoose";

const reactionSchema = new mongoose.Schema({
  emoji: { type: String, required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
}, { _id: false });

const messageSchema = new mongoose.Schema({
  chatId: { type: mongoose.Schema.Types.ObjectId, ref: "Chat", required: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  
  content: { type: String, required: function() { return !this.isUnsent && this.type === 'text'; } },
  type: { type: String, enum: ["text", "image", "file", "video", "audio"], default: "text" },
  
  fileUrl: { type: String },
  fileName: { type: String },
  fileSize: { type: Number },
  
  isUnsent: { type: Boolean, default: false },
  
  reactions: [reactionSchema],
  
  readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  deliveredTo: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  deletedFor: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  
  replyTo: { type: mongoose.Schema.Types.ObjectId, ref: "Message" }
}, { timestamps: true });

messageSchema.index({ chatId: 1, createdAt: 1 });
messageSchema.index({ sender: 1 });

export default mongoose.model("Message", messageSchema);
