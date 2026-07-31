import mongoose from "mongoose";

const PlatformProfileSchema = new mongoose.Schema({}, { strict: false, timestamps: true });

const PlatformProfile = mongoose.models.PlatformProfile || mongoose.model("PlatformProfile", PlatformProfileSchema);

export default PlatformProfile;
