import mongoose from "mongoose";

const ChallengeSchema = new mongoose.Schema({}, { strict: false, timestamps: true });

const Challenge = mongoose.models.Challenge || mongoose.model("Challenge", ChallengeSchema);

export default Challenge;
