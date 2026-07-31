import mongoose from "mongoose";

const UserJourneySchema = new mongoose.Schema({}, { strict: false, timestamps: true });

const UserJourney = mongoose.models.UserJourney || mongoose.model("UserJourney", UserJourneySchema);

export default UserJourney;
