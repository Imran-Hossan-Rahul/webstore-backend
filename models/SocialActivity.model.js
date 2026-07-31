import mongoose from "mongoose";

const SocialActivitySchema = new mongoose.Schema({}, { strict: false, timestamps: true });

const SocialActivity = mongoose.models.SocialActivity || mongoose.model("SocialActivity", SocialActivitySchema);

export default SocialActivity;
