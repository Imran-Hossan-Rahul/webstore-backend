import mongoose from "mongoose";

const commentSchema = new mongoose.Schema(
  {
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    blog: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Blog",
      required: false, // Changed from true
      index: true,
    },
    post: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Post",
        required: false,
        index: true,
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    likes: { type: Number, default: 0 },
    likedBy: [{ type: String }],
    parentComment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Comment",
      default: null,
      index: true,
    },
    feedbackType: {
        type: String,
        enum: ['comment', 'issue', 'suggestion', 'kudos', 'question', 'answer', 'critique'],
        default: 'comment',
    },
    isPinned: {
        type: Boolean,
        default: false,
    },
    isHelpful: {
        type: Boolean,
        default: false,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

commentSchema.index({ blog: 1, createdAt: -1 });

export default mongoose.models.Comment || mongoose.model("Comment", commentSchema);
