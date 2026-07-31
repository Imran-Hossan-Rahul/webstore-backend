import mongoose from "mongoose";

const CommunityTaskSchema = new mongoose.Schema({}, { strict: false, timestamps: true });

const CommunityTask = mongoose.models.CommunityTask || mongoose.model("CommunityTask", CommunityTaskSchema);

export default CommunityTask;
