import mongoose from "mongoose";

const ArtifactSchema = new mongoose.Schema({}, { strict: false, timestamps: true });

const Artifact = mongoose.models.Artifact || mongoose.model("Artifact", ArtifactSchema);

export default Artifact;
