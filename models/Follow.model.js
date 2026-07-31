import mongoose from "mongoose";

const FollowSchema = new mongoose.Schema({}, { strict: false, timestamps: true });

const Follow = mongoose.models.Follow || mongoose.model("Follow", FollowSchema);

export default Follow;
