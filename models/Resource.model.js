import mongoose from "mongoose";

const ResourceSchema = new mongoose.Schema({}, { strict: false, timestamps: true });

const Resource = mongoose.models.Resource || mongoose.model("Resource", ResourceSchema);

export default Resource;
