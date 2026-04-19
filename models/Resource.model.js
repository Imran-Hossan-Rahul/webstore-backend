import mongoose from "mongoose";

const resourceSchema = new mongoose.Schema({
  creator: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  category: {
    type: String,
    enum: [
      "design",
      "code",
      "ui-kit",
      "template",
      "icon",
      "font",
      "mockup",
      "tutorial",
      "tool",
      "other"
    ],
    required: true
  },
  type: {
    type: String,
    enum: ["file", "link"],
    required: true
  },
  fileUrl: String,
  externalLink: String,
  previewImage: String,
  tags: [String],
  isPaid: { type: Boolean, default: false },
  price: { type: Number, default: 0 },
  downloads: { type: Number, default: 0 },
  views: { type: Number, default: 0 },
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  likesCount: { type: Number, default: 0 },
  bookmarks: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  rating: {
    average: { type: Number, default: 0 },
    count: { type: Number, default: 0 }
  },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

resourceSchema.index({ creator: 1, createdAt: -1 });
resourceSchema.index({ category: 1, isActive: 1 });
resourceSchema.index({ tags: 1 });
resourceSchema.index({ downloads: -1 });
resourceSchema.index({ likesCount: -1 });

export default mongoose.model("Resource", resourceSchema);
