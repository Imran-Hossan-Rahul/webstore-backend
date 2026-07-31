import mongoose from "mongoose";

const FollowHistorySchema = new mongoose.Schema({}, { strict: false, timestamps: true });

const FollowHistory = mongoose.models.FollowHistory || mongoose.model("FollowHistory", FollowHistorySchema);

export default FollowHistory;
