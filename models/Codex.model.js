import mongoose from "mongoose";

const CodexSchema = new mongoose.Schema({}, { strict: false, timestamps: true });

const Codex = mongoose.models.Codex || mongoose.model("Codex", CodexSchema);

export default Codex;
