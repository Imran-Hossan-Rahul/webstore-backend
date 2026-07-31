import mongoose from "mongoose";

const InteractionSchema = new mongoose.Schema({}, { strict: false, timestamps: true });

const Interaction = mongoose.models.Interaction || mongoose.model("Interaction", InteractionSchema);

export default Interaction;
