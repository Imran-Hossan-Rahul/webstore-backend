import mongoose from "mongoose";

const followSchema = new mongoose.Schema({
  follower: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  following: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

// Ensure a user can only follow another user once
followSchema.index({ follower: 1, following: 1 }, { unique: true });
followSchema.index({ following: 1 }); // Efficient lookup of followers
followSchema.index({ follower: 1 });  // Efficient lookup of following

export default mongoose.model("Follow", followSchema);
