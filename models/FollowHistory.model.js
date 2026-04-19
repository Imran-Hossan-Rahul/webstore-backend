import mongoose from "mongoose";

const followHistorySchema = new mongoose.Schema({
  follower: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true
  },
  following: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true
  },
  action: {
    type: String,
    enum: ["follow", "unfollow"],
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }
});

export default mongoose.model("FollowHistory", followHistorySchema);
