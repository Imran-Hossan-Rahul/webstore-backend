import mongoose from "mongoose";

const DiscussionSchema = new mongoose.Schema({}, { strict: false, timestamps: true });

const Discussion = mongoose.models.Discussion || mongoose.model("Discussion", DiscussionSchema);

export default Discussion;
