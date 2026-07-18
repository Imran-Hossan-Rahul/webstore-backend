import mongoose from "mongoose";

const commentSchema = new mongoose.Schema(
  {
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    codex: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Codex",
      required: false, // Changed from true
      index: true,
    },
    post: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Post",
        required: false,
        index: true,
    },
    artifact: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Artifact",
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

commentSchema.index({ codex: 1, createdAt: -1 });
// ✅ OPTIMIZATION: Added missing compound indexes for comment listing
commentSchema.index({ artifact: 1, createdAt: -1 }); // getArtifactComments — was full scan!
commentSchema.index({ post: 1, createdAt: -1 });      // getPostComments

export default mongoose.models.Comment || mongoose.model("Comment", commentSchema);



